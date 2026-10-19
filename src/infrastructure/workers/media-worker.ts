// Media Worker (editor-de-cartas.md §18, §21; runtime pipeline de importação): valida assinatura, tamanho e
// dimensões ANTES de decodificar; decodifica com orientação normalizada (imageOrientation: from-image),
// regrava o master sem metadados (PNG; WebP se o PNG passar do limite), limita o lado maior, gera miniatura
// e calcula o SHA-256 que vira o assetId. Máscaras viram tons de cinza (luminância), dados — não sRGB de arte.
// O recorte/espelhamento são parâmetros não destrutivos da impressão (crop + artTransform), nunca aplicados aqui.
import { ART_LIMITS, fitWithin, maskCoverage, sniffImage, toMaskPixels } from '../../domain/editor/media.ts';
import type { MediaAsset, MediaRequest, MediaResponse } from './media-protocol.ts';

type WorkerScope = {
  onmessage: ((event: MessageEvent<MediaRequest>) => void) | null;
  postMessage: (message: MediaResponse, transfer?: Transferable[]) => void;
};

const scope = globalThis as unknown as WorkerScope;

class MediaFailure extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function encode(canvas: OffscreenCanvas, maxBytes: number): Promise<{ mediaType: 'image/png' | 'image/webp'; bytes: Uint8Array }> {
  const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
  if (png.length <= maxBytes) return { mediaType: 'image/png', bytes: png };
  const webp = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/webp', quality: 0.92 })).arrayBuffer());
  if (webp.length <= maxBytes) return { mediaType: 'image/webp', bytes: webp };
  throw new MediaFailure('IMAGE_TOO_LARGE', 'Mesmo normalizada, a imagem passa do limite de 10 MiB.');
}

async function decode(bytes: Uint8Array): Promise<{ bitmap: ImageBitmap; mediaType: string; width: number; height: number }> {
  const sniff = sniffImage(bytes);
  if (!sniff.ok) throw new MediaFailure(sniff.code, sniff.message);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as unknown as BlobPart], { type: sniff.mediaType }), { imageOrientation: 'from-image', premultiplyAlpha: 'none' });
  } catch {
    throw new MediaFailure('IMAGE_CORRUPT', 'A imagem não pôde ser decodificada (arquivo corrompido ou incompleto).');
  }
  // Pós-decodificação: a orientação EXIF pode trocar eixos; os limites continuam valendo.
  if (bitmap.width > ART_LIMITS.maxAxis || bitmap.height > ART_LIMITS.maxAxis || bitmap.width * bitmap.height > ART_LIMITS.maxPixels) {
    bitmap.close();
    throw new MediaFailure('IMAGE_TOO_LARGE', 'Dimensões decodificadas acima do limite.');
  }
  return { bitmap, mediaType: sniff.mediaType, width: bitmap.width, height: bitmap.height };
}

function draw(bitmap: ImageBitmap, width: number, height: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d');
  if (!g) throw new MediaFailure('CANVAS_UNAVAILABLE', 'Canvas 2D indisponível no worker.');
  g.imageSmoothingQuality = 'high';
  g.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

async function asset(canvas: OffscreenCanvas): Promise<MediaAsset> {
  const encoded = await encode(canvas, ART_LIMITS.maxBytes);
  return { assetId: await sha256(encoded.bytes), mediaType: encoded.mediaType, bytes: encoded.bytes, width: canvas.width, height: canvas.height };
}

async function importArt(bytes: Uint8Array) {
  const { bitmap, mediaType, width, height } = await decode(bytes);
  try {
    const size = fitWithin(width, height, ART_LIMITS.masterMaxAxis);
    const master = await asset(draw(bitmap, size.width, size.height));
    const t = fitWithin(width, height, ART_LIMITS.thumbnailAxis);
    const thumbCanvas = draw(bitmap, t.width, t.height);
    const thumb = new Uint8Array(await (await thumbCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 })).arrayBuffer());
    return {
      master, thumbnail: { mediaType: 'image/webp', bytes: thumb, width: t.width, height: t.height },
      source: { mediaType, width, height, bytes: bytes.length }, resized: size.width !== width || size.height !== height,
    };
  } finally {
    bitmap.close();
  }
}

async function maskFromRgba(rgba: Uint8ClampedArray, width: number, height: number) {
  const gray = toMaskPixels(rgba);
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d');
  if (!g) throw new MediaFailure('CANVAS_UNAVAILABLE', 'Canvas 2D indisponível no worker.');
  g.putImageData(new ImageData(gray as unknown as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  return { mask: await asset(canvas), coverage: maskCoverage(gray) };
}

async function importMask(bytes: Uint8Array, width: number, height: number) {
  const { bitmap } = await decode(bytes);
  try {
    const canvas = draw(bitmap, width, height);
    const g = canvas.getContext('2d')!;
    return await maskFromRgba(g.getImageData(0, 0, width, height).data, width, height);
  } finally {
    bitmap.close();
  }
}

function transferOf(message: MediaResponse): Transferable[] {
  if (!message.ok) return [];
  if (message.op === 'IMPORT_ART') return [message.result.master.bytes.buffer as ArrayBuffer, message.result.thumbnail.bytes.buffer as ArrayBuffer];
  return [message.result.mask.bytes.buffer as ArrayBuffer];
}

scope.onmessage = (event) => {
  const req = event.data;
  const run = async (): Promise<MediaResponse> => {
    try {
      switch (req.op) {
        case 'IMPORT_ART': return { id: req.id, ok: true, op: req.op, result: await importArt(new Uint8Array(req.bytes)) };
        case 'IMPORT_MASK': return { id: req.id, ok: true, op: req.op, result: await importMask(new Uint8Array(req.bytes), req.width, req.height) };
        case 'MASK_FROM_PIXELS': {
          const expected = req.width * req.height * 4;
          if (req.rgba.byteLength !== expected || req.width < 1 || req.height < 1 || req.width > 2048 || req.height > 2048) throw new MediaFailure('MASK_INVALID', 'Máscara pintada com dimensões inválidas.');
          return { id: req.id, ok: true, op: req.op, result: await maskFromRgba(new Uint8ClampedArray(req.rgba), req.width, req.height) };
        }
        default: throw new MediaFailure('MEDIA_OP_UNKNOWN', 'Operação desconhecida.');
      }
    } catch (error) {
      if (error instanceof MediaFailure) return { id: req.id, ok: false, code: error.code, message: error.message };
      return { id: req.id, ok: false, code: 'MEDIA_FAILED', message: error instanceof Error ? error.message : String(error) };
    }
  };
  void run().then((message) => scope.postMessage(message, transferOf(message)));
};

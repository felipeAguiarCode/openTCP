// Cliente do Media Worker: um worker dedicado por sessão do Estúdio, requisições com ID e bytes
// transferidos (sem cópia). A verificação de assinatura/tamanho roda também aqui antes de enviar, para
// recusar cedo arquivos enormes sem consumir memória do worker (§32 “Imagem excessiva”).
import { ART_LIMITS, sniffImage } from '../../domain/editor/media.ts';
import type { ArtImport, MaskImport, MediaError, MediaRequest, MediaResponse } from './media-protocol.ts';

export type MediaClient = {
  readonly importArt: (file: Blob) => Promise<({ readonly ok: true } & ArtImport) | MediaError>;
  readonly importMask: (file: Blob, width: number, height: number) => Promise<({ readonly ok: true } & MaskImport) | MediaError>;
  readonly maskFromPixels: (rgba: Uint8ClampedArray, width: number, height: number) => Promise<({ readonly ok: true } & MaskImport) | MediaError>;
  readonly dispose: () => void;
};

type Pending = { resolve: (r: MediaResponse) => void };

/** Lê só o necessário para a assinatura/cabeçalho antes de carregar o arquivo inteiro. */
async function precheck(file: Blob): Promise<MediaError | null> {
  if (file.size > ART_LIMITS.maxBytes) return { ok: false, code: 'IMAGE_TOO_LARGE', message: `Arquivo com ${(file.size / 1048576).toFixed(1)} MiB; o limite é 10 MiB.` };
  const head = new Uint8Array(await file.slice(0, Math.min(file.size, 256 * 1024)).arrayBuffer());
  const sniff = sniffImage(head, { maxBytes: Number.MAX_SAFE_INTEGER });
  // JPEG pode ter o SOF depois de 256 KiB (miniaturas EXIF): nesse caso o worker confere com o arquivo inteiro.
  if (!sniff.ok && !(sniff.code === 'IMAGE_CORRUPT' && head[0] === 0xff && head[1] === 0xd8)) return { ok: false, code: sniff.code, message: sniff.message };
  return null;
}

export function createMediaClient(): MediaClient {
  let worker: Worker | null = null;
  let seq = 0;
  const pending = new Map<number, Pending>();
  const ensure = (): Worker => {
    if (worker) return worker;
    worker = new Worker(new URL('./media-worker.ts', import.meta.url), { type: 'module', name: 'card-studio-media' });
    worker.onmessage = (event: MessageEvent<MediaResponse>) => {
      const p = pending.get(event.data.id);
      if (!p) return;
      pending.delete(event.data.id);
      p.resolve(event.data);
    };
    worker.onerror = () => {
      for (const [id, p] of pending) p.resolve({ id, ok: false, code: 'MEDIA_WORKER_FAILED', message: 'O processador de imagens falhou; a arte anterior foi mantida.' });
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  };
  const send = (build: (id: number) => MediaRequest, transfer: Transferable[]): Promise<MediaResponse> => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, { resolve });
    try {
      ensure().postMessage(build(id), transfer);
    } catch (error) {
      pending.delete(id);
      resolve({ id, ok: false, code: 'MEDIA_WORKER_FAILED', message: error instanceof Error ? error.message : String(error) });
    }
  });
  return {
    importArt: async (file) => {
      const blocked = await precheck(file);
      if (blocked) return blocked;
      const bytes = await file.arrayBuffer();
      const r = await send((id) => ({ id, op: 'IMPORT_ART', bytes }), [bytes]);
      return r.ok && r.op === 'IMPORT_ART' ? { ok: true, ...r.result } : r.ok ? { ok: false, code: 'MEDIA_FAILED', message: 'Resposta inesperada.' } : { ok: false, code: r.code, message: r.message };
    },
    importMask: async (file, width, height) => {
      const blocked = await precheck(file);
      if (blocked) return blocked;
      const bytes = await file.arrayBuffer();
      const r = await send((id) => ({ id, op: 'IMPORT_MASK', bytes, width, height }), [bytes]);
      return r.ok && r.op !== 'IMPORT_ART' ? { ok: true, ...r.result } : r.ok ? { ok: false, code: 'MEDIA_FAILED', message: 'Resposta inesperada.' } : { ok: false, code: r.code, message: r.message };
    },
    maskFromPixels: async (rgba, width, height) => {
      const copy = rgba.slice().buffer;
      const r = await send((id) => ({ id, op: 'MASK_FROM_PIXELS', rgba: copy, width, height }), [copy]);
      return r.ok && r.op !== 'IMPORT_ART' ? { ok: true, ...r.result } : r.ok ? { ok: false, code: 'MEDIA_FAILED', message: 'Resposta inesperada.' } : { ok: false, code: r.code, message: r.message };
    },
    dispose: () => {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
  };
}

// Fábrica de texturas Canvas (frente, verso, Energia, genéricas) com cache LRU por hash do conteúdo.
// Texturas de cor em sRGB; máscaras/dados nunca passam por aqui (runtime §16.1).
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, type Texture } from 'three';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { RenderSystem } from '../core/render-system.ts';
import { estimateTextureBytes } from '../core/resources.ts';
import { hash53 } from '../core/rng.ts';
import { QUALITY_PROFILES } from '../core/quality.ts';
import { COLORS } from '../core/tokens.ts';
import { cardFontTag } from './fonts.ts';
import { drawCardFace, templateKindOf, type SleeveStyle } from './face-canvas.ts';
import { drawEnergySymbol } from './glyphs.ts';
import { energyOrbImage, energyOrbsTag, loadEnergyOrbs } from './energy-orbs.ts';
import { cardBackTag, drawCardBack, loadCardBack } from './card-back.ts';
import { printedArt } from './printed-art.ts';
import { loadSleeveArt, sleeveArtImage } from './sleeve-art.ts';

export type FaceResolution = 'STANDARD' | 'HIGH';

export type TextureLease = { readonly key: string; readonly texture: Texture };

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function canvasTexture(canvas: HTMLCanvasElement, anisotropy: number, mipmaps = true): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.generateMipmaps = mipmaps;
  texture.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Textura desenhada sob demanda e compartilhada por chave (contagem de referências + LRU). */
export function acquireCanvasTexture(rs: RenderSystem, key: string, width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, mipmaps = true): TextureLease {
  const texture = rs.textures.acquire(key, () => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    draw(ctx, canvas.width, canvas.height);
    return canvasTexture(canvas, rs.anisotropy(), mipmaps);
  }, estimateTextureBytes(width, height, mipmaps));
  return { key, texture };
}

export function releaseTexture(rs: RenderSystem, lease: TextureLease | null): void {
  if (lease) rs.textures.release(lease.key);
}

export function faceSize(rs: RenderSystem, resolution: FaceResolution): [number, number] {
  if (resolution === 'HIGH') return [1000, 1400];
  const [w, h] = QUALITY_PROFILES[rs.quality()].cardTexture;
  return [w, h];
}

/** Chave estável: hash dos dados da face + template + resolução + fonte efetiva + estado da Impressão completa. */
export function faceTextureKey(face: CardFaceData, width: number, height: number, printedTag = 'none'): string {
  return `face:${templateKindOf(face)}:${hash53(JSON.stringify(face))}:${width}x${height}:${cardFontTag()}:${printedTag}`;
}

export function acquireFaceTexture(rs: RenderSystem, face: CardFaceData, resolution: FaceResolution = 'STANDARD'): TextureLease {
  const [w, h] = faceSize(rs, resolution);
  const printed = printedArt(face);
  return acquireCanvasTexture(rs, faceTextureKey(face, w, h, printed.tag), w, h, (ctx, cw, ch) => drawCardFace(ctx, face, cw, ch, printed.image));
}

export function sleeveKey(sleeve?: SleeveStyle): string {
  // Sleeve do Pocket já carregado: a imagem dele; senão o verso padrão (arte fornecida pelo autor).
  return sleeveArtImage(sleeve?.assetKey) ? `sleeve-art:${sleeve!.assetKey}` : `card-back:${cardBackTag()}`;
}

/**
 * Verso das cartas: a imagem do sleeve do Pocket equipado no deck (cantos já transparentes) ou, sem ela ou enquanto
 * carrega, a arte padrão `card-back.webp`. HIGH (inspector/abertura) desenha em 600×840 para não borrar em tela cheia.
 */
export function acquireSleeveTexture(rs: RenderSystem, sleeve: SleeveStyle, resolution: FaceResolution = 'STANDARD'): TextureLease {
  void loadCardBack();
  void loadSleeveArt(sleeve.assetKey);
  const [w, h] = resolution === 'HIGH' ? [600, 840] : [300, 420];
  const art = sleeveArtImage(sleeve.assetKey);
  return acquireCanvasTexture(rs, `${sleeveKey(sleeve)}:${w}`, w, h, (ctx, cw, ch) => {
    if (!art) { drawCardBack(ctx, cw, ch); return; }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(art, 0, 0, cw, ch);
  });
}

/**
 * Ficha de Energia ligada: a bola do tipo (arte do atlas; desenho procedural enquanto carrega ou para tipos sem bola);
 * contagem agrupada (> 4) e próxima esmaecida.
 */
export function acquireEnergyTexture(rs: RenderSystem, type: string, options: { count?: number; dim?: boolean } = {}): TextureLease {
  void loadEnergyOrbs();
  const count = options.count ?? 1;
  const key = `energy:${type}:${count}:${options.dim ? 'dim' : 'on'}:${energyOrbsTag()}`;
  return acquireCanvasTexture(rs, key, 128, 128, (ctx, w) => {
    const s = w / 128;
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.arc(64, 66, 58, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100,125,154,0.28)';
    ctx.fill();
    const orb = energyOrbImage(type);
    if (orb) {
      ctx.save();
      if (options.dim) ctx.globalAlpha = 0.45;
      ctx.drawImage(orb, 64 - 56, 62 - 56, 112, 112);
      ctx.restore();
    } else drawEnergySymbol(ctx, type, 64, 62, 56, { dim: options.dim ?? false });
    if (options.dim) {
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(64, 62, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (count > 1) {
      ctx.beginPath();
      ctx.arc(100, 98, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.line;
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.font = `900 28px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`×${count}`, 100, 99);
    }
  });
}

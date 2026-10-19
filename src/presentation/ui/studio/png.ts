// “Exportar imagem” (editor-de-cartas.md §29, ED-063): desenha a face da carta num Canvas 2D a partir de
// CardFaceData + arte local, no mesmo vocabulário do template HTML pocket-light-card-v1. É só imagem de
// apresentação (com selo), nunca uma carta jogável importável. Fonte OFL empacotada (Nunito), sem rede.
import type { CardFaceData } from '../../../domain/cards/text.ts';
import { TYPE_LABEL } from '../../../domain/cards/text.ts';
import type { CardPrinting, PokemonType } from '../../../domain/cards/types.ts';

const W = 630;
const H = 880;

const TYPE_COLOR: Record<string, string> = {
  GRASS: '#72B75D', FIRE: '#EF785B', WATER: '#60ADE7', LIGHTNING: '#E8C83E', PSYCHIC: '#A279CB', FIGHTING: '#C48D61', DARKNESS: '#536A80',
  METAL: '#A2B1BC', DRAGON: '#B8A65D', COLORLESS: '#BAC5D0',
};
const STRIP_COLOR: Record<string, string> = {
  GRASS: '#4B823A', FIRE: '#D83B15', WATER: '#1D79BF', LIGHTNING: '#8A7310', PSYCHIC: '#8F5EC0', FIGHTING: '#A0683C', DARKNESS: '#475B6D',
  METAL: '#627888', DRAGON: '#837439', COLORLESS: '#61778E',
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) {
      if (lines === maxLines - 1) { g.fillText(`${line}…`, x, y + lines * lineHeight); return lines + 1; }
      g.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
    } else line = test;
  }
  if (line) { g.fillText(line, x, y + lines * lineHeight); lines += 1; }
  return lines;
}

function typeDot(g: CanvasRenderingContext2D, type: string, cx: number, cy: number, r: number): void {
  g.fillStyle = TYPE_COLOR[type] ?? '#BAC5D0';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 2;
  g.stroke();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawArt(g: CanvasRenderingContext2D, img: HTMLImageElement, printing: CardPrinting, x: number, y: number, w: number, h: number): void {
  const c = printing.crop;
  const t = printing.artTransform;
  const sx = c.x * img.naturalWidth;
  const sy = c.y * img.naturalHeight;
  const sw = Math.max(1, c.width * img.naturalWidth);
  const sh = Math.max(1, c.height * img.naturalHeight);
  g.save();
  roundRect(g, x, y, w, h, 12);
  g.clip();
  g.translate(x + w / 2 + t.offsetX * w * 0.5, y + h / 2 + t.offsetY * h * 0.5);
  g.rotate((t.rotationDegrees * Math.PI) / 180);
  // Espelha só a ilustração (ED-042): a transformação termina antes dos textos.
  g.scale(t.mirrorIllustration ? -t.scale : t.scale, t.scale);
  if (t.exposure) g.filter = `brightness(${Math.max(0, 1 + t.exposure)})`;
  const scale = Math.max(w / sw, h / sh);
  g.drawImage(img, sx, sy, sw, sh, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale);
  g.restore();
}

export async function renderCardPng(face: CardFaceData, printing: CardPrinting, artUrl: string | null): Promise<Blob> {
  try { await document.fonts?.load('800 32px Nunito'); } catch { /* fonte local ausente: usa a do sistema */ }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D indisponível.');
  const toPng = () => new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG.'))), 'image/png'));
  // Impressão completa: a imagem já é a carta inteira; nada do template é desenhado por cima.
  const printed = printing.artMode === 'FULL_PRINTING' && artUrl ? await loadImage(artUrl) : null;
  if (printed) {
    roundRect(g, 0, 0, W, H, 30);
    g.clip();
    drawArt(g, printed, printing, 0, 0, W, H);
    return toPng();
  }
  const type = (face.types[0] ?? 'COLORLESS') as PokemonType;
  const font = (weight: number, size: number) => `${weight} ${size}px Nunito, system-ui, sans-serif`;
  // Borda clara e corpo tingido pelo tipo.
  roundRect(g, 0, 0, W, H, 30);
  const border = g.createLinearGradient(0, 0, W, H);
  border.addColorStop(0, '#fbfdff'); border.addColorStop(0.55, '#dfe8f1'); border.addColorStop(1, '#f6f9fc');
  g.fillStyle = border;
  g.fill();
  roundRect(g, 22, 22, W - 44, H - 44, 20);
  const body = g.createLinearGradient(0, 22, 0, H - 22);
  const tint = face.category === 'TRAINER' ? '#eef2f7' : `${TYPE_COLOR[type] ?? '#BAC5D0'}44`;
  body.addColorStop(0, tint); body.addColorStop(1, '#ffffff');
  g.fillStyle = body;
  g.fill();
  const img = artUrl ? await loadImage(artUrl) : null;
  if (img && printing.artMode === 'FULL_ART') drawArt(g, img, printing, 22, 22, W - 44, H - 44);
  // Cabeçalho.
  g.fillStyle = '#4a5f77';
  g.font = font(700, 20);
  g.fillText(face.subtitle + (face.evolvesFromName ? ` · de ${face.evolvesFromName}` : ''), 44, 58);
  g.fillStyle = '#1f3044';
  g.font = font(800, 36);
  g.fillText(face.name, 44, 100, 400);
  if (face.hp !== null) {
    g.font = font(800, 34);
    g.textAlign = 'right';
    g.fillText(`PS ${face.hp}`, W - 92, 100);
    g.textAlign = 'left';
  }
  if (face.types[0]) typeDot(g, face.types[0], W - 64, 89, 18);
  // Janela de arte.
  const art = { x: 44, y: 120, w: W - 88, h: 320 };
  roundRect(g, art.x, art.y, art.w, art.h, 12);
  const artBg = g.createLinearGradient(art.x, art.y, art.x + art.w, art.y + art.h);
  artBg.addColorStop(0, '#ffffff'); artBg.addColorStop(1, face.category === 'TRAINER' ? '#9fb3c7' : (TYPE_COLOR[type] ?? '#BAC5D0'));
  g.fillStyle = artBg;
  g.fill();
  if (img && printing.artMode === 'ART_WINDOW') drawArt(g, img, printing, art.x, art.y, art.w, art.h);
  g.strokeStyle = '#f4f8ff';
  g.lineWidth = 6;
  roundRect(g, art.x, art.y, art.w, art.h, 12);
  g.stroke();
  // Corpo.
  let y = 480;
  const maxW = W - 100;
  for (const a of face.abilities) {
    g.fillStyle = '#b8233a';
    g.font = font(800, 22);
    g.fillText(`Habilidade · ${a.name}`, 50, y);
    y += 28;
    g.fillStyle = '#1f3044';
    g.font = font(600, 19);
    y += wrap(g, a.text, 50, y, maxW, 24, 3) * 24 + 6;
  }
  for (const a of face.attacks) {
    roundRect(g, 44, y - 26, W - 88, 40, 10);
    g.fillStyle = STRIP_COLOR[a.type] ?? '#61778E';
    g.fill();
    a.cost.forEach((c, i) => typeDot(g, c, 70 + i * 30, y - 6, 12));
    g.fillStyle = '#ffffff';
    g.font = font(800, 24);
    g.fillText(a.name, 70 + a.cost.length * 30 + 8, y + 2, 330);
    g.textAlign = 'right';
    g.fillText(a.damage, W - 60, y + 2);
    g.textAlign = 'left';
    y += 34;
    if (a.text) {
      g.fillStyle = '#1f3044';
      g.font = font(600, 19);
      y += wrap(g, a.text, 50, y, maxW, 24, 3) * 24;
    }
    y += 16;
  }
  if (face.category === 'TRAINER' && face.trainerText) {
    g.fillStyle = '#1f3044';
    g.font = font(600, 21);
    y += wrap(g, face.trainerText, 50, y, maxW, 27, 6) * 27;
  }
  if (face.ruleBoxText) {
    g.fillStyle = '#4a5f77';
    g.font = font(600, 17);
    wrap(g, face.ruleBoxText, 50, Math.max(y, 760), maxW, 21, 2);
  }
  if (face.category === 'POKEMON') {
    g.fillStyle = '#3c5068';
    g.font = font(700, 18);
    g.fillText(`Fraqueza ${face.weakness ?? '—'}`, 50, 818);
    g.textAlign = 'right';
    g.fillText(`Recuo ${face.retreat ?? 0}`, W - 50, 818);
    g.textAlign = 'left';
  }
  g.fillStyle = '#5d7189';
  g.font = font(600, 15);
  g.fillText(`${face.setId.toUpperCase()} ${face.collectorNumber}${printing.artist ? ` · Ilus. ${printing.artist}` : ''}`, 50, 848);
  g.textAlign = 'right';
  g.fillText(`${TYPE_LABEL[type] ?? ''} · imagem de apresentação — não é carta jogável`, W - 50, 848);
  g.textAlign = 'left';
  // Acabamento: brilho localizado discreto (nunca sobre os textos).
  if (face.finish !== 'NORMAL') {
    g.save();
    roundRect(g, art.x, art.y, art.w, art.h, 12);
    g.clip();
    const sheen = g.createLinearGradient(art.x, art.y, art.x + art.w, art.y + art.h);
    sheen.addColorStop(0.2, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, face.finish === 'CHROME' ? 'rgba(220,230,240,0.35)' : 'rgba(180,230,255,0.3)');
    sheen.addColorStop(0.8, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(art.x, art.y, art.w, art.h);
    g.restore();
  }
  return toPng();
}

// VFX locais e temporários (direção visual §11, interface §25.15): anéis, partículas, feixes por família
// do golpe, faixa do ataque, linhas de velocidade e a moeda. Nada aqui intercepta clique ou altera regra;
// aleatoriedade decorativa determinística por semente.
import {
  AdditiveBlending, BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Points,
  PointsMaterial, RingGeometry, Vector3, type Material, type Object3D,
} from 'three';
import type { RenderSystem } from '../core/render-system.ts';
import { createVisualRng, rngRange } from '../core/rng.ts';
import { COLORS, STRIP_COLORS, asTypeId, mixHex, type TypeId } from '../core/tokens.ts';
import { fitLine, type Measure } from '../card/text-fit.ts';
import { fontString } from '../card/face-canvas.ts';
import { acquireCanvasTexture, releaseTexture, type TextureLease } from '../card/textures.ts';
import { drawTypeGlyph } from '../card/glyphs.ts';
import { CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH, roundedRectGeometry, roundedRingGeometry } from '../card/geometry.ts';
import type { CosmeticVisualInput } from './playmat.ts';

export type EffectHandle = { readonly update: (t: number) => void; readonly dispose: () => void };

export type ParticleShape = 'dot' | 'leaf' | 'spark' | 'star' | 'ring';

export type VfxProfile = { readonly color: string; readonly accent: string; readonly shape: ParticleShape; readonly gravity: number; readonly rings: number };

export const VFX_BY_TYPE: Readonly<Record<TypeId, VfxProfile>> = {
  FIRE: { color: '#F28A3C', accent: '#FFD27A', shape: 'dot', gravity: 0.9, rings: 1 },
  WATER: { color: '#3FA6EE', accent: '#BFE6FF', shape: 'dot', gravity: -1.2, rings: 1 },
  GRASS: { color: '#5DB544', accent: '#C8F0A8', shape: 'leaf', gravity: -0.4, rings: 1 },
  LIGHTNING: { color: '#F2CF2E', accent: '#FFF6C2', shape: 'spark', gravity: 0, rings: 1 },
  PSYCHIC: { color: '#A86FDB', accent: '#E8D6FA', shape: 'ring', gravity: 0, rings: 3 },
  FIGHTING: { color: '#C48D61', accent: '#F1D9C4', shape: 'dot', gravity: -1.4, rings: 2 },
  DARKNESS: { color: '#3E5670', accent: '#B9C7D6', shape: 'dot', gravity: 0, rings: 1 },
  METAL: { color: '#B8C7D3', accent: '#FFFFFF', shape: 'spark', gravity: 0, rings: 1 },
  DRAGON: { color: '#D2B25A', accent: '#BFE0FF', shape: 'star', gravity: 0.3, rings: 2 },
  COLORLESS: { color: '#FFFFFF', accent: '#DDE8F3', shape: 'star', gravity: 0, rings: 2 },
};

export function vfxFor(type: string | null | undefined): VfxProfile {
  return VFX_BY_TYPE[asTypeId(type)];
}

function particleTexture(rs: RenderSystem, shape: ParticleShape): TextureLease {
  return acquireCanvasTexture(rs, `fx:particle:${shape}`, 64, 64, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    if (shape === 'dot') {
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    } else if (shape === 'ring') {
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(c, c, c * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === 'leaf') drawTypeGlyph(ctx, 'GRASS', c, c, c * 0.8, '#FFFFFF');
    else if (shape === 'spark') drawTypeGlyph(ctx, 'LIGHTNING', c, c, c * 0.85, '#FFFFFF');
    else drawTypeGlyph(ctx, 'COLORLESS', c, c, c * 0.85, '#FFFFFF');
  }, false);
}

/** Anel que se expande e some (impacto, flair, condição, pontos). */
export function createRingEffect(_rs: RenderSystem, parent: Object3D, options: { position: Vector3; color: string; radius: number; maxScale?: number; flat?: boolean; opacity?: number; thickness?: number }): EffectHandle {
  const geometry = new RingGeometry(options.radius * (1 - (options.thickness ?? 0.18)), options.radius, 40);
  const material = new MeshBasicMaterial({ color: options.color, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  const mesh = new Mesh(geometry, material);
  if (options.flat !== false) mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(options.position);
  mesh.renderOrder = 20;
  parent.add(mesh);
  const max = options.maxScale ?? 2.2;
  const peak = options.opacity ?? 0.9;
  return {
    update: (t) => {
      const k = Math.min(1, Math.max(0, t));
      mesh.scale.setScalar(0.35 + (max - 0.35) * (1 - (1 - k) ** 3));
      material.opacity = peak * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    },
    dispose: () => {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

/** Partículas radiais (orçamento por qualidade; Baixo = 0). */
export function createBurstEffect(rs: RenderSystem, parent: Object3D, options: { origin: Vector3; profile: VfxProfile; count: number; spread: number; seed: string; size: number; flat?: boolean }): EffectHandle {
  if (options.count <= 0) return { update: () => undefined, dispose: () => undefined };
  const rng = createVisualRng(options.seed);
  const n = options.count;
  const velocity: number[] = [];
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    const a = rng() * Math.PI * 2;
    const r = rngRange(rng, 0.4, 1);
    const up = rngRange(rng, 0.1, 0.6);
    if (options.flat === false) velocity.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    else velocity.push(Math.cos(a) * r, up, Math.sin(a) * r);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const lease = particleTexture(rs, options.profile.shape);
  const material = new PointsMaterial({
    color: options.profile.color, map: lease.texture, size: options.size, transparent: true, depthWrite: false, toneMapped: false,
    sizeAttenuation: options.flat !== false, opacity: 0,
  });
  const points = new Points(geometry, material);
  points.renderOrder = 22;
  parent.add(points);
  return {
    update: (t) => {
      const k = Math.min(1, Math.max(0, t));
      const travel = options.spread * (1 - (1 - k) ** 2);
      const attr = geometry.getAttribute('position') as Float32BufferAttribute;
      for (let i = 0; i < n; i += 1) {
        const g = options.flat === false ? 0 : -options.profile.gravity * k * k * options.spread * 0.4;
        attr.setXYZ(i, options.origin.x + velocity[i * 3]! * travel, options.origin.y + velocity[i * 3 + 1]! * travel + g, options.origin.z + velocity[i * 3 + 2]! * travel);
      }
      attr.needsUpdate = true;
      material.opacity = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
    },
    dispose: () => {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      releaseTexture(rs, lease);
    },
  };
}

/** Feixe/trajetória curta da fonte ao alvo (arco), partículas em rastro. */
export function createBeamEffect(rs: RenderSystem, parent: Object3D, options: { from: Vector3; to: Vector3; profile: VfxProfile; count: number; arcHeight: number; size: number; seed: string }): EffectHandle {
  const n = Math.max(6, options.count);
  const rng = createVisualRng(options.seed);
  const jitter = Array.from({ length: n * 3 }, () => (rng() - 0.5) * 0.18);
  const positions = new Float32Array(n * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const lease = particleTexture(rs, options.profile.shape === 'ring' ? 'dot' : options.profile.shape);
  const material = new PointsMaterial({ color: options.profile.color, map: lease.texture, size: options.size, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  const points = new Points(geometry, material);
  points.renderOrder = 21;
  parent.add(points);
  const control = new Vector3().addVectors(options.from, options.to).multiplyScalar(0.5);
  control.y += options.arcHeight;
  const at = (s: number, out: Vector3) => {
    const u = 1 - s;
    out.set(
      u * u * options.from.x + 2 * u * s * control.x + s * s * options.to.x,
      u * u * options.from.y + 2 * u * s * control.y + s * s * options.to.y,
      u * u * options.from.z + 2 * u * s * control.z + s * s * options.to.z,
    );
    return out;
  };
  const p = new Vector3();
  return {
    update: (t) => {
      const head = Math.min(1, Math.max(0, t)) * 1.35;
      const attr = geometry.getAttribute('position') as Float32BufferAttribute;
      for (let i = 0; i < n; i += 1) {
        const s = Math.min(1, Math.max(0, head - i * 0.022));
        at(s, p);
        attr.setXYZ(i, p.x + jitter[i * 3]!, p.y + jitter[i * 3 + 1]!, p.z + jitter[i * 3 + 2]!);
      }
      attr.needsUpdate = true;
      material.opacity = t < 0.75 ? 1 : Math.max(0, 1 - (t - 0.75) / 0.25);
    },
    dispose: () => {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      releaseTexture(rs, lease);
    },
  };
}

/**
 * Faixa do ataque: nome em branco sobre attackStripColors (≥ 4,5:1), fonte da face; nome da carta menor. `wide`
 * (destaque de ponta a ponta da mesa, gameplay-pocket §10.2) usa uma textura mais larga com o nome centralizado.
 */
export type AttackBandState = {
  /** Centro da faixa (px CSS), largura total, inclinação e lado de quem ataca (+1 entra pela esquerda, -1 pela direita). */
  readonly x: number; readonly y: number; readonly width: number; readonly rotation: number; readonly dir: 1 | -1;
  /** Abertura (0–1) e fechamento (0–1, para o lado oposto) da faixa. */
  readonly open: number; readonly close: number;
  /** Entrada e saída do texto (0–1) e deslize de leitura (px). */
  readonly textIn: number; readonly textOut: number; readonly drift: number;
  /** Brilho atravessando a faixa (0–1; fora disso, oculto). */
  readonly shine: number;
};

/**
 * Faixa do ataque em camadas (decisão do autor, 15/10/2026: fluida como as outras faixas): fundo na cor do tipo com
 * pontas esmaecidas, que abre do lado de quem ataca com desaceleração longa e fecha para o lado oposto; o texto (nome do
 * ataque e do Pokémon) numa camada própria, sem esticar, que entra, desliza devagar e sai; e um brilho que a atravessa.
 * Camada de trânsito (px CSS).
 */
export function createAttackBand(rs: RenderSystem, attackName: string, creatureName: string, type: string, wide = false): {
  readonly group: Group; readonly set: (state: AttackBandState) => void; readonly dispose: () => void;
} {
  const texW = wide ? 2560 : 1024;
  const texH = 144;
  const color = STRIP_COLORS[asTypeId(type)];
  const bgLease = acquireCanvasTexture(rs, `fx:band:${asTypeId(type)}`, 1024, texH, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, mixHex(color, '#000000', 0.06));
    g.addColorStop(0.7, color);
    g.addColorStop(1, mixHex(color, '#FFFFFF', 0.08));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, w, 5);
    ctx.fillRect(0, h - 5, w, 5);
    // Pontas esmaecidas (como a máscara da faixa de turno).
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, 0, w, 0);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(0.06, 'rgba(0,0,0,1)');
    fade.addColorStop(0.94, 'rgba(0,0,0,1)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  }, false);
  const textLease = acquireCanvasTexture(rs, `fx:band-text:${wide ? 'wide' : 'card'}:${attackName}:${creatureName}`, texW, texH, (ctx, w, h) => {
    const measure: Measure = (text, font) => {
      ctx.font = fontString(font);
      return ctx.measureText(text).width;
    };
    const small = fitLine(creatureName, 300, { sizePx: 30, weight: 700 }, 20, measure);
    const smallW = measure(small.text, small.font);
    const name = fitLine(attackName, (wide ? w * 0.6 : w - 120 - smallW - 60), { sizePx: wide ? 96 : 74, weight: 900 }, 40, measure);
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 10;
    ctx.font = fontString(name.font);
    const nameW = measure(name.text, name.font);
    ctx.fillText(name.text, wide ? (w - nameW) / 2 : 56, h / 2 + 3);
    ctx.font = fontString(small.font);
    ctx.globalAlpha = 0.92;
    ctx.textAlign = wide ? 'left' : 'right';
    ctx.fillText(small.text, wide ? (w + nameW) / 2 + 36 : w - 48, h / 2 + (wide ? 22 : 4));
  }, false);
  const shineLease = acquireCanvasTexture(rs, 'fx:band-shine', 256, texH, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, false);
  const group = new Group();
  group.visible = false;
  // Fundo com origem na borda esquerda (x de 0 a 1): abrir/fechar escala a partir de uma das pontas.
  const bgGeo = new PlaneGeometry(1, 1);
  bgGeo.translate(0.5, 0, 0);
  const bgMat = new MeshBasicMaterial({ map: bgLease.texture, transparent: true, depthWrite: false, toneMapped: false });
  const bg = new Mesh(bgGeo, bgMat);
  bg.renderOrder = 60;
  const textGeo = new PlaneGeometry(1, texH / texW);
  const textMat = new MeshBasicMaterial({ map: textLease.texture, transparent: true, depthWrite: false, toneMapped: false });
  const text = new Mesh(textGeo, textMat);
  text.renderOrder = 62;
  const shineGeo = new PlaneGeometry(1, 1);
  const shineMat = new MeshBasicMaterial({ map: shineLease.texture, transparent: true, depthWrite: false, toneMapped: false, blending: AdditiveBlending });
  const shine = new Mesh(shineGeo, shineMat);
  shine.renderOrder = 61;
  group.add(bg, shine, text);
  return {
    group,
    set: (st) => {
      const visibleBand = st.open > 0.001 && st.close < 0.999;
      group.visible = visibleBand || (st.textIn > 0 && st.textOut < 1);
      group.position.set(st.x, -st.y, 160);
      group.rotation.z = st.rotation;
      const full = st.width;
      const height = full * (texH / texW);
      // Abre do lado de quem ataca e fecha para o lado oposto: o trecho visível é [a, b] em fração da largura.
      const a = st.dir === 1 ? st.close : 1 - st.open;
      const b = st.dir === 1 ? st.open : 1 - st.close;
      const span = Math.max(0.0001, b - a);
      bg.visible = visibleBand && b > a;
      bg.position.set(-full / 2 + a * full, 0, 0);
      bg.scale.set(full * span, height * (0.4 + 0.6 * Math.min(1, st.open)) * (1 - 0.3 * st.close), 1);
      // Texto: entra do lado de quem ataca, desliza na leitura e sai para o lado oposto.
      const tin = Math.min(1, Math.max(0, st.textIn));
      const tout = Math.min(1, Math.max(0, st.textOut));
      text.position.set(st.dir * (-120 * (1 - tin) + st.drift + 140 * tout), 0, 1);
      text.scale.setScalar(full);
      textMat.opacity = tin * (1 - tout);
      text.visible = textMat.opacity > 0.01;
      shine.visible = st.shine > 0 && st.shine < 1 && bg.visible;
      shine.position.set(st.dir * (-full * 0.55 + st.shine * full * 1.1), 0, 0.5);
      shine.scale.set(full * 0.18, height, 1);
      shineMat.opacity = Math.sin(Math.PI * Math.min(1, Math.max(0, st.shine)));
    },
    dispose: () => {
      group.removeFromParent();
      for (const g of [bgGeo, textGeo, shineGeo]) g.dispose();
      for (const m of [bgMat, textMat, shineMat]) m.dispose();
      for (const l of [bgLease, textLease, shineLease]) releaseTexture(rs, l);
    },
  };
}

/** Linhas de velocidade claras atrás da carta em destaque (sem strobe). */
export function createSpeedLines(count: number, seed: string): { group: Group; update: (t: number, width: number, height: number) => void; dispose: () => void } {
  const group = new Group();
  const rng = createVisualRng(seed);
  const geometry = new PlaneGeometry(1, 1);
  const materials: Material[] = [];
  const lines: { mesh: Mesh; y: number; speed: number; len: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const material = new MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: AdditiveBlending });
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 55;
    group.add(mesh);
    lines.push({ mesh, y: rng() - 0.5, speed: 0.6 + rng() * 0.8, len: 0.25 + rng() * 0.35 });
  }
  return {
    group,
    update: (t, width, height) => {
      for (const l of lines) {
        const x = ((1 - ((t * l.speed * 2.2) % 1)) - 0.5) * width * 1.4;
        l.mesh.position.set(x, l.y * height, -2);
        l.mesh.scale.set(width * l.len, Math.max(2, height * 0.012), 1);
        (l.mesh.material as MeshBasicMaterial).opacity = 0.55 * Math.sin(Math.PI * Math.min(1, t));
      }
    },
    dispose: () => {
      group.removeFromParent();
      geometry.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

export type CoinVisual = {
  readonly group: Group;
  /** A face é a imagem da moeda do Pocket (false: desenho da paleta, enquanto a imagem não chega ou sem arte). */
  readonly art: boolean;
  readonly setPose: (angle: number, lift: number, scale: number) => void;
  readonly setGlow: (amount: number) => void;
  readonly dispose: () => void;
};

/**
 * CoinVisual: borda cilíndrica e dois discos, cara à frente e coroa atrás (o giro é em torno do eixo X). Moeda do
 * Pocket com as imagens carregadas (`art`): as faces são as imagens empacotadas; senão, faces procedurais da paleta.
 */
export function createCoinVisual(rs: RenderSystem, coin: CosmeticVisualInput | null, art?: Readonly<Record<'HEADS' | 'TAILS', HTMLImageElement>> | null): CoinVisual {
  const gold = coin?.visual.palette[0] ?? COLORS.pointGold;
  const silver = coin?.visual.palette[1] ?? '#C9D3DC';
  const face = (key: string, base: string, draw: (ctx: CanvasRenderingContext2D, c: number) => void) => acquireCanvasTexture(rs, key, 256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c * 0.7, c * 0.6, 10, c, c, c);
    g.addColorStop(0, mixHex(base, '#FFFFFF', 0.45));
    g.addColorStop(1, mixHex(base, '#263A50', 0.12));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(c, c, c - 18, 0, Math.PI * 2);
    ctx.stroke();
    draw(ctx, c);
  });
  const artFace = (key: string, edge: string, img: HTMLImageElement) => acquireCanvasTexture(rs, key, 256, 256, (ctx, w) => {
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, w);
    ctx.drawImage(img, 0, 0, w, w);
  });
  const assetKey = coin?.visual.assetKey ?? null;
  const heads = art ? artFace(`coin:art:${assetKey}:heads`, gold, art.HEADS)
    : face(`coin:heads:${gold}`, gold, (ctx, c) => drawTypeGlyph(ctx, 'COLORLESS', c, c, c * 0.5, '#FFFFFF'));
  const tails = art ? artFace(`coin:art:${assetKey}:tails`, '#AEB9C4', art.TAILS) : face(`coin:tails:${silver}`, silver, (ctx, c) => {
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(c, c, c * 0.12, 0, Math.PI * 2);
    ctx.fill();
  });
  const thickness = 0.07;
  const rimGeo = new CylinderGeometry(0.5, 0.5, thickness, 48, 1, true);
  const discGeo = new CircleGeometry(0.5, 48);
  // Borda: metal neutro puxado para a cor média da face (a cor da borda da imagem pode ser um contorno escuro).
  const side = new MeshBasicMaterial({ color: art ? mixHex(gold, '#8E9AA6', 0.5) : mixHex(gold, '#8A6A10', 0.35), toneMapped: false, side: DoubleSide });
  const top = new MeshBasicMaterial({ map: heads.texture, toneMapped: false });
  const bottom = new MeshBasicMaterial({ map: tails.texture, toneMapped: false });
  const rim = new Mesh(rimGeo, side);
  rim.rotation.x = Math.PI / 2;
  const front = new Mesh(discGeo, top);
  front.position.z = thickness / 2;
  // A coroa fica de cabeça para baixo no próprio disco: depois de meia volta em X aparece em pé.
  const back = new Mesh(discGeo, bottom);
  back.position.z = -thickness / 2;
  back.rotation.x = Math.PI;
  const body = new Group();
  body.name = 'CoinVisual';
  body.add(rim, front, back);
  const glowGeo = new RingGeometry(0.55, 0.68, 48);
  const glowMat = new MeshBasicMaterial({ color: COLORS.primary, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const glow = new Mesh(glowGeo, glowMat);
  glow.position.z = -10;
  const group = new Group();
  const spinner = new Group();
  spinner.add(body);
  group.add(glow, spinner);
  group.visible = false;
  return {
    group,
    art: !!art,
    setPose: (angle, lift, scale) => {
      body.rotation.set(angle, 0, 0);
      spinner.position.y = lift;
      spinner.scale.setScalar(scale);
    },
    setGlow: (amount) => {
      glowMat.opacity = Math.max(0, Math.min(1, amount)) * 0.8;
    },
    dispose: () => {
      group.removeFromParent();
      rimGeo.dispose();
      discGeo.dispose();
      glowGeo.dispose();
      side.dispose();
      top.dispose();
      bottom.dispose();
      glowMat.dispose();
      releaseTexture(rs, heads);
      releaseTexture(rs, tails);
    },
  };
}

// ------------------------------------------------------------------- estilo Pocket, fase 3 (gameplay-pocket §6, §9)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Cor da dissolução por subtipo de Treinador (observações §6.6): Item ciano, Apoiador dourado, Ferramenta lilás, Estádio verde. */
export const TRAINER_DISSOLVE_COLORS: Readonly<Record<string, string>> = { ITEM: '#7FEFF0', SUPPORTER: '#FFB43A', TOOL: '#B79CF2', STADIUM: '#5CF08A' };

export type DropZoneState = 'HIDDEN' | 'SHOWN' | 'HOVER';

/**
 * Zona de soltura do Treinador: retângulo arredondado verde translúcido com borda clara, desenhado na camada de
 * trânsito (px CSS) por baixo da carta arrastada. A geometria é refeita só quando o tamanho muda.
 */
export function createDropZone(): { group: Group; place: (x: number, y: number, w: number, h: number, z: number) => void; setState: (s: DropZoneState) => void; dispose: () => void } {
  const group = new Group();
  group.visible = false;
  // Com teste de profundidade: a carta arrastada (opaca, mais perto da câmera) fica por cima do véu verde.
  const fillMat = new MeshBasicMaterial({ color: '#5CDE8C', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
  const lineMat = new MeshBasicMaterial({ color: '#D2FFE0', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  let size = '';
  let fill: Mesh | null = null;
  let line: Mesh | null = null;
  const rebuild = (w: number, h: number) => {
    fill?.geometry.dispose();
    line?.geometry.dispose();
    fill?.removeFromParent();
    line?.removeFromParent();
    const r = Math.min(w, h) * 0.08;
    fill = new Mesh(roundedRectGeometry(w, h, r, 8), fillMat);
    line = new Mesh(roundedRingGeometry(w, h, r, Math.max(3, h * 0.009), 8), lineMat);
    fill.renderOrder = -20;
    line.renderOrder = -19;
    group.add(fill, line);
  };
  return {
    group,
    place: (x, y, w, h, z) => {
      const key = `${Math.round(w)}x${Math.round(h)}`;
      if (key !== size) {
        size = key;
        rebuild(w, h);
      }
      group.position.set(x, -y, 100 + z);
    },
    setState: (s) => {
      group.visible = s !== 'HIDDEN';
      fillMat.opacity = s === 'HOVER' ? 0.36 : 0.2;
      lineMat.opacity = s === 'HOVER' ? 1 : 0.75;
    },
    dispose: () => {
      group.removeFromParent();
      fill?.geometry.dispose();
      line?.geometry.dispose();
      fillMat.dispose();
      lineMat.dispose();
    },
  };
}

/**
 * Dissolução do Treinador (gameplay-pocket §9): a carta clareia até uma placa branca, um halo na cor do subtipo pulsa
 * e três molduras se expandem em camadas e somem. Camada de trânsito (px CSS); `update(k, …)` com k em [0, 1].
 */
export function createDissolveFx(color: string): { group: Group; update: (k: number, x: number, y: number, width: number, rotation: number, z: number) => void; dispose: () => void } {
  const group = new Group();
  group.visible = false;
  const transparent = { transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false } as const;
  const plateGeo = roundedRectGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_RADIUS, 6);
  const glowGeo = roundedRectGeometry(CARD_WIDTH + 0.2, CARD_HEIGHT + 0.2, CARD_RADIUS + 0.1, 6);
  const ringGeo = roundedRingGeometry(CARD_WIDTH + 0.06, CARD_HEIGHT + 0.06, CARD_RADIUS + 0.03, 0.045, 6);
  const plateMat = new MeshBasicMaterial({ color: '#FFFFFF', ...transparent });
  const glowMat = new MeshBasicMaterial({ color, ...transparent, blending: AdditiveBlending });
  const plate = new Mesh(plateGeo, plateMat);
  const glow = new Mesh(glowGeo, glowMat);
  glow.renderOrder = 69;
  plate.renderOrder = 70;
  group.add(glow, plate);
  const rings = [color, '#FFFFFF', color].map((c, i) => {
    const mesh = new Mesh(ringGeo, new MeshBasicMaterial({ color: c, ...transparent }));
    mesh.renderOrder = 71 + i;
    group.add(mesh);
    return mesh;
  });
  return {
    group,
    update: (k, x, y, width, rotation, z) => {
      group.visible = k > 0 && k < 1;
      group.position.set(x, -y, 100 + z);
      group.rotation.set(0, 0, rotation);
      group.scale.setScalar(width);
      const whiten = clamp01(k / 0.35);
      const fade = clamp01((k - 0.55) / 0.45);
      plateMat.opacity = whiten * (1 - fade);
      plate.scale.setScalar(1 + 0.06 * fade);
      glowMat.opacity = 0.7 * Math.sin(Math.PI * clamp01(k / 0.85));
      rings.forEach((r, i) => {
        const local = clamp01((k - 0.2 - i * 0.12) / 0.55);
        const e = 1 - (1 - local) ** 3;
        r.scale.set(1 + 0.6 * e, 1 + 0.42 * e, 1);
        (r.material as MeshBasicMaterial).opacity = local > 0 ? 0.95 * (1 - local) : 0;
      });
    },
    dispose: () => {
      group.removeFromParent();
      plateGeo.dispose();
      glowGeo.dispose();
      ringGeo.dispose();
      plateMat.dispose();
      glowMat.dispose();
      for (const r of rings) (r.material as MeshBasicMaterial).dispose();
    },
  };
}

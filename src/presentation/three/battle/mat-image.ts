// Imagem local do tapete na mesa 3D (interface §23.26; UI-111/112/113): textura do asset (URL local de
// objeto), recorte 4:3 aplicado no shader sobre uma caixa 4:3 que cobre a superfície interna da mesa (sem
// distorcer a imagem), cor-base sob a transparência e opacidade 0,55 como na mesa 2D — as duas metades, a
// linha central, o círculo e as guias continuam legíveis. Troca com crossfade de dois samplers. Texturas no
// cache LRU do RenderSystem; asset ausente ou que não decodifica → camada vazia (tapete neutro) e status
// `missing` para o HUD HTML, sem exceção.
import {
  BufferGeometry, Color, LinearFilter, LinearMipmapLinearFilter, Mesh, SRGBColorSpace, ShaderMaterial, Texture, Vector4,
} from 'three';
import type { RenderSystem } from '../core/render-system.ts';
import { estimateTextureBytes } from '../core/resources.ts';

/**
 * Imagem do tapete pronta para a cena: `url` nula = asset ausente ou ilegível (mostra o neutro e avisa);
 * `pending` = a URL ainda está sendo resolvida pelo hospedeiro (nada aparece, status `loading`).
 */
export type MatImageSource = {
  readonly id: string;
  readonly url: string | null;
  readonly pending?: boolean;
  readonly width: number;
  readonly height: number;
  /** Recorte normalizado 0..1 (proporção 4:3 na imagem). */
  readonly crop: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly baseHex: string;
};

export type MatImageStatus = 'none' | 'loading' | 'loaded' | 'missing';

/** Opacidade da imagem sobre a mesa de duas cores (igual à mesa 2D, `.b2-table .mat-image-surface`). */
export const MAT_IMAGE_OPACITY = 0.55;

/** Caixa 4:3 (mundo, plano XZ) que cobre um retângulo — equivalente ao `cover` da mesa 2D. */
export function coverBox4x3(minX: number, maxX: number, minZ: number, maxZ: number): { x0: number; z0: number; w: number; h: number } {
  const w = maxX - minX;
  const h = maxZ - minZ;
  if (w / h >= 4 / 3) {
    const bh = (w * 3) / 4;
    return { x0: minX, z0: (minZ + maxZ) / 2 - bh / 2, w, h: bh };
  }
  const bw = (h * 4) / 3;
  return { x0: (minX + maxX) / 2 - bw / 2, z0: minZ, w: bw, h };
}

/** Coordenada de textura (v para cima, flipY) do ponto `uv` da caixa 4:3 dentro do recorte. Pura. */
export function cropTexCoord(crop: MatImageSource['crop'], u: number, v: number): { s: number; t: number } {
  return { s: crop.x + u * crop.w, t: 1 - (crop.y + v * crop.h) };
}

const VERTEX = /* glsl */ `
varying vec2 vXZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vXZ = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D mapA;
uniform sampler2D mapB;
uniform vec4 cropA;
uniform vec4 cropB;
uniform vec3 baseA;
uniform vec3 baseB;
uniform float onA;
uniform float onB;
uniform float mixT;
uniform float opacity;
uniform vec4 box;
varying vec2 vXZ;
// Cores levadas ao espaço de saída (sRGB) ANTES de pré-multiplicar: a composição fica como a do CSS na
// mesa 2D (cor-base sob a imagem e opacidade 0,55 misturadas em sRGB), sem clarear a imagem.
vec3 toOutput(vec3 linear) { return linearToOutputTexel(vec4(linear, 1.0)).rgb; }
vec4 layer(sampler2D m, vec4 crop, vec3 base, float on, vec2 uv) {
  vec2 t = vec2(crop.x + uv.x * crop.z, 1.0 - (crop.y + uv.y * crop.w));
  vec4 c = texture2D(m, t);
  vec3 rgb = mix(toOutput(base), toOutput(c.rgb), c.a);
  float a = on * opacity;
  return vec4(rgb * a, a);
}
void main() {
  vec2 uv = clamp((vXZ - box.xy) / box.zw, 0.0, 1.0);
  vec4 a = layer(mapA, cropA, baseA, onA, uv);
  vec4 b = layer(mapB, cropB, baseB, onB, uv);
  gl_FragColor = mix(a, b, mixT);
}`;

type Slot = { source: MatImageSource | null; key: string | null; texture: Texture | null };

/** Identidade de uma fonte para transições: asset + URL + pendência (o recorte troca sem transição). */
export function matImageKey(source: MatImageSource | null | undefined): string {
  if (!source) return 'none';
  return `${source.id}:${source.pending ? 'pending' : source.url ? source.url : 'missing'}`;
}

export type MatImageLayer = {
  readonly mesh: Mesh;
  /** Geometria da superfície interna e caixa 4:3 que a cobre (recalculadas quando o perfil muda). */
  readonly setGeometry: (geometry: BufferGeometry, box: { x0: number; z0: number; w: number; h: number }) => void;
  /** Mostra `source` (ou nada) com crossfade de `ms` (0 = imediato). */
  readonly show: (source: MatImageSource | null, ms: number) => void;
  readonly status: () => MatImageStatus;
  readonly update: (dtMs: number) => boolean;
  readonly dispose: () => void;
};

/**
 * Decodifica a imagem de `source.url` numa textura do cache LRU (uma por asset). `onState` recebe loaded/
 * missing; a mesma textura é compartilhada por todas as cenas que a usam (referências).
 */
function acquireMatTexture(rs: RenderSystem, source: MatImageSource, onState: () => void): { key: string; texture: Texture } {
  const key = `matimg:${source.id}:${source.url ?? 'none'}`;
  const texture = rs.textures.acquire(key, () => {
    const t = new Texture();
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = rs.anisotropy();
    t.generateMipmaps = true;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.userData.state = 'loading';
    t.userData.waiters = new Set<() => void>();
    const done = (state: 'loaded' | 'missing') => {
      t.userData.state = state;
      for (const cb of t.userData.waiters as Set<() => void>) cb();
      (t.userData.waiters as Set<() => void>).clear();
    };
    if (!source.url || typeof Image === 'undefined') done('missing');
    else {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) {
          done('missing');
          return;
        }
        t.image = img;
        t.needsUpdate = true;
        done('loaded');
        rs.requestRender();
      };
      img.onerror = () => done('missing');
      img.src = source.url;
    }
    return t;
  }, estimateTextureBytes(Math.max(1, source.width), Math.max(1, source.height)));
  if (texture.userData.state === 'loading') (texture.userData.waiters as Set<() => void>).add(onState);
  return { key, texture };
}

export function createMatImageLayer(rs: RenderSystem, onStatus: (status: MatImageStatus) => void): MatImageLayer {
  const material = new ShaderMaterial({
    name: 'PlaymatImage',
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      mapA: { value: null }, mapB: { value: null },
      cropA: { value: new Vector4(0, 0, 1, 1) }, cropB: { value: new Vector4(0, 0, 1, 1) },
      baseA: { value: new Color('#FFFFFF') }, baseB: { value: new Color('#FFFFFF') },
      onA: { value: 0 }, onB: { value: 0 }, mixT: { value: 0 }, opacity: { value: MAT_IMAGE_OPACITY },
      box: { value: new Vector4(0, 0, 1, 1) },
    },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(new BufferGeometry(), material);
  mesh.name = 'PlaymatImage';
  mesh.renderOrder = -3;
  mesh.visible = false;
  let a: Slot = { source: null, key: null, texture: null };
  let b: Slot | null = null;
  let fade: { t: number; duration: number } | null = null;
  let lastStatus: MatImageStatus = 'none';
  let disposed = false;

  const stateOf = (slot: Slot): MatImageStatus => {
    if (!slot.source) return 'none';
    const st = slot.texture?.userData.state as string | undefined;
    return st === 'loaded' ? 'loaded' : st === 'missing' ? 'missing' : 'loading';
  };

  /** Atualiza uniformes de um lado (A/B) conforme o estado da textura; a camada só aparece decodificada. */
  const apply = () => {
    if (disposed) return;
    const set = (slot: Slot | null, suffix: 'A' | 'B') => {
      const u = material.uniforms;
      const loaded = !!slot && stateOf(slot) === 'loaded';
      u[`on${suffix}`]!.value = loaded ? 1 : 0;
      if (slot?.source && slot.texture) {
        u[`map${suffix}`]!.value = slot.texture;
        const c = slot.source.crop;
        (u[`crop${suffix}`]!.value as Vector4).set(c.x, c.y, c.w, c.h);
        (u[`base${suffix}`]!.value as Color).set(/^#[0-9a-fA-F]{6}$/.test(slot.source.baseHex) ? slot.source.baseHex : '#FFFFFF');
      }
    };
    set(a, 'A');
    set(b ?? a, 'B');
    mesh.visible = material.uniforms.onA!.value > 0 || material.uniforms.onB!.value > 0;
    // Status do que está (ou vai ficar) exibido.
    const shown = stateOf(b ?? a);
    if (shown !== lastStatus) {
      lastStatus = shown;
      onStatus(shown);
    }
    rs.requestRender();
  };

  const release = (slot: Slot | null) => {
    if (slot?.key) rs.textures.release(slot.key);
  };

  const slotFor = (source: MatImageSource | null): Slot => {
    if (!source) return { source: null, key: null, texture: null };
    if (source.pending) return { source, key: null, texture: null };
    const leased = acquireMatTexture(rs, source, apply);
    return { source, key: leased.key, texture: leased.texture };
  };

  const finishFade = () => {
    if (!b) return;
    release(a);
    a = b;
    b = null;
    fade = null;
    material.uniforms.mixT!.value = 0;
    apply();
  };

  return {
    mesh,
    setGeometry: (geometry, box) => {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      (material.uniforms.box!.value as Vector4).set(box.x0, box.z0, box.w, box.h);
      rs.requestRender();
    },
    show: (source, ms) => {
      const current = b ?? a;
      if (matImageKey(current.source) === matImageKey(source)) {
        if (source && current.source && JSON.stringify(current.source.crop) !== JSON.stringify(source.crop)) current.source = source;
        apply();
        return;
      }
      if (b) finishFade();
      if (ms <= 0) {
        release(a);
        a = slotFor(source);
        apply();
        return;
      }
      b = slotFor(source);
      fade = { t: 0, duration: ms };
      material.uniforms.mixT!.value = 0;
      apply();
    },
    status: () => stateOf(b ?? a),
    update: (dtMs) => {
      if (!fade) return false;
      fade.t += dtMs;
      const k = Math.min(1, fade.t / fade.duration);
      material.uniforms.mixT!.value = k;
      if (k >= 1) finishFade();
      return k < 1;
    },
    dispose: () => {
      disposed = true;
      release(a);
      release(b);
      mesh.geometry.dispose();
      material.dispose();
      mesh.removeFromParent();
    },
  };
}

// Acabamentos NORMAL/HOLOGRAPHIC/FOIL/CHROME (runtime §15.3): shader pequeno numa camada sobre a frente.
// Brilho dependente da direção de visão, limitado à máscara da janela de arte (texto protegido); no
// ângulo frontal a intensidade é baixa para nunca apagar letras (VS-025). O material da impressão
// continua não iluminado com toneMapped = false.
import { AdditiveBlending, ShaderMaterial, Vector2, Vector4, type IUniform } from 'three';
import type { RenderSystem } from '../core/render-system.ts';
import { artWindowUv, innerBodyUv, type TemplateKind } from './face-canvas.ts';

export type FinishKind = 'NORMAL' | 'HOLOGRAPHIC' | 'FOIL' | 'CHROME';

export function asFinish(value: string | null | undefined): FinishKind {
  return value === 'HOLOGRAPHIC' || value === 'FOIL' || value === 'CHROME' ? value : 'NORMAL';
}

/** Uniformes globais compartilhados por todos os materiais de acabamento (um relógio por frame). */
export const FINISH_GLOBALS: { readonly time: IUniform<number>; readonly animated: IUniform<number> } = {
  time: { value: 0 },
  animated: { value: 1 },
};

const VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vViewDir;
varying vec3 vNormalV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mv.xyz);
  vNormalV = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = /* glsl */ `
uniform float uKind;
uniform float uIntensity;
uniform float uOpacity;
uniform float uTime;
uniform float uAnimated;
uniform vec4 uArt;
uniform vec4 uInner;
uniform vec2 uTilt;
varying vec2 vUv;
varying vec3 vViewDir;
varying vec3 vNormalV;

float box(vec2 uv, vec4 r, float f) {
  vec2 a = smoothstep(r.xy, r.xy + f, uv);
  vec2 b = 1.0 - smoothstep(r.zw - f, r.zw, uv);
  return a.x * a.y * b.x * b.y;
}
vec3 spectrum(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
void main() {
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(vViewDir);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float grazing = 1.0 - ndv;
  vec2 tilt = (V.xy - N.xy * ndv) + uTilt;
  float t = uTime * uAnimated;
  float art = box(vUv, uArt, 0.012);
  float frameMask = 1.0 - box(vUv, uInner, 0.006);
  vec3 col = vec3(1.0);
  float a = 0.0;
  if (uKind < 1.5) {
    float h = fract(vUv.x * 1.1 + vUv.y * 0.7 + tilt.x * 1.8 + tilt.y * 1.3 + t * 0.035);
    float bands = 0.5 + 0.5 * sin((vUv.x - vUv.y) * 38.0 + tilt.x * 20.0 + t * 0.6);
    col = mix(vec3(1.0), spectrum(h), 0.6);
    a = art * uIntensity * (0.05 + 0.45 * grazing + 0.1 * bands);
  } else if (uKind < 2.5) {
    float h = fract((vUv.x + vUv.y) * 0.9 + tilt.x * 2.2 - tilt.y * 1.6 + t * 0.05);
    float sparkle = pow(max(0.0, sin(vUv.x * 220.0 + t * 0.3) * sin(vUv.y * 260.0 + t)), 18.0);
    col = mix(vec3(1.0), spectrum(h), 0.7);
    a = (art + frameMask * 0.5) * uIntensity * (0.06 + 0.5 * grazing + 0.5 * sparkle);
  } else {
    float sweep = smoothstep(0.16, 0.0, abs(fract(vUv.x * 0.6 - vUv.y * 0.45 + tilt.x * 1.6 + tilt.y + t * 0.04) - 0.5));
    col = vec3(0.93, 0.96, 1.0);
    a = (frameMask * 0.9 + art * 0.15) * uIntensity * (0.06 + 0.8 * sweep);
  }
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
  #include <colorspace_fragment>
}`;

const KIND_INDEX: Readonly<Record<Exclude<FinishKind, 'NORMAL'>, number>> = { HOLOGRAPHIC: 1, FOIL: 2, CHROME: 3 };

export function createFinishMaterial(finish: Exclude<FinishKind, 'NORMAL'>, template: TemplateKind, intensity: number): ShaderMaterial {
  const art = artWindowUv(template);
  const inner = innerBodyUv();
  return new ShaderMaterial({
    name: `finish-${finish}-${template}`,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uKind: { value: KIND_INDEX[finish] },
      uIntensity: { value: intensity },
      uOpacity: { value: 1 },
      uTime: FINISH_GLOBALS.time,
      uAnimated: FINISH_GLOBALS.animated,
      uArt: { value: new Vector4(art.u0, art.v0, art.u1, art.v1) },
      uInner: { value: new Vector4(inner.u0, inner.v0, inner.u1, inner.v1) },
      uTilt: { value: new Vector2(0, 0) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
}

export function finishMaterialKey(finish: FinishKind, template: TemplateKind): string {
  return `finish:${finish}:${template}`;
}

/** Material compartilhado por (acabamento, template); parâmetros por instância exigem clone. */
export function acquireFinishMaterial(rs: RenderSystem, finish: FinishKind, template: TemplateKind): { key: string; material: ShaderMaterial } | null {
  if (finish === 'NORMAL') return null;
  const key = finishMaterialKey(finish, template);
  const intensity = finish === 'CHROME' ? 0.75 : finish === 'FOIL' ? 0.7 : 0.62;
  return { key, material: rs.resources.acquire(key, () => createFinishMaterial(finish, template, intensity)) };
}

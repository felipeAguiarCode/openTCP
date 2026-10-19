// Peças de vitrine reutilizadas pelos palcos de painel: pedestal claro com aro, sombra de contato
// pré-desfocada, DeckBoxVisual com o verso cosmético e câmera que enquadra um conteúdo no retângulo.
import {
  BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, PlaneGeometry, RingGeometry, Vector3,
  type Material,
} from 'three';
import type { RenderSystem } from '../core/render-system.ts';
import { COLORS, mixHex } from '../core/tokens.ts';
import type { CssRect } from '../core/viewport.ts';
import type { SleeveStyle } from '../card/face-canvas.ts';
import { acquireCanvasTexture, acquireSleeveTexture, releaseTexture } from '../card/textures.ts';

export type Pedestal = {
  readonly group: Group;
  readonly setHighlight: (state: 'NONE' | 'HOVER' | 'SELECTED') => void;
  readonly dispose: () => void;
};

/** Pedestal branco fosco com aro azul-pálido e anel de destaque (seleção da Descoberta / vitrine). */
export function createPedestal(rs: RenderSystem, options: { radius: number; height?: number; accent?: string }): Pedestal {
  const r = options.radius;
  const h = options.height ?? r * 0.32;
  const group = new Group();
  group.name = 'Pedestal';
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => {
    owned.push(x);
    return x;
  };
  const top = new Mesh(keep(new CylinderGeometry(r, r * 1.04, h, 48)), keep(new MeshLambertMaterial({ color: '#FFFFFF' })));
  top.position.y = -h / 2;
  const rim = new Mesh(keep(new CylinderGeometry(r * 1.06, r * 1.1, h * 0.35, 48)), keep(new MeshLambertMaterial({ color: mixHex(options.accent ?? COLORS.primary, '#FFFFFF', 0.55) })));
  rim.position.y = -h * 0.82;
  const ringMat = keep(new MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const ring = new Mesh(keep(new RingGeometry(r * 0.86, r * 0.98, 64)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  ring.visible = false;
  const shadow = createContactShadow(rs, r * 3.1, r * 1.5);
  shadow.mesh.position.y = -h * 1.0 - 0.002;
  group.add(shadow.mesh, rim, top, ring);
  return {
    group,
    setHighlight: (state) => {
      ring.visible = state !== 'NONE';
      ringMat.opacity = state === 'SELECTED' ? 1 : 0.55;
      ringMat.color.set(state === 'SELECTED' ? COLORS.cyan : COLORS.primary);
    },
    dispose: () => {
      group.removeFromParent();
      shadow.dispose();
      for (const o of owned) o.dispose();
    },
  };
}

/** Sombra de contato azul-acinzentada (sprite pré-desfocado, sem shadow map). */
export function createContactShadow(rs: RenderSystem, width: number, depth: number, opacity = 0.42): { mesh: Mesh; dispose: () => void } {
  const lease = acquireCanvasTexture(rs, 'stage:contact-shadow', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(100,125,154,0.85)');
    g.addColorStop(0.55, 'rgba(100,125,154,0.35)');
    g.addColorStop(1, 'rgba(100,125,154,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, false);
  const geometry = new PlaneGeometry(width, depth);
  const material = new MeshBasicMaterial({ map: lease.texture, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return {
    mesh,
    dispose: () => {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      releaseTexture(rs, lease);
    },
  };
}

export type DeckBoxInput = { readonly sleeve: SleeveStyle; readonly label?: string; readonly accent?: string };

/** DeckBoxVisual: caixa clara com o sleeve na frente e faixa da cor do deck (sem couro ou runas). */
export function createDeckBoxVisual(rs: RenderSystem, input: DeckBoxInput): { group: Group; dispose: () => void } {
  const group = new Group();
  group.name = 'DeckBoxVisual';
  const w = 1.08;
  const h = 1.5;
  const d = 0.46;
  const sleeve = acquireSleeveTexture(rs, input.sleeve);
  const accent = input.accent ?? input.sleeve.palette[1] ?? COLORS.primary;
  const label = acquireCanvasTexture(rs, `deckbox:label:${input.label ?? ''}:${accent}`, 512, 128, (ctx, cw, ch) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = accent;
    ctx.fillRect(0, ch - 18, cw, 18);
    ctx.fillStyle = COLORS.text;
    ctx.font = `800 52px Nunito, 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let text = input.label ?? '';
    while (text.length > 1 && ctx.measureText(text).width > cw - 40) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, cw / 2, ch / 2 - 6);
  }, false);
  const side = new MeshLambertMaterial({ color: mixHex(accent, '#FFFFFF', 0.72) });
  const front = new MeshBasicMaterial({ map: sleeve.texture, toneMapped: false });
  const topMat = new MeshBasicMaterial({ map: label.texture, toneMapped: false });
  const materials: Material[] = [side, side, topMat, side, front, side];
  const geometry = new BoxGeometry(w, h, d);
  const box = new Mesh(geometry, materials);
  box.position.y = h / 2;
  const lidGeo = new BoxGeometry(w * 1.02, h * 0.16, d * 1.04);
  const lidMat = new MeshLambertMaterial({ color: mixHex(accent, '#FFFFFF', 0.35) });
  const lid = new Mesh(lidGeo, lidMat);
  lid.position.y = h - h * 0.08;
  const shadow = createContactShadow(rs, w * 2.2, d * 3.2, 0.5);
  shadow.mesh.position.y = 0.002;
  group.add(shadow.mesh, box, lid);
  return {
    group,
    dispose: () => {
      group.removeFromParent();
      geometry.dispose();
      lidGeo.dispose();
      side.dispose();
      front.dispose();
      topMat.dispose();
      lidMat.dispose();
      shadow.dispose();
      releaseTexture(rs, sleeve);
      releaseTexture(rs, label);
    },
  };
}

/**
 * Câmera em perspectiva que enquadra uma caixa (largura × altura no plano focal) no retângulo CSS,
 * com margem. Usada por inspector, vitrine, Descoberta e pacote.
 */
export function framePerspective(camera: PerspectiveCamera, rect: CssRect, content: { width: number; height: number; center: Vector3; margin?: number; elevationDeg?: number }): number {
  const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 16 / 9;
  camera.aspect = aspect;
  const margin = content.margin ?? 1.12;
  const vfov = (camera.fov * Math.PI) / 180;
  const halfH = Math.max(content.height / 2, content.width / 2 / aspect) * margin;
  const distance = halfH / Math.tan(vfov / 2);
  const elev = ((content.elevationDeg ?? 0) * Math.PI) / 180;
  camera.position.set(content.center.x, content.center.y + Math.sin(elev) * distance, content.center.z + Math.cos(elev) * distance);
  camera.lookAt(content.center);
  camera.near = Math.max(0.05, distance * 0.1);
  camera.far = distance * 6 + 20;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return distance;
}

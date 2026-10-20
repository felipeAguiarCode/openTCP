// Zona de Energia como “prato” (gameplay-pocket §5.2; referências .specs/referencias/batalha/energy-empty.png e
// energy-fullfiled.png): disco branco-lilás com aro claro; com Energia pronta, um orbe brilhante do tipo com halo ciano
// pulsando; o ícone escuro da próxima Energia fica na borda de baixo (à direita do seu prato, à esquerda do adversário).
// O orbe de arrasto (camada de trânsito, px CSS) segue o ponteiro com um rastro na cor do tipo.
import { AdditiveBlending, CircleGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { RenderSystem } from '../core/render-system.ts';
import { TYPE_COLORS, asTypeId, mixHex } from '../core/tokens.ts';
import { drawTypeGlyph } from '../card/glyphs.ts';
import { acquireCanvasTexture, releaseTexture, type TextureLease } from '../card/textures.ts';
import { energyOrbImage, energyOrbsTag, loadEnergyOrbs } from '../card/energy-orbs.ts';

const DARK = '#14102A';

function plateTexture(rs: RenderSystem): TextureLease {
  return acquireCanvasTexture(rs, 'energy:plate', 256, 256, (ctx, w) => {
    const c = w / 2;
    const shadow = ctx.createRadialGradient(c, c + 10, 92, c, c + 10, 128);
    shadow.addColorStop(0, 'rgba(80,90,140,0.30)');
    shadow.addColorStop(1, 'rgba(80,90,140,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(c, c + 10, 128, 0, Math.PI * 2);
    ctx.fill();
    const disc = ctx.createRadialGradient(c - 30, c - 34, 10, c, c, 116);
    disc.addColorStop(0, '#FFFFFF');
    disc.addColorStop(0.62, '#EFEBFB');
    disc.addColorStop(1, '#D6CDEF');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(c, c, 116, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    ctx.arc(c, c, 111, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(150,140,205,0.45)';
    ctx.beginPath();
    ctx.arc(c, c, 90, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(c, c, 100, Math.PI * 1.08, Math.PI * 1.55);
    ctx.stroke();
  }, false);
}

function orbTexture(rs: RenderSystem, type: string): TextureLease {
  void loadEnergyOrbs();
  const base = TYPE_COLORS[asTypeId(type)];
  return acquireCanvasTexture(rs, `energy:orb:${asTypeId(type)}:${energyOrbsTag()}`, 256, 256, (ctx, w) => {
    const c = w / 2;
    // A bola do atlas, quando há (os 8 tipos da Zona); senão, o desenho procedural.
    const art = energyOrbImage(type);
    if (art) {
      ctx.drawImage(art, c - 104, c - 104, 208, 208);
      return;
    }
    const ball = ctx.createRadialGradient(c - 28, c - 32, 6, c, c, 104);
    ball.addColorStop(0, mixHex(base, '#FFFFFF', 0.38));
    ball.addColorStop(0.45, base);
    ball.addColorStop(1, mixHex(base, DARK, 0.58));
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(c, c, 104, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = 'rgba(20,16,42,0.55)';
    ctx.shadowBlur = 10;
    drawTypeGlyph(ctx, type, c, c + 2, 56, '#FFFFFF');
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.beginPath();
    ctx.ellipse(c - 34, c - 46, 36, 18, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(c, c, 101, 0, Math.PI * 2);
    ctx.stroke();
  }, false);
}

function haloTexture(rs: RenderSystem): TextureLease {
  return acquireCanvasTexture(rs, 'energy:halo', 256, 256, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, 128);
    g.addColorStop(0, 'rgba(143,247,247,0)');
    g.addColorStop(0.5, 'rgba(143,247,247,0)');
    g.addColorStop(0.62, 'rgba(160,250,250,0.95)');
    g.addColorStop(0.74, 'rgba(45,236,229,0.45)');
    g.addColorStop(1, 'rgba(45,236,229,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  }, false);
}

function nextTexture(rs: RenderSystem, type: string): TextureLease {
  void loadEnergyOrbs();
  const base = TYPE_COLORS[asTypeId(type)];
  return acquireCanvasTexture(rs, `energy:next:${asTypeId(type)}:${energyOrbsTag()}`, 128, 128, (ctx, w) => {
    const c = w / 2;
    // Próxima Energia: a bola do tipo escurecida (ainda não gerada), com o aro branco do prato.
    const art = energyOrbImage(type);
    if (art) {
      ctx.drawImage(art, c - 54, c - 54, 108, 108);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(20,16,42,0.22)';
      ctx.fillRect(0, 0, w, w);
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(c, c, 54, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = mixHex(base, DARK, 0.5);
    ctx.beginPath();
    ctx.arc(c, c, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    drawTypeGlyph(ctx, type, c, c + 1, 30, mixHex(base, '#FFFFFF', 0.5));
  }, false);
}

function disc(lease: TextureLease, renderOrder: number, additive = false): Mesh {
  const mesh = new Mesh(new CircleGeometry(0.5, 40), new MeshBasicMaterial({
    map: lease.texture, transparent: true, depthWrite: false, toneMapped: false, ...(additive ? { blending: AdditiveBlending } : {}),
  }));
  mesh.renderOrder = renderOrder;
  return mesh;
}

function disposeMesh(m: Mesh): void {
  m.removeFromParent();
  m.geometry.dispose();
  (m.material as MeshBasicMaterial).dispose();
}

export type EnergyPlatePose = { readonly x: number; readonly z: number; readonly scale: number; readonly side: 'HUMAN' | 'NPC' };

/**
 * Prato no mundo (raiz das zonas de Energia, sobre a mesa). `set` recebe o tipo pronto, o próximo e a opacidade do
 * orbe (0 enquanto um passo ou o arrasto o leva); `pulse` anima o halo e devolve true enquanto houver orbe.
 */
export function createEnergyPlate(rs: RenderSystem, parent: Group): {
  readonly set: (pose: EnergyPlatePose, ready: string | null, next: string | null, readyOpacity: number) => void;
  readonly pulse: (now: number) => boolean;
  readonly dispose: () => void;
} {
  const group = new Group();
  group.name = 'EnergyPlate';
  parent.add(group);
  const plateLease = plateTexture(rs);
  const haloLease = haloTexture(rs);
  const plate = disc(plateLease, 5);
  const halo = disc(haloLease, 6, true);
  group.add(plate, halo);
  for (const m of [plate, halo]) m.rotation.x = -Math.PI / 2;
  let orb: { type: string; tag: string; lease: TextureLease; mesh: Mesh } | null = null;
  let nextIcon: { type: string; tag: string; lease: TextureLease; mesh: Mesh } | null = null;
  let orbOpacity = 0;
  let scale = 1;
  const swap = (cur: typeof orb, type: string | null, make: (t: string) => TextureLease, order: number) => {
    const tag = energyOrbsTag();
    if (cur && cur.type === type && cur.tag === tag) return cur;
    if (cur) {
      disposeMesh(cur.mesh);
      releaseTexture(rs, cur.lease);
    }
    if (!type) return null;
    const lease = make(type);
    const mesh = disc(lease, order);
    mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
    return { type, tag, lease, mesh };
  };
  return {
    set: (pose, ready, next, readyOpacity) => {
      scale = pose.scale;
      group.position.set(pose.x, 0.006, pose.z);
      plate.scale.setScalar(pose.scale * 1.5);
      plate.position.y = 0;
      orb = swap(orb, ready, (t) => orbTexture(rs, t), 8);
      nextIcon = swap(nextIcon, next, (t) => nextTexture(rs, t), 9);
      orbOpacity = ready ? readyOpacity : 0;
      if (orb) {
        orb.mesh.scale.setScalar(pose.scale * 0.98);
        orb.mesh.position.y = 0.01;
        (orb.mesh.material as MeshBasicMaterial).opacity = orbOpacity;
        orb.mesh.visible = orbOpacity > 0.01;
      }
      halo.visible = orbOpacity > 0.01;
      halo.position.y = 0.008;
      if (nextIcon) {
        nextIcon.mesh.scale.setScalar(pose.scale * 0.44);
        nextIcon.mesh.position.set((pose.side === 'HUMAN' ? 1 : -1) * pose.scale * 0.52, 0.014, pose.scale * 0.44);
      }
    },
    pulse: (now) => {
      if (!halo.visible) return false;
      const k = 0.5 + 0.5 * Math.sin(now / 320);
      halo.scale.setScalar(scale * (1.55 + 0.1 * k));
      (halo.material as MeshBasicMaterial).opacity = orbOpacity * (0.55 + 0.4 * k);
      return true;
    },
    dispose: () => {
      group.removeFromParent();
      for (const m of [plate, halo]) disposeMesh(m);
      releaseTexture(rs, plateLease);
      releaseTexture(rs, haloLease);
      for (const o of [orb, nextIcon]) {
        if (!o) continue;
        disposeMesh(o.mesh);
        releaseTexture(rs, o.lease);
      }
    },
  };
}

/**
 * Orbe na camada de trânsito (px CSS, y para baixo): o arrasto livre e o voo da ligação. Um rastro de discos na cor do
 * tipo segue as últimas posições.
 */
export function createEnergyOrbSprite(rs: RenderSystem, parent: Group, type: string): {
  readonly set: (x: number, y: number, sizePx: number, opacity: number, z?: number) => void;
  readonly clearTrail: () => void;
  readonly dispose: () => void;
} {
  const group = new Group();
  parent.add(group);
  const orbLease = orbTexture(rs, type);
  const haloLease = haloTexture(rs);
  const orb = disc(orbLease, 82);
  const halo = disc(haloLease, 81, true);
  group.add(halo, orb);
  const color = TYPE_COLORS[asTypeId(type)];
  const trailMat = () => new MeshBasicMaterial({ color: mixHex(color, '#FFFFFF', 0.35), transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: AdditiveBlending });
  const trail = Array.from({ length: 7 }, () => {
    const m = new Mesh(new CircleGeometry(0.5, 20), trailMat());
    m.renderOrder = 80;
    parent.add(m);
    return m;
  });
  const history: { x: number; y: number }[] = [];
  return {
    set: (x, y, sizePx, opacity, z = 520) => {
      group.position.set(x, -y, 100 + z);
      orb.scale.setScalar(sizePx);
      halo.scale.setScalar(sizePx * 1.6);
      (orb.material as MeshBasicMaterial).opacity = opacity;
      (halo.material as MeshBasicMaterial).opacity = opacity * 0.85;
      group.visible = opacity > 0.01;
      const last = history[history.length - 1];
      if (!last || Math.hypot(last.x - x, last.y - y) > 2) history.push({ x, y });
      while (history.length > trail.length) history.shift();
      trail.forEach((m, i) => {
        const p = history[history.length - 1 - (trail.length - i)];
        if (!p || opacity <= 0.01) { m.visible = false; return; }
        const k = (i + 1) / trail.length;
        m.visible = true;
        m.position.set(p.x, -p.y, 100 + z - 1);
        m.scale.setScalar(sizePx * (0.35 + 0.45 * k));
        (m.material as MeshBasicMaterial).opacity = opacity * 0.35 * k;
      });
    },
    clearTrail: () => {
      history.length = 0;
      for (const m of trail) m.visible = false;
    },
    dispose: () => {
      group.removeFromParent();
      for (const m of [orb, halo, ...trail]) disposeMesh(m);
      releaseTexture(rs, orbLease);
      releaseTexture(rs, haloLease);
    },
  };
}

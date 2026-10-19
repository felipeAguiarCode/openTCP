// Harness de desenvolvimento (npm run dev → /harness.html): visualiza os palcos Three.js com a batalha
// de demonstração do motor real. Não faz parte da UI do jogo; HUD mínimo em DOM só para conferir âncoras.
import type { PresentedBoard } from '../../animation/board-model.ts';
import type { SpeedMode } from '../../animation/timing.ts';
import { CONDITION_LABEL } from '../../../domain/cards/text.ts';
import type { BattleCue } from '../battle/executors.ts';
import { createBattleStage, createRenderSystem, type BattlePresentationInput, type CosmeticVisualInput, type Quality, type RenderSystem } from '../index.ts';
import { buildBundle } from '../../../content/bundle.ts';
import { buildDemoBattle, type DemoBattle } from './demo-battle.ts';
import { mountExtraStages, type ExtraStages } from './extra-stages.ts';

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLDivElement;
const toolbar = document.getElementById('toolbar') as HTMLDivElement;
const status = document.getElementById('status') as HTMLDivElement;
const log = document.getElementById('log') as HTMLDivElement;

const params = new URLSearchParams(location.search);
const initialQuality = (params.get('quality') as Quality | null) ?? 'MEDIUM';
const created = createRenderSystem(canvas, {
  quality: initialQuality,
  onContextLost: () => setStatus('Contexto WebGL perdido — pausado.'),
  onContextRestored: () => setStatus('Contexto restaurado.'),
});
if (!created.ok) {
  document.body.innerHTML = `<div class="error">Modo de compatibilidade 2D necessário: ${created.code} — ${created.message}</div>`;
  throw new Error(created.code);
}
const rs: RenderSystem = created.system;

// Cosméticos reais do catálogo base (content/source/cosmetics.ts): o humano usa o conjunto do Porto das
// Marés com o sleeve e a moeda do Blastoise; o NPC, o preset do Bosque (preset-npc-c01, sleeve e moeda da Erika). Arena real
// do capítulo 2.
const COSMETICS = new Map(buildBundle().cosmetics.map((c) => [c.cosmeticId, c]));
const cosmetic = (id: string): CosmeticVisualInput => {
  const c = COSMETICS.get(id);
  if (!c) throw new Error(`cosmético ausente ${id}`);
  return c;
};
const presentation: BattlePresentationInput = {
  arenaId: 'arena-harbor',
  playerCosmetics: { playmat: cosmetic('mat-c02-harbor'), sleeve: cosmetic('sleeve-pocket-blastoise'), coin: cosmetic('coin-pocket-blastoise') },
  opponentCosmetics: { playmat: cosmetic('mat-c01-grove'), sleeve: cosmetic('sleeve-pocket-erikaandvileplume'), coin: cosmetic('coin-pocket-erikaalt') },
  displayMode: 'TURN_OWNER',
};

const demo: DemoBattle = buildDemoBattle('A');
const stage = createBattleStage(rs, {
  attemptId: 'harness-attempt',
  presentation,
  resolveCard: (ref) => ({ face: demo.faceOf(ref), definition: demo.definitionOf(ref) }),
});

let presented: PresentedBoard | null = null;
let showAnchors = params.get('anchors') === '1';
let speed: SpeedMode = (params.get('speed') as SpeedMode | null) ?? 'NORMAL';
let reduced = params.get('reduced') === '1';
let extras: ExtraStages | null = null;
stage.setSpeed(speed);
stage.setReducedMotion(reduced);

function setStatus(text: string): void {
  status.textContent = text;
}

function el(tag: string, cls: string, style: Partial<CSSStyleDeclaration>, html = ''): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  Object.assign(e.style, style);
  e.innerHTML = html;
  return e;
}

function renderHud(): void {
  hud.innerHTML = '';
  if (extras?.active()) return;
  const rects = stage.getAnchorRects();
  const regions = stage.getRegions();
  const actions = regions.actions;
  if (actions) {
    log.style.top = `${actions.y + 44}px`;
    log.style.width = `${Math.max(180, actions.width - 24)}px`;
  }
  if (showAnchors) {
    for (const [k, r] of Object.entries(rects)) hud.appendChild(el('div', 'anchor', { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }, `<span style="font:9px monospace;background:#fff8">${k}</span>`));
  }
  const b = presented;
  if (!b) return;
  const scale = stage.getLayout().scale;
  const overlays = stage.getOverlayRects();
  const covered = (x: number, y: number) => overlays.some((o) => x >= o.x && x <= o.x + o.width && y >= o.y && y <= o.y + o.height);
  const box = (r: { x: number; y: number; width: number; height: number }) => ({ left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
  // Barras (FOCUS_TABLE): adversário no topo, jogador no rodapé; pontos no centro (âncoras *_POINTS).
  if (regions.hud) hud.appendChild(el('div', 'pbar', box(regions.hud), '<span class="pbar-name"><i class="npc"></i>Adversário</span>'));
  if (regions.humanBar) hud.appendChild(el('div', 'pbar', box(regions.humanBar), '<span class="pbar-name"><i></i>Você</span>'));
  // Finalizar turno flutuante (HUMAN_END_TURN), Histórico e Menu redondos.
  const endTurn = rects.HUMAN_END_TURN;
  if (endTurn) {
    const mine = b.currentPlayer === b.viewer && !b.result;
    hud.appendChild(el('div', `end-turn${mine ? '' : ' off'}`, { ...box(endTurn), fontSize: `${Math.round(18 * Math.max(0.75, scale))}px` }, mine ? 'Finalizar turno' : 'Turno do adversário'));
  }
  for (const k of ['history', 'menu'] as const) if (regions[k]) hud.appendChild(el('div', 'float-round', box(regions[k]!), k === 'menu' ? '☰' : '⟲'));
  for (const player of ['A', 'B'] as const) {
    const side = b.sides[player];
    for (const e of [side.active, ...side.bench]) {
      if (!e) continue;
      const r = rects[`ENTITY:${e.entityId}`];
      if (!r) continue;
      const pct = e.maxHp > 0 ? Math.max(0, e.remainingHp / e.maxHp) : 0;
      const size = e.slot === 'ACTIVE' ? 1 : 0.78;
      // Rótulo sob uma carta em primeiro plano (cut-in, trânsito): some enquanto ela passa.
      if (covered(r.x + r.width - 10, r.y + 4)) continue;
      // Número grande sobre o canto superior direito da carta (referência), barra verde logo abaixo.
      hud.appendChild(el('div', `hp${e.knockedOut ? ' ko' : ''}`, { left: `${r.x + r.width + 4 * scale}px`, top: `${r.y + 2 * scale}px`, fontSize: `${Math.round(34 * size * Math.max(0.62, scale))}px` },
        `${e.remainingHp}<div class="bar" style="width:${Math.round(r.width * 0.62)}px"><i style="width:${pct * 100}%"></i></div>`));
      const conds = [e.conditions.poisoned ? 'POISONED' : null, e.conditions.burned ? 'BURNED' : null, e.conditions.control].filter(Boolean) as string[];
      if (conds.length) hud.appendChild(el('div', 'cond', { left: `${r.x + r.width + 6 * scale}px`, top: `${r.y + 26 * scale}px` }, conds.map((c) => `<span>${CONDITION_LABEL[c as keyof typeof CONDITION_LABEL] ?? c}</span>`).join('')));
    }
    const role = side.role;
    const deck = rects[`${role}_DECK_TOP`];
    const discard = rects[`${role}_DISCARD`];
    if (deck) hud.appendChild(el('div', 'counter', { left: `${deck.x + deck.width / 2}px`, top: `${deck.y + deck.height + 2}px` }, `Deck ${side.deckCount}`));
    if (discard) hud.appendChild(el('div', 'counter', { left: `${discard.x + discard.width / 2}px`, top: `${discard.y + discard.height + 2}px` }, `Descarte ${side.discard.length}`));
    const pts = rects[`${role}_POINTS`];
    if (pts) {
      // Três marcadores; os conquistados acendem em dourado com o número.
      const discs = [0, 1, 2].map((i) => `<i class="${i < side.points ? 'on' : ''}">${i < side.points ? i + 1 : ''}</i>`).join('');
      hud.appendChild(el('div', 'points', box(pts), discs));
    }
    if (role === 'NPC') {
      const fan = rects.NPC_HAND;
      if (fan) hud.appendChild(el('div', 'counter', { left: `${fan.x + fan.width + 14 * scale}px`, top: `${fan.y + fan.height - 16 * scale}px` }, `${side.hand.length}`));
    }
  }
}

function toast(text: string, ms = 1600): void {
  const d = document.createElement('div');
  d.textContent = text;
  log.prepend(d);
  setTimeout(() => d.remove(), ms);
  while (log.children.length > 8) log.lastElementChild?.remove();
}

function floatAt(entityId: string, text: string, heal: boolean): void {
  const r = stage.getAnchorRects()[`ENTITY:${entityId}`];
  if (!r) return;
  const f = el('div', `float${heal ? ' heal' : ''}`, { left: `${r.x + r.width / 2}px`, top: `${r.y + r.height / 2}px` }, text);
  document.body.appendChild(f);
  requestAnimationFrame(() => {
    f.style.transform = 'translate(-50%, -130%)';
    f.style.opacity = '0';
  });
  setTimeout(() => f.remove(), 1200);
}

function onCue(c: BattleCue): void {
  switch (c.kind) {
    case 'TURN_BANNER': {
      const r = stage.getRegions().turnBanner;
      toast(c.role === 'HUMAN' ? `Seu turno · ${c.turnNumber}` : `Turno do NPC · ${c.turnNumber}`);
      if (r && !c.skipped) {
        const b = el('div', `banner${c.role === 'NPC' ? ' npc' : ''}`, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` }, c.role === 'HUMAN' ? 'SEU TURNO' : 'TURNO DO NPC');
        document.body.appendChild(b);
        setTimeout(() => (b.style.opacity = '0'), 700);
        setTimeout(() => b.remove(), 1100);
      }
      break;
    }
    case 'ATTACK_NAME': toast(`${c.attackerName}: ${c.attackName}`); break;
    case 'DAMAGE': toast(c.prevented ? 'Protegido' : `${c.amount} de dano`); if (!c.skipped) floatAt(c.entityId, c.prevented ? '0' : `-${c.amount}`, false); break;
    case 'HEAL': toast(`+${c.amount} HP`); if (!c.skipped) floatAt(c.entityId, `+${c.amount}`, true); break;
    case 'COIN_RESULT': toast(`Moeda ${c.index + 1}/${c.count}: ${c.face === 'HEADS' ? 'Cara' : 'Coroa'}`); break;
    case 'KNOCKOUT': toast('Nocaute!'); break;
    case 'POINTS': toast(`${c.role === 'HUMAN' ? 'Você' : 'NPC'} +${c.points} ponto(s) — total ${c.total}`); break;
    case 'TRAINER': toast(`${c.name} (${c.subtype})`); break;
    case 'DRAW': toast(c.role === 'HUMAN' ? `Comprou ${c.count}` : `NPC comprou ${c.count}`); break;
    case 'RESULT': toast(c.result?.winner ? `Fim: vitória de ${c.result.winner}` : 'Fim: empate'); break;
    default: break;
  }
}

stage.onPresentedChange((b) => {
  presented = b;
  renderHud();
});
stage.onAnchorsChanged(() => renderHud());
stage.onCue(onCue);
stage.onPick((t) => toast(`pick ${JSON.stringify(t)}`, 2200));
stage.onDragIntent((i) => toast(`drag → ${JSON.stringify(i.target)}`, 2200));

function loadDemo(): void {
  stage.setView(demo.start, presentation);
  stage.setHighlights({ selectable: [], selected: [], targets: [] });
}

let currentBatch = '';

async function playScript(): Promise<void> {
  loadDemo();
  for (const batch of demo.script) {
    toast(`▶ ${batch.label}`);
    currentBatch = batch.label;
    await stage.present({ events: batch.events, before: batch.before, after: batch.after });
  }
  currentBatch = '';
  toast('Roteiro concluído');
}

/** Treinador sem alvo a partir do estado depois do Básico: prévia no centro e dissolução (gameplay-pocket §9). */
async function playTrainer(): Promise<void> {
  const t = demo.trainer;
  if (!t) {
    toast('Sem Treinador sem alvo na mão do roteiro');
    return;
  }
  stage.setView(t.before, presentation);
  currentBatch = t.label;
  await stage.present({ events: t.events, before: t.before, after: t.after });
  currentBatch = '';
}

async function playOpening(): Promise<void> {
  stage.setView(demo.opening.before, presentation);
  currentBatch = demo.opening.label;
  await stage.present({ events: demo.opening.events, before: demo.opening.before, after: demo.opening.after, newAttempt: true });
  currentBatch = '';
}

/** Pausa a apresentação quando o lote `label` atinge `ms` de tempo de apresentação (capturas). */
function pauseWhen(label: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = performance.now();
    const check = () => {
      const d = stage.diagnostics();
      if (currentBatch === label && d.presenting && d.elapsedMs >= ms) {
        stage.pause();
        resolve(true);
        return;
      }
      if (performance.now() - started > 60000) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

/**
 * Promoção depois do nocaute (gameplay-pocket §6.2): o estado final do roteiro sem o Ativo humano; os Pokémon do
 * Banco flutuam e se arrastam até o espaço do Ativo. As solturas ficam em `__harness.drops`.
 */
const drops: string[] = [];
stage.onEntityDrop((d) => {
  drops.push(d.entityId);
  toast(`promoção → ${d.entityId}`, 2200);
});
function promoteDemo(): string[] {
  const last = demo.script[demo.script.length - 1]!.after;
  const human = last.sides[last.viewer];
  const view = { ...last, sides: { ...last.sides, [last.viewer]: { ...human, active: null } } };
  stage.setView(view, presentation);
  const bench = human.bench.filter((e): e is NonNullable<typeof e> => !!e).map((e) => e.entityId);
  stage.setHighlights({ selectable: bench, selected: [], targets: ['HUMAN_ACTIVE'], floating: bench });
  return bench;
}

function demoHighlights(): void {
  const b = presented;
  if (!b) return;
  const human = b.sides[b.viewer];
  const npc = b.sides[b.viewer === 'A' ? 'B' : 'A'];
  stage.setHighlights({
    selectable: human.hand.map((h) => h.key),
    selected: human.active ? [human.active.entityId] : [],
    targets: [...(npc.active ? [npc.active.entityId] : []), ...human.bench.map((e, i) => (e ? null : `HUMAN_BENCH_${i}`)).filter((x): x is string => !!x)],
  });
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  if (primary) b.className = 'primary';
  b.addEventListener('click', onClick);
  toolbar.appendChild(b);
  return b;
}

function select<T extends string>(label: string, values: readonly T[], current: T, onChange: (v: T) => void): void {
  const s = document.createElement('select');
  s.title = label;
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = `${label}: ${v}`;
    if (v === current) o.selected = true;
    s.appendChild(o);
  }
  s.addEventListener('change', () => onChange(s.value as T));
  toolbar.appendChild(s);
}

button('Carregar demo', () => {
  extras?.close();
  loadDemo();
}, true);
button('Abertura', () => {
  extras?.close();
  void playOpening();
});
button('Roteiro (compra→Básico→Energia→ataque/moeda→KO→pontos)', () => {
  extras?.close();
  void playScript();
}, true);
button('Treinador (prévia e dissolução)', () => {
  void playTrainer();
});
button('Pular', () => stage.skipToBarrier());
button('Pausa', () => stage.pause());
button('Retomar', () => stage.resume());
button('Destaques', () => demoHighlights());
select('Velocidade', ['NORMAL', 'FAST', 'INSTANT'] as const, speed, (v) => {
  speed = v;
  stage.setSpeed(v);
});
const rm = button('Movimento reduzido', () => {
  reduced = !reduced;
  stage.setReducedMotion(reduced);
  rm.setAttribute('aria-pressed', String(reduced));
});
rm.setAttribute('aria-pressed', String(reduced));
select('Layout', ['auto', 'desktop1080', 'compact720'] as const, 'auto', (v) => stage.setLayoutProfile(v));
select('Qualidade', ['LOW', 'MEDIUM', 'HIGH'] as const, initialQuality, (v) => rs.setQuality(v));
select('Tapete', ['TURN_OWNER', 'PLAYER_FIXED', 'NEUTRAL'] as const, 'TURN_OWNER', (v) => {
  const p = { ...presentation, displayMode: v };
  Object.assign(presentation, p);
  if (presented) stage.setView(demo.script[demo.script.length - 1]!.after, p);
});
const anchorsBtn = button('Âncoras', () => {
  showAnchors = !showAnchors;
  anchorsBtn.setAttribute('aria-pressed', String(showAnchors));
  renderHud();
});
extras = mountExtraStages(rs, demo, { button, onOpen: () => {
  stage.setActive(false);
  hud.innerHTML = '';
  log.innerHTML = '';
}, onClose: () => {
  stage.setActive(true);
  renderHud();
} });

function tick(): void {
  const d = rs.diagnostics();
  const s = stage.diagnostics();
  setStatus(`${s.profileId} ×${s.frame.scale.toFixed(3)} · DPR ${d.pixelRatio} · ${d.quality}\ndraw calls ${d.drawCalls} · tris ${d.triangles} · tex ${d.textures} · geo ${d.geometries} · prog ${d.programs}\nentidades ${s.entities} · mão ${s.handCards} · proxies ${s.liveProxies} · ${s.presenting ? 'apresentando' : 'pronto'} · fit ${s.fit.ok ? 'ok' : 'NOK'} (${s.fit.maxSlotErrorPx.toFixed(2)} px)`);
  setTimeout(tick, 500);
}
tick();

loadDemo();

declare global {
  interface Window {
    __harness?: Record<string, unknown>;
  }
}
window.__harness = {
  chrome: (on: boolean) => document.body.classList.toggle('clean', !on),
  loadDemo,
  playScript,
  playOpening,
  playTrainer,
  demoHighlights,
  promoteDemo,
  drops: () => [...drops],
  skip: () => stage.skipToBarrier(),
  pauseWhen,
  pause: () => stage.pause(),
  resume: () => stage.resume(),
  isPresenting: () => stage.isPresenting(),
  setSpeed: (s: SpeedMode) => stage.setSpeed(s),
  setReducedMotion: (on: boolean) => stage.setReducedMotion(on),
  setLayout: (id: 'auto' | 'desktop1080' | 'compact720') => stage.setLayoutProfile(id),
  setQuality: (q: Quality) => rs.setQuality(q),
  showAnchors: (on: boolean) => {
    showAnchors = on;
    renderHud();
  },
  diagnostics: () => ({ render: rs.diagnostics(), stage: stage.diagnostics() }),
  anchorRects: () => stage.getAnchorRects(),
  extras: () => extras,
  stage,
  rs,
};

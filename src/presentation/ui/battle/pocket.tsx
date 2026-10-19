// Camada da mesa no estilo do Pokémon TCG Pocket (gameplay-pocket §4, §5.1, §7): aviso no topo, faixa de turno com
// “Turno atual: N” e mosaico de hexágonos na troca de tapete, “Pronto? Já!”, folha do menu ≡ e os botões da
// preparação na mesa. Só apresentação: nada aqui decide regra nem grava.
import type { JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ContentIndex } from '../../../application/content.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { CoinDisc, type CoinLike } from '../components/coin.tsx';
import { Button } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { boxStyle, toBox, type Rect, type StageLayout } from './layout.ts';
import { Region } from './stage.tsx';
import type { CoinShown } from './controller.ts';

export type BattleToast = { readonly text: string; readonly tone?: 'info' | 'wait' | 'deny'; readonly pill?: string | null };

/** Aviso em pílula branca no topo da mesa (região `toast`); espera e recusa em vermelho. */
export function ToastLayer({ layout, toast }: { readonly layout: StageLayout; readonly toast: BattleToast | null }): JSX.Element | null {
  if (!toast) return null;
  return (
    <Region layout={layout} rect={layout.regions.toast} class="battle-toast-region">
      <div key={toast.text} class={`battle-toast tone-${toast.tone ?? 'info'}`} role="status" aria-live="polite" data-testid="battle-toast">
        <span>{toast.text}</span>
        {toast.pill ? <b class="battle-toast-pill">{toast.pill}</b> : null}
      </div>
    </Region>
  );
}

export type TurnBannerInfo = { readonly role: 'HUMAN' | 'NPC'; readonly turn: number | null; readonly key: number };

/** Faixa de turno: ciano pela esquerda (seu turno) ou coral pela direita (adversário), com “Turno atual: N”. */
export function TurnBanner({ layout, info, reduced, mosaic }: {
  readonly layout: StageLayout; readonly info: TurnBannerInfo | null; readonly reduced: boolean; readonly mosaic: boolean;
}): JSX.Element | null {
  // Antes do turno 1, “Pronto? Já!” ocupa a faixa e depois dá lugar ao banner (gameplay-pocket §5.1).
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!info || info.turn !== 1) { setReady(false); return; }
    setReady(true);
    const t = setTimeout(() => setReady(false), reduced ? 300 : 900);
    return () => clearTimeout(t);
  }, [info?.key]);
  if (!info) return null;
  // Mensagem de destaque centrada na tela (decisão do autor, 15/10/2026): a camada cobre a tela inteira e a faixa
  // fica no centro exato; a pílula “Turno atual” pende abaixo dela sem deslocá-la.
  const rect: Rect = [0, 0, layout.design[0], layout.design[1]];
  return (
    <>
      {mosaic && !reduced && !ready ? <HexMosaic key={info.key} layout={layout} /> : null}
      <div class={`headline-layer ${reduced ? 'is-reduced' : ''}`} style={boxStyle(toBox(layout, rect))} role="status" data-testid="turn-banner">
        {ready ? (
          <div key="ready" class="ready-go">
            <span class="ready-streak ready-streak-a" aria-hidden="true" />
            <span class="ready-streak ready-streak-b" aria-hidden="true" />
            <b class="ready-go-text">Pronto? Já!</b>
          </div>
        ) : (
          <div key={`turn-${info.key}`} class={`turn-band side-${info.role.toLowerCase()}`}>
            <div class="turn-band-strip"><span class="turn-band-text">{info.role === 'HUMAN' ? 'Seu turno' : 'Turno do adversário'}</span></div>
            {info.turn ? <span class="turn-band-pill">Turno atual: <b>{info.turn}</b></span> : null}
          </div>
        )}
      </div>
    </>
  );
}

/** Mosaico de hexágonos que acende em ordem aleatória sobre a mesa durante a troca de tapete (~0,6 s). */
function HexMosaic({ layout }: { readonly layout: StageLayout }): JSX.Element {
  const board = layout.regions.board;
  const cells = useMemo(() => {
    const out: { x: number; y: number; d: number; c: number }[] = [];
    const w = 96;
    const h = w * 0.866;
    for (let row = 0; row * h < board[3] + h; row += 1) {
      for (let col = 0; col * w * 0.75 < board[2] + w; col += 1) {
        out.push({ x: col * w * 0.75, y: row * h + (col % 2 ? h / 2 : 0), d: Math.round(Math.random() * 420), c: Math.floor(Math.random() * 5) });
      }
    }
    return out;
  }, []);
  return (
    <div class="hex-mosaic" style={boxStyle(toBox(layout, board))} aria-hidden="true">
      <svg viewBox={`0 0 ${board[2]} ${board[3]}`} preserveAspectRatio="none">
        {cells.map((h, i) => (
          <polygon key={i} class={`hex hex-c${h.c}`} style={{ animationDelay: `${h.d}ms` }}
            points={[0, 60, 120, 180, 240, 300].map((a) => `${h.x + 46 * Math.cos((a * Math.PI) / 180)},${h.y + 46 * Math.sin((a * Math.PI) / 180)}`).join(' ')} />
        ))}
      </svg>
    </div>
  );
}

/** Folha do menu ≡ (gameplay-pocket §7.2): desliza da esquerda, acima do botão; fecha ao tocar fora. */
export function BattleMenu({ layout, open, onClose, onHistory, onPause, onSaveExit, onConcede }: {
  readonly layout: StageLayout; readonly open: boolean; readonly onClose: () => void;
  readonly onHistory: () => void; readonly onPause: () => void; readonly onSaveExit: () => void; readonly onConcede: () => void;
}): JSX.Element | null {
  if (!open) return null;
  const m = layout.regions.menu;
  const width = layout.profile === 'desktop1080' ? 300 : 236;
  const height = layout.profile === 'desktop1080' ? 248 : 200;
  const rect: Rect = [m[0], Math.max(8, m[1] + m[3] - height), width, height];
  const pick = (fn: () => void) => () => { onClose(); fn(); };
  return (
    <>
      <button type="button" class="battle-menu-scrim" aria-label="Fechar menu" onClick={onClose} />
      <div class="battle-menu" style={boxStyle(toBox(layout, rect))} role="menu" aria-label="Menu do duelo" data-testid="battle-menu-sheet">
        <button type="button" role="menuitem" class="battle-menu-item" onClick={pick(onHistory)}><Icon name="history" size={20} /> Histórico</button>
        <button type="button" role="menuitem" class="battle-menu-item" onClick={pick(onPause)} data-testid="pause"><Icon name="settings" size={20} /> Pausa e ajustes</button>
        <button type="button" role="menuitem" class="battle-menu-item" onClick={pick(onSaveExit)}><Icon name="saves" size={20} /> Salvar e sair</button>
        <button type="button" role="menuitem" class="battle-menu-concede" onClick={pick(onConcede)}>Desistir</button>
      </div>
    </>
  );
}

/** Preparação na mesa (gameplay-pocket §4): Recomeçar à esquerda e Iniciar duelo à direita, na divisória. */
export function SetupControls({ layout, canStart, canReset, busy, onReset, onStart }: {
  readonly layout: StageLayout; readonly canStart: boolean; readonly canReset: boolean; readonly busy: boolean; readonly onReset: () => void; readonly onStart: () => void;
}): JSX.Element {
  return (
    <>
      <div class="float-setup-reset" style={boxStyle(toBox(layout, layout.regions.setupReset))}>
        <Button icon="refresh" onClick={onReset} disabledReason={canReset ? null : 'Nenhuma carta colocada.'} testId="setup-reset">Recomeçar</Button>
      </div>
      <div class="float-end-turn" style={boxStyle(toBox(layout, layout.regions.endTurn))}>
        <Button variant="primary" onClick={onStart} loading={busy} disabledReason={canStart ? null : 'Escolha um Básico para o Ativo.'} testId="setup-confirm">Iniciar duelo</Button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ fase 2 (gameplay-pocket §10)

/** PS que conta em degraus de 10 a cada ~0,1 s, vermelho ao cair e verde ao subir; com movimento reduzido, salta. */
export function HpNumber({ value, reduced }: { readonly value: number; readonly reduced: boolean }): JSX.Element {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<'down' | 'up' | null>(null);
  useEffect(() => {
    if (reduced || shown === value) { setShown(value); return undefined; }
    const step = value < shown ? -10 : 10;
    setDir(step < 0 ? 'down' : 'up');
    let current = shown;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const id = setInterval(() => {
      current = step < 0 ? Math.max(value, current + step) : Math.min(value, current + step);
      setShown(current);
      if (current === value) {
        clearInterval(id);
        settle = setTimeout(() => setDir(null), 700);
      }
    }, 100);
    return () => { clearInterval(id); if (settle) clearTimeout(settle); };
  }, [value]);
  return <b class={dir ? `hp-${dir}` : undefined}>{shown}</b>;
}

export type ScoringInfo = { readonly role: 'HUMAN' | 'NPC'; readonly points: number; readonly total: number; readonly pointsToWin: number; readonly key: number };

/** Tela “+1 ponto!” (§10.5): mesa desfocada, faixa azul/coral, avatar, medalhões e o texto com pop. */
export function ScoringOverlay({ info, name, avatar }: { readonly info: ScoringInfo | null; readonly name: string; readonly avatar: JSX.Element }): JSX.Element | null {
  if (!info) return null;
  const label = info.points === 1 ? '+1 ponto!' : `+${info.points} pontos!`;
  return (
    <div key={info.key} class={`scoring-overlay side-${info.role.toLowerCase()}`} role="status" aria-live="assertive" data-testid="scoring-overlay">
      <div class="scoring-band">
        <b class="scoring-text">{label}</b>
        <div class="scoring-avatar">{avatar}</div>
        <div class="scoring-stripe">
        <span class="scoring-name">{name}</span>
        <span class="scoring-medals" aria-label={`${info.total} de ${info.pointsToWin} pontos`}>
          {Array.from({ length: info.pointsToWin }, (_, i) => (
            <span key={i} class={`scoring-medal ${i < info.total ? 'is-won' : ''} ${i >= info.total - info.points && i < info.total ? 'is-new' : ''}`}>{i + 1}</span>
          ))}
        </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Resultado da moeda (§10.6): véu na cor de quem lança e “Cara!”/“Coroa!” digitado; a sequência fica embaixo. Na mesa
 * 2D (`coin` presente), a moeda equipada no deck de quem lança gira antes do texto; na 3D, a moeda é a da cena.
 */
export function CoinResult({ shown, role, coin, reduced }: {
  readonly shown: CoinShown | null; readonly role: 'HUMAN' | 'NPC'; readonly coin: CoinLike | null; readonly reduced: boolean;
}): JSX.Element | null {
  if (!shown || !shown.faces.length) return null;
  const words = shown.faces.map((f) => (f === 'HEADS' ? 'Cara' : 'Coroa'));
  const face = shown.faces[shown.faces.length - 1]!;
  const last = `${words[words.length - 1]}!`;
  const flip = coin && !reduced ? 520 : 0;
  return (
    <div key={shown.key} class={`coin-overlay side-${role.toLowerCase()}`} role="status" aria-live="polite" data-testid="coin-result" data-face={face}>
      {coin ? <CoinDisc coin={coin} face={face} toss={!reduced} spins={2} durationMs={flip} size={132} /> : null}
      <b class="coin-typed" aria-label={last}>{[...last].map((ch, i) => <span key={i} style={{ animationDelay: `${flip + i * 60}ms` }}>{ch}</span>)}</b>
      {words.length > 1 ? <span class="coin-sequence">{words.join(' · ')}</span> : null}
    </div>
  );
}

/** Pílula de fim (§10.7): Vitória (azul), Derrota (laranja→vermelho) ou Empate, sobre véu escuro. */
export function ResultPill({ outcome }: { readonly outcome: 'WIN' | 'LOSS' | 'DRAW' | null }): JSX.Element | null {
  if (!outcome) return null;
  const text = outcome === 'WIN' ? 'Vitória' : outcome === 'LOSS' ? 'Derrota' : 'Empate';
  return (
    <div class={`result-pill-overlay outcome-${outcome.toLowerCase()}`} role="status" aria-live="assertive" data-testid="result-pill">
      <b class="result-pill">{text}</b>
    </div>
  );
}

// ------------------------------------------------------------------ fase 3 (gameplay-pocket §5.2, §9)

export type EnergyGenInfo = { readonly role: 'HUMAN' | 'NPC'; readonly key: number };

/**
 * Energia gerada (§5.2): flash branco com estrela sobre o prato e, no seu lado, o rótulo “Próxima Energia gerada” logo
 * abaixo dele (~0,7 s). Serve às mesas 2D e 3D: o prato fica no centro da região da Zona de Energia nas duas.
 */
export function EnergyGenerated({ layout, info }: { readonly layout: StageLayout; readonly info: EnergyGenInfo | null }): JSX.Element | null {
  if (!info) return null;
  const r = layout.regions[info.role === 'HUMAN' ? 'humanEnergy' : 'npcEnergy'];
  const d = layout.energy.ready * 1.45;
  const [cx, cy] = [r[0] + r[2] / 2, r[1] + r[3] / 2];
  const flash: Rect = [cx - d * 0.7, cy - d * 0.7, d * 1.4, d * 1.4];
  const w = layout.profile === 'desktop1080' ? 236 : 180;
  const h = layout.profile === 'desktop1080' ? 34 : 26;
  const label: Rect = [cx - w / 2, cy + d / 2 + 4, w, h];
  return (
    <>
      <span key={`f${info.key}`} class="zone-flash" style={boxStyle(toBox(layout, flash))} aria-hidden="true" />
      {info.role === 'HUMAN' ? (
        <div key={`l${info.key}`} class="zone-generated" style={boxStyle(toBox(layout, label))} role="status" data-testid="energy-generated">Próxima Energia gerada</div>
      ) : null}
    </>
  );
}

export type SpotlightInfo = { readonly printingId: string; readonly mode: 'DRAW' | 'PLAY' | 'TRAINER'; readonly subtype: string | null; readonly key: number };

/** Duração de cada prévia da mesa 2D em velocidade Normal (a 3D segue os presets DRAW_SELF, PLAY_BASIC e PLAY_ITEM). */
export const SPOTLIGHT_MS: Readonly<Record<SpotlightInfo['mode'], number>> = { DRAW: 700, PLAY: 750, TRAINER: 950 };

/**
 * Prévia grande no centro da mesa 2D (§5.2, §9): a carta comprada ou jogada surge com um pop e sai; o Treinador clareia e
 * dissolve em molduras na cor do subtipo (Item ciano, Apoiador dourado, Ferramenta lilás, Estádio verde).
 */
export function CardSpotlight({ layout, info, content }: { readonly layout: StageLayout; readonly info: SpotlightInfo | null; readonly content: ContentIndex }): JSX.Element | null {
  if (!info) return null;
  const r = layout.regions.attackCutin;
  const w = layout.profile === 'desktop1080' ? 300 : 210;
  const rect: Rect = [r[0] + r[2] / 2 - w / 2, r[1] + r[3] / 2 - w * 0.7, w, w * 1.4];
  const sub = (info.subtype ?? 'ITEM').toLowerCase();
  return (
    <div key={info.key} class={`card-spotlight mode-${info.mode.toLowerCase()} sub-${sub}`} style={{ ...boxStyle(toBox(layout, rect)), '--spot-ms': `${SPOTLIGHT_MS[info.mode]}ms` }}
      aria-hidden="true" data-testid="card-spotlight">
      <CardFace face={faceOf(content, info.printingId)} size="lg" />
      {info.mode === 'TRAINER' ? <><span class="spot-plate" /><span class="spot-ring spot-ring-a" /><span class="spot-ring spot-ring-b" /><span class="spot-ring spot-ring-c" /></> : null}
    </div>
  );
}

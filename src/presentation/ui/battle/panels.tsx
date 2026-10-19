// Painéis HTML do duelo (interface §23.4, §25, §26, §27): HUD superior, seletor universal de decisões,
// inspector, histórico e menu de pausa. As ações do turno são botões flutuantes (actions.tsx).
import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { BattleView, CardRef, DecisionView } from '../../../domain/battle/views.ts';
import type { ContentIndex } from '../../../application/content.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { Button, Drawer } from '../components/controls.tsx';
import type { LogLine } from './log.ts';

export function TopHud({ title, subtitle, view, aiThinking, onPause, onHistory, difficulty }: {
  readonly title: string; readonly subtitle: string; readonly view: BattleView; readonly aiThinking: boolean; readonly onPause: () => void; readonly onHistory: () => void; readonly difficulty: string | null;
}): JSX.Element {
  const mine = view.currentPlayer === view.viewer;
  const deciding = view.decisions.find((d) => !d.answered);
  const status = view.result ? 'Partida encerrada'
    : view.phase === 'SETUP' ? 'Preparação'
    : deciding && deciding.player !== view.viewer ? 'Adversário escolhendo'
    : mine ? 'Seu turno' : aiThinking ? 'Turno do adversário · IA pensando' : 'Turno do adversário';
  return (
    <header class="battle-hud">
      <Button variant="ghost" icon="pause" onClick={onPause} label="Pausa (Esc)">Pausa</Button>
      <div class="battle-hud-title"><strong>{title}</strong><small class="muted">{subtitle}</small></div>
      <div class={`battle-turn ${mine ? 'is-mine' : 'is-theirs'}`} role="status" aria-live="polite">
        <span>Turno {view.globalTurnNumber}</span><b>{status}</b>
      </div>
      <div class="battle-hud-right">
        {difficulty ? <span class="badge">{difficulty}</span> : null}
        <Button variant="ghost" icon="history" onClick={onHistory} label="Histórico (H)">Histórico</Button>
      </div>
    </header>
  );
}

export type Selection =
  | { readonly kind: 'HAND_CARD'; readonly cardId: string }
  | { readonly kind: 'ENTITY'; readonly entityId: string }
  | { readonly kind: 'ENERGY' }
  | null;

/** Alvo pendente escolhido por clique: Energia pronta → Pokémon; Recuo → Pokémon do Banco. Cartas da mão se arrastam. */
export type Pending =
  | { readonly kind: 'ATTACH'; readonly targets: readonly string[] }
  | { readonly kind: 'RETREAT'; readonly benchIndex: number | null }
  | null;

const DECISION_TITLE: Record<string, string> = {
  PROMOTE: 'Escolha o novo Pokémon Ativo', SELECT_TARGETS: 'Escolha o alvo', SELECT_CARDS: 'Escolha cartas', SELECT_ENERGY: 'Escolha Energias',
  SELECT_ATTACK: 'Escolha o ataque', CONFIRM_OPTIONAL: 'Usar o efeito?', ORDER_TOP: 'Ordene as cartas do topo', SETUP: 'Prepare o campo',
};

/** Seletor universal (interface §26.1): título, motivo, cardinalidade, contador; confirmar só com o número correto. */
export function DecisionPanel({ decision, view, content, onResolve, busy, labelFor }: {
  readonly decision: DecisionView; readonly view: BattleView; readonly content: ContentIndex; readonly onResolve: (selection: string[]) => void; readonly busy: boolean;
  readonly labelFor: (option: string) => { label: string; printingId: string | null };
}): JSX.Element {
  const [picked, setPicked] = useState<string[]>([]);
  const options = decision.options ?? [];
  const ordering = decision.kind === 'ORDER_TOP';
  const toggle = (o: string) => {
    if (picked.includes(o)) setPicked(picked.filter((x) => x !== o));
    else if (decision.max === 1) setPicked([o]);
    else if (picked.length < decision.max) setPicked([...picked, o]);
  };
  const ok = picked.length >= decision.min && picked.length <= decision.max;
  if (decision.kind === 'CONFIRM_OPTIONAL') {
    return (
      <section class="decision-panel" role="dialog" aria-label={DECISION_TITLE.CONFIRM_OPTIONAL}>
        <h2>{DECISION_TITLE.CONFIRM_OPTIONAL}</h2>
        <div class="row"><Button variant="primary" onClick={() => onResolve(['YES'])} loading={busy}>Sim</Button><Button onClick={() => onResolve(['NO'])} loading={busy}>Não</Button></div>
      </section>
    );
  }
  void view;
  return (
    <section class="decision-panel" role="dialog" aria-label={DECISION_TITLE[decision.kind] ?? 'Escolha'}>
      <h2>{DECISION_TITLE[decision.kind] ?? 'Escolha'}</h2>
      <p class="small muted">{ordering ? 'Clique na ordem desejada (a primeira fica no topo).' : decision.min === decision.max ? `Escolha ${decision.min}.` : `Escolha de ${decision.min} a ${decision.max}.`} Selecionadas: {picked.length}/{decision.max}.</p>
      <div class="decision-options">
        {options.map((o) => {
          const info = labelFor(o);
          const index = picked.indexOf(o);
          return (
            <button key={o} type="button" class={`decision-option ${index >= 0 ? 'is-selected' : ''}`} aria-pressed={index >= 0} onClick={() => toggle(o)}>
              {info.printingId ? <CardFace face={faceOf(content, info.printingId)} size="xs" /> : null}
              <span>{info.label}</span>
              {index >= 0 && (ordering || decision.max > 1) ? <b class="decision-index">{index + 1}</b> : null}
            </button>
          );
        })}
      </div>
      <div class="row">
        <Button variant="primary" onClick={() => onResolve(picked)} loading={busy} disabledReason={ok ? null : `Selecione ${decision.min === decision.max ? decision.min : `${decision.min}–${decision.max}`}.`} testId="decision-confirm">Confirmar</Button>
        {picked.length ? <Button variant="ghost" onClick={() => setPicked([])}>Limpar</Button> : null}
        {decision.min > 0 ? <small class="muted">Esta escolha precisa ser concluída.</small> : null}
      </div>
    </section>
  );
}

export function HistoryDrawer({ open, onClose, log }: { readonly open: boolean; readonly onClose: () => void; readonly log: readonly LogLine[] }): JSX.Element | null {
  return (
    <Drawer open={open} title="Histórico" onClose={onClose}>
      <ol class="battle-log">
        {[...log].reverse().map((l) => <li key={l.seq} class={`log-${l.tone}`}>{l.text}</li>)}
      </ol>
    </Drawer>
  );
}

export function InspectorDrawer({ refCard, content, onClose, children }: { readonly refCard: CardRef | null; readonly content: ContentIndex; readonly onClose: () => void; readonly children?: ComponentChildren }): JSX.Element | null {
  const face = refCard ? faceOf(content, refCard.printingId) : null;
  return (
    <Drawer open={!!refCard} title={face?.name ?? 'Carta'} onClose={onClose} side="left">
      <div class="stack">
        <CardFace face={face} size="lg" />
        {face?.attacks.map((a) => <div key={a.name} class="rule-block"><strong>{a.name} {a.damage}</strong>{a.text ? <p class="small">{a.text}</p> : null}</div>)}
        {face?.abilities.map((a) => <div key={a.name} class="rule-block"><strong>Habilidade · {a.name}</strong><p class="small">{a.text}</p></div>)}
        {face?.category === 'TRAINER' ? <p class="rule-block small">{face.trainerText}</p> : null}
        {children}
      </div>
    </Drawer>
  );
}

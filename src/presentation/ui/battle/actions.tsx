// Ações do turno. Ataques, Habilidades, Fóssil e Recuo ficam na ficha do Pokémon tocado (decisão do autor, 15/10/2026;
// referência .specs/referencias/batalha): a carta sobe ampliada para o centro da mesa e as ações aparecem sobre ela. Na região
// `actionButtons` ficam só a dica do alvo pendente (Energia, Recuo) com Cancelar e o “Jogar” de uma carta da mão
// selecionada. Jogar cartas é arrastar até o campo; o clique numa carta da mão é a alternativa.
import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Action } from '../../../domain/battle/types.ts';
import type { BattleView } from '../../../domain/battle/views.ts';
import type { PokemonType } from '../../../domain/cards/types.ts';
import type { ContentIndex } from '../../../application/content.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { Button } from '../components/controls.tsx';
import { TypeIcon } from '../components/icons.tsx';
import type { Affordances, AttackRow } from './affordances.ts';
import { boxStyle, toBox, type StageLayout } from './layout.ts';
import type { Pending, Selection } from './panels.tsx';

function costIcons(cost: Readonly<Partial<Record<string, number>>>, size: number): JSX.Element[] {
  return Object.entries(cost).flatMap(([t, n]) => Array.from({ length: n ?? 0 }, (_, i) => <TypeIcon key={`${t}${i}`} type={t as PokemonType} size={size} label={false} />));
}

/**
 * Linha de ataque no visual do painel do Pocket (gameplay-pocket §10.1): custo à esquerda, nome e dano, texto do
 * ataque embaixo; utilizável com borda brilhante, bloqueada em cinza — tocar nela mostra o motivo no aviso do topo.
 */
function AttackButton({ row, type, lock, onAction, onBlocked, compact }: {
  readonly row: AttackRow; readonly type: PokemonType; readonly lock: string | null; readonly onAction: (a: Action) => void;
  readonly onBlocked: (reason: string) => void; readonly compact: boolean;
}): JSX.Element {
  const reason = lock ?? (row.action ? null : row.reason ?? 'Indisponível agora');
  return (
    <button type="button" class={`attack-button ${reason ? 'is-blocked' : 'is-ready'}`} style={{ '--strip': `var(--pocket-strip-${type.toLowerCase()})` }} data-testid={`attack-${row.attack.id}`}
      aria-disabled={reason ? 'true' : undefined} title={[reason, row.text].filter(Boolean).join(' — ') || undefined}
      aria-label={`Atacar: ${row.attack.name}${row.damage ? `, ${row.damage}` : ''}${reason ? ` (${reason})` : ''}`}
      onClick={() => { if (reason) onBlocked(reason); else if (row.action) onAction(row.action); }}>
      <span class="attack-cost" aria-hidden="true">{costIcons(row.attack.energyCost, compact ? 14 : 18)}</span>
      <span class="attack-name">{row.attack.name}{row.fromName ? <small class="muted"> · {row.fromName}</small> : null}</span>
      <b class="attack-damage">{row.damage}</b>
      {row.text ? <small class="attack-text">{row.text}</small> : null}
    </button>
  );
}

/** Habilidade ativável na ficha: mesma linha do ataque, em dourado, com o texto da Habilidade. */
function AbilityButton({ name, text, action, reason, onAction, onBlocked }: {
  readonly name: string; readonly text: string; readonly action: Action | null; readonly reason: string | null;
  readonly onAction: (a: Action) => void; readonly onBlocked: (reason: string) => void;
}): JSX.Element {
  const blocked = reason ?? (action ? null : 'Indisponível agora');
  return (
    <button type="button" class={`attack-button ability-button ${blocked ? 'is-blocked' : 'is-ready'}`} data-testid="ability"
      aria-disabled={blocked ? 'true' : undefined} title={[blocked, text].filter(Boolean).join(' — ') || undefined}
      aria-label={`Habilidade: ${name}${blocked ? ` (${blocked})` : ''}`}
      onClick={() => { if (blocked) onBlocked(blocked); else if (action) onAction(action); }}>
      <span class="ability-tag" aria-hidden="true">Habilidade</span>
      <span class="attack-name">{name}</span>
      {text ? <small class="attack-text">{text}</small> : null}
    </button>
  );
}

/**
 * Ficha do Pokémon tocado (decisão do autor, 15/10/2026; referência .specs/referencias/batalha/attack.png): a carta ampliada
 * no centro da mesa com o PS atual no canto e, sobre a metade de baixo dela, os ataques (só do Ativo), as Habilidades
 * ativáveis, o descarte de Fóssil e a pílula Recuar (só do Ativo). Fora do seu turno, as linhas aparecem bloqueadas.
 * Tocar fora da ficha ou Esc fecha.
 */
export function CardActions({ layout, view, content, aff, entityId, busy, onAction, onPending, onBlocked, onClose }: {
  readonly layout: StageLayout; readonly view: BattleView; readonly content: ContentIndex; readonly aff: Affordances | null;
  readonly entityId: string; readonly busy: boolean;
  readonly onAction: (a: Action) => void; readonly onPending: (p: Pending) => void; readonly onBlocked: (reason: string) => void; readonly onClose: () => void;
}): JSX.Element | null {
  const root = useRef<HTMLDivElement>(null);
  const me = view.sides[view.viewer];
  const entity = [me.active, ...me.bench].find((e) => e?.entityId === entityId) ?? null;
  useEffect(() => { root.current?.querySelector<HTMLElement>('.attack-button.is-ready, .retreat-pill.is-ready')?.focus({ preventScroll: true }); }, [entityId]);
  if (!entity || !aff) return null;
  const myTurn = view.currentPlayer === view.viewer && view.phase === 'MAIN' && !view.result;
  const lock = busy ? 'Aguarde a jogada atual.' : !myTurn ? 'Aguarde o seu turno.' : null;
  const compact = layout.profile === 'compact720';
  const face = faceOf(content, entity.top.printingId);
  const type = face?.types[0] ?? 'COLORLESS';
  const isActive = me.active?.entityId === entityId;
  const abilityText = (name: string) => face?.abilities.find((a) => a.name === name)?.text ?? '';
  const rows: JSX.Element[] = [];
  if (isActive) for (const row of aff.attacks) rows.push(<AttackButton key={`atk-${row.fromName ?? ''}-${row.attack.id}`} row={row} type={type} lock={lock} onAction={onAction} onBlocked={onBlocked} compact={compact} />);
  for (const ab of aff.abilities(entityId)) {
    rows.push(<AbilityButton key={`ab-${ab.abilityId}`} name={ab.name} text={abilityText(ab.name)} action={lock ? null : ab.action} reason={lock ?? ab.reason} onAction={onAction} onBlocked={onBlocked} />);
  }
  const fossil = aff.fossilDiscard(entityId);
  if (fossil) rows.push(<Button key="fossil" variant="ghost" size="sm" onClick={() => onAction(fossil)} disabledReason={lock} testId="fossil-discard">Descartar {face?.name ?? 'Fóssil'}</Button>);
  const retreatOk = aff.retreat.available && !lock;
  const retreat = isActive ? (
    <button type="button" class={`retreat-pill ${retreatOk ? 'is-ready' : 'is-blocked'}`} data-testid="retreat"
      aria-disabled={retreatOk ? undefined : 'true'} title={lock ?? aff.retreat.reason ?? undefined}
      aria-label={`Recuar${aff.retreat.cost !== null ? `, custo ${aff.retreat.cost}` : ''}${retreatOk ? '' : ` (${lock ?? aff.retreat.reason})`}`}
      onClick={() => { if (retreatOk) onPending({ kind: 'RETREAT', benchIndex: null }); else if (lock ?? aff.retreat.reason) onBlocked((lock ?? aff.retreat.reason)!); }}>
      <span class="attack-cost" aria-hidden="true">{costIcons({ COLORLESS: aff.retreat.cost ?? 0 }, compact ? 14 : 16)}</span>
      <span>Recuar</span>
    </button>
  ) : null;
  const hpPct = entity.maxHp ? (entity.remainingHp / entity.maxHp) * 100 : 0;
  return (
    <>
      <button type="button" class="card-actions-scrim" aria-label="Fechar ações" tabIndex={-1} onClick={onClose} />
      <div ref={root} class={`card-actions ${rows.length || retreat ? '' : 'is-card-only'}`} style={boxStyle(toBox(layout, layout.regions.attackCutin))}
        role="dialog" aria-label={`Ações de ${face?.name ?? 'Pokémon'}`} data-testid="card-actions"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}>
        <div class="card-actions-card">
          <CardFace face={face} size="lg" />
          <span class={`card-actions-hp ${hpPct <= 25 ? 'is-low' : ''}`} aria-label={`PS ${entity.remainingHp} de ${entity.maxHp}`}>
            <b>{entity.remainingHp}</b><span class="b2-hpbar"><span style={{ width: `${hpPct}%` }} /></span>
          </span>
        </div>
        {rows.length || retreat ? (
          <div class="card-actions-rows" role="group" aria-label="Ações do Pokémon">
            {rows}
            {retreat}
          </div>
        ) : null}
      </div>
    </>
  );
}

export function FloatingActions({ layout, view, content, aff, selection, pending, busy, onAction, onCancel }: {
  readonly layout: StageLayout; readonly view: BattleView; readonly content: ContentIndex; readonly aff: Affordances | null;
  readonly selection: Selection; readonly pending: Pending; readonly busy: boolean;
  readonly onAction: (a: Action) => void; readonly onCancel: () => void;
}): JSX.Element | null {
  const myTurn = view.currentPlayer === view.viewer && view.phase === 'MAIN' && !view.result;
  if (!myTurn || !aff) return null;
  const me = view.sides[view.viewer];
  const lock = busy ? 'Aguarde a jogada atual.' : null;
  const cancel = <Button key="cancel" variant="ghost" size="sm" onClick={onCancel} testId="action-cancel">Cancelar (Esc)</Button>;
  const items: JSX.Element[] = [];

  if (pending) {
    const hint = pending.kind === 'ATTACH' ? 'Toque no Pokémon que recebe a Energia.' : 'Toque no Pokémon do Banco que vai para a posição Ativa.';
    items.push(<p key="hint" class="action-hint" role="status">{hint}</p>, cancel);
  } else if (selection?.kind === 'HAND_CARD') {
    const plan = aff.plan(selection.cardId);
    const ref = me.hand?.find((c) => c.cardId === selection.cardId);
    const name = (ref ? faceOf(content, ref.printingId)?.name : null) ?? 'carta';
    if (plan.play) items.push(<Button key="play" variant="primary" onClick={() => onAction(plan.play!)} disabledReason={lock} testId="play-card">Jogar {name}</Button>);
    else items.push(<p key="hint" class={`action-hint ${plan.reason ? 'is-blocked' : ''}`} role="status">{plan.reason ?? `Arraste ${name} até um alvo realçado (ou toque nele).`}</p>);
    items.push(cancel);
  }
  if (!items.length) return null;
  return (
    <div class="action-buttons" style={boxStyle(toBox(layout, layout.regions.actionButtons))} role="group" aria-label="Ações do turno">
      {items}
    </div>
  );
}

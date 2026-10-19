// HUD do duelo em FOCUS_TABLE (interface §23.4/§23.5): placas dos jogadores nos cantos, afastadas das bordas —
// a sua embaixo à esquerda (foto à esquerda), a do adversário em cima à direita (foto à direita) — com os três
// pontos grandes; botões flutuantes (Menu/Pausa, Histórico, Finalizar turno). Nenhum painel lateral fixo; as ações
// do turno são botões flutuantes (actions.tsx).
import type { JSX } from 'preact';
import type { BattleView } from '../../../domain/battle/views.ts';
import type { PokemonType } from '../../../domain/cards/types.ts';
import { Button } from '../components/controls.tsx';
import { Icon, typeGlyphPath } from '../components/icons.tsx';
import { PointsCounter } from './Board2D.tsx';
import { boxStyle, toBox, type Rect, type StageLayout } from './layout.ts';

export function turnStatus(view: BattleView, aiThinking: boolean): string {
  const mine = view.currentPlayer === view.viewer;
  const deciding = view.decisions.find((d) => !d.answered);
  return view.result ? 'Partida encerrada'
    : view.phase === 'SETUP' ? 'Preparação'
    : deciding && deciding.player !== view.viewer ? 'Adversário escolhendo'
    : mine ? 'Seu turno' : aiThinking ? 'Turno do adversário · pensando' : 'Turno do adversário';
}

/**
 * Foto do jogador na placa: o retrato (emote) escolhido no perfil e o do rival (`IMAGE`, só a imagem, sem contorno);
 * tipo e inicial ficam de reserva para conteúdo sem retrato (Estúdio, testes).
 */
export type PlateAvatar =
  | { readonly kind: 'TYPE'; readonly type: PokemonType }
  | { readonly kind: 'INITIAL'; readonly letter: string; readonly tone: string }
  | { readonly kind: 'IMAGE'; readonly url: string };

export function AvatarCircle({ avatar, label }: { readonly avatar: PlateAvatar; readonly label: string }): JSX.Element {
  if (avatar.kind === 'IMAGE') return <img class="plate-avatar is-portrait" src={avatar.url} alt={label} draggable={false} decoding="async" />;
  if (avatar.kind === 'TYPE') {
    return (
      <span class={`plate-avatar is-type type-${avatar.type.toLowerCase()}`} role="img" aria-label={label}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={typeGlyphPath(avatar.type)} fill-rule="evenodd" /></svg>
      </span>
    );
  }
  return <span class={`plate-avatar is-initial ${avatar.tone}`} role="img" aria-label={label}><b aria-hidden="true">{avatar.letter}</b></span>;
}

/** Placa do jogador: foto + nome/linha de status + contador de pontos (âncora *_POINTS). */
export function PlayerPlate({ layout, who, name, detail, hint, view, avatar, status }: {
  readonly layout: StageLayout; readonly who: 'HUMAN' | 'NPC'; readonly name: string; readonly detail?: string; readonly view: BattleView;
  readonly avatar: PlateAvatar; readonly status?: string;
  /** Texto longo para a dica do ponteiro (nome do encontro). */
  readonly hint?: string;
}): JSX.Element {
  const side = who === 'HUMAN' ? view.sides[view.viewer] : view.sides[view.viewer === 'A' ? 'B' : 'A'];
  const turnHere = view.phase !== 'SETUP' && !view.result && (view.currentPlayer === view.viewer) === (who === 'HUMAN');
  return (
    <header class={`player-plate player-plate-${who.toLowerCase()} ${turnHere ? 'is-turn' : ''}`} style={boxStyle(toBox(layout, layout.regions[who === 'HUMAN' ? 'humanPlate' : 'npcPlate']))}
      aria-label={who === 'HUMAN' ? `Você: ${name}` : `Adversário: ${name}`} title={hint}>
      <AvatarCircle avatar={avatar} label={who === 'HUMAN' ? `Foto de ${name}` : `Foto do adversário ${name}`} />
      <div class="plate-text">
        <span class="plate-name">{name}</span>
        {status ? <span class="plate-status" role="status" aria-live="polite">{status}</span> : detail ? <span class="plate-detail">{detail}</span> : null}
      </div>
      <PointsCounter points={side.points} pointsToWin={view.pointsToWin} prefix={who} name={name} />
    </header>
  );
}

/** Botão redondo flutuante numa região do perfil. */
export function FloatingButton({ layout, rect, icon, label, onClick, testId }: {
  readonly layout: StageLayout; readonly rect: Rect; readonly icon: 'menu' | 'history'; readonly label: string; readonly onClick: () => void; readonly testId?: string;
}): JSX.Element {
  return (
    <button type="button" class="float-round" style={boxStyle(toBox(layout, rect))} aria-label={label} title={label} onClick={onClick} data-testid={testId}>
      <Icon name={icon} size={Math.round(Math.max(20, rect[3] * layout.scale * 0.42))} />
    </button>
  );
}

export function EndTurnButton({ layout, view, disabledReason, onEndTurn }: { readonly layout: StageLayout; readonly view: BattleView; readonly disabledReason: string | null; readonly onEndTurn: () => void }): JSX.Element | null {
  if (view.phase === 'SETUP' || view.result) return null;
  return (
    <div class="float-end-turn" style={boxStyle(toBox(layout, layout.regions.endTurn))} data-anchor="HUMAN_END_TURN">
      <Button variant="primary" onClick={onEndTurn} disabledReason={disabledReason} testId="end-turn">Finalizar turno</Button>
    </div>
  );
}

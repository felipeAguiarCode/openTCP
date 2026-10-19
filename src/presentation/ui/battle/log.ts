// Histórico textual (interface §23.13, §26): somente eventos autorizados para o humano, descritos em
// PT-BR a partir dos dados confirmados. Eventos técnicos sem leitura útil são omitidos.
import type { BattleEvent, PlayerId } from '../../../domain/battle/types.ts';
import { CONDITION_LABEL, TYPE_LABEL } from '../../../domain/cards/text.ts';
import type { PokemonType, SpecialCondition } from '../../../domain/cards/types.ts';

export type Names = {
  readonly card: (cardId: string | null | undefined) => string;
  readonly entity: (entityId: string | null | undefined) => string;
  readonly player: (p: PlayerId | null | undefined) => string;
};

export type LogLine = { readonly seq: number; readonly text: string; readonly tone: 'neutral' | 'damage' | 'heal' | 'turn' | 'ko' | 'coin' | 'end' };

const COIN = (r: unknown) => (r === 'HEADS' ? 'cara' : 'coroa');
const REASON: Record<string, string> = { HAND_FULL: 'mão cheia', DECK_EMPTY: 'baralho vazio' };

export function describeEvent(e: BattleEvent, n: Names): LogLine | null {
  const d = e.data as Record<string, unknown>;
  const p = d.player as PlayerId | undefined;
  const who = n.player(p);
  const line = (text: string, tone: LogLine['tone'] = 'neutral'): LogLine => ({ seq: e.seq, text, tone });
  switch (e.type) {
    case 'COIN_RESOLVED': {
      const results = (d.results as string[] | undefined) ?? [];
      const why = d.reason === 'FIRST_PLAYER' ? 'Moeda de abertura' : d.reason === 'CONFUSION' ? 'Moeda de Confusão' : d.reason === 'SLEEP_RECOVERY' ? 'Moeda do Sono'
        : d.reason === 'BURN_RECOVERY' ? 'Moeda da Queimadura' : d.reason === 'ATTACK_GATE' ? 'Moeda antes do ataque' : d.reason === 'DAMAGE_PREVENTION' ? 'Moeda de proteção'
          : d.reason === 'SURVIVE_KNOCKOUT' ? 'Moeda para resistir' : d.reason === 'REROLL' ? 'Moedas relançadas' : 'Moeda';
      return line(`${why}: ${results.map(COIN).join(', ')}.`, 'coin');
    }
    case 'FIRST_PLAYER_DECIDED': return line(`${n.player(d.firstPlayer as PlayerId)} começa${d.method === 'FIXTURE' ? ' (cenário preparado)' : ''}.`, 'turn');
    case 'CARDS_DEALT': return line(`${who} recebe a mão inicial.`);
    case 'SETUP_REVEALED': return line(`${who} revela o Ativo e o Banco.`);
    case 'TURN_STARTED': return line(`Turno ${d.globalTurnNumber as number}: ${who}.`, 'turn');
    case 'CARD_DRAWN': return line(d.cardId ? `${who} compra ${n.card(d.cardId as string)}.` : `${who} compra 1 carta.`);
    case 'DRAW_SKIPPED': return line(`${who} não compra (${REASON[d.reason as string] ?? d.reason}).`);
    case 'POKEMON_ENTERED': return line(`${who} coloca ${n.card(d.cardId as string)} no Banco.`);
    case 'POKEMON_EVOLVED': return line(`${who} evolui para ${n.card(d.toCardId as string)}.`);
    case 'ENERGY_ATTACHED': return line(`${who} liga Energia ${TYPE_LABEL[d.energyType as PokemonType] ?? d.energyType} a ${n.entity(d.entityId as string)}.`);
    case 'ENERGY_MOVED': return line(`Energia movida de ${n.entity(d.fromEntityId as string)} para ${n.entity(d.toEntityId as string)}.`);
    case 'ENERGY_DISCARDED': return line(`${(d.energies as unknown[] | undefined)?.length ?? 1} Energia(s) descartada(s) de ${n.entity(d.entityId as string)}.`);
    case 'TRAINER_PLAYED': return line(`${who} joga ${n.card(d.cardId as string)}.`);
    case 'TOOL_ATTACHED': return line(`${who} prende ${n.card(d.cardId as string)} em ${n.entity(d.entityId as string)}.`);
    case 'TOOL_REMOVED': return line(`Ferramenta removida de ${n.entity(d.entityId as string)}.`);
    case 'STADIUM_REPLACED': return line(`${who} coloca o Estádio ${n.card(d.cardId as string)}.`);
    case 'ABILITY_ACTIVATED': return line(`${who} usa a Habilidade de ${n.entity(d.entityId as string)}.`);
    case 'ABILITY_TRIGGERED': return line(`Habilidade de ${n.entity(d.entityId as string)} é acionada.`);
    case 'ATTACK_DECLARED': return line(`${n.entity(d.entityId as string)} usa ${d.attackName as string}.`, 'turn');
    case 'ATTACK_FAILED': return line(d.reason === 'EFFECT' ? 'O ataque não fez nada.' : `O ataque falhou (${d.reason === 'CONFUSED' ? 'Confusão' : d.reason === 'COIN_GATE' ? 'moeda' : String(d.reason)}).`);
    case 'DAMAGE_APPLIED': return line(`${n.entity(d.targetEntityId as string)} recebe ${d.amount as number} de dano (${Math.max(0, (d.maxHp as number) - (d.damageTotal as number))}/${d.maxHp as number} PS).`, 'damage');
    case 'DAMAGE_PREVENTED': return line(`Dano prevenido em ${n.entity(d.targetEntityId as string)}.`);
    case 'DAMAGE_MOVED': return line(`${d.amount as number} de dano movido de ${n.entity(d.fromEntityId as string)} para ${n.entity(d.toEntityId as string)}.`, 'damage');
    case 'REMAINING_HP_SET': return line(`${n.entity(d.entityId as string)} fica com ${d.remainingHp as number} PS restantes.`, 'damage');
    case 'POKEMON_DEVOLVED': return line(`${n.entity(d.entityId as string)} involui; ${n.card(d.cardId as string)} volta para a mão.`);
    case 'CARDS_RETURNED_TO_DECK': return line(`${who} embaralha ${d.count as number} carta${d.count === 1 ? '' : 's'} da mão no baralho.`);
    case 'ENERGY_TYPE_CHANGED': return line(`Uma Energia de ${n.entity(d.entityId as string)} vira ${TYPE_LABEL[d.to as PokemonType] ?? d.to}.`);
    case 'CARDS_REVEALED': return line(`${who} revela ${(d.cardIds as string[] | undefined)?.length ?? 0} carta(s).`);
    case 'TRAINER_COPIED': return line(`${who} usa o efeito de ${n.card(d.cardId as string)}.`);
    case 'HEAL_APPLIED': return line(`${n.entity(d.entityId as string)} recupera ${d.amount as number} PS.`, 'heal');
    case 'CONDITION_APPLIED': return line(`${n.entity(d.entityId as string)} fica ${CONDITION_LABEL[d.condition as SpecialCondition] ?? d.condition}.`);
    case 'CONDITION_REMOVED': return line(`${n.entity(d.entityId as string)} não está mais ${CONDITION_LABEL[d.condition as SpecialCondition] ?? d.condition}.`);
    case 'POKEMON_MOVED': return line(`${n.entity(d.entityId as string)} vai para a posição Ativa.`);
    case 'POKEMON_KNOCKED_OUT': return line(`${n.card((d.cardIds as string[] | undefined)?.at(-1))} foi nocauteado.`, 'ko');
    case 'POINTS_GRANTED': return line(`${who} marca ${d.points as number} ponto(s) — total ${d.total as number}.`, 'ko');
    case 'CARD_SEARCHED': return line(d.cardId ? `${who} busca ${n.card(d.cardId as string)} no baralho.` : `${who} busca uma carta no baralho.`);
    case 'CARD_DISCARDED': return line(`${who} descarta ${(d.cardIds as string[] | undefined)?.map((id) => n.card(id)).join(', ') ?? 'cartas'}.`);
    case 'CARD_RETURNED': return line(`${who} devolve uma carta.`);
    case 'DECK_SHUFFLED': return line(`${who} embaralha o baralho.`);
    case 'HAND_REVEALED': return line(`${who} revela a mão.`);
    case 'HAND_SHUFFLED_INTO_DECK': return line(`${who} embaralha a mão (${d.count as number} carta${d.count === 1 ? '' : 's'}) no baralho.`);
    case 'DELAYED_EFFECT_SCHEDULED': return line('Um efeito atrasado foi preparado.');
    case 'DELAYED_EFFECT_TRIGGERED': return line('Um efeito atrasado foi resolvido.');
    case 'DELAYED_EFFECT_REMOVED': return line('Um efeito atrasado foi cancelado.');
    case 'PLAYER_CONCEDED': return line(`${who} abandona a partida.`, 'end');
    case 'MATCH_ENDED': {
      const w = d.winner as PlayerId | null;
      return line(d.outcome === 'DRAW' ? 'A partida terminou empatada.' : `${n.player(w)} vence a partida.`, 'end');
    }
    default: return null;
  }
}

export function describeEvents(events: readonly BattleEvent[], names: Names): LogLine[] {
  return events.map((e) => describeEvent(e, names)).filter((l): l is LogLine => l !== null);
}

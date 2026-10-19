// Mapa evento → preset (interface §36.2.1) como dado. Cada tipo de BattleEvent emitido pelo motor tem
// uma regra: preset(s) do catálogo, fusão com o passo de outro evento do mesmo grupo, ou no-op documentado.
import type { PresetId } from './catalog.ts';

export type EventRule =
  | { readonly kind: 'PRESET'; readonly presets: readonly PresetId[]; readonly rule: string }
  | { readonly kind: 'MERGED'; readonly into: string; readonly presets: readonly PresetId[]; readonly rule: string }
  | { readonly kind: 'NOOP'; readonly rule: string };

export const EVENT_PRESET_RULES: Readonly<Record<string, EventRule>> = {
  TURN_STARTED: { kind: 'PRESET', presets: ['TURN_BANNER', 'PLAYMAT_TRANSITION'], rule: 'Faixa sempre; transição de tapete em paralelo só quando o playmat resolvido muda.' },
  CARDS_DEALT: { kind: 'PRESET', presets: ['INITIAL_DEAL'], rule: 'Mãos iniciais dos dois lados num passo; frentes só para o dono.' },
  CARD_DRAWN: { kind: 'PRESET', presets: ['DRAW_SELF', 'DRAW_OPPONENT', 'DRAW_BATCH'], rule: '1 carta: DRAW_SELF/DRAW_OPPONENT; 2+ no mesmo grupo: DRAW_BATCH em lotes de até 5.' },
  CARD_SEARCHED: { kind: 'PRESET', presets: ['DRAW_SELF', 'DRAW_OPPONENT'], rule: 'Extensão documentada: deck → mão com a mesma trajetória da compra, sem sugerir posição.' },
  SETUP_REVEALED: { kind: 'PRESET', presets: ['SETUP_REVEAL'], rule: 'Revelação da preparação: todas as cartas do campo num grupo paralelo.' },
  CARD_REVEALED: { kind: 'PRESET', presets: ['SETUP_REVEAL'], rule: 'Fora da preparação, o mesmo giro só nas cartas reveladas.' },
  CARD_HIDDEN: { kind: 'PRESET', presets: ['RETURN_TO_HAND'], rule: 'Carta exposta volta à zona oculta com descriptor opaco; sem representação exposta, só reconciliação.' },
  DECK_SHUFFLED: { kind: 'PRESET', presets: ['SHUFFLE'], rule: 'Versos neutros; a ordem já foi resolvida.' },
  POKEMON_ENTERED: { kind: 'PRESET', presets: ['PLAY_BASIC', 'PLAY_SPECIAL'], rule: 'PLAY_SPECIAL se pública e finish ≠ NORMAL ou ruleBox ≠ NONE; senão PLAY_BASIC.' },
  POKEMON_EVOLVED: { kind: 'PRESET', presets: ['EVOLVE'], rule: 'Dano e anexos preservados.' },
  TRAINER_PLAYED: { kind: 'PRESET', presets: ['PLAY_ITEM', 'PLAY_SUPPORTER', 'ATTACH_TOOL', 'PLAY_STADIUM'], rule: 'Por subtipo: Item/Fóssil, Apoiador, Ferramenta, Estádio.' },
  TOOL_ATTACHED: { kind: 'MERGED', into: 'TRAINER_PLAYED', presets: ['ATTACH_TOOL'], rule: 'Mesmo passo do TRAINER_PLAYED de Ferramenta.' },
  STADIUM_REPLACED: { kind: 'MERGED', into: 'TRAINER_PLAYED', presets: ['PLAY_STADIUM'], rule: 'Mesmo passo do TRAINER_PLAYED de Estádio; não toca o playmat.' },
  ENERGY_ATTACHED: { kind: 'PRESET', presets: ['ATTACH_ENERGY'], rule: 'Zona → Pokémon.' },
  ENERGY_MOVED: { kind: 'PRESET', presets: ['ATTACH_ENERGY'], rule: 'Pokémon → Pokémon.' },
  ENERGY_DISCARDED: { kind: 'PRESET', presets: ['ATTACH_ENERGY'], rule: 'Pokémon → descarte; ao sair do campo, absorvido pelo passo de Nocaute.' },
  ATTACK_DECLARED: { kind: 'PRESET', presets: ['ATTACK_STANDARD', 'ATTACK_SPECIAL', 'ATTACK_FOCUS'], rule: 'Com dano do ataque: STANDARD/SPECIAL (inclui impacto); sem dano: ATTACK_FOCUS.' },
  ATTACK_FAILED: { kind: 'MERGED', into: 'ATTACK_DECLARED', presets: ['ATTACK_FOCUS'], rule: 'Falha por Confusão encerra o ATTACK_FOCUS.' },
  ABILITY_TRIGGERED: { kind: 'PRESET', presets: ['ABILITY_FOCUS'], rule: 'Acento na fonte real.' },
  ABILITY_ACTIVATED: { kind: 'PRESET', presets: ['ABILITY_FOCUS'], rule: 'Acento na fonte real.' },
  COIN_RESOLVED: { kind: 'PRESET', presets: ['COIN_FIRST', 'COIN_NEXT'], rule: 'Primeira moeda da resolução COIN_FIRST; cada seguinte COIN_NEXT; face já confirmada.' },
  DAMAGE_APPLIED: { kind: 'PRESET', presets: ['DAMAGE_FEEDBACK'], rule: 'Fora de ataque (checkup, Habilidade, efeito); o dano do ataque é parte do ATTACK_*.' },
  DAMAGE_PREVENTED: { kind: 'PRESET', presets: ['DAMAGE_FEEDBACK'], rule: 'Extensão documentada: escudo e “Protegido” (§25.16), sem impacto destrutivo.' },
  DAMAGE_MOVED: { kind: 'PRESET', presets: ['DAMAGE_FEEDBACK'], rule: 'Extensão documentada: dano movido entre Pokémon (Dusknoir, Acerola); os dois contadores mudam.' },
  REMAINING_HP_SET: { kind: 'PRESET', presets: ['DAMAGE_FEEDBACK'], rule: 'Extensão documentada: PS restantes definidos por efeito (Superpresa, Dreno Vital); não é dano.' },
  POKEMON_DEVOLVED: { kind: 'PRESET', presets: ['RETURN_TO_HAND'], rule: 'Extensão documentada: a carta de Evolução do topo volta para a mão; a pilha de baixo continua no campo.' },
  CARDS_RETURNED_TO_DECK: { kind: 'NOOP', rule: 'Cartas da mão voltam ao baralho; o DECK_SHUFFLED seguinte apresenta o embaralhamento.' },
  ENERGY_TYPE_CHANGED: { kind: 'NOOP', rule: 'A ficha de Energia reconcilia o tipo novo no fim do passo.' },
  CARDS_REVEALED: { kind: 'NOOP', rule: 'Seletor/histórico HTML mostra só cartas autorizadas.' },
  TRAINER_COPIED: { kind: 'NOOP', rule: 'Penny: o efeito copiado tem seus próprios eventos; o nome aparece no histórico.' },
  HEAL_APPLIED: { kind: 'PRESET', presets: ['HEAL_FEEDBACK'], rule: 'Valor efetivamente curado.' },
  CONDITION_APPLIED: { kind: 'PRESET', presets: ['STATUS_FEEDBACK'], rule: 'Ícone e acento curto.' },
  CONDITION_REMOVED: { kind: 'PRESET', presets: ['STATUS_FEEDBACK'], rule: 'Ícone some com indicação curta.' },
  POKEMON_MOVED: { kind: 'PRESET', presets: ['RETREAT', 'SWITCH', 'PROMOTE'], rule: 'Por reason.' },
  POKEMON_KNOCKED_OUT: { kind: 'PRESET', presets: ['KNOCKOUT'], rule: 'Grupo completo em paralelo antes dos pontos; descartes da pilha são absorvidos.' },
  POKEMON_REMOVED: { kind: 'PRESET', presets: ['DISCARD'], rule: 'Extensão documentada: saída do campo sem Nocaute (sem pontos).' },
  CARD_DISCARDED: { kind: 'PRESET', presets: ['DISCARD'], rule: 'Sem pontos; absorvido por Nocaute/Treinador quando é parte desse passo.' },
  CARD_RETURNED: { kind: 'PRESET', presets: ['RETURN_TO_HAND'], rule: 'Para o baralho usa a mesma trajetória até *_DECK_TOP.' },
  TOOL_REMOVED: { kind: 'PRESET', presets: ['DISCARD'], rule: 'Extensão documentada: Ferramenta sai para descarte/mão.' },
  POINTS_GRANTED: { kind: 'PRESET', presets: ['POINTS'], rule: 'Depois de todos os Nocautes do grupo.' },
  MATCH_ENDED: { kind: 'PRESET', presets: ['RESULT_TRANSITION'], rule: 'Depois da resolução terminal completa.' },
  PACK_OPENING_COMMITTED: { kind: 'PRESET', presets: ['PACK_TEAR', 'PACK_EXTRACT', 'PACK_REVEAL', 'PACK_REVEAL_SPECIAL'], rule: 'Palco de pacote (createPackOpeningStage), não a mesa.' },
  COSMETIC_UNLOCKED: { kind: 'NOOP', rule: 'Aparece como cartão no resumo, sem segunda concessão.' },
  // No-ops documentados: o estado reconcilia no fim do passo vizinho e o HUD/histórico mostra o texto.
  FIRST_PLAYER_DECIDED: { kind: 'NOOP', rule: 'O COIN_RESOLVED (FIRST_PLAYER) carrega o visual; o anúncio é HTML.' },
  DRAW_SKIPPED: { kind: 'NOOP', rule: 'Nunca animar carta fictícia (§24.15); motivo no HUD.' },
  DECISION_REQUESTED: { kind: 'NOOP', rule: 'Vira barreira PENDING_DECISION; o seletor é HTML.' },
  DECISION_RESOLVED: { kind: 'NOOP', rule: 'Só reconciliação.' },
  END_TURN_REQUESTED: { kind: 'NOOP', rule: 'Só histórico.' },
  TURN_ENDING: { kind: 'NOOP', rule: 'Checkup apresenta seus próprios eventos.' },
  TURN_ENDED: { kind: 'NOOP', rule: 'A próxima abertura (TURN_STARTED) mostra a faixa.' },
  ENERGY_ZONE_UPDATED: { kind: 'NOOP', rule: 'Fichas da Zona reconciliam no fim do passo vizinho.' },
  EFFECT_STARTED: { kind: 'NOOP', rule: 'Selo com o ícone do efeito no Pokémon afetado, com estouro e brilho na carta (interface §25.21).' },
  EFFECT_EXPIRED: { kind: 'NOOP', rule: 'O selo do efeito some com indicação curta.' },
  DELAYED_EFFECT_SCHEDULED: { kind: 'NOOP', rule: 'Marcador no HUD/inspector.' },
  DELAYED_EFFECT_TRIGGERED: { kind: 'NOOP', rule: 'Os efeitos disparados têm seus próprios eventos.' },
  DELAYED_EFFECT_REMOVED: { kind: 'NOOP', rule: 'Marcador no HUD/inspector.' },
  CARDS_LOOKED_AT: { kind: 'NOOP', rule: 'Seletor HTML mostra só cartas autorizadas.' },
  HAND_REVEALED: { kind: 'NOOP', rule: 'Seletor HTML mostra só cartas autorizadas.' },
  HAND_SHUFFLED_INTO_DECK: { kind: 'NOOP', rule: 'Mão vai ao baralho (conteúdo oculto ao adversário); o DECK_SHUFFLED seguinte apresenta o embaralhamento.' },
  FIXTURE_LOADED: { kind: 'NOOP', rule: 'Carga de fixture não é animada.' },
  PLAYER_CONCEDED: { kind: 'NOOP', rule: 'MATCH_ENDED apresenta o resultado.' },
};

export function ruleFor(type: string): EventRule {
  return EVENT_PRESET_RULES[type] ?? { kind: 'NOOP', rule: 'Tipo desconhecido: só reconciliação.' };
}

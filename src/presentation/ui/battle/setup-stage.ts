// Preparação na mesa (gameplay-pocket §4): disposição provisória do Ativo e do Banco antes de “Iniciar duelo”. Só
// apresentação — a visão provisória tira da mão as cartas escolhidas e as mostra nos slots; nada vai ao motor nem à
// gravação até a confirmação, que envia a seleção [Ativo, ...Banco] da decisão SETUP.
import type { PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView, CardRef, EntityView } from '../../../domain/battle/views.ts';

export type SetupStaging = { readonly active: string | null; readonly bench: readonly (string | null)[] };

export const EMPTY_STAGING: SetupStaging = { active: null, bench: [null, null, null] };

const PREFIX = 'staged:';
export const stagedEntityId = (cardId: string): string => `${PREFIX}${cardId}`;
/** Carta de uma entidade provisória (`staged:<cardId>`), ou null se a entidade é real. */
export const stagedCardOf = (entityId: string): string | null => (entityId.startsWith(PREFIX) ? entityId.slice(PREFIX.length) : null);

export const stagedCards = (s: SetupStaging): string[] => [s.active, ...s.bench].filter((x): x is string => !!x);

/** Entidades provisórias viradas para baixo: todo Básico colocado na preparação (desvira na revelação). */
export const stagedFaceDown = (s: SetupStaging): ReadonlySet<string> => new Set(stagedCards(s).map(stagedEntityId));

/** Seleção da decisão SETUP: Ativo primeiro, depois o Banco na ordem dos slots. */
export const setupSelection = (s: SetupStaging): string[] => (s.active ? [s.active, ...s.bench.filter((x): x is string => !!x)] : []);

/** Âncoras onde um Básico pode ir agora: só o Ativo enquanto ele estiver vazio; depois, os slots livres do Banco. */
export function setupTargets(s: SetupStaging, benchLimit: number): string[] {
  if (!s.active) return ['HUMAN_ACTIVE'];
  if (stagedCards(s).length - 1 >= benchLimit) return [];
  return [0, 1, 2].filter((i) => !s.bench[i]).map((i) => `HUMAN_BENCH_${i}`);
}

export type PlaceResult = { readonly ok: true; readonly staging: SetupStaging } | { readonly ok: false; readonly reason: string };

/** Coloca o Básico no slot pedido (ou no próximo livre, com `anchorId` null). */
export function placeCard(s: SetupStaging, cardId: string, anchorId: string | null, eligible: ReadonlySet<string>, benchLimit: number): PlaceResult {
  if (!eligible.has(cardId)) return { ok: false, reason: 'Só Pokémon Básicos entram na preparação' };
  if (stagedCards(s).includes(cardId)) return { ok: false, reason: 'Esta carta já está na mesa' };
  const targets = setupTargets(s, benchLimit);
  if (!targets.length) return { ok: false, reason: 'O Banco já está cheio' };
  const anchor = anchorId ?? targets[0]!;
  if (!targets.includes(anchor)) {
    if (!s.active) return { ok: false, reason: 'Coloque primeiro um Básico no Ativo' };
    return { ok: false, reason: anchor === 'HUMAN_ACTIVE' ? 'O Ativo já foi escolhido' : 'Coloque no seu Banco' };
  }
  if (anchor === 'HUMAN_ACTIVE') return { ok: true, staging: { ...s, active: cardId } };
  const i = Number(anchor.slice('HUMAN_BENCH_'.length));
  return { ok: true, staging: { ...s, bench: s.bench.map((x, k) => (k === i ? cardId : x)) } };
}

/** Devolve a carta à mão (o Banco não sobe sozinho para o Ativo). */
export function unplaceCard(s: SetupStaging, cardId: string): SetupStaging {
  return { active: s.active === cardId ? null : s.active, bench: s.bench.map((x) => (x === cardId ? null : x)) };
}

/** Visão da mesa com a disposição provisória: as cartas escolhidas saem da mão e aparecem nos slots do jogador. */
export function stagedView(view: BattleView, player: PlayerId, s: SetupStaging, hpOf: (ref: CardRef) => number): BattleView {
  const side = view.sides[player];
  const hand = side.hand ?? [];
  const used = new Set(stagedCards(s));
  if (!used.size) return view;
  const entity = (cardId: string | null, position: 'ACTIVE' | 'BENCH', benchIndex: number | null): EntityView | null => {
    const ref = cardId ? hand.find((h) => h.cardId === cardId) : null;
    if (!ref) return null;
    const hp = hpOf(ref);
    return {
      entityId: stagedEntityId(ref.cardId), owner: player, position, benchIndex, stack: [ref], top: ref, damage: 0, maxHp: hp, remainingHp: hp,
      energies: [], tool: null, conditions: { poisoned: false, burned: false, control: null }, retreatCost: null, abilitiesSuppressed: false, isFossil: false, effects: [],
    };
  };
  return {
    ...view,
    sides: {
      ...view.sides,
      [player]: {
        ...side,
        hand: hand.filter((h) => !used.has(h.cardId)),
        handCount: Math.max(0, side.handCount - used.size),
        active: entity(s.active, 'ACTIVE', null) ?? side.active,
        bench: [0, 1, 2].map((i) => entity(s.bench[i] ?? null, 'BENCH', i) ?? side.bench[i] ?? null),
      },
    },
  };
}

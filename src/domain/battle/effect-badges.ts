// Selos de efeito nos Pokémon em campo (interface §25.21; ícones do Pokémon TCG Pocket): cada efeito temporário em jogo
// vira um selo no Pokémon que ele afeta, com o tipo do ícone e um texto curto em PT-BR. As Condições Especiais seguem em
// `EntityView.conditions`; Ferramentas, Estádio e Habilidades contínuas não ganham selo (estão na própria carta).
import type { Operation, RestrictableAction } from '../cards/types.ts';
import { locate, type Ctx } from './core.ts';
import { temporaryEffects } from './derived.ts';
import type { PlayerId } from './types.ts';

/**
 * Tipo do ícone: BAN (não pode — atacar, recuar, evoluir, Habilidade), PLAY_NEGATIVE (o jogador não pode jogar Itens,
 * Apoiadores ou ligar Energia), INVALID (dano, efeitos ou Condições prevenidos), BUFF/DEBUFF (modificador a favor ou
 * contra quem o recebe) e OTHER_POSITIVE/OTHER_NEGATIVE (os demais efeitos, a favor ou contra).
 */
export type EffectBadgeKind = 'BAN' | 'PLAY_NEGATIVE' | 'INVALID' | 'BUFF' | 'DEBUFF' | 'OTHER_POSITIVE' | 'OTHER_NEGATIVE';
export type EffectBadge = { readonly effectId: string; readonly kind: EffectBadgeKind; readonly label: string };

type Readable = Pick<Ctx, 's' | 'cat'>;

const PLAYER_ACTIONS: ReadonlySet<RestrictableAction> = new Set(['PLAY_ITEM', 'PLAY_SUPPORTER', 'MANUAL_ENERGY']);
const ACTION_LABEL: Readonly<Record<RestrictableAction, string>> = {
  ATTACK: 'Não pode atacar', RETREAT: 'Não pode recuar', USE_ABILITY: 'Não pode usar Habilidades', EVOLVE: 'Não pode evoluir',
  PLAY_ITEM: 'Não pode jogar Itens', PLAY_SUPPORTER: 'Não pode jogar Apoiadores', MANUAL_ENERGY: 'Não pode ligar Energia',
  RECEIVE_ZONE_ENERGY: 'Não pode receber Energia da Zona',
};
/** Para cada atributo: se um valor positivo é bom para quem recebe e o texto do selo. */
const STAT: Readonly<Record<string, { readonly goodWhenPositive: boolean; readonly text: (signed: string) => string }>> = {
  DAMAGE_DEALT: { goodWhenPositive: true, text: (n) => `${n} de dano nos ataques` },
  DAMAGE_TAKEN: { goodWhenPositive: false, text: (n) => `${n} de dano recebido` },
  MAX_HP: { goodWhenPositive: true, text: (n) => `${n} PS` },
  RETREAT_COST: { goodWhenPositive: false, text: (n) => `Recuo ${n}` },
  ATTACK_COST: { goodWhenPositive: false, text: (n) => `Custo dos ataques ${n}` },
  ENERGY_PROVISION: { goodWhenPositive: true, text: (n) => `Energia fornecida ${n}` },
  KNOCKOUT_POINTS: { goodWhenPositive: false, text: (n) => `${n} ponto(s) ao ser Nocauteado` },
  POISON_DAMAGE: { goodWhenPositive: false, text: (n) => `Veneno ${n}` },
};

const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/** Tipo do ícone e texto de um efeito (null quando o efeito não muda nada visível, como um modificador de 0). */
export function classifyEffect(op: Operation, amount: number | null): { readonly kind: EffectBadgeKind; readonly label: string } | null {
  switch (op.type) {
    case 'RESTRICT_ACTION': {
      const label = op.actions.map((a) => (a === 'ATTACK' && op.attackIds?.length ? 'Não pode usar esse ataque' : ACTION_LABEL[a])).join(' · ');
      return { kind: op.actions.every((a) => PLAYER_ACTIONS.has(a)) ? 'PLAY_NEGATIVE' : 'BAN', label };
    }
    case 'SUPPRESS_ABILITIES': return { kind: 'BAN', label: 'Habilidades sem efeito' };
    case 'PREVENT_DAMAGE': {
      const what = op.amount === 'ALL' ? 'todo o dano' : `${op.amount} de dano`;
      return { kind: 'INVALID', label: op.coinFlip ? `Pode prevenir ${what} (moeda)` : `Previne ${what}` };
    }
    case 'PREVENT_EFFECTS': return { kind: 'INVALID', label: 'Imune aos efeitos dos ataques do rival' };
    case 'PREVENT_CONDITIONS': return { kind: 'INVALID', label: 'Não pode ser afetado por Condições Especiais' };
    case 'MODIFY': {
      const stat = STAT[op.stat];
      if (!stat || !amount) return null;
      const good = amount > 0 === stat.goodWhenPositive;
      return { kind: good ? 'BUFF' : 'DEBUFF', label: stat.text(signed(amount)) };
    }
    case 'COUNTER_DAMAGE': return { kind: 'OTHER_POSITIVE', label: `Devolve ${amount ?? op.amount} de dano a quem atacar` };
    case 'GRANT_RULE': return { kind: 'OTHER_POSITIVE', label: 'Regra especial concedida' };
    case 'SURVIVE_KNOCKOUT': return { kind: 'OTHER_POSITIVE', label: 'Pode sobreviver a um Nocaute (moeda)' };
    case 'REROLL_COINS': return { kind: 'OTHER_POSITIVE', label: 'Pode relançar as moedas' };
    case 'ATTACK_COIN_GATE': return { kind: 'OTHER_NEGATIVE', label: 'Joga uma moeda antes de atacar' };
    case 'PREVENT_HEALING': return { kind: 'OTHER_NEGATIVE', label: 'Não pode ser curado' };
    default: return null;
  }
}

/**
 * Selos de cada Pokémon em campo (por entityId), na ordem em que os efeitos começaram. Restrição só do jogador (Itens,
 * Apoiadores, Energia) aparece uma vez, no Ativo do jogador afetado.
 */
export function effectBadgesByEntity(ctx: Readable): ReadonlyMap<string, readonly EffectBadge[]> {
  const out = new Map<string, EffectBadge[]>();
  const add = (entityId: string, badge: EffectBadge) => out.set(entityId, [...(out.get(entityId) ?? []), badge]);
  for (const { effect, targets, amount } of temporaryEffects(ctx)) {
    const c = classifyEffect(effect.operation, amount);
    if (!c || !effect.effectId) continue;
    const badge: EffectBadge = { effectId: effect.effectId, kind: c.kind, label: c.label };
    if (c.kind === 'PLAY_NEGATIVE') {
      const players = new Set<PlayerId>(targets.map((id) => locate(ctx.s, id)?.player).filter((p): p is PlayerId => !!p));
      for (const p of players) { const active = ctx.s.players[p].active; if (active) add(active.entityId, badge); }
    } else for (const id of new Set(targets)) add(id, badge);
  }
  return out;
}

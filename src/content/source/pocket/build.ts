// Construtor de definições de carta a partir das linhas do `.inspo` (A1Row ou PocketRow), das tabelas de efeito
// (texto em inglês → DSL) e dos nomes PT-BR. Mesma carta de jogo (nome, estágio, PS, ataques, Habilidades, regras) ⇔
// mesma gameplayKey, em qualquer set. Efeito, nome ou símbolo sem entrada nas tabelas é erro.
import { deckLimitKeyV1 } from '../../../domain/cards/naming.ts';
import type { Ability, Attack, CardDefinition, CostType, PokemonType, RuleBox, Stage } from '../../../domain/cards/types.ts';
import { attack, pokemon, trainer } from '../../builders.ts';
import type { AttackFx, TrainerFx } from '../a1/effects.ts';
import { pokemonName } from './names/pokemon.ts';
import { tagsOf } from './tags.ts';

export type AbilityFx = (id: string, name: string) => Ability;

export type EffectTables = {
  readonly attacks: Readonly<Record<string, (printed: number | null) => AttackFx>>;
  readonly abilities: Readonly<Record<string, AbilityFx>>;
  readonly trainers: Readonly<Record<string, TrainerFx>>;
};
export type NameTables = {
  readonly attacks: Readonly<Record<string, string>>;
  readonly abilities: Readonly<Record<string, string>>;
  readonly trainers: Readonly<Record<string, string>>;
};

/** Campos de jogo comuns às linhas do A1 e dos outros sets. */
export type GameRow = {
  readonly number: number;
  readonly name: string;
  readonly category: 'POKEMON' | 'TRAINER';
  readonly subtype: string;
  readonly element: string | null;
  readonly hp: number | null;
  readonly evolvesFrom: string | null;
  readonly weakness: string | null;
  readonly retreat: number | null;
  readonly abilities: readonly { readonly name: string; readonly effect: string }[];
  readonly attacks: readonly { readonly cost: string; readonly name: string; readonly damage: string | null; readonly effect: string | null }[];
  readonly effect: string | null;
  readonly ruleBox?: RuleBox;
};

const TYPE: Readonly<Record<string, PokemonType>> = {
  Grass: 'GRASS', Fire: 'FIRE', Water: 'WATER', Lightning: 'LIGHTNING', Psychic: 'PSYCHIC', Fighting: 'FIGHTING',
  Darkness: 'DARKNESS', Metal: 'METAL', Dragon: 'DRAGON', Colorless: 'COLORLESS',
};
const COST: Readonly<Record<string, CostType>> = {
  G: 'GRASS', R: 'FIRE', W: 'WATER', L: 'LIGHTNING', P: 'PSYCHIC', F: 'FIGHTING', D: 'DARKNESS', M: 'METAL', C: 'COLORLESS',
};
const STAGE: Readonly<Record<string, Stage>> = { Basic: 'BASIC', 'Stage 1': 'STAGE_1', 'Stage 2': 'STAGE_2' };
const TRAINER_SUBTYPE: Readonly<Record<string, TrainerFx['subtype']>> = { Item: 'ITEM', Supporter: 'SUPPORTER', Tool: 'TOOL', Stadium: 'STADIUM' };

/** Mesma carta de jogo ⇔ mesmos dados de regra (arte, raridade, pacote e artista não contam). */
export const gameplayKey = (r: GameRow): string =>
  JSON.stringify([r.name, r.category, r.subtype, r.element, r.hp, r.evolvesFrom, r.weakness, r.retreat, r.abilities, r.attacks, r.effect]);

/** id de ataque/Habilidade estável a partir do nome em inglês (só precisa ser único dentro da carta). */
export const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ruleBoxOf = (r: GameRow): RuleBox => r.ruleBox ?? (/ ex$/.test(r.name) ? 'EX' : 'NONE');
/** Nome-base em inglês sem "ex" e sem "Mega … ex". */
const englishBase = (name: string, ruleBox: RuleBox): string =>
  ruleBox === 'MEGA_EX' ? name.replace(/^Mega /, '').replace(/ ex$/, '') : ruleBox === 'EX' ? name.replace(/ ex$/, '') : name;

export function makeBuilder(effects: EffectTables, names: NameTables, prefix: string) {
  function need<T>(table: Readonly<Record<string, T>>, key: string, what: string): T {
    const value = table[key];
    if (value === undefined) throw new Error(`${prefix}: ${what} sem entrada: "${key}"`);
    return value;
  }

  /** Nome final de qualquer carta pelo nome em inglês (Treinador traduzido, Pokémon com forma regional em PT-BR). */
  function finalName(englishName: string): string {
    const trainerName = names.trainers[englishName];
    if (trainerName) return trainerName;
    if (/^Mega .+ ex$/.test(englishName)) return `Mega ${pokemonName(englishBase(englishName, 'MEGA_EX'))} ex`;
    if (/ ex$/.test(englishName)) return `${pokemonName(englishBase(englishName, 'EX'))} ex`;
    return pokemonName(englishName);
  }

  function costOf(cost: string): Partial<Record<CostType, number>> {
    const out: Partial<Record<CostType, number>> = {};
    if (cost === '0') return out;
    for (const ch of cost) {
      const t = need(COST, ch, 'símbolo de custo');
      out[t] = (out[t] ?? 0) + 1;
    }
    return out;
  }

  function buildAttack(a: GameRow['attacks'][number], owner: string): Attack {
    const m = a.damage ? /^(\d+)([+x×]?)$/.exec(a.damage) : null;
    if (a.damage && !m) throw new Error(`${prefix}: dano não reconhecido em ${owner}/${a.name}: "${a.damage}"`);
    const printed = m ? Number(m[1]) : null;
    const variable = !!m?.[2];
    const fx = a.effect ? need(effects.attacks, a.effect, `efeito de ataque (${owner}/${a.name})`)(printed) : {};
    // Dano variável ("30+", "50×") vem de fórmula ou de bônus condicional (MODIFY DAMAGE_DEALT no próprio Pokémon).
    const bonus = (fx.effects ?? []).some((b) => b.operation.type === 'MODIFY' && b.operation.stat === 'DAMAGE_DEALT');
    if (variable && !fx.formula && !bonus) throw new Error(`${prefix}: dano "${a.damage}" em ${owner}/${a.name} sem fórmula nem bônus`);
    return attack({
      id: slug(a.name), name: need(names.attacks, a.name, 'nome de ataque'), cost: costOf(a.cost),
      damage: fx.damage !== undefined ? fx.damage : printed,
      ...(fx.formula ? { formula: fx.formula } : {}),
      ...(fx.target !== undefined ? { target: fx.target } : {}),
      ...(fx.preconditions ? { preconditions: fx.preconditions } : {}),
      ...(fx.additionalCosts ? { additionalCosts: fx.additionalCosts } : {}),
      ...(fx.alternativeCost ? { alternativeCost: fx.alternativeCost } : {}),
      ...(fx.ignoreDefenderEffects ? { ignoreDefenderEffects: true as const } : {}),
      effects: fx.effects ?? [],
    });
  }

  /** Definição de carta de uma linha; `id` explícito quando o nome já pertence a outra definição. */
  function buildCard(r: GameRow, id?: string): CardDefinition {
    if (r.category === 'TRAINER') {
      const fx = need(effects.trainers, r.effect ?? '', `efeito de Treinador (${r.name})`);
      const declared = TRAINER_SUBTYPE[r.subtype];
      if (declared && declared !== fx.subtype) throw new Error(`${prefix}: ${r.name} é ${r.subtype} na origem, mas o efeito é ${fx.subtype}`);
      return trainer({ ...(id ? { id } : {}), baseName: need(names.trainers, r.name, 'nome de Treinador'), subtype: fx.subtype, effects: fx.effects,
        ...(fx.rules ? { rules: fx.rules } : {}) });
    }
    const ruleBox = ruleBoxOf(r);
    const base = englishBase(r.name, ruleBox);
    const type = need(TYPE, r.element ?? '', `tipo (${r.name})`);
    const tags = tagsOf(base);
    return pokemon({
      ...(id ? { id } : {}), baseName: pokemonName(base), ruleBox, stage: need(STAGE, r.subtype, `estágio (${r.name})`),
      from: r.evolvesFrom ? [deckLimitKeyV1(finalName(r.evolvesFrom))] : [], type, hp: r.hp ?? 0, retreat: r.retreat ?? 0,
      weakness: r.weakness ? need(TYPE, r.weakness, `fraqueza (${r.name})`) : null,
      attacks: r.attacks.map((a) => buildAttack(a, r.name)),
      abilities: r.abilities.map((ab) => need(effects.abilities, ab.effect, `Habilidade (${r.name}/${ab.name})`)(slug(ab.name), need(names.abilities, ab.name, 'nome de Habilidade'))),
      ...(tags.length ? { tags } : {}),
    });
  }

  return { buildCard, finalName };
}

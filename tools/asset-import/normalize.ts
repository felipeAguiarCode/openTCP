// Normalização das linhas de `src/content/source/pocket/raw` (JSON do Limitless, em inglês) para o formato enxuto do
// conteúdo: só campos de jogo, símbolo de raridade resolvido (brilhantes separados), pacote, artista, caixa de regra,
// bebês da 6ª carta e origem das promos. Funções puras (testadas em normalize.test.ts); o index.ts só lê e escreve arquivos.
import type { PocketRarity, PocketRow, PromoSource } from '../../src/content/source/pocket/rows.ts';
import type { PocketSet } from '../../src/content/source/pocket/registry.ts';

export type Raw = {
  readonly number: number; readonly name: string; readonly element?: string; readonly hp?: number | null; readonly category: string; readonly subtype: string;
  readonly evolves_from?: string | null; readonly abilities: readonly { readonly name: string; readonly effect: string }[];
  readonly attacks: readonly { readonly cost: string; readonly name: string; readonly damage: string | number | null; readonly effect: string | null }[];
  readonly effect?: string | null; readonly rules?: readonly string[]; readonly weakness?: string | null; readonly retreat?: number | null;
  readonly rarity: string | null; readonly pack: string | null; readonly artist?: string | null;
};

/**
 * Texto de regra canônico: espaços colapsados, espaço depois de ponto colado em maiúscula ("Pokémon.At" → "Pokémon. At"),
 * sinal de menos tipográfico → hífen, apóstrofo curvo → reto, "Pokemon" → "Pokémon" e "],[" → "], [". O mesmo texto
 * escrito de jeitos diferentes entre sets vira a mesma chave nas tabelas de efeito.
 */
export function cleanText(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/\s+/g, ' ').replace(/\.(?=[A-Z])/g, '. ').replace(/−/g, '-').replace(/[‘’]/g, "'")
    .replace(/\bPokemon\b/g, 'Pokémon').replace(/\],\[/g, '], [').trim();
}

const SYMBOLS: Readonly<Record<string, PocketRarity>> = {
  '◊': '◊', '◊◊': '◊◊', '◊◊◊': '◊◊◊', '◊◊◊◊': '◊◊◊◊', '☆': '☆', '☆☆': '☆☆', '☆☆☆': '☆☆☆', 'Crown Rare': '♛',
};

const PROMO_SOURCES: Readonly<Record<string, PromoSource>> = {
  Shop: 'SHOP', Campaign: 'CAMPAIGN', Missions: 'MISSIONS', 'Premium Missions': 'PREMIUM_MISSIONS', 'Wonder Pick': 'WONDER_PICK',
  'Promo pack': 'PROMO_PACK', 'Promo Pack': 'PROMO_PACK',
};

function ruleBoxOf(r: Raw): PocketRow['ruleBox'] {
  const rules = r.rules ?? [];
  const mega = rules.some((x) => /^Mega Evolution ex rule/.test(x));
  const ex = !mega && rules.some((x) => /^ex rule/.test(x));
  const byName = /^Mega .+ ex$/.test(r.name) ? 'MEGA_EX' : / ex$/.test(r.name) ? 'EX' : 'NONE';
  const byRule = mega ? 'MEGA_EX' : ex ? 'EX' : 'NONE';
  if (r.category === 'Pokémon' && byName !== byRule) throw new Error(`${r.name} #${r.number}: nome indica ${byName}, regra indica ${byRule}`);
  return r.category === 'Pokémon' ? byRule : 'NONE';
}

/** Bebê da 6ª carta: Básico de 30 PS, sem Fraqueza, sem recuo e com todos os ataques de custo zero. */
function isBabyShape(r: Raw): boolean {
  return r.category === 'Pokémon' && r.subtype === 'Basic' && r.hp === 30 && (!r.weakness || r.weakness === 'none') && (r.retreat ?? 0) === 0
    && r.attacks.length > 0 && r.attacks.every((a) => a.cost === '0');
}

/** Normaliza as linhas de um set e confere as contagens esperadas do registro (numeração, brilhantes, bebês). */
export function normalizeSet(set: PocketSet, raws: readonly Raw[]): PocketRow[] {
  const sorted = [...raws].sort((a, b) => a.number - b.number);
  if (sorted.length !== set.expect.printings) throw new Error(`${set.code}: ${sorted.length} impressões, esperado ${set.expect.printings}`);
  sorted.forEach((r, i) => {
    if (r.number !== i + 1) throw new Error(`${set.code}: numeração quebrada em ${r.number} (esperado ${i + 1})`);
  });
  // Brilhantes: a origem grava ✵/✵✵ como ☆/☆☆; são os ☆/☆☆ numerados depois do último ☆☆☆ do set.
  const lastImmersive = Math.max(0, ...sorted.filter((r) => r.rarity === '☆☆☆').map((r) => r.number));
  const rows = sorted.map((r): PocketRow => {
    let rarity: PocketRarity;
    let promoSource: PromoSource | null = null;
    if (set.kind === 'PROMO') {
      rarity = 'PROMO';
      if (r.rarity !== null) {
        const src = PROMO_SOURCES[r.rarity];
        if (!src) throw new Error(`${set.code} #${r.number}: origem de promo desconhecida "${r.rarity}"`);
        promoSource = src;
      }
    } else {
      const sym = r.rarity ? SYMBOLS[r.rarity] : undefined;
      if (!sym) throw new Error(`${set.code} #${r.number}: raridade desconhecida "${r.rarity}"`);
      rarity = lastImmersive && r.number > lastImmersive && sym === '☆' ? '✵' : lastImmersive && r.number > lastImmersive && sym === '☆☆' ? '✵✵' : sym;
    }
    let pack: string | null = null;
    if (r.pack) {
      const key = set.packs[r.pack];
      if (!key) throw new Error(`${set.code} #${r.number}: pacote desconhecido "${r.pack}"`);
      pack = key;
    }
    return {
      number: r.number,
      name: r.name,
      category: r.category === 'Trainer' ? 'TRAINER' : 'POKEMON',
      subtype: r.subtype,
      element: r.element ?? null,
      hp: r.hp ?? null,
      evolvesFrom: r.evolves_from ?? null,
      weakness: r.weakness && r.weakness !== 'none' ? r.weakness : null,
      retreat: r.retreat ?? null,
      abilities: r.abilities.map((a) => ({ name: a.name, effect: cleanText(a.effect)! })),
      attacks: r.attacks.map((a) => ({ cost: a.cost, name: a.name, damage: a.damage === null || a.damage === '' ? null : String(a.damage), effect: cleanText(a.effect) })),
      effect: cleanText(r.effect),
      rarity,
      pack,
      artist: r.artist ?? null,
      ruleBox: ruleBoxOf(r),
      bonus: set.babyBonus && isBabyShape(r) && (rarity === '◊◊◊' || rarity === '☆'),
      promoSource,
    };
  });
  const shiny: [number, number] = [rows.filter((r) => r.rarity === '✵').length, rows.filter((r) => r.rarity === '✵✵').length];
  if (shiny[0] !== set.expect.shiny[0] || shiny[1] !== set.expect.shiny[1]) throw new Error(`${set.code}: brilhantes ${shiny.join('/')}, esperado ${set.expect.shiny.join('/')}`);
  const bonus = rows.filter((r) => r.bonus).map((r) => r.number);
  if (bonus.join(',') !== set.expect.bonus.join(',')) throw new Error(`${set.code}: 6ª carta ${bonus.join(',')}, esperado ${set.expect.bonus.join(',')}`);
  return rows;
}

/** Linha do formato legado do A1 (a1-data.generated.ts): raridade e pacote como na origem. */
export function a1LegacyRow(r: Raw) {
  return {
    number: r.number,
    name: r.name,
    category: r.category === 'Trainer' ? 'TRAINER' : 'POKEMON',
    subtype: r.subtype,
    element: r.element ?? null,
    hp: r.hp ?? null,
    evolvesFrom: r.evolves_from ?? null,
    weakness: r.weakness && r.weakness !== 'none' ? r.weakness : null,
    retreat: r.retreat ?? null,
    abilities: r.abilities.map((a) => ({ name: a.name, effect: cleanText(a.effect)! })),
    attacks: r.attacks.map((a) => ({ cost: a.cost, name: a.name, damage: a.damage === null || a.damage === '' ? null : String(a.damage), effect: cleanText(a.effect) })),
    effect: cleanText(r.effect),
    rarity: r.rarity,
    pack: r.pack ? r.pack.replace(/ pack$/, '').toLowerCase() : null,
    artist: r.artist ?? null,
  };
}

/** Nome do arquivo de arte no pacote: `A1a-001.webp` → `A1A-001.webp`, `P-B-001.webp` → `PB-001.webp`. */
export const artFileName = (set: PocketSet, number: number): string => `${set.setId.toUpperCase()}-${String(number).padStart(3, '0')}.webp`;
/** Nome do arquivo na origem (`pocket/raw/<setId>/<código>-NNN`). */
export const sourceBaseName = (set: PocketSet, number: number): string => `${set.code}-${String(number).padStart(3, '0')}`;

// Cosméticos (campanha §21.4–§21.6; direção visual §8): nove playmats, versos, moedas e flairs; presets de NPC e do jogador.
// Procedurais (assetKey null, paleta e padrão dos tokens pocket-light-v1), exceto as moedas e os sleeves do Pokémon TCG
// Pocket: imagens empacotadas (assetKey `coin-art:<stem>`, src/presentation/assets/coins; `sleeve-art:<stem>`,
// src/presentation/assets/sleeves), gratuitas para equipar.
import type { Cosmetic, CosmeticPresetContent } from '../types.ts';
import { POCKET_COINS } from './coins.generated.ts';
import { POCKET_SLEEVES } from './sleeves.generated.ts';

type Pattern = Cosmetic['visual']['pattern'];

const mat = (cosmeticId: string, name: string, palette: string[], pattern: Pattern, accentHex: string, acquisition: Cosmetic['acquisition']): Cosmetic => ({
  cosmeticId, kind: 'PLAYMAT', definitionVersion: 2, names: { 'pt-BR': name }, acquisition,
  visual: { palette, pattern, assetKey: null, variants: ['standard', 'calm'], accentHex },
  fallbackCosmeticId: cosmeticId === 'mat-neutral' ? null : 'mat-neutral',
});

const FREE = { kind: 'FREE', requiredCompletedNodeId: null, credits: 0 } as const;
const shop = (nodeId: string, credits: number): Cosmetic['acquisition'] => ({ kind: 'EMPORIUM', requiredCompletedNodeId: nodeId, credits });

export const PLAYMATS: readonly Cosmetic[] = [
  mat('mat-neutral', 'Mesa Neutra', ['#EAF4FA', '#DCD6F7', '#FFFFFF', '#75C7FA'], 'LINES', '#75C7FA', FREE),
  mat('mat-academy', 'Escola de Treinadores', ['#FFFFFF', '#CFE8FB', '#DCD6F7', '#357DE4'], 'LINES', '#357DE4', FREE),
  mat('mat-c01-grove', 'Ginásio de Celadon', ['#DFF5E3', '#B9E4C0', '#A7D8F5', '#72B75D'], 'LEAVES', '#72B75D', shop('C01-E06', 500)),
  mat('mat-c02-harbor', 'Ginásio de Sootopolis', ['#BFE9FA', '#8EE3E0', '#F3E6C8', '#2DECE5'], 'WAVES', '#2DECE5', shop('C02-E06', 500)),
  mat('mat-c03-circuits', 'Ginásio de Vermilion', ['#EEF5FC', '#FFF1B8', '#9BE7F0', '#E8C83E'], 'CIRCUITS', '#E8C83E', shop('C03-E06', 500)),
  mat('mat-c04-observatory', 'Ginásio de Saffron', ['#E7DDF5', '#D6E4F7', '#E9ECF2', '#A279CB'], 'STARS', '#A279CB', shop('C04-E06', 500)),
  mat('mat-c05-foundry', 'Ginásio de Stow-on-Side', ['#E6EAEE', '#FBD9C9', '#F5F7F9', '#EF785B'], 'SYMBOLS', '#EF785B', shop('C05-E06', 500)),
  mat('mat-c06-archive', 'Ginásio de Viridian', ['#FBF8EF', '#D3EAFB', '#E3DDF5', '#75C7FA'], 'PAGES', '#75C7FA', shop('C06-E06', 500)),
  mat('mat-circuit-complete', 'Troféu do Torneio de Kanto', ['#FFFFFF', '#C8FAF5', '#DCD6F7', '#F6CE3D'], 'CHAPTERS', '#F6CE3D',
    { kind: 'GRANT', requiredCompletedNodeId: 'F00-D03', credits: 0, grantMilestoneId: 'final-f00-d03' }),
];

type ChapterTheme = { readonly n: string; readonly name: string; readonly palette: readonly string[]; readonly pattern: Pattern; readonly accent: string };
const THEMES: readonly ChapterTheme[] = [
  { n: '01', name: 'Celadon', palette: ['#DFF5E3', '#72B75D'], pattern: 'LEAVES', accent: '#72B75D' },
  { n: '02', name: 'Sootopolis', palette: ['#BFE9FA', '#2DECE5'], pattern: 'WAVES', accent: '#2DECE5' },
  { n: '03', name: 'Vermilion', palette: ['#FFF1B8', '#E8C83E'], pattern: 'CIRCUITS', accent: '#E8C83E' },
  { n: '04', name: 'Saffron', palette: ['#E7DDF5', '#A279CB'], pattern: 'STARS', accent: '#A279CB' },
  { n: '05', name: 'Stow-on-Side', palette: ['#FBD9C9', '#EF785B'], pattern: 'SYMBOLS', accent: '#EF785B' },
  { n: '06', name: 'Viridian', palette: ['#FBF8EF', '#75C7FA'], pattern: 'PAGES', accent: '#75C7FA' },
];

const accessory = (kind: 'SLEEVE' | 'COIN', cosmeticId: string, name: string, palette: readonly string[], pattern: Pattern, accentHex: string, acquisition: Cosmetic['acquisition'], fallback: string | null): Cosmetic => ({
  cosmeticId, kind, definitionVersion: 1, names: { 'pt-BR': name }, acquisition,
  visual: { palette: [...palette], pattern, assetKey: null, variants: ['standard'], accentHex }, fallbackCosmeticId: fallback,
});

/** Nomes em PT-BR dos sleeves do Pocket que não são só nomes próprios (o resto mantém o nome, com “e” no lugar de “and”/“&”). */
const SLEEVE_NAMES: Readonly<Record<string, string>> = {
  "Team Rocket's Boss": 'Chefe da Equipe Rocket', 'Team Rocket': 'Equipe Rocket', 'Zapdos Articuno and Moltres': 'Zapdos, Articuno e Moltres',
  'Yamper Growlithe Lillipup Rockruff and Fidough': 'Yamper e Companhia', 'Pokemon of the Forest': 'Pokémon da Floresta',
  'Pokemon 30th Celebration Design': 'Celebração de 30 anos', 'The New Year With Pikachu': 'Ano-Novo com Pikachu', 'Special Set 01': 'Conjunto Especial 1',
  'Special Set 02': 'Conjunto Especial 2', 'Professor Oak': 'Professor Carvalho', 'Lillie ver. 2': 'Lillie (versão 2)', 'Eevee ver. 2': 'Eevee (versão 2)',
  'Ho-oh & Lugia': 'Ho-Oh e Lugia', 'Alolan Vulpix': 'Vulpix de Alola', 'Street Party': 'Festa na Rua', 'Mythical Island Mew': 'Mew da Ilha Mítica',
};
const sleeveName = (name: string): string => SLEEVE_NAMES[name] ?? name.replace(/^Shiny (.+)$/, '$1 Brilhante').replace(/ (?:and|&) /g, ' e ');

/** Sleeves do Pokémon TCG Pocket (o verso das cartas do deck, imagem empacotada): gratuitos, em ordem alfabética. */
export const POCKET_SLEEVE_COSMETICS: readonly Cosmetic[] = [...POCKET_SLEEVES]
  .map((s) => ({ ...s, label: sleeveName(s.name) }))
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  .map((s) => ({
    cosmeticId: `sleeve-pocket-${s.stem}`, kind: 'SLEEVE' as const, definitionVersion: 1, names: { 'pt-BR': `Verso ${s.label}` }, acquisition: FREE,
    visual: { palette: [s.base, s.edge], pattern: 'NONE' as const, assetKey: `sleeve-art:${s.stem}`, variants: ['standard'], accentHex: s.edge },
    fallbackCosmeticId: 'sleeve-neutral',
  }));

export const SLEEVES: readonly Cosmetic[] = [
  accessory('SLEEVE', 'sleeve-neutral', 'Verso Neutro', ['#FFFFFF', '#75C7FA'], 'LINES', '#75C7FA', FREE, null),
  ...THEMES.map((t) => accessory('SLEEVE', `sleeve-c${t.n}`, `Verso ${t.name}`, t.palette, t.pattern, t.accent, shop(`C${t.n}-E03`, 200), 'sleeve-neutral')),
  ...POCKET_SLEEVE_COSMETICS,
];

/** Sleeve do Pocket de cada rival (preset de NPC), como as moedas: o Prólogo, cada Ginásio e a final. */
const RIVAL_SLEEVES: Readonly<Record<string, string>> = {
  academy: 'sleeve-pocket-professoroak', '01': 'sleeve-pocket-erikaandvileplume', '02': 'sleeve-pocket-blastoise', '03': 'sleeve-pocket-pikachu',
  '04': 'sleeve-pocket-mewtwo', '05': 'sleeve-pocket-lucario', '06': 'sleeve-pocket-charizard', final: 'sleeve-pocket-teamrocketsboss',
};

/** Nomes em PT-BR das moedas do Pocket que não são nomes próprios (o resto mantém o nome do Pokémon ou treinador). */
const COIN_NAMES: Readonly<Record<string, string>> = {
  'Poke Ball': 'Poké Bola', 'Professor Oak': 'Professor Carvalho', 'Team Rocket': 'Equipe Rocket', "Team Rocket's Boss": 'Chefe da Equipe Rocket',
  'Pokemon 30th Celebration Design': 'Celebração de 30 anos', 'Special Set 01': 'Conjunto Especial 1', 'Special Set 02': 'Conjunto Especial 2',
  'Pikachu Ver. 2': 'Pikachu (versão 2)', 'Lillie ver. 2': 'Lillie (versão 2)', 'Eevee ver. 2': 'Eevee (versão 2)',
  'Ho-Oh & Lugia': 'Ho-Oh e Lugia', 'Espeon & Umbreon': 'Espeon e Umbreon', 'Alolan Vulpix': 'Vulpix de Alola', 'Shaymin Sky Forme': 'Shaymin Forma Céu',
  'Red Rainbow': 'Red Arco-Íris', 'Rainbow Erika': 'Erika Arco-Íris', 'Erika Alt': 'Erika (alternativa)',
};
const coinName = (name: string): string => COIN_NAMES[name] ?? name.replace(/^Shiny (.+)$/, '$1 Brilhante');

/** Moedas do Pokémon TCG Pocket (face empacotada; coroa gerada da face): gratuitas, em ordem alfabética. */
export const POCKET_COIN_COSMETICS: readonly Cosmetic[] = [...POCKET_COINS]
  .map((c) => ({ ...c, label: coinName(c.name) }))
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  .map((c) => ({
    cosmeticId: `coin-pocket-${c.stem}`, kind: 'COIN' as const, definitionVersion: 1, names: { 'pt-BR': `Moeda ${c.label}` }, acquisition: FREE,
    visual: { palette: [c.base, c.edge], pattern: 'NONE' as const, assetKey: `coin-art:${c.stem}`, variants: ['standard'], accentHex: c.edge },
    fallbackCosmeticId: 'coin-neutral',
  }));

export const COINS: readonly Cosmetic[] = [
  accessory('COIN', 'coin-neutral', 'Moeda Neutra', ['#FFFFFF', '#357DE4'], 'NONE', '#357DE4', FREE, null),
  ...THEMES.map((t) => accessory('COIN', `coin-c${t.n}`, `Moeda ${t.name}`, t.palette, t.pattern, t.accent, shop(`C${t.n}-E06`, 300), 'coin-neutral')),
  ...POCKET_COIN_COSMETICS,
];

/** Moeda do Pocket de cada rival (preset de NPC): a do Prólogo, a de cada Ginásio e a da final. */
const RIVAL_COINS: Readonly<Record<string, string>> = {
  academy: 'coin-pocket-pokeball', '01': 'coin-pocket-erikaalt', '02': 'coin-pocket-blastoise', '03': 'coin-pocket-pikachu',
  '04': 'coin-pocket-mewtwo', '05': 'coin-pocket-lucario', '06': 'coin-pocket-charizard', final: 'coin-pocket-teamrocketsboss',
};

const flair = (cosmeticId: string, name: string, palette: readonly string[], accentHex: string, acquisition: Cosmetic['acquisition'], fallback: string | null): Cosmetic => ({
  cosmeticId, kind: 'FLAIR', definitionVersion: 1, names: { 'pt-BR': name }, acquisition,
  visual: { palette: [...palette], pattern: 'NONE', assetKey: null, variants: ['standard'], accentHex },
  flair: { triggers: ['PUBLIC_ENTRY'], particleBudget: 24, durationMs: 600, reducedVariant: 'FADE' },
  fallbackCosmeticId: fallback,
});

export const FLAIRS: readonly Cosmetic[] = [
  flair('flair-basic', 'Brilho Básico', ['#FFFFFF', '#2DECE5'], '#2DECE5', FREE, null),
  ...THEMES.map((t) => flair(`flair-c${t.n}`, `Brilho ${t.name}`, t.palette, t.accent,
    { kind: 'GRANT', requiredCompletedNodeId: `C${t.n}-E06`, credits: 0, grantMilestoneId: `medal-c${t.n}` }, 'flair-basic')),
];

export const COSMETICS: readonly Cosmetic[] = [...PLAYMATS, ...SLEEVES, ...COINS, ...FLAIRS];

export const COSMETIC_PRESETS: readonly CosmeticPresetContent[] = [
  { presetId: 'preset-player-default', playmatId: 'mat-neutral', sleeveId: 'sleeve-neutral', coinId: 'coin-pocket-pokeball', defaultEntryFlairId: 'flair-basic' },
  { presetId: 'preset-npc-academy', playmatId: 'mat-academy', sleeveId: RIVAL_SLEEVES.academy!, coinId: RIVAL_COINS.academy!, defaultEntryFlairId: 'flair-basic' },
  ...THEMES.map((t, i) => ({
    presetId: `preset-npc-c${t.n}`, playmatId: PLAYMATS[i + 2]!.cosmeticId, sleeveId: RIVAL_SLEEVES[t.n] ?? `sleeve-c${t.n}`, coinId: RIVAL_COINS[t.n] ?? `coin-c${t.n}`, defaultEntryFlairId: `flair-c${t.n}`,
  })),
  { presetId: 'preset-npc-final', playmatId: 'mat-circuit-complete', sleeveId: RIVAL_SLEEVES.final!, coinId: RIVAL_COINS.final!, defaultEntryFlairId: 'flair-basic' },
];

/** Cosméticos gratuitos concedidos no onboarding. */
export const FREE_COSMETIC_IDS: readonly string[] = ['mat-neutral', 'mat-academy', 'sleeve-neutral', 'coin-neutral', 'flair-basic'];

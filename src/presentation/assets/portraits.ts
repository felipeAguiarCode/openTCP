// Retratos (emotes) de treinadores da franquia, usados como avatar do jogador e dos rivais. Cada PNG (128×128) já é
// um emblema redondo com aro próprio, e o cabelo ou os acessórios podem sair do disco: a interface desenha só a
// imagem, sem contorno, sombra nem recorte. A pasta portraits/ é a própria origem (sem importador); chave
// `portrait:<stem>` (`portrait:erika-emote-1` → portraits/erika-emote-1.png). Origem e restrições em ASSETS.md.

const FILES: Readonly<Record<string, string>> = import.meta.glob<string>('./portraits/*.png', { query: '?url', import: 'default', eager: true });
const URLS = new Map(Object.entries(FILES).map(([file, url]) => [file.slice('./portraits/'.length, -'.png'.length), url]));

/** Nome de exibição de cada treinador pelo prefixo do arquivo (o mesmo nome das cartas de Apoiador, quando há). */
const TRAINERS: Readonly<Record<string, string>> = {
  bea: 'Bea', blaine: 'Blaine', blue: 'Blue', brassius: 'Brassius', brawly: 'Brawly', bugsy: 'Bugsy', burgh: 'Burgh', candice: 'Candice',
  cheren: 'Cheren', chili: 'Chili', chuck: 'Chuck', clay: 'Clay', clemont: 'Clemont', 'crasher-wake': 'Crasher Wake', elesa: 'Elesa',
  erika: 'Erika', falkner: 'Falkner', fantina: 'Fantina', flannery: 'Flannery', gardenia: 'Gardenia', giovanni: 'Giovanni', gordie: 'Gordie',
  grant: 'Grant', grusha: 'Grusha', iono: 'Iono', janine: 'Janine', jasmine: 'Jasmine', kabu: 'Kabu', koga: 'Koga', korrina: 'Korrina',
  larry: 'Larry', liza: 'Liza', 'lt-surge': 'Tenente Surge', marlon: 'Marlon', marnie: 'Marnie', maylene: 'Maylene', melony: 'Melony',
  milo: 'Milo', morty: 'Morty', norman: 'Norman', olympia: 'Olympia', piers: 'Piers', raihan: 'Raihan', roark: 'Roark', roxanne: 'Roxanne',
  roxie: 'Roxie', sabrina: 'Sabrina', skyla: 'Skyla', tate: 'Tate', valerie: 'Valerie', viola: 'Viola', volkner: 'Volkner', wallace: 'Wallace',
  whitney: 'Whitney', wulfric: 'Wulfric',
};

/** Variantes de roupa do arquivo, em PT-BR. */
const VARIANT_WORDS: Readonly<Record<string, string>> = {
  holiday: 'Festas', summer: 'Verão', fall: 'Outono', spring: 'Primavera', new: 'Ano-Novo', year: '', anniversary: 'Aniversário',
  academy: 'Academia', classic: 'Clássico', champion: 'Campeão', special: 'Traje especial', costume: '', arc: 'Arc', sygna: 'Sygna',
  alt: 'Alternativo', palentines: 'Dia dos Namorados',
};

export type Portrait = {
  /** `portrait:<stem>` — o valor guardado no perfil e no conteúdo. */
  readonly key: string;
  /** Prefixo do treinador (`lt-surge`). */
  readonly trainer: string;
  readonly trainerName: string;
  /** Roupa (“Festas 2020”, “Academia”); null no traje padrão. */
  readonly variant: string | null;
  readonly label: string;
  readonly url: string;
};

function describe(stem: string, url: string): Portrait | null {
  const trainer = Object.keys(TRAINERS).filter((t) => stem === t || stem.startsWith(`${t}-`)).sort((a, b) => b.length - a.length)[0];
  if (!trainer) return null;
  const rest = stem.slice(trainer.length).replace(/^-/, '');
  const [outfit = '', emote = ''] = rest.split(/-?emote-?/);
  const words = outfit.split('-').filter(Boolean).map((w) => (/^\d+$/.test(w) ? w : VARIANT_WORDS[w] ?? w)).filter(Boolean);
  const variant = words.length ? words.join(' ') : null;
  const trainerName = TRAINERS[trainer]!;
  const label = `${trainerName}${variant ? ` (${variant})` : ''}${emote ? ` · ${/^\d+$/.test(emote) ? `expressão ${emote}` : emote === 'gym' ? 'ginásio' : emote}` : ''}`;
  return { key: `portrait:${stem}`, trainer, trainerName, variant, label, url };
}

/** Todos os retratos, em ordem de treinador e de arquivo. */
export const PORTRAITS: readonly Portrait[] = [...URLS].map(([stem, url]) => describe(stem, url)).filter((p): p is Portrait => !!p)
  .sort((a, b) => a.trainerName.localeCompare(b.trainerName, 'pt-BR') || a.key.localeCompare(b.key));

/** Retratos agrupados por treinador (seletor de avatar). */
export const PORTRAITS_BY_TRAINER: readonly { readonly trainerName: string; readonly portraits: readonly Portrait[] }[] = (() => {
  const groups = new Map<string, Portrait[]>();
  for (const p of PORTRAITS) groups.set(p.trainerName, [...(groups.get(p.trainerName) ?? []), p]);
  return [...groups].map(([trainerName, portraits]) => ({ trainerName, portraits }));
})();

/** URL local do retrato pela chave `portrait:<stem>`; null se não existe no pacote. */
export function portraitUrl(key: string | null | undefined): string | null {
  const m = key ? /^portrait:([a-z0-9-]+)$/.exec(key) : null;
  return m ? URLS.get(m[1]!) ?? null : null;
}

export const portraitOf = (key: string | null | undefined): Portrait | null => PORTRAITS.find((p) => p.key === key) ?? null;

/** Retrato padrão de um perfil novo (e dos perfis antigos, que guardavam um tipo de Energia como avatar). */
export const DEFAULT_PLAYER_PORTRAIT = 'portrait:marnie-academy-emote-1';

/** Retrato do jogador pela configuração `avatar`: a chave, se existir no pacote; senão, o padrão. */
export function playerPortraitKey(setting: unknown): string {
  return typeof setting === 'string' && portraitUrl(setting) ? setting : DEFAULT_PLAYER_PORTRAIT;
}

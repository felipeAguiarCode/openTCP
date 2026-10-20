// Linha normalizada de uma impressão de qualquer set do Pocket (gerada por tools/asset-import em pocket/data/). Os
// campos de jogo são os mesmos do A1Row (a1/a1-data.generated.ts), então a mesma carta de jogo tem a mesma chave em
// qualquer set e reimpressões apontam para a mesma definição.

/** Símbolo de raridade já resolvido: brilhantes (✵/✵✵) separados das estrelas; promos sem símbolo. */
export type PocketRarity = '◊' | '◊◊' | '◊◊◊' | '◊◊◊◊' | '☆' | '☆☆' | '☆☆☆' | '✵' | '✵✵' | '♛' | 'PROMO';

/** Origem da promo no Pocket (campo `rarity` da origem nos sets P-A/P-B); só informativa. */
export type PromoSource = 'SHOP' | 'CAMPAIGN' | 'MISSIONS' | 'PREMIUM_MISSIONS' | 'WONDER_PICK' | 'PROMO_PACK';

export type PocketRow = {
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
  readonly rarity: PocketRarity;
  /** Chave do pacote de origem (registry `packs`); null = em todos os pacotes do set. */
  readonly pack: string | null;
  readonly artist: string | null;
  readonly ruleBox: 'NONE' | 'EX' | 'MEGA_EX';
  /** Bebê que só sai na 6ª carta do pacote (A4, A4a). */
  readonly bonus: boolean;
  readonly promoSource: PromoSource | null;
};

// O content-build precisa falhar com lista clara quando o conteúdo quebra uma regra (campanha §20.5).
import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import type { ContentBundle, Product } from './types.ts';
import { validateBundle } from '../../tools/content-build/validate.ts';

const base = buildBundle();
const errorsOf = (bundle: ContentBundle) => validateBundle(bundle).errors;
const withNodes = (fn: (nodes: ContentBundle['nodes']) => ContentBundle['nodes']): ContentBundle => ({ ...base, nodes: fn(base.nodes) });

describe('validador do content-build rejeita conteúdo inválido', () => {
  it('ciclo e pré-requisito fora de §2.2', () => {
    const errors = errorsOf(withNodes((nodes) => nodes.map((n) => (n.nodeId === 'P00-T01' ? { ...n, prerequisites: { allOf: ['P00-T06'] } } : n))));
    expect(errors.some((e) => e.includes('ciclo'))).toBe(true);
    expect(errors.some((e) => e.includes('P00-T01') && e.includes('§2.2'))).toBe(true);
  });

  it('deck ilegal (21 cartas, 3 cópias)', () => {
    const decks = base.decks.map((d) => (d.deckId === 'starter-jardim-vivo' ? { ...d, entries: [...d.entries, { printingId: d.entries[0]!.printingId, count: 1 as const }] } : d));
    const errors = errorsOf({ ...base, decks });
    expect(errors.some((e) => e.includes('starter-jardim-vivo') && e.includes('DECK_SIZE_INVALID'))).toBe(true);
    expect(errors.some((e) => e.includes('starter-jardim-vivo') && e.includes('DECK_COPY_LIMIT_EXCEEDED'))).toBe(true);
  });

  it('categoria com chance positiva e pool vazio', () => {
    const products = base.products.map((p): Product => (p.productId === 'pack-a1-charizard' ? { ...p, pools: { ...p.pools!, ULTRA: [] } } : p));
    expect(errorsOf({ ...base, products }).some((e) => e.includes('pack-a1-charizard') && e.includes('pool vazio'))).toBe(true);
  });

  it('PROMO em pool aleatório', () => {
    const promo = base.printings.find((p) => p.rarity === 'PROMO')!.printingId;
    const products = base.products.map((p): Product => (p.productId === 'pack-a1-pikachu' ? { ...p, pools: { ...p.pools!, COMMON: [...p.pools!.COMMON, { printingId: promo, weight: 1 }] } } : p));
    expect(errorsOf({ ...base, products }).some((e) => e.includes('PROMO'))).toBe(true);
  });

  it('rival sem retrato empacotado (chave ausente, malformada ou sem arquivo)', () => {
    const withPortrait = (key: string | null): ContentBundle => ({ ...base, npcs: base.npcs.map((n) => (n.npcId === 'iris' ? { ...n, portraitAssetKey: key } : n)) });
    expect(errorsOf(base).some((e) => e.includes('retrato'))).toBe(false);
    expect(errorsOf(withPortrait(null)).some((e) => e.includes('NPC iris') && e.includes('retrato inválido'))).toBe(true);
    expect(errorsOf(withPortrait('erika-emote-1')).some((e) => e.includes('NPC iris') && e.includes('retrato inválido'))).toBe(true);
    expect(errorsOf(withPortrait('portrait:nao-existe')).some((e) => e.includes('NPC iris') && e.includes('ausente'))).toBe(true);
  });

  it('verso com imagem sem o arquivo empacotado ou com chave malformada', () => {
    const withSleeveArt = (key: string): ContentBundle => ({ ...base, cosmetics: base.cosmetics.map((c) => (c.cosmeticId === 'sleeve-pocket-pikachu' ? { ...c, visual: { ...c.visual, assetKey: key } } : c)) });
    expect(errorsOf(base).some((e) => e.includes('verso'))).toBe(false);
    expect(errorsOf(withSleeveArt('sleeve-art:nao-existe')).some((e) => e.includes('sleeve-pocket-pikachu') && e.includes('sem imagem'))).toBe(true);
    expect(errorsOf(withSleeveArt('pikachu')).some((e) => e.includes('sleeve-pocket-pikachu') && e.includes('inválida'))).toBe(true);
  });

  it('moeda com imagem sem as faces empacotadas ou com chave malformada', () => {
    const withCoinArt = (key: string): ContentBundle => ({ ...base, cosmetics: base.cosmetics.map((c) => (c.cosmeticId === 'coin-pocket-pikachu' ? { ...c, visual: { ...c.visual, assetKey: key } } : c)) });
    expect(errorsOf(base).some((e) => e.includes('moeda'))).toBe(false);
    const missing = errorsOf(withCoinArt('coin-art:nao-existe'));
    expect(missing.some((e) => e.includes('coin-pocket-pikachu') && e.includes('sem heads'))).toBe(true);
    expect(missing.some((e) => e.includes('coin-pocket-pikachu') && e.includes('sem tails'))).toBe(true);
    expect(errorsOf(withCoinArt('pikachu')).some((e) => e.includes('coin-pocket-pikachu') && e.includes('inválida'))).toBe(true);
  });

  it('economia divergente de §15.4', () => {
    const rewardTables = base.rewardTables.map((t) => (t.rewardTableId === 'puzzle-v1' ? { ...t, credits: 120 } : t));
    const errors = errorsOf({ ...base, rewardTables });
    expect(errors.some((e) => e.includes('máximo único'))).toBe(true);
  });

  it('objetivo de composição cumprido pelos decks iniciais', () => {
    const objectives = base.objectives.map((o) => (o.objectiveId === 'C05-E01-DECK' ? { ...o, predicates: [{ type: 'DECK_COMPOSITION' as const, composition: { minSubtypeCopies: { ITEM: 2 } } }] } : o));
    expect(errorsOf({ ...base, objectives }).some((e) => e.includes('C05-E01-DECK') && e.includes('automaticamente'))).toBe(true);
  });

  it('opcode fora do registro e referência inexistente', () => {
    const cards = base.cards.map((c) => (c.id === 'sabrina' && c.category === 'TRAINER'
      ? { ...c, trainerEffects: [{ id: 'sabrina-1', timing: 'ON_PLAY' as const, operation: { type: 'TELEPORT' } as never }] } : c));
    const decks = [...base.decks, { ...base.decks[0]!, deckId: 'deck-fantasma', entries: [{ printingId: 'nao-existe', count: 2 as const }] }];
    const errors = errorsOf({ ...base, cards, decks });
    expect(errors.some((e) => e.includes('TELEPORT'))).toBe(true);
    expect(errors.some((e) => e.includes('nao-existe'))).toBe(true);
  });

  it('solução de puzzle que não vence', () => {
    const fixtures = base.fixtures.map((f) => (f.fixtureId === 'fx-c02-e02' ? { ...f, solution: [{ actor: 'HUMAN' as const, command: { type: 'END_TURN' as const } }] } : f));
    expect(errorsOf({ ...base, fixtures }).some((e) => e.includes('fx-c02-e02') && e.includes('solução'))).toBe(true);
  });
});

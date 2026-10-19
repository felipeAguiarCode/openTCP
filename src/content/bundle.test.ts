import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import { buildCatalog } from '../domain/cards/catalog.ts';
import { deckMetrics, evaluateComposition, validateDeck } from '../domain/deck/validate.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import { validateBundle } from '../../tools/content-build/validate.ts';
import { economyAudit } from '../../tools/content-build/economy.ts';

const bundle = buildBundle();
const cat = buildCatalog(bundle.cards, bundle.printings);
const starters = bundle.decks.filter((d) => d.kind === 'STARTER');
const starterPrintings = bundle.onboarding.inventory.map((i) => i.printingId);

describe('pacote de conteúdo base 3.5.0 (todos os sets do Pocket até o A4b + Promo-A e Promo-B)', () => {
  it('monta e passa em todas as validações (schemas + semântica)', () => {
    const report = validateBundle(bundle);
    expect(report.errors).toEqual([]);
  });

  it('é determinístico (mesmo contentHash em duas montagens)', () => {
    expect(jcsHash(buildBundle())).toBe(jcsHash(bundle));
  });

  it('tem a estrutura de campanha §2.1', () => {
    expect(bundle.nodes).toHaveLength(45);
    expect(bundle.nodes.filter((n) => n.kind !== 'DISCOVERY')).toHaveLength(39);
    expect(bundle.nodes.filter((n) => n.kind === 'DISCOVERY')).toHaveLength(6);
    expect(bundle.nodes.filter((n) => n.essential)).toHaveLength(27);
  });

  it('catálogo: 1.210 cartas de jogo, 2.069 impressões, todas em Impressão completa com a imagem empacotada', () => {
    expect(bundle.cards.length).toBe(1210);
    expect(bundle.printings.length).toBe(2069);
    expect(bundle.sets.map((s) => s.setId)).toEqual(['a1', 'pa', 'a1a', 'a2', 'a2a', 'a3', 'a3a', 'a3b', 'a4', 'a4a', 'a4b', 'pb']);
    for (const p of bundle.printings) expect(p, p.printingId).toMatchObject({ artMode: 'FULL_PRINTING', artKey: `art:${p.setId}:${p.collectorNumber}`, artAssetId: null });
    // 117 do Promo-A (6 antigas + 111) e 103 do Promo-B.
    expect(bundle.printings.filter((p) => p.rarity === 'PROMO')).toHaveLength(220);
    expect(bundle.printings.filter((p) => p.variant.shiny)).toHaveLength(100);
  });

  it('os 38 iniciais: 12 Pokémon do A1, 20 dos sets seguintes e as 6 promos básicas', () => {
    expect(starterPrintings).toHaveLength(38);
    expect(starterPrintings[0]).toBe('a1-033-charmander');
    expect(starterPrintings.slice(12, 32).every((id) => !id.startsWith('a1-') && !id.startsWith('pa-'))).toBe(true);
    expect(starterPrintings[37]).toBe('pa-003-lupa-de-mao');
  });
});

describe('decks', () => {
  it('oito decks iniciais exatos e legais, um por tipo de Energia (§3.5)', () => {
    expect(starters.map((d) => d.name)).toEqual(['Chama Constante', 'Maré Serena', 'Jardim Vivo', 'Faísca Veloz', 'Eco Psíquico', 'Punho Firme', 'Sombra Astuta', 'Aço Paciente']);
    expect(new Set(starters.map((d) => d.energyTypes[0])).size).toBe(8);
    for (const deck of starters) {
      const r = validateDeck(deck.entries, cat, { energyTypes: deck.energyTypes, inventory: Object.fromEntries(bundle.onboarding.inventory.map((i) => [i.printingId, i.count])) });
      expect(r.errors, deck.deckId).toEqual([]);
      expect(deck.entries.every((e) => e.count === 2)).toBe(true);
      expect(deck.entries).toHaveLength(10);
    }
  });

  it('todo deck de NPC e de apoio é legal', () => {
    for (const deck of bundle.decks.filter((d) => d.kind !== 'STARTER')) {
      const r = validateDeck(deck.entries, cat, { energyTypes: deck.energyTypes });
      expect(r.errors, deck.deckId).toEqual([]);
    }
  });

  it('cada nó de batalha tem decks História/Padrão/Especialista', () => {
    for (const node of bundle.nodes.filter((n) => ['DUEL', 'ELITE', 'BOSS', 'FINAL'].includes(n.kind))) {
      const ids = Object.values(node.difficultyProfiles!).map((p) => p.npcDeckId);
      expect(new Set(ids).size, node.nodeId).toBe(3);
    }
  });

  it('objetivos de composição (-DECK) nunca são cumpridos pelos decks iniciais', () => {
    const decks = bundle.objectives.filter((o) => o.objectiveId.endsWith('-DECK'));
    expect(decks).toHaveLength(27);
    for (const o of decks) {
      for (const deck of starters) {
        const m = deckMetrics(deck, cat, { starterPrintingIds: starterPrintings });
        const ok = o.predicates.every((p) => p.composition && evaluateComposition(m, p.composition).ok);
        expect(ok, `${o.objectiveId} × ${deck.deckId}`).toBe(false);
      }
    }
  });
});

describe('economia (campanha §15.4)', () => {
  it('rota obrigatória 4.010 e máximo único 7.730 recalculados dos dados', () => {
    const e = economyAudit(bundle);
    expect(e.onboarding).toBe(300);
    expect(e.prologue).toBe(350);
    expect(e.chapters).toBe(2460);
    expect(e.finals).toBe(900);
    expect(e.mandatory).toBe(4010);
    expect(e.puzzles).toBe(600);
    expect(e.elites).toBe(960);
    expect(e.objectives).toBe(2160);
    expect(e.objectiveCount).toBe(54);
    expect(e.optional).toBe(3720);
    expect(e.maxOneTime).toBe(7730);
  });

  it('pacotes do A1 seguem §16.2 e nenhum pool positivo é vazio; PROMO fora dos pools', () => {
    for (const pack of bundle.products.filter((p) => p.kind === 'RANDOM_PACK' && p.slots)) {
      expect(pack.cardsPerPack).toBe(5);
      expect(pack.price?.credits).toBe(100);
      for (const slot of pack.slots!) {
        expect(Object.values(slot.categoryWeights).reduce((a, b) => a + b, 0)).toBe(100);
        for (const [category, weight] of Object.entries(slot.categoryWeights)) {
          if (weight > 0) expect(pack.pools![category as 'COMMON'].length, `${pack.productId} ${category}`).toBeGreaterThan(0);
        }
      }
      const pooled = Object.values(pack.pools!).flat().map((e) => cat.printings.get(e.printingId)!);
      expect(pooled.some((p) => p.rarity === 'PROMO')).toBe(false);
    }
  });

  it('pacotes dos outros sets: taxas oficiais por símbolo, pools coerentes, PROMO só nos pacotes promocionais', () => {
    const tier = bundle.products.filter((p) => p.kind === 'RANDOM_PACK' && p.tierSlots);
    expect(tier).toHaveLength(14);
    for (const pack of tier) {
      expect(pack.price?.credits).toBe(100);
      expect(pack.availability.fromStart).toBe(true);
      expect(pack.cardsPerPack).toBe(pack.productId === 'pack-a4b' ? 4 : 5);
      const promo = pack.productId.endsWith('-promo');
      for (const slot of pack.tierSlots!) {
        expect(Object.values(slot.weights).reduce((a, b) => a + (b ?? 0), 0), `${pack.productId} ${slot.position}`).toBe(100000);
        for (const [symbol, weight] of Object.entries(slot.weights)) if (weight) expect(pack.tierPools![symbol as '◊']?.length, `${pack.productId} ${symbol}`).toBeGreaterThan(0);
      }
      const pooled = Object.values(pack.tierPools!).flat().map((id) => cat.printings.get(id!)!);
      expect(pooled.every((p) => (p.rarity === 'PROMO') === promo), pack.productId).toBe(true);
      expect(!!pack.rarePack, pack.productId).toBe(!promo);
    }
    const size = (id: string) => {
      const pack = tier.find((p) => p.productId === id)!;
      return { ...Object.fromEntries(Object.entries(pack.tierPools!).map(([s, ids]) => [s, ids!.length])), raro: pack.rarePack?.symbols.reduce((n, s) => n + (pack.tierPools![s]?.length ?? 0), 0) };
    };
    expect(size('pack-a3-solgaleo')).toEqual({ '◊': 44, '◊◊': 34, '◊◊◊': 14, '◊◊◊◊': 5, '☆': 12, '☆☆': 14, '☆☆☆': 1, '✵': 10, '✵✵': 4, '♛': 2, raro: 43 });
    expect(size('pack-a4b')).toEqual({ '◊': 128, '◊◊': 100, '◊◊◊': 50, '◊◊◊◊': 75, '☆': 6, '☆☆': 16, '☆☆☆': 1, '✵✵': 2, '♛': 1, raro: 26 });
    expect(size('pack-pa-promo')).toEqual({ PROMO: 111, raro: undefined });
    // 6ª carta: os três bebês ◊◊◊ e o ☆ de cada pacote do A4, fora do pool principal.
    for (const id of ['pack-a4-lugia', 'pack-a4-ho-oh', 'pack-a4a']) {
      const pack = tier.find((p) => p.productId === id)!;
      expect(Object.fromEntries(Object.entries(pack.bonusSlot!.pools).map(([s, ids]) => [s, ids!.length])), id).toEqual({ '◊◊◊': 3, '☆': 1 });
      const main = new Set(Object.values(pack.tierPools!).flat());
      expect(Object.values(pack.bonusSlot!.pools).flat().some((x) => main.has(x!)), id).toBe(false);
    }
  });

  it('pacote tutorial: cinco cartas ◊ do A1 fora da coleção inicial, não vendido', () => {
    const tutorial = bundle.products.find((p) => p.productId === 'pack-tutorial-v1')!;
    expect(tutorial.kind).toBe('FIXED_PACK');
    expect(tutorial.price).toBeNull();
    const defs = tutorial.fixedContents!.map((id) => cat.printings.get(id)!);
    expect(defs.every((p) => p.rarity === 'COMMON' && p.setId === 'a1' && p.finish === 'NORMAL')).toBe(true);
    const starterDefs = new Set(starterPrintings.map((id) => cat.printings.get(id)!.cardDefinitionId));
    expect(defs.some((p) => starterDefs.has(p.cardDefinitionId))).toBe(false);
  });
});

// Conteúdo de cada set do Pocket depois do A1: impressões conforme o registro, evolução resolvida entre sets,
// efeitos válidos no editor e texto PT-BR cabendo no template, sem inglês sobrando.
import { describe, expect, it } from 'vitest';
import { cardFace, catalogNames } from '../../../domain/cards/text.ts';
import { isPokemon } from '../../../domain/cards/types.ts';
import { estimateTextFit } from '../../../domain/editor/textfit.ts';
import { validateDefinition } from '../../../domain/editor/validate.ts';
import { printing } from '../../builders.ts';
import { A1_CARDS } from '../a1/cards.ts';
import { PROMO_A } from '../promo-a.ts';
import { ORPHAN_EVOLUTIONS, pocketNewCards, pocketSetSpecs } from './cards.ts';
import { POCKET_SETS } from './registry.ts';

const NEW_SETS = POCKET_SETS.filter((s) => s.setId !== 'a1');
const ALL = [...A1_CARDS, ...PROMO_A.map((p) => p.card), ...pocketNewCards(NEW_SETS.map((s) => s.setId))];
const nameOf = catalogNames(ALL);
const KEYS = new Set(ALL.map((c) => c.deckLimitKey));
/** Restos do texto original que denunciariam efeito sem tradução. */
const ENGLISH = /\b(your|opponent|damage|heads|tails|Energy|Benched|attack does)\b|\?/;

describe.each(NEW_SETS.map((s) => [s.code, s] as const))('set %s', (_code, set) => {
  const specs = pocketSetSpecs(set.setId);
  const cards = [...new Map(specs.map((s) => [s.card.id, s.card])).values()];

  it('impressões numeradas de 1 a N, brilhantes e bebês conforme o registro', () => {
    expect(specs.map((s) => s.number)).toEqual(Array.from({ length: set.expect.printings }, (_, i) => i + 1));
    expect(specs.filter((s) => s.symbol === '✵').length).toBe(set.expect.shiny[0]);
    expect(specs.filter((s) => s.symbol === '✵✵').length).toBe(set.expect.shiny[1]);
    expect(specs.filter((s) => s.bonus).map((s) => s.number)).toEqual(set.expect.bonus);
  });

  it('toda evolução aponta para uma carta existente (em qualquer set)', () => {
    // Só as promos sem estágio anterior em nenhum set (ORPHAN_EVOLUTIONS) ficam sem base.
    for (const card of cards) {
      if (isPokemon(card)) for (const from of card.evolvesFrom) if (!KEYS.has(from)) expect(ORPHAN_EVOLUTIONS[card.id], `${card.id} ← ${from}`).toBe(from);
    }
  });

  it('definições sem erro de validação no editor', () => {
    for (const card of cards) {
      const errors = validateDefinition(card, { catalog: ALL }).issues.filter((i) => i.severity === 'ERROR');
      expect(errors.map((i) => `${i.code} ${i.message}`), card.id).toEqual([]);
    }
  });

  it('texto PT-BR cabe no template e não tem inglês', () => {
    for (const card of cards) {
      const face = cardFace(card, printing({ card, setId: set.setId, number: 1, rarity: 'COMMON', ownNumber: true }), nameOf);
      const fit = estimateTextFit(face);
      expect(fit.regions.filter((r) => r.overflow).map((r) => r.label), card.id).toEqual([]);
      expect(fit.bodyOverflow, card.id).toBe(false);
      expect(fit.attackNameOverflow, card.id).toEqual([]);
      const text = [...face.attacks.map((a) => `${a.name} ${a.text}`), ...face.abilities.map((a) => `${a.name} ${a.text}`), face.trainerText].join(' ');
      expect(text, card.id).not.toMatch(ENGLISH);
    }
  });
});

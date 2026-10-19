// Decks sobre o SQLite real (WASM em memória): rascunho automático como escrita leve, versão confirmada
// como operação, duelo usando a última versão confirmada, importação de lista e auto-build.
import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../../infrastructure/storage/node.ts';
import { miniBundle } from '../support/mini-bundle.ts';
import type { BuiltBundle } from '../../content/types.ts';
import { printing } from '../../content/builders.ts';
import * as S from '../support/generic-cards.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import { startAttempt } from '../../application/battle.ts';
import { createCommandBus } from '../../application/commands.ts';
import { contentInstallRows, indexContent } from '../../application/content.ts';
import { observable, reloadSnapshot, type GameContext } from '../../application/context.ts';
import {
  DECK_LIST_FORMAT, addCard, archiveDeck, autoBuild, canAdd, confirmDeck, draftFromContentDeck, draftFromRow, exportDeckList, importDeckList,
  removeCard, saveDeckDraft, validateDraft,
} from '../../application/decks.ts';
import type { AiPort } from '../../application/ports/ai.ts';
import { deterministicPlatform } from '../../application/ports/platform.ts';
import type { ProfileSnapshot } from '../../application/ports/storage.ts';
import { createProfile, selectProfile } from '../../application/profiles.ts';

const idleAi: AiPort = { plan: () => Promise.reject(new Error('sem IA neste teste')), cancel: () => undefined, dispose: () => undefined };

async function setup(bundle: BuiltBundle = miniBundle()): Promise<GameContext> {
  const storage = await createMemoryStorage();
  expect((await storage.installContent(contentInstallRows(bundle))).ok).toBe(true);
  const platform = deterministicPlatform();
  const game: GameContext = {
    storage, platform, bus: createCommandBus(storage, platform), content: observable(indexContent(bundle)),
    snapshot: observable<ProfileSnapshot | null>(null), ai: idleAi,
  };
  const created = await createProfile(game, { displayName: 'Bia', favoriteDeckId: 'starter-fire' });
  if (!created.ok) throw new Error(created.message);
  expect(await selectProfile(game, created.profileId)).toBe(true);
  return game;
}

const snap = (game: GameContext): ProfileSnapshot => game.snapshot.get()!;

describe('decks sobre SQLite', () => {
  it('rascunho, versão confirmada e duelo com a última versão confirmada', async () => {
    const game = await setup();
    const content = game.content.get();
    const template = content.decks.get('starter-water')!;
    const deckId = game.platform.newId('deck');
    let draft = draftFromContentDeck(deckId, template, 'Maré de Teste');
    expect(validateDraft(content, snap(game), draft).ok).toBe(true);

    // Rascunho é escrita leve: cria o deck sem gerar operação.
    const revisionBefore = snap(game).profile.revision;
    const saved = await saveDeckDraft(game, draft);
    expect(saved).toEqual({ ok: true, head: 1 });
    expect(snap(game).profile.revision).toBe(revisionBefore);
    expect(snap(game).decks.find((d) => d.deckId === deckId)).toMatchObject({ status: 'DRAFT', confirmed: null });

    // 19 cartas: inválido; confirmar é recusado antes de qualquer escrita.
    const removed = draft.cards[0]!.printingId;
    draft = removeCard(draft, removed);
    expect((await saveDeckDraft(game, draft)).ok).toBe(true);
    const invalid = await confirmDeck(game, draft);
    expect(invalid).toMatchObject({ ok: false, code: 'DECK_INVALID' });
    if (!invalid.ok && invalid.code === 'DECK_INVALID') expect(invalid.validation.errors.map((e) => e.code)).toContain('DECK_SIZE_INVALID');
    expect(snap(game).profile.revision).toBe(revisionBefore);
    expect((await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'T01', difficulty: 'STANDARD', deckId })).ok).toBe(false);

    // Volta a 20 e confirma: operação CONFIRM_DECK.
    draft = addCard(draft, removed);
    const confirmed = await confirmDeck(game, draft);
    expect(confirmed).toEqual({ ok: true, revision: 3 });
    expect(snap(game).profile.revision).toBe(revisionBefore + 1);
    const row = snap(game).decks.find((d) => d.deckId === deckId)!;
    expect(row.status).toBe('CONFIRMED');
    expect(row.confirmed?.entries).toHaveLength(20);

    // Rascunho novo por cima da versão confirmada: o duelo continua com a confirmada.
    const shorter = removeCard(draftFromRow(row), removed);
    expect((await saveDeckDraft(game, shorter)).ok).toBe(true);
    const over = snap(game).decks.find((d) => d.deckId === deckId)!;
    expect(over.status).toBe('DRAFT');
    expect(over.confirmed?.revision).toBe(3);
    expect(over.entries).toHaveLength(19);
    const started = await startAttempt(game, { mode: 'CAMPAIGN', nodeId: 'T01', difficulty: 'STANDARD', deckId });
    expect(started.ok).toBe(true);
    if (started.ok) {
      const human = started.session.state.players.A;
      const total = human.deck.length + human.hand.length + (human.active ? 1 : 0) + human.bench.filter(Boolean).length;
      expect(total).toBe(20);
    }
  });

  it('limites de cópia, posse, importação de lista e auto-build', async () => {
    const game = await setup();
    const content = game.content.get();
    const fire = content.decks.get('starter-fire')!;
    const first = fire.entries[0]!.printingId;
    let draft = draftFromContentDeck('deck-x', fire);
    draft = removeCard(draft, fire.entries[1]!.printingId);
    // Duas cópias por nome; o inventário inicial tem exatamente 2 de cada.
    expect(canAdd(content, snap(game), draft, first)).toMatch(/Limite de 2 cópias/);
    expect(canAdd(content, snap(game), { ...draft, cards: draft.cards.filter((c) => c.printingId !== first) }, first)).toBeNull();

    // Exportar → importar devolve a mesma lista; desconhecidas e ausentes são relatadas, nunca concedidas.
    const file = exportDeckList(draftFromContentDeck('deck-y', fire));
    const back = importDeckList(content, snap(game), JSON.parse(JSON.stringify(file)), 'deck-z');
    expect(back.ok && back.draft.cards).toHaveLength(20);
    const tampered = { ...file, entries: [...file.entries, { printingId: 'nao-existe', count: 1 }] };
    const r = importDeckList(content, snap(game), tampered, 'deck-w');
    expect(r.ok && r.unknown).toEqual(['nao-existe']);
    expect(importDeckList(content, snap(game), { format: 'outro' }, 'deck-v').ok).toBe(false);
    expect(importDeckList(content, snap(game), { ...file, version: 2 }, 'deck-v').ok).toBe(false);
    expect(importDeckList(content, snap(game), { ...file, entries: [{ printingId: first, count: 3 }] }, 'deck-v').ok).toBe(false);
    expect(file.format).toBe(DECK_LIST_FORMAT);

    // Auto-build: proposta legal com as cartas possuídas, sem violar limite ou posse.
    const proposal = autoBuild(content, snap(game), { types: ['GRASS'], deckId: 'deck-auto', name: 'Auto' });
    expect(proposal.cards).toHaveLength(20);
    const v = validateDraft(content, snap(game), proposal);
    expect(v.errors.map((e) => e.code)).toEqual([]);
  });

  it('UI-015/G-072/UI-050: vigésima primeira carta é recusada com motivo; importar lista mostra faltantes sem conceder cartas', async () => {
    // Pacote com uma impressão Foil da Faísca que o perfil novo não possui.
    const base = miniBundle();
    const foil = printing({ card: S.faisca, setId: 'base', number: 1, rarity: 'RARE', finish: 'FOIL' });
    const variant = { ...base, printings: [...base.printings, foil] };
    const game = await setup({ ...variant, contentHash: jcsHash(variant) });
    const content = game.content.get();
    const fire = content.decks.get('starter-fire')!;
    const full = draftFromContentDeck('deck-full', fire);
    expect(full.cards).toHaveLength(20);
    const extra = content.decks.get('starter-water')!.entries[0]!.printingId;
    // A 21ª carta não entra nem substitui outra silenciosamente: o motivo é devolvido e a lista fica intacta.
    expect(canAdd(content, snap(game), full, extra)).toMatch(/já tem 20 cartas/);
    expect(full.cards.map((c) => c.printingId)).toEqual(draftFromContentDeck('deck-full', fire).cards.map((c) => c.printingId));
    expect(validateDraft(content, snap(game), addCard(full, extra)).errors.map((e) => e.code)).toContain('DECK_SIZE_INVALID');

    // Lista com cópias além das possuídas: faltantes relatados, nada concedido nem gravado.
    const revision = snap(game).profile.revision;
    const inventory = JSON.stringify(snap(game).inventory);
    expect(snap(game).inventory.some((i) => i.printingId === foil.printingId)).toBe(false);
    // Nove entradas do deck (sem a Faísca normal) + 2 Faíscas Foil não possuídas.
    const entries = exportDeckList(full).entries.filter((e) => content.catalog.printing(e.printingId).cardDefinitionId !== S.faisca.id);
    const file = { ...exportDeckList(full), entries: [...entries, { printingId: foil.printingId, count: 2 }] };
    const imported = importDeckList(content, snap(game), file, 'deck-imp');
    if (!imported.ok) throw new Error(imported.message);
    expect(imported.draft.cards).toHaveLength(20);
    expect(imported.missing).toEqual([{ printingId: foil.printingId, missing: 2 }]);
    expect(validateDraft(content, snap(game), imported.draft).errors.map((e) => e.code)).toContain('CARD_NOT_OWNED');
    expect(await confirmDeck(game, imported.draft)).toMatchObject({ ok: false, code: 'DECK_INVALID' });
    await reloadSnapshot(game);
    expect(JSON.stringify(snap(game).inventory)).toBe(inventory);
    expect(snap(game).profile.revision).toBe(revision);
  });

  it('excluir deck só arquiva; as cartas continuam na coleção', async () => {
    const game = await setup();
    const inventoryBefore = snap(game).inventory.reduce((s, i) => s + i.quantity, 0);
    const deck = snap(game).decks.find((d) => d.name === 'Jardim Vivo')!;
    expect(await archiveDeck(game, deck.deckId)).toBe(true);
    expect(snap(game).decks.find((d) => d.deckId === deck.deckId)?.archived ?? true).toBe(true);
    expect(snap(game).inventory.reduce((s, i) => s + i.quantity, 0)).toBe(inventoryBefore);
  });
});

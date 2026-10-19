// Atualização do conteúdo BASE num banco que já tem um build anterior instalado (persistencia-sqlite.md §8): o
// navegador que instalou um 3.0.0 de desenvolvimento (outro content_hash) recusa outro 3.0.0, mas aceita a versão
// atual por cima, porque nenhuma definição nem impressão mudou — e nada do que já estava instalado se perde.
import { describe, expect, it } from 'vitest';
import { contentInstallRows } from '../../application/content.ts';
import { buildBundle } from '../../content/bundle.ts';
import { CONTENT_VERSION } from '../../content/source/campaign.ts';
import type { BuiltBundle } from '../../content/types.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';
import { createMemoryStorage } from './node.ts';

const built = (bundle: ReturnType<typeof buildBundle>): BuiltBundle => ({ ...bundle, contentHash: jcsHash(bundle) });

describe('atualização do conteúdo BASE', () => {
  it('um 3.0.0 de desenvolvimento instalado não bloqueia a versão atual', async () => {
    expect(CONTENT_VERSION).not.toBe('3.0.0');
    const current = buildBundle();
    // Build de desenvolvimento: mesmas cartas e impressões, outros decks/diálogos (outro content_hash).
    const dev = built({ ...current, version: '3.0.0', decks: current.decks.slice(0, -1) });
    const storage = await createMemoryStorage();
    expect((await storage.installContent(contentInstallRows(dev))).ok).toBe(true);
    // O mesmo número de versão com outro hash continua recusado.
    const sameVersion = await storage.installContent(contentInstallRows(built({ ...current, version: '3.0.0' })));
    expect(sameVersion).toMatchObject({ ok: false, code: 'IMPORT_INVALID' });
    // A versão atual instala por cima.
    expect(await storage.installContent(contentInstallRows(built(current)))).toMatchObject({ ok: true, installed: true });
  }, 120_000);
});

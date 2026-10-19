// Perfil do catálogo antigo (conteúdo 1.0.0) é reconhecido pelo inventário; perfis do Genetic Apex e cartas autorais não.
import { describe, expect, it } from 'vitest';
import { buildBundle } from '../content/bundle.ts';
import { jcsHash } from '../domain/hash/jcs.ts';
import { indexContent } from './content.ts';
import { isLegacyInventory, legacyPrintings } from './legacy.ts';

const bundle = buildBundle();
const content = indexContent({ ...bundle, contentHash: jcsHash(bundle) });

describe('perfil do catálogo antigo', () => {
  it('impressões genéricas (base-001-faisca) marcam o perfil como legado', () => {
    const inventory = [{ printingId: 'a1-033-charmander', quantity: 2 }, { printingId: 'base-001-faisca', quantity: 2 }, { printingId: 'base-009-gota', quantity: 0 }];
    expect(legacyPrintings(inventory, content)).toEqual(['base-001-faisca']);
    expect(isLegacyInventory(inventory, content)).toBe(true);
  });

  it('perfil novo (coleção A1 + promos) e cartas do Estúdio (print-…) não são legado', () => {
    const inventory = [...content.starterPrintingIds].map((printingId) => ({ printingId, quantity: 2 }));
    expect(inventory.length).toBeGreaterThan(0);
    expect(isLegacyInventory([...inventory, { printingId: 'print-minha-carta-normal-v1', quantity: 1 }], content)).toBe(false);
  });

  it('sem conteúdo carregado nada é recusado', () => {
    expect(isLegacyInventory([{ printingId: 'base-001-faisca', quantity: 1 }], null)).toBe(false);
  });
});

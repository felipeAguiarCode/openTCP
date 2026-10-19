// Linha de base do conteúdo instalado antes da 3.0.0: as definições, impressões e produtos do Genetic Apex (A1) e das
// 6 promos do Promo-A não podem mudar nem um byte (installContent recusa mudança de definição/impressão já instalada,
// persistência §8 / DB-047). Sets novos só acrescentam. Hashes tirados do conteúdo 2.2.0.
import { describe, expect, it } from 'vitest';
import { buildBundle } from './bundle.ts';
import { jcsHash } from '../domain/hash/jcs.ts';

const bundle = buildBundle();
const LEGACY_PA = new Set(['001', '002', '003', '005', '006', '007']);
const printings = bundle.printings.filter((p) => p.setId === 'a1' || (p.setId === 'pa' && LEGACY_PA.has(p.collectorNumber)));
const cardKeys = new Set(printings.map((p) => `${p.cardDefinitionId}@${p.cardDefinitionVersion}`));
const cards = bundle.cards.filter((c) => cardKeys.has(`${c.id}@${c.version}`));
const products = bundle.products.filter((p) => /^pack-(a1-|tutorial)/.test(p.productId) || /^card-a1-/.test(p.productId));

describe('conteúdo legado (A1 + 6 promos do P-A) intacto', () => {
  it('231 definições idênticas às da 2.2.0', () => {
    expect(cards).toHaveLength(231);
    expect(jcsHash(cards)).toBe('1fb7d1cedcd95ad0e7bea5c709be0655d0b8b15cb033165d409d443c9fdea433');
  });

  it('292 impressões idênticas às da 2.2.0', () => {
    expect(printings).toHaveLength(292);
    expect(jcsHash(printings)).toBe('f9cc34be66fdfe7a9e6ac5035686df8adda813548206a0d2d06ae72b01ab3334');
  });

  it('pacote tutorial, 3 pacotes do A1 e 286 cartas dirigidas idênticos aos da 2.2.0', () => {
    expect(products).toHaveLength(290);
    expect(jcsHash(products)).toBe('053fdbce7947b191e3242844a4fa8e9e7211ed5e6d02cad15a32e0d9f9efe513');
  });
});

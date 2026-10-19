// content-build: monta o ContentBundle de src/content/bundle.ts, valida (schemas + semântica + motor),
// calcula o contentHash (JCS) e publica public/content/base-<versão>.json, manifest.json e .specs/catalogo-conteudo.md.
// Uso: node --experimental-strip-types tools/content-build/index.ts [--check]
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBundle } from '../../src/content/bundle.ts';
import type { BuiltBundle } from '../../src/content/types.ts';
import { canonicalize, jcsHash, utf8 } from '../../src/domain/hash/jcs.ts';
import { ROOT, validateBundle } from './validate.ts';
import { renderCatalog, renderSetCatalog } from './catalog-md.ts';

function main(): number {
  const checkOnly = process.argv.includes('--check');
  const bundle = buildBundle();
  const report = validateBundle(bundle);
  const e = report.economy;
  console.log(`content-build ${bundle.packageId}@${bundle.version}: ${bundle.cards.length} definições, ${bundle.printings.length} impressões, ${bundle.decks.length} decks, ${bundle.products.length} produtos, ${bundle.nodes.length} nós, ${bundle.objectives.length} objetivos, ${bundle.fixtures.length} fixtures, ${bundle.dialogues.length} diálogos.`);
  console.log(`economia: rota obrigatória ${e.mandatory} Créditos; opcional ${e.optional} (puzzles ${e.puzzles} + elites ${e.elites} + objetivos ${e.objectives}); máximo único ${e.maxOneTime}.`);
  for (const p of report.puzzles) console.log(`  fixture ${p.fixtureId} (${p.nodeId}): ${p.solved ? 'resolvida' : 'FALHOU'} — ${p.actions} ações, ${p.ownTurnsUsed ?? '?'} turno(s) próprio(s)${p.turnLimit ? ` / limite ${p.turnLimit}` : ''}`);
  const strategy = report.warnings;
  if (strategy.length) console.log(`${strategy.length} aviso(s) de estratégia (não bloqueiam): ${strategy.slice(0, 5).join(' | ')}${strategy.length > 5 ? ' …' : ''}`);
  if (report.errors.length) {
    console.error(`\n${report.errors.length} erro(s) de validação:`);
    for (const err of report.errors) console.error(`  ✗ ${err}`);
    return 1;
  }
  const contentHash = jcsHash(bundle);
  const built: BuiltBundle = { ...bundle, contentHash };
  const json = canonicalize(built);
  const file = `base-${bundle.version}.json`;
  const manifest = { packageId: bundle.packageId, version: bundle.version, contentHash, bytes: utf8(json).length, file };
  console.log(`contentHash ${contentHash} (${manifest.bytes} bytes)`);
  if (checkOnly) return 0;
  const outDir = resolve(ROOT, 'public', 'content');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, file), json, 'utf-8');
  // Só a versão do manifesto é carregada: pacotes de versões anteriores não vão para o build.
  for (const old of readdirSync(outDir)) if (/^base-.+\.json$/.test(old) && old !== file) rmSync(resolve(outDir, old));
  writeFileSync(resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  writeFileSync(resolve(ROOT, '.specs', 'catalogo-conteudo.md'), renderCatalog(built, report), 'utf-8');
  const setDir = resolve(ROOT, '.specs', 'catalogo');
  mkdirSync(setDir, { recursive: true });
  for (const s of built.sets) writeFileSync(resolve(setDir, `cartas-${s.setId}.md`), renderSetCatalog(built, s.setId), 'utf-8');
  console.log(`publicado: public/content/${file}, public/content/manifest.json, .specs/catalogo-conteudo.md, .specs/catalogo/cartas-<set>.md (${built.sets.length})`);
  return 0;
}

process.exitCode = main();

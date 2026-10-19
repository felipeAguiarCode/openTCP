// Importa os sets do Pokémon TCG Pocket de `.inspo/decks/<Set (CÓDIGO)>/` (JSON do Limitless, em inglês) para módulos
// de dados enxutos e determinísticos, e copia a imagem de cada impressão (a carta impressa inteira, webp) para
// `src/presentation/assets/cards/<setId>/<SETID>-NNN.webp` (modo de arte “Impressão completa”).
//   - Genetic Apex (A1) continua em `src/content/source/a1/a1-data.generated.ts`, no formato legado (byte a byte igual).
//   - Os demais sets vão para `src/content/source/pocket/data/<setId>.generated.ts` (PocketRow, ver pocket/rows.ts).
// Também copia os retratos (emotes) de `.inspo/portraits/` para `src/presentation/assets/portraits/` (avatares do
// jogador e dos rivais), com o nome normalizado de `portraitFileName`.
// O build não lê o `.inspo`; rode `npm run inspo:import` só quando a origem mudar. Opções:
//   --set <código>   importa só um set (repetível)
//   --check          não grava nada; sai com 1 se algum arquivo gerado ou imagem difere do disco
// As regras viram DSL em pocket/effects e os nomes PT-BR em pocket/names (falta = o conteúdo não carrega).
import fs from 'node:fs';
import path from 'node:path';
import { POCKET_SETS, type PocketSet } from '../../src/content/source/pocket/registry.ts';
import { a1LegacyRow, artFileName, normalizeSet, portraitFileName, sourceBaseName, type Raw } from './normalize.ts';

const root = path.resolve(import.meta.dirname, '..', '..');
const decks = path.join(root, '.inspo', 'decks');
const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.flatMap((a, i) => (a === '--set' && args[i + 1] ? [args[i + 1]!] : []));

const A1_HEADER = `// GERADO por tools/inspo-import a partir de .inspo/Genetic Apex (A1) (dados do Limitless TCG, em inglês). Não editar à mão.
// Dados de terceiros (The Pokémon Company): uso local. Uma linha por impressão; cartas de jogo idênticas são agrupadas em a1/cards.ts.

export type A1Row = {
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
  readonly rarity: string;
  readonly pack: 'pikachu' | 'charizard' | 'mewtwo' | null;
  readonly artist: string | null;
};

export const A1_ROWS: readonly A1Row[] = [
`;

const pocketHeader = (set: PocketSet) => `// GERADO por tools/inspo-import a partir de .inspo/decks/${set.folder} (dados do Limitless TCG, em inglês). Não editar à mão.
// Dados de terceiros (The Pokémon Company): uso local. Uma linha por impressão; cartas de jogo idênticas (inclusive entre
// sets) são agrupadas em pocket/cards.ts.
import type { PocketRow } from '../rows.ts';

export const ROWS: readonly PocketRow[] = [
`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const diffs: string[] = [];
let written = 0;

/** Grava (ou, em --check, compara) um arquivo de texto ou binário. */
function emit(file: string, content: string | Buffer): void {
  const next = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const current = fs.existsSync(file) ? fs.readFileSync(file) : null;
  if (current && current.equals(next)) return;
  if (check) {
    diffs.push(path.relative(root, file));
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  written++;
}

if (!fs.existsSync(decks)) {
  process.stderr.write(`origem ausente: ${decks}\n`);
  process.exit(1);
}

for (const set of POCKET_SETS) {
  if (only.length && !only.includes(set.code) && !only.includes(set.setId)) continue;
  const source = path.join(decks, set.folder);
  if (!fs.existsSync(source)) {
    process.stderr.write(`origem ausente: ${source}\n`);
    process.exit(1);
  }
  const pattern = new RegExp(`^${escape(set.code)}-\\d{3}\\.json$`);
  const files = fs.readdirSync(source).filter((f) => pattern.test(f)).sort();
  const raws = files.map((f) => JSON.parse(fs.readFileSync(path.join(source, f), 'utf8')) as Raw);
  const rows = normalizeSet(set, raws);

  if (set.setId === 'a1') {
    const legacy = [...raws].sort((a, b) => a.number - b.number).map(a1LegacyRow);
    emit(path.join(root, 'src', 'content', 'source', 'a1', 'a1-data.generated.ts'), `${A1_HEADER}${legacy.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n];\n`);
  } else {
    emit(path.join(root, 'src', 'content', 'source', 'pocket', 'data', `${set.setId}.generated.ts`),
      `${pocketHeader(set)}${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n];\n`);
  }

  // Imagens: uma por impressão; falta de imagem é erro (toda impressão usa “Impressão completa”).
  const artDir = path.join(root, 'src', 'presentation', 'assets', 'cards', set.setId);
  const expected = new Set(rows.map((r) => artFileName(set, r.number)));
  const missing: string[] = [];
  for (const r of rows) {
    const image = path.join(source, `${sourceBaseName(set, r.number)}.webp`);
    if (!fs.existsSync(image)) missing.push(path.basename(image));
    else emit(path.join(artDir, artFileName(set, r.number)), fs.readFileSync(image));
  }
  if (missing.length) {
    process.stderr.write(`imagens ausentes em ${source}: ${missing.join(', ')}\n`);
    process.exit(1);
  }
  const ownPattern = new RegExp(`^${escape(set.setId.toUpperCase())}-\\d{3}\\.webp$`);
  if (fs.existsSync(artDir)) {
    for (const old of fs.readdirSync(artDir)) {
      if (!ownPattern.test(old) || expected.has(old)) continue;
      if (check) diffs.push(path.relative(root, path.join(artDir, old)));
      else fs.rmSync(path.join(artDir, old));
    }
  }
  process.stdout.write(`${set.code}: ${rows.length} impressões, ${expected.size} imagens\n`);
}

// Retratos (só na importação completa): um PNG por emote, sem as cópias “(1)” da origem.
const portraits = path.join(root, '.inspo', 'portraits');
if (!only.length && fs.existsSync(portraits)) {
  const outDir = path.join(root, 'src', 'presentation', 'assets', 'portraits');
  const expected = new Set<string>();
  for (const file of fs.readdirSync(portraits).sort()) {
    const name = portraitFileName(file);
    if (!name) continue;
    if (expected.has(name)) {
      process.stderr.write(`retrato repetido depois de normalizar: ${file} → ${name}\n`);
      process.exit(1);
    }
    expected.add(name);
    emit(path.join(outDir, name), fs.readFileSync(path.join(portraits, file)));
  }
  if (fs.existsSync(outDir)) {
    for (const old of fs.readdirSync(outDir)) {
      if (expected.has(old)) continue;
      if (check) diffs.push(path.relative(root, path.join(outDir, old)));
      else fs.rmSync(path.join(outDir, old));
    }
  }
  process.stdout.write(`retratos: ${expected.size}\n`);
}

if (check) {
  if (diffs.length) {
    process.stderr.write(`difere do .inspo (${diffs.length}):\n${diffs.slice(0, 40).map((d) => `  ${d}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('tudo igual ao .inspo\n');
} else process.stdout.write(`${written} arquivo(s) gravado(s)\n`);

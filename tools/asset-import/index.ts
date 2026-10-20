// Importa os sets do Pokémon TCG Pocket de `src/content/source/pocket/raw/<setId>/` (JSON do Limitless, em inglês, um
// `<CÓDIGO>-NNN.json` por impressão) para módulos de dados enxutos e determinísticos, e confere a imagem de cada impressão
// (a carta impressa inteira, webp) em `src/presentation/assets/cards/<setId>/<SETID>-NNN.webp` (modo de arte “Impressão
// completa”). Num set novo, a imagem `<CÓDIGO>-NNN.webp` posta ao lado do JSON é copiada para lá com o nome do pacote.
//   - Genetic Apex (A1) continua em `src/content/source/a1/a1-data.generated.ts`, no formato legado (byte a byte igual).
//   - Os demais sets vão para `src/content/source/pocket/data/<setId>.generated.ts` (PocketRow, ver pocket/rows.ts).
// O build não lê a origem bruta; rode `npm run assets:import` só quando ela mudar. Opções:
//   --set <código>   importa só um set (repetível)
//   --check          não grava nada; sai com 1 se algum arquivo gerado ou imagem difere do disco
// As regras viram DSL em pocket/effects e os nomes PT-BR em pocket/names (falta = o conteúdo não carrega).
import fs from 'node:fs';
import path from 'node:path';
import { POCKET_SETS } from '../../src/content/source/pocket/registry.ts';
import { a1LegacyRow, artFileName, normalizeSet, sourceBaseName, type Raw } from './normalize.ts';

const root = path.resolve(import.meta.dirname, '..', '..');
const raw = path.join(root, 'src', 'content', 'source', 'pocket', 'raw');
const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.flatMap((a, i) => (a === '--set' && args[i + 1] ? [args[i + 1]!] : []));

const generatedBy = (setId: string) =>
  `// GERADO por tools/asset-import a partir de src/content/source/pocket/raw/${setId} (dados do Limitless TCG, em inglês). Não editar à mão.`;

const A1_HEADER = `${generatedBy('a1')}
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

const pocketHeader = (setId: string) => `${generatedBy(setId)}
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

for (const set of POCKET_SETS) {
  if (only.length && !only.includes(set.code) && !only.includes(set.setId)) continue;
  const source = path.join(raw, set.setId);
  if (!fs.existsSync(source)) {
    process.stderr.write(`origem ausente: ${path.relative(root, source)}\n`);
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
      `${pocketHeader(set.setId)}${rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')}\n];\n`);
  }

  // Imagens: uma por impressão, da origem quando houver, senão a já empacotada; falta é erro (toda impressão usa
  // “Impressão completa”).
  const artDir = path.join(root, 'src', 'presentation', 'assets', 'cards', set.setId);
  const packed = new Set(fs.existsSync(artDir) ? fs.readdirSync(artDir) : []);
  const expected = new Set(rows.map((r) => artFileName(set, r.number)));
  const missing: string[] = [];
  for (const r of rows) {
    const image = path.join(source, `${sourceBaseName(set, r.number)}.webp`);
    if (fs.existsSync(image)) emit(path.join(artDir, artFileName(set, r.number)), fs.readFileSync(image));
    else if (!packed.has(artFileName(set, r.number))) missing.push(artFileName(set, r.number));
  }
  if (missing.length) {
    process.stderr.write(`imagens ausentes em ${path.relative(root, artDir)} (ou ${path.relative(root, source)}): ${missing.join(', ')}\n`);
    process.exit(1);
  }
  const ownPattern = new RegExp(`^${escape(set.setId.toUpperCase())}-\\d{3}\\.webp$`);
  for (const old of packed) {
    if (!ownPattern.test(old) || expected.has(old)) continue;
    if (check) diffs.push(path.relative(root, path.join(artDir, old)));
    else fs.rmSync(path.join(artDir, old));
  }
  process.stdout.write(`${set.code}: ${rows.length} impressões, ${expected.size} imagens\n`);
}

if (check) {
  if (diffs.length) {
    process.stderr.write(`difere da origem (${diffs.length}):\n${diffs.slice(0, 40).map((d) => `  ${d}`).join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write('tudo igual à origem\n');
} else process.stdout.write(`${written} arquivo(s) gravado(s)\n`);

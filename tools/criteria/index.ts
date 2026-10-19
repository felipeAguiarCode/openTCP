// Rastreabilidade dos critérios de aceite (plano §Verificação): extrai os IDs das specs e confere o
// mapa src/tests/criteria-map.json. Cada critério precisa de teste automatizado, item de checklist
// manual ou justificativa N/A. `--write` acrescenta IDs novos como PENDING; `--strict` falha com PENDING.
import fs from 'node:fs';
import path from 'node:path';

type Entry = { readonly status: 'AUTOMATED' | 'MANUAL' | 'NA' | 'PENDING'; readonly ref?: string; readonly note?: string };
type CriteriaMap = Record<string, Entry>;

const root = path.resolve(import.meta.dirname, '..', '..');
const specs = path.join(root, '.specs');
const mapFile = path.join(root, 'src', 'tests', 'criteria-map.json');
const PREFIX: Record<string, string> = { G: 'gameplay', C: 'campanha', UI: 'interface', R: 'runtime', DB: 'persistência', ED: 'editor', VS: 'direção visual' };

function extract(): Map<string, { spec: string; text: string }> {
  const out = new Map<string, { spec: string; text: string }>();
  for (const file of fs.readdirSync(specs).filter((f) => f.endsWith('.md'))) {
    const lines = fs.readFileSync(path.join(specs, file), 'utf8').split('\n');
    for (const line of lines) {
      const m = /^\|\s*\**((?:G|UI|C|R|DB|ED|VS)-\d{3})\**\s*\|(.*)$/.exec(line);
      if (!m) continue;
      const id = m[1]!;
      if (!out.has(id)) out.set(id, { spec: file, text: m[2]!.split('|').map((s) => s.trim()).filter(Boolean).join(' — ').slice(0, 200) });
    }
  }
  return out;
}

function testExists(ref: string): boolean {
  const [file] = ref.split('::');
  return !!file && fs.existsSync(path.join(root, file));
}

const args = new Set(process.argv.slice(2));
const found = extract();
const map: CriteriaMap = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) as CriteriaMap : {};
let added = 0;
for (const id of found.keys()) if (!map[id]) { map[id] = { status: 'PENDING', note: found.get(id)!.text }; added++; }
const orphans = Object.keys(map).filter((id) => !found.has(id));
const brokenRefs = Object.entries(map).filter(([, e]) => e.status === 'AUTOMATED' && (!e.ref || !testExists(e.ref))).map(([id]) => id);
if (args.has('--write')) {
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  fs.mkdirSync(path.dirname(mapFile), { recursive: true });
  fs.writeFileSync(mapFile, `${JSON.stringify(sorted, null, 2)}\n`);
}
const bySpec = new Map<string, Record<Entry['status'], number>>();
for (const [id, e] of Object.entries(map)) {
  if (!found.has(id)) continue;
  const key = PREFIX[id.split('-')[0]!] ?? '?';
  const row = bySpec.get(key) ?? { AUTOMATED: 0, MANUAL: 0, NA: 0, PENDING: 0 };
  row[e.status]++;
  bySpec.set(key, row);
}
process.stdout.write(`Critérios: ${found.size} nas specs${added ? ` (${added} novos ${args.has('--write') ? 'gravados' : 'sem mapa'})` : ''}\n`);
for (const [spec, r] of [...bySpec].sort()) process.stdout.write(`  ${spec.padEnd(16)} automatizados ${String(r.AUTOMATED).padStart(3)} · manuais ${String(r.MANUAL).padStart(3)} · N/A ${String(r.NA).padStart(2)} · pendentes ${String(r.PENDING).padStart(3)}\n`);
if (orphans.length) process.stdout.write(`IDs no mapa que não existem mais nas specs: ${orphans.join(', ')}\n`);
if (brokenRefs.length) process.stdout.write(`Referências de teste inexistentes: ${brokenRefs.join(', ')}\n`);
const pending = Object.entries(map).filter(([id, e]) => found.has(id) && e.status === 'PENDING').length;
const failed = brokenRefs.length > 0 || orphans.length > 0 || (!args.has('--write') && added > 0) || (args.has('--strict') && pending > 0);
process.exit(failed ? 1 : 0);

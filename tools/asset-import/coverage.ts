// Cobertura das tabelas de efeito e de nomes PT-BR por set: lista os textos (inglês) e nomes que ainda não têm entrada
// em pocket/effects e pocket/names (só das cartas que não são reimpressão do A1 ou das promos antigas).
//   node --experimental-strip-types tools/asset-import/coverage.ts [setId…] [--json arquivo]
import fs from 'node:fs';
import { A1_KEYS } from '../../src/content/source/a1/cards.ts';
import { gameplayKey } from '../../src/content/source/pocket/build.ts';
import { POCKET_ROWS } from '../../src/content/source/pocket/data/index.ts';
import { EFFECTS, NAMES } from '../../src/content/source/pocket/effects/index.ts';
import { isLegacyPromo } from '../../src/content/source/pocket/cards.ts';
import { POCKET_SETS } from '../../src/content/source/pocket/registry.ts';

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt >= 0 ? args[jsonAt + 1] : null;
const only = args.filter((a, i) => !a.startsWith('--') && i !== jsonAt + 1);

type Miss = { readonly text: string; readonly where: string[] };
const report: Record<string, Record<string, Miss[]>> = {};
const seen = new Set<string>(A1_KEYS.keys());
for (const r of POCKET_ROWS.pa ?? []) if (isLegacyPromo('pa', r.number)) seen.add(gameplayKey(r));

for (const set of POCKET_SETS) {
  if (set.setId === 'a1') continue;
  const rows = POCKET_ROWS[set.setId] ?? [];
  const miss: Record<string, Map<string, string[]>> = {
    attackEffects: new Map(), abilityEffects: new Map(), trainerEffects: new Map(), attackNames: new Map(), abilityNames: new Map(), trainerNames: new Map(),
  };
  const add = (kind: string, text: string, where: string) => {
    const m = miss[kind]!;
    m.set(text, [...(m.get(text) ?? []), where]);
  };
  for (const r of rows) {
    const key = gameplayKey(r);
    if (isLegacyPromo(set.setId, r.number) || seen.has(key)) continue;
    seen.add(key);
    const where = `${set.code}-${String(r.number).padStart(3, '0')} ${r.name}`;
    if (r.category === 'TRAINER') {
      if (!EFFECTS.trainers[r.effect ?? '']) add('trainerEffects', `[${r.subtype}] ${r.effect}`, where);
      if (!NAMES.trainers[r.name]) add('trainerNames', r.name, where);
      continue;
    }
    for (const a of r.attacks) {
      if (a.effect && !EFFECTS.attacks[a.effect]) add('attackEffects', a.effect, `${where} / ${a.name} ${a.cost} ${a.damage ?? ''}`);
      if (!NAMES.attacks[a.name]) add('attackNames', a.name, where);
    }
    for (const ab of r.abilities) {
      if (!EFFECTS.abilities[ab.effect]) add('abilityEffects', ab.effect, `${where} / ${ab.name}`);
      if (!NAMES.abilities[ab.name]) add('abilityNames', ab.name, where);
    }
  }
  if (only.length && !only.includes(set.setId) && !only.includes(set.code)) continue;
  report[set.setId] = Object.fromEntries(Object.entries(miss).map(([k, m]) => [k, [...m.entries()].map(([text, w]) => ({ text, where: w }))]));
}

if (jsonFile) fs.writeFileSync(jsonFile, JSON.stringify(report, null, 1));
for (const [setId, kinds] of Object.entries(report)) {
  const counts = Object.entries(kinds).map(([k, v]) => `${k} ${v.length}`).join(' · ');
  process.stdout.write(`${setId}: ${counts}\n`);
}

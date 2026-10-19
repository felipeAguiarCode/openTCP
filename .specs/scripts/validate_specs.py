#!/usr/bin/env python3
"""Validate documentation/configuration only. This does not run the game or GPU.

Default: prints the report to stdout and exits 0/1. With --write-report the report is
written to documentation-test-results.json (deterministic: no machine-specific values),
which must happen BEFORE scripts/build_manifest.py regenerates MANIFEST.sha256.
"""
from pathlib import Path
from urllib.parse import unquote
import argparse
import json
import re
import sqlite3
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DOC_VERSION = "3.2.0"
EXPECTED_TABLES = 47
CRITERIA_PREFIXES = ("G", "C", "UI", "R", "DB", "ED", "VS", "FX")
issues = []
stats = {}


def check(condition, message):
    if not condition:
        issues.append(message)


def slug(text):
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'[`*_]', '', text).lower()
    text = ''.join(ch for ch in text if ch.isalnum() or ch in ' -_')
    return re.sub(r'\s+', '-', text.strip())


def anchors(text):
    found = re.findall(r'<a\s+id="([^"]+)"', text)
    implicit = [slug(m.group(1)) for m in re.finditer(r'^#{1,6}\s+(.+)$', text, re.M)]
    return found, set(found + implicit)


def fenced_blocks(text):
    blocks, buffer, fence = [], [], None
    for line in text.splitlines():
        m = re.match(r'^\s*(`{3,}|~{3,})(.*)$', line)
        if m:
            marker, info = m.groups()
            if fence is None:
                fence = (marker[0], len(marker), info.strip())
                buffer = []
            elif marker[0] == fence[0] and len(marker) >= fence[1]:
                blocks.append((fence[2], '\n'.join(buffer)))
                fence = None
            else:
                buffer.append(line)
        elif fence is not None:
            buffer.append(line)
    return blocks, fence is None


markdown = sorted(p for p in ROOT.rglob('*.md') if p.name != 'VALIDACAO.md')
anchor_map, requirement_ids, md_json = {}, {}, []
for path in markdown:
    text = path.read_text(encoding='utf-8')
    rel = path.relative_to(ROOT).as_posix()
    explicit, all_ids = anchors(text)
    check(len(explicit) == len(set(explicit)), f'duplicate anchor: {rel}')
    anchor_map[path.resolve()] = all_ids
    blocks, closed = fenced_blocks(text)
    check(closed, f'unclosed code fence: {rel}')
    for lang, block in blocks:
        if lang == 'json':
            try:
                md_json.append((rel, json.loads(block)))
            except Exception as e:
                issues.append(f'invalid fenced JSON {rel}: {e}')
    ids = re.findall(r'^\|\s*((?:' + '|'.join(CRITERIA_PREFIXES) + r')-\d{3})\s*\|', text, re.M)
    if ids:
        check(len(ids) == len(set(ids)), f'duplicate criterion ID: {rel}')
        requirement_ids[rel] = ids
    # Section numbers like "## 🧪 14. Title" or "### 26.8. Title" must be unique per file.
    numbers = re.findall(r'^#{2,4}\s+(?:\S+\s+)?(\d+(?:\.\d+)*)\.\s', text, re.M)
    dupes = sorted({n for n in numbers if numbers.count(n) > 1})
    check(not dupes, f'duplicate section numbers {rel}: {dupes}')
    if path.parent == ROOT and rel not in ('README.md', 'CHANGELOG.md', 'referencias-visuais.md'):
        header = text[:600]
        check(DOC_VERSION in header, f'document version not {DOC_VERSION}: {rel}')

# Criteria: contiguous numbering per prefix.
all_criteria = [i for ids in requirement_ids.values() for i in ids]
check(len(all_criteria) == len(set(all_criteria)), 'criterion ID reused across documents')
for prefix in CRITERIA_PREFIXES:
    nums = sorted(int(i.split('-')[1]) for i in all_criteria if i.split('-')[0] == prefix)
    if nums:
        check(nums == list(range(1, len(nums) + 1)), f'criteria {prefix} not contiguous')

# Anchors of 3.1.0 must survive.
baseline = json.loads((ROOT / 'scripts/anchors-3.1.0.json').read_text(encoding='utf-8'))
for rel, old in baseline['anchors'].items():
    current = set(re.findall(r'<a\s+id="([^"]+)"', (ROOT / rel).read_text(encoding='utf-8')))
    missing = [a for a in old if a not in current]
    check(not missing, f'anchors removed from {rel}: {missing}')

link_count = 0
for path in markdown:
    text = path.read_text(encoding='utf-8')
    for link in re.findall(r'\[[^\]\n]*\]\(([^)\n]+)\)', text):
        if link.startswith(('http:', 'https:', 'mailto:', 'data:', 'sandbox:')):
            continue
        link = link.split(' "')[0]
        filepath, _, frag = unquote(link).partition('#')
        destination = (path.parent / filepath).resolve() if filepath else path.resolve()
        if destination.name == 'MANIFEST.sha256':
            continue
        check(destination.exists(), f'missing link {path.name}: {link}')
        if destination.exists() and frag and destination.suffix == '.md':
            ids = anchor_map.get(destination)
            if ids is None:
                _, ids = anchors(destination.read_text(encoding='utf-8'))
            check(frag in ids, f'missing anchor {path.name}: {link}')
        link_count += 1

json_paths = sorted(p for p in ROOT.rglob('*.json') if p.name != 'documentation-test-results.json')
data = {}
for path in json_paths:
    try:
        data[path.relative_to(ROOT).as_posix()] = json.loads(path.read_text(encoding='utf-8'))
    except Exception as e:
        issues.append(f'invalid JSON {path}: {e}')

# JSON Schemas, examples and fenced JSON fragments.
schema_checks = 0
try:
    from jsonschema import Draft202012Validator
    validators = {}
    for path in sorted((ROOT / 'schemas').glob('*.json')):
        schema = json.loads(path.read_text(encoding='utf-8'))
        Draft202012Validator.check_schema(schema)
        validators[path.name] = Draft202012Validator(schema)
        schema_checks += 1
    cds = data['schemas/card-definition.schema.json']

    def validate(name, instance, label, sub=None):
        global schema_checks
        if sub:
            schema = dict(cds['$defs'][sub])
            schema['$defs'] = cds['$defs']
            validator = Draft202012Validator(schema)
        else:
            validator = validators[name]
        errors = [e.message for e in validator.iter_errors(instance)]
        check(not errors, f'schema {sub or name} rejects {label}: {errors[:2]}')
        schema_checks += 1

    validate('card-definition.schema.json', data['examples/card-definition.example.json'], 'card-definition example')
    for item in data['examples/card-printings.example.json']:
        validate('card-printing.schema.json', item, item['printingId'])
    validate('editor-draft.schema.json', data['examples/editor-project.example.json'], 'editor-project example')
    for rel, block in md_json:
        if not isinstance(block, dict):
            continue
        if block.get('dataVersion') == 2 and 'category' in block:
            validate('card-definition.schema.json', block, f'{rel} card block')
        elif 'appearanceVersion' in block and 'printingId' in block:
            validate('card-printing.schema.json', block, f'{rel} printing block')
        elif 'energyCost' in block and 'endsTurn' in block:
            validate(None, block, f'{rel} attack block', 'attack')
        elif 'sourcePositions' in block and 'kind' in block:
            validate(None, block, f'{rel} ability block', 'ability')
        elif 'timing' in block and 'operation' in block:
            validate(None, block, f'{rel} effect block', 'effectBlock')
except Exception as e:
    issues.append(f'JSON Schema validation: {e!r}')

# Effects DSL: the opcode table of efeitos-dsl.md §9 must equal the schema registry.
dsl = (ROOT / 'efeitos-dsl.md').read_text(encoding='utf-8')
section9 = dsl.split('<a id="dsl-9"></a>', 1)[1].split('<a id="dsl-10"></a>', 1)[0]
doc_ops = re.findall(r'^\|\s*`([A-Z_]+)`\s*\|', section9.split('`MODIFY.stat`')[0], re.M)
schema_ops = data['schemas/card-definition.schema.json']['$defs']['operation']['properties']['type']['enum']
check(sorted(doc_ops) == sorted(schema_ops), f'DSL opcode table differs from schema: {sorted(set(doc_ops) ^ set(schema_ops))}')

# Grant keys: one canonical format across documents (no content version, no profileId).
grant_pattern = re.compile(r'(first-clear|objective|discovery|opening|onboarding|cosmetic|custom-grant):[^\s`|"]*')
grant_samples = 0
for path in markdown:
    for m in grant_pattern.finditer(path.read_text(encoding='utf-8')):
        grant_samples += 1
        token = m.group(0)
        check('campaignVersion' not in token and 'profileId' not in token,
              f'non-canonical grant key in {path.name}: {token}')

# Visual tokens and CSS.
tokens = data['examples/visual-tokens.json']
css = (ROOT / 'design/theme-pocket.css').read_text(encoding='utf-8')
for key, value in tokens['colors'].items():
    css_key = re.sub(r'(?<!^)([A-Z])', r'-\1', key).lower()
    check(f'--pocket-{css_key}: {value};' in css, f'CSS token mismatch: {key}')
check('color-scheme: light' in css, 'CSS must force intended light shell')


def luminance(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in rgb]
    return sum(a * b for a, b in zip(rgb, (0.2126, 0.7152, 0.0722)))


def ratio(a_hex, b_hex):
    a, b = sorted((luminance(a_hex), luminance(b_hex)))
    return (b + 0.05) / (a + 0.05)


contrasts = []
for foreground, background in tokens['contrastPairs']:
    r = ratio(tokens['colors'][foreground], tokens['colors'][background])
    check(r >= 4.5, f'contrast under 4.5: {foreground}/{background}')
    contrasts.append({'foreground': foreground, 'background': background, 'ratio': round(r, 3)})
strips = tokens.get('attackStripColors', {})
check(len(strips) == 10, 'attackStripColors must define the 10 types')
for type_name, value in strips.items():
    r = ratio('#FFFFFF', value)
    check(r >= 4.5, f'attack strip contrast under 4.5: {type_name}')
    check(f'--pocket-strip-{type_name.lower()}: {value};' in css, f'CSS strip token mismatch: {type_name}')
    contrasts.append({'foreground': '#FFFFFF', 'background': f'strip:{type_name}', 'ratio': round(r, 3)})

# Battle layout.
layout = data['examples/battle-layout.json']


def contains(outer, inner):
    x, y, w, h = outer
    a, b, c, d = inner
    return a >= x - 0.01 and b >= y - 0.01 and a + c <= x + w + 0.01 and b + d <= y + h + 0.01


def overlaps(a, b):
    return a[0] < b[0] + b[2] and b[0] < a[0] + a[2] and a[1] < b[1] + b[3] and b[1] < a[1] + a[3]


expected_slots = {f'{who}_ACTIVE' for who in ('HUMAN', 'NPC')} | {f'{who}_BENCH_{i}' for who in ('HUMAN', 'NPC') for i in range(3)}
for profile in layout['profiles']:
    width, height = profile['viewport']
    for key, rect in profile['regions'].items():
        check(contains([0, 0, width, height], rect), f'out of viewport {profile["id"]}/{key}')
    slots = profile['slots']
    check(len(slots) == 8, f'slot count {profile["id"]}')
    check({slot['id'] for slot in slots} == expected_slots, f'incorrect semantic slots {profile["id"]}')
    rects = []
    for slot in slots:
        x, y = slot['center']
        w, h = slot['size']
        rect = [x - w / 2, y - h / 2, w, h]
        rects.append((slot['id'], rect))
        check(abs(w / h - 5 / 7) < 1e-5, f'card aspect {slot["id"]}')
        check(contains(profile['regions']['protectedCards'], rect), f'slot out of protected {profile["id"]}/{slot["id"]}')
    for i in range(len(rects)):
        for j in range(i + 1, len(rects)):
            check(not overlaps(rects[i][1], rects[j][1]), f'slots overlap {profile["id"]}/{rects[i][0]}/{rects[j][0]}')
    # trainerZone: zona verde de soltura do Treinador, sobreposta ao centro da mesa de propósito (gameplay-pocket §6).
    container_regions = {'hud', 'humanBar', 'board', 'protectedCards', 'attackCutin', 'inspector', 'actions', 'hand', 'trainerZone'}
    for key, rect in profile['regions'].items():
        if key in container_regions:
            continue
        for slot_id, slot_rect in rects:
            check(not overlaps(rect, slot_rect), f'region {profile["id"]}/{key} overlaps {slot_id}')
    for key in ('humanDeck', 'humanDiscard', 'npcDeck', 'npcDiscard', 'humanEnergy', 'npcEnergy', 'humanPoints', 'npcPoints', 'stadium', 'npcHand', 'humanBar', 'endTurn', 'history', 'menu'):
        check(key in profile['regions'], f'missing region {profile["id"]}/{key}')
    check('handPolicy' in profile, f'missing handPolicy {profile["id"]}')
    hx = profile['regions']['hand'][0] + profile['regions']['hand'][2] / 2
    bench_x = sorted(s['center'][0] for s in slots if s['id'].startswith('HUMAN_BENCH'))
    check(abs(hx - bench_x[1]) <= 1, f'hand not centered with slots {profile["id"]}')
check(any(p['id'] == 'desktop1080' for p in layout['profiles']) and any(p['id'] == 'compact720' for p in layout['profiles']), 'layout profiles missing')

# Interface tables must mirror the layout JSON (§23.5 table; §23.14 prose).
ui = (ROOT / 'interface-16x9.md').read_text(encoding='utf-8')
p1080 = next(p for p in layout['profiles'] if p['id'] == 'desktop1080')
p720 = next(p for p in layout['profiles'] if p['id'] == 'compact720')
names_1080 = {'Faixa do adversário (borda da mesa)': 'hud', 'Sua faixa (borda da mesa)': 'humanBar', 'Sua placa: foto, nome e pontos': 'humanPlate',
              'Placa do adversário: pontos, nome e foto': 'npcPlate', 'Dica do alvo pendente e Jogar': 'actionButtons', 'Viewport Three.js do campo': 'board', 'Região protegida das oito cartas': 'protectedCards',
              'Ações (reserva do preset tático)': 'actions', 'Viewport da mão': 'hand', 'Destaque transitório': 'attackCutin', 'Botão flutuante Finalizar turno': 'endTurn'}
sec235 = ui.split('### 23.5.', 1)[1].split('### 23.6.', 1)[0]
for label, key in names_1080.items():
    m = re.search(r'^\|\s*' + re.escape(label) + r'\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|', sec235, re.M)
    check(m is not None and [int(v) for v in m.groups()] == p1080['regions'][key], f'§23.5 {label} differs from battle-layout.json')
sec2314 = ui.split('### 23.14.', 1)[1].split('### 23.15.', 1)[0]
for label, key in {'HUD': 'hud', 'Campo': 'board', 'Região protegida': 'protectedCards', 'Ações': 'actions', 'Mão': 'hand'}.items():
    m = re.search(re.escape(label) + r'\s+X=(\d+)/Y=(\d+)/W=(\d+)/H=(\d+)', sec2314)
    check(m is not None and [int(v) for v in m.groups()] == p720['regions'][key], f'§23.14 {label} differs from battle-layout.json')

# Routes: unique IDs and paths.
routes = re.findall(r'^\|\s*(S\d{2})\s*\|\s*`([^`]+)`\s*\|', ui.split('### 3.2.', 1)[1].split('### 3.3.', 1)[0], re.M)
check(len(routes) == len({r[0] for r in routes}) == len({r[1] for r in routes}), 'route IDs or paths duplicated')

# Presets: catalog and choreographies.
presets = data['examples/animation-presets.json']['presets']
duration = {x['id']: x['durationMs'] for x in presets}
check(len(duration) == len(presets) == 38, 'animation preset count or duplicate')
sec362 = ui.split('<a id="interface-motion-timing"></a>', 1)[1].split('### 36.3.', 1)[0]
table = dict((k, int(v)) for k, v in re.findall(r'^\|\s*`([A-Z_]+)`\s*\|[^|]+\|\s*(\d+)\s*ms\s*\|', sec362, re.M))
check({k: v for k, v in table.items() if k in duration} == duration, 'interface §36.2 table differs from animation-presets.json')
ui_presets = data['examples/animation-presets.json'].get('uiPresets', [])
check({p['id'] for p in ui_presets} >= {'UI_HOVER', 'UI_DRAWER', 'UI_DRAG_RETURN'}, 'uiPresets missing')
easings = {'linear', 'easeOutCubic', 'easeInOutCubic', 'easeOutBack'}
seqs = data['examples/motion-choreography.json']['sequences']
for seq in seqs:
    check(seq['presetId'] in duration, f'unknown preset {seq["presetId"]}')
    offset = 0
    for phase in seq['phases']:
        check(phase['startMs'] == offset, f'phase gap {seq["presetId"]}')
        check(phase['endMs'] == phase['startMs'] + phase['durationMs'], f'phase sum {seq["presetId"]}')
        check(phase['durationMs'] > 0, f'empty phase {seq["presetId"]}')
        check(not phase['mayMutateDomain'], f'visual mutates rules {seq["presetId"]}')
        check(phase.get('easing') in easings, f'phase easing invalid {seq["presetId"]}/{phase["phaseId"]}')
        offset = phase['endMs']
    check(offset == seq['totalMs'] == duration.get(seq['presetId']), f'total duration {seq["presetId"]}')

mats = data['examples/playmats.example.json']['playmats']
check(len(mats) == len({m['id'] for m in mats}) == 9, 'playmat count')
check(all(m['definitionVersion'] == 2 and not m['gameplayModifiers'] for m in mats), 'playmat version/rules')
check(all('pocket-light-v2' not in json.dumps(m) for m in mats), 'playmat asset keys must not imply a pocket-light-v2 profile')
cp = data['examples/cosmetic-preset.example.json']
check('entryFlairByDeckEntryId' not in cp, 'entry flair must live in deck_entries, not presets')
check(any(m['id'] == cp['playmat']['playmatId'] and m['definitionVersion'] == cp['playmat']['definitionVersion'] for m in mats), 'preset mat mismatch')
matrix = data['examples/visual-capture-matrix.json']
visual_ids = set(requirement_ids.get('direcao-visual-pocket.md', []))
layout_ids = {p['id'] for p in layout['profiles']}
for c in matrix['captures']:
    check(all(i in visual_ids for i in c['requirementIds']), f'capture requirement mismatch: {c["id"]}')
    check(c['executionStatus'] == 'PENDING_IMPLEMENTATION' and c['screenshotPath'] is None, f'false visual execution: {c["id"]}')
    profiles = c.get('viewportProfiles', [])
    check(set(profiles) <= layout_ids, f'capture viewport profile unknown: {c["id"]}')

# Database: pure DDL, generated seed, demo integrity.
ddl = (ROOT / 'database/schema-v1.sql').read_text(encoding='utf-8')
check(re.search(r'^\s*(BEGIN\s*(IMMEDIATE|TRANSACTION)?\s*;|COMMIT\b|PRAGMA\b)', ddl, re.I | re.M) is None,
      'schema-v1.sql must be pure DDL (runner owns transaction and PRAGMAs)')
check(len(re.findall(r'^CREATE TABLE ', ddl, re.M)) == EXPECTED_TABLES, 'DDL table count')
try:
    sys.path.insert(0, str(ROOT / 'database'))
    from build_seed import build as build_seed
    check((ROOT / 'database/seed-demo.sql').read_text(encoding='utf-8') == build_seed(), 'seed-demo.sql is stale (run build_seed.py)')
except Exception as e:
    issues.append(f'seed generator: {e!r}')
conn = sqlite3.connect(f'file:{ROOT / "database/demo.sqlite3"}?mode=ro', uri=True)
integrity = conn.execute('PRAGMA integrity_check').fetchone()[0]
fk = list(conn.execute('PRAGMA foreign_key_check'))
table_count = conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchone()[0]
user_version = conn.execute('PRAGMA user_version').fetchone()[0]
conn.close()
check(integrity == 'ok', 'demo integrity failure')
check(not fk, 'demo foreign key failure')
check(table_count == EXPECTED_TABLES, f'demo table count {table_count} != {EXPECTED_TABLES}')
check(user_version == 1, 'demo user_version')

stats.update({
    'markdownFilesChecked': len(markdown),
    'relativeLinksChecked': link_count,
    'explicitAnchors': sum(len(anchors(p.read_text(encoding="utf-8"))[0]) for p in markdown),
    'fencedJsonBlocks': len(md_json), 'jsonFilesChecked': len(json_paths),
    'jsonSchemaChecks': schema_checks, 'schemas': len(list((ROOT / 'schemas').glob('*.json'))),
    'dslOpcodes': len(schema_ops), 'grantKeySamples': grant_samples, 'contrasts': contrasts,
    'layoutProfiles': len(layout['profiles']), 'slotsPerProfile': 8, 'animationPresets': len(presets),
    'uiPresets': len(ui_presets), 'phaseSequences': len(seqs), 'playmats': len(mats),
    'artBriefs': len(data['examples/art-briefs.json']['briefs']), 'routes': len(routes),
    'plannedCaptureScenarios': len(matrix['captures']),
    'plannedProductRequirements': {name: len(ids) for name, ids in requirement_ids.items()},
    'plannedProductRequirementsTotal': len(all_criteria),
    'demoIntegrity': integrity, 'demoForeignKeyViolations': len(fk), 'demoTables': table_count,
    'notExecuted': ['game', 'card-editor', 'WebGL-render', 'GPU-performance', 'SQLite-WASM-OPFS', 'browser-import', 'visual-capture'],
})
report = {'documentVersion': DOC_VERSION, 'scope': 'STATIC_DOCUMENTATION_CONFIG_AND_NATIVE_DEMO_INTEGRITY',
          'passed': not issues, 'issues': issues, 'statistics': stats}
parser = argparse.ArgumentParser()
parser.add_argument('--write-report', action='store_true')
args = parser.parse_args()
if args.write_report:
    (ROOT / 'documentation-test-results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
sys.exit(0 if not issues else 1)

// Empacotamento offline (runtime §1.5, §20; plano Fase 14): gera dist/manifest.json com sha256/bytes,
// audita referências externas, monta card-campaign/ (dist, runner, iniciadores, LICENSES, LEIA-ME)
// e o ZIP distribuível. Relatório de placeholders/licenças em release-report.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { auditOffline } from './audit-offline.mjs';
import { writeLicenses } from './licenses.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'card-campaign');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const MEDIA = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.glb': 'model/gltf-binary',
  '.ktx2': 'image/ktx2', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.txt': 'text/plain',
};

function fail(msg) { process.stderr.write(`\n${msg}\n\n`); process.exit(1); }

function walk(dir, base = dir, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, list);
    else list.push(path.relative(base, full).replaceAll('\\', '/'));
  }
  return list.sort();
}

/** Chave lógica estável por arquivo: conteúdo e fontes têm chaves semânticas; bundles, `file:<path>`. */
function assetKeyOf(rel) {
  if (rel.startsWith('content/')) return `content:${rel.slice('content/'.length)}`;
  if (rel.startsWith('vendor/sqlite/')) return `sqlite:${rel.slice('vendor/sqlite/'.length)}`;
  if (/\.woff2?$/.test(rel)) return `font:${path.basename(rel)}`;
  return `file:${rel}`;
}

if (!fs.existsSync(path.join(dist, 'index.html'))) fail('dist/ não encontrado. Rode "npm run build" antes de empacotar.');
const contentManifestPath = path.join(dist, 'content', 'manifest.json');
if (!fs.existsSync(contentManifestPath)) fail('dist/content/manifest.json ausente: o catálogo precisa estar no pacote.');
if (!fs.existsSync(path.join(dist, 'vendor', 'sqlite'))) fail('dist/vendor/sqlite ausente: o runtime SQLite WASM precisa estar no pacote.');
const contentManifest = JSON.parse(fs.readFileSync(contentManifestPath, 'utf8'));

// 1. manifest.json da distribuição (gerado por último dentro de dist, sem se autoincluir).
const files = walk(dist).filter((f) => f !== 'manifest.json');
const assets = files.map((rel) => {
  const bytes = fs.readFileSync(path.join(dist, rel));
  return { assetKey: assetKeyOf(rel), path: rel, mediaType: MEDIA[path.extname(rel).toLowerCase()] ?? 'application/octet-stream', bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), required: true };
});
const manifest = { manifestVersion: 1, appVersion: pkg.version, contentVersion: contentManifest.version, contentHash: contentManifest.contentHash, assets };
fs.writeFileSync(path.join(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// 2. Auditoria offline.
const audit = auditOffline(dist);
if (audit.errors.length) {
  for (const e of audit.errors) process.stderr.write(`ERRO  ${e.file}: ${e.url} (${e.reason})\n`);
  fail(`Auditoria offline falhou com ${audit.errors.length} referência(s) externa(s).`);
}

// 3. Monta a pasta distribuível.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(dist, path.join(out, 'dist'), { recursive: true });
fs.mkdirSync(path.join(out, 'runner'), { recursive: true });
fs.copyFileSync(path.join(root, 'runner', 'server.mjs'), path.join(out, 'runner', 'server.mjs'));
for (const f of ['start-local.cmd', 'start-local.sh', 'LEIA-ME.txt']) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.chmodSync(path.join(out, 'start-local.sh'), 0o755);
const licenses = writeLicenses(path.join(out, 'LICENSES'));
// Assets de apresentação fornecidos pelo autor (origem e restrições) acompanham as licenças.
const assetsDoc = path.join(root, 'src', 'presentation', 'assets', 'ASSETS.md');
if (fs.existsSync(assetsDoc)) fs.copyFileSync(assetsDoc, path.join(out, 'LICENSES', 'ASSETS.md'));
const authorAssets = fs.existsSync(assetsDoc)
  ? fs.readFileSync(assetsDoc, 'utf8').split('\n').filter((l) => /^\| `/.test(l)).map((l) => l.split('|').map((c) => c.trim()).filter(Boolean))
    .map(([file, use, origin, restrictions]) => ({ file: file.replace(/`/g, '').split(' ')[0], use, origin, restrictions }))
  : [];

// 4. ZIP (caminhos relativos com prefixo card-campaign/).
const entries = {};
for (const rel of walk(out)) entries[`card-campaign/${rel}`] = [new Uint8Array(fs.readFileSync(path.join(out, rel))), { level: /\.(png|jpg|webp|woff2|wasm|zip)$/.test(rel) ? 0 : 6 }];
const zip = zipSync(entries);
const zipName = `card-campaign-${pkg.version}.zip`;
fs.writeFileSync(path.join(root, zipName), zip);

// 5. Relatório: tamanho, placeholders e licenças.
const content = JSON.parse(fs.readFileSync(path.join(dist, 'content', contentManifest.file), 'utf8'));
const templateOnly = (content.printings ?? []).filter((p) => p.artMode === 'TEMPLATE_ONLY').length;
const fullPrinting = (content.printings ?? []).filter((p) => p.artMode === 'FULL_PRINTING').length;
const report = {
  generatedAt: new Date().toISOString(), appVersion: pkg.version, content: { version: contentManifest.version, hash: contentManifest.contentHash },
  files: assets.length, distBytes: assets.reduce((s, a) => s + a.bytes, 0), zip: { file: zipName, bytes: zip.length },
  audit: { errors: 0, textualUrls: [...new Set(audit.info.map((i) => i.url.replace(/^https?:\/\//, '').split('/')[0]))] },
  placeholders: { cardArt: `${fullPrinting} impressões com a imagem da carta impressa (FULL_PRINTING); ${templateOnly} em TEMPLATE_ONLY (moldura + nome, placeholder tipado)`, audio: 'slots de áudio sem arquivos; ausência de áudio não bloqueia', playmats: 'texturas procedurais a partir da paleta' },
  licenses,
  authorAssets,
  thirdPartyData: 'Cartas do Pokémon TCG Pocket do Genetic Apex (A1) ao Deluxe Pack ex (A4b), Promo-A e Promo-B, retratos dos treinadores da franquia (avatares), bolas de Energia, frente oficial dos pacotes, moedas, sleeves e ícones de efeito do Pocket (© The Pokémon Company): dados e imagens para uso local; não redistribuir.',
};
fs.writeFileSync(path.join(root, 'release-report.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`Pacote pronto: card-campaign/ e ${zipName} (${(zip.length / 1048576).toFixed(1)} MiB, ${assets.length} arquivos). Relatório: release-report.json\n`);

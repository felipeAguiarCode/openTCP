// Copia o runtime SQLite WASM fixado (JS, WASM e worker auxiliar do VFS opfs) para
// public/vendor/sqlite/, servido em /vendor/sqlite/ no dev e copiado para dist/vendor/sqlite/ no build.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkgJson = require.resolve('@sqlite.org/sqlite-wasm/package.json');
const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
const source = path.join(path.dirname(pkgJson), 'dist');
const target = path.resolve('public', 'vendor', 'sqlite');
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const file of ['index.mjs', 'sqlite3.wasm', 'sqlite3-opfs-async-proxy.js']) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}
fs.writeFileSync(path.join(target, 'VERSION.json'), JSON.stringify({ package: pkg.name, version: pkg.version, license: pkg.license }, null, 2) + '\n');
console.log(`sqlite-wasm ${pkg.version} -> ${path.relative(process.cwd(), target)}`);

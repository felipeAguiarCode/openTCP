#!/usr/bin/env node
// Runner local do Card Campaign (runtime-offline-threejs.md §1.7).
// Servidor estático mínimo: só módulos nativos do Node, sem API, sem gravar arquivos.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 4173;
const CANONICAL = `http://localhost:${PORT}`;
const MIN_NODE_MAJOR = 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.ktx2': 'image/ktx2',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.txt': 'text/plain; charset=utf-8',
};

const BASE_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
};

function parseArgs(argv) {
  const args = { open: true, dist: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--no-open') args.open = false;
    else if (argv[i] === '--dist') args.dist = argv[++i];
  }
  return args;
}

function fail(message) {
  process.stderr.write(`\n${message}\n\n`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isFinite(major) || major < MIN_NODE_MAJOR) {
  fail(`Este jogo precisa do Node.js ${MIN_NODE_MAJOR} ou mais recente (encontrado ${process.versions.node}). Veja LEIA-ME.txt.`);
}

const args = parseArgs(process.argv.slice(2));
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(args.dist ?? path.join(here, '..', 'dist'));
if (!fs.existsSync(path.join(root, 'index.html'))) {
  fail(`Pasta do jogo não encontrada: ${root}\nExtraia o pacote completo ou rode "npm run build" no ambiente de desenvolvimento.`);
}
const realRoot = fs.realpathSync(root);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function resolveSafe(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s === '.')) return null;
  const relative = decoded === '/' ? 'index.html' : segments.join('/');
  if (path.isAbsolute(relative)) return null;
  const candidate = path.resolve(realRoot, relative);
  let real;
  try {
    real = fs.realpathSync(candidate);
  } catch {
    return null;
  }
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return null;
  return real;
}

function handler(req, res) {
  const host = (req.headers.host ?? '').toLowerCase();
  const url = new URL(req.url ?? '/', CANONICAL);
  if (host === `127.0.0.1:${PORT}` || host === `[::1]:${PORT}`) {
    res.writeHead(307, { ...BASE_HEADERS, Location: `${CANONICAL}${url.pathname}${url.search}` });
    res.end();
    return;
  }
  if (host !== `localhost:${PORT}`) {
    send(res, 403, 'Host não permitido.');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Método não permitido.', { Allow: 'GET, HEAD' });
    return;
  }
  const file = resolveSafe(url.pathname);
  if (!file) {
    send(res, 404, 'Não encontrado.');
    return;
  }
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    send(res, 404, 'Não encontrado.');
    return;
  }
  if (!stat.isFile()) {
    send(res, 404, 'Não encontrado.');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const name = path.basename(file);
  const headers = {
    ...BASE_HEADERS,
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': String(stat.size),
    'Cache-Control': name === 'index.html' || name === 'manifest.json' ? 'no-cache' : 'public, max-age=31536000, immutable',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

function listen(address) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen({ port: PORT, host: address, exclusive: true }, () => resolve(server));
  });
}

function openBrowser(target) {
  const platform = process.platform;
  const command = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const commandArgs = platform === 'win32' ? ['/c', 'start', '""', target] : [target];
  try {
    const child = spawn(command, commandArgs, { stdio: 'ignore', detached: true, windowsVerbatimArguments: platform === 'win32' });
    child.on('error', () => process.stdout.write(`Abra manualmente: ${target}\n`));
    child.unref();
  } catch {
    process.stdout.write(`Abra manualmente: ${target}\n`);
  }
}

const servers = [];
try {
  servers.push(await listen('127.0.0.1'));
} catch (error) {
  if (error.code === 'EADDRINUSE') fail(`A porta ${PORT} já está em uso; feche o outro programa e tente de novo.\nO jogo não troca de porta: outra porta seria outra origem e outro banco de saves.`);
  fail(`Não foi possível iniciar o servidor local: ${error.message}`);
}
try {
  servers.push(await listen('::1'));
} catch (error) {
  if (error.code === 'EADDRINUSE') {
    servers.forEach((s) => s.close());
    fail(`A porta ${PORT} já está em uso (IPv6); feche o outro programa e tente de novo.`);
  }
  process.stdout.write('Aviso: IPv6 (::1) indisponível; servindo apenas em 127.0.0.1.\n');
}

process.stdout.write(`\nCard Campaign rodando em ${CANONICAL}/\nServindo: ${realRoot}\nPressione Ctrl+C para encerrar.\n\n`);
if (args.open) openBrowser(`${CANONICAL}/`);

function shutdown() {
  process.stdout.write('\nEncerrando o servidor local...\n');
  servers.forEach((s) => s.close());
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

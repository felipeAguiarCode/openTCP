// Auditoria offline do build (runtime §20.6, R-004): falha se o pacote referenciar CDNs, telemetria
// ou endpoints não locais em contexto de carregamento. URLs apenas textuais (documentação dentro de
// mensagens de bibliotecas, namespaces XML) são listadas como informativas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXT = new Set(['.js', '.mjs', '.css', '.html', '.json', '.gltf', '.txt', '.svg', '.webmanifest']);
const URL_RE = /\bhttps?:\/\/[^\s"'`)<>\\]+/g;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/;
const NAMESPACE = /^https?:\/\/(www\.)?w3\.org\//;
const BLOCKED_HOST = /(cdn|unpkg|jsdelivr|googleapis|gstatic|google-analytics|googletagmanager|doubleclick|cloudflare|sentry|segment|mixpanel|hotjar|amplitude|facebook|fonts\.|analytics|telemetry)/i;
const LOAD_CONTEXT = /(fetch\s*\(|import\s*\(|importScripts\s*\(|new\s+(Shared)?Worker\s*\(|\bsrc\s*=|\bhref\s*=|url\s*\(|XMLHttpRequest|sendBeacon|WebSocket\s*\(|EventSource\s*\()\s*["'`]?$/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function auditOffline(distDir) {
  const errors = [];
  const info = [];
  for (const file of walk(distDir)) {
    if (!TEXT_EXT.has(path.extname(file).toLowerCase())) continue;
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(distDir, file).replaceAll('\\', '/');
    for (const m of text.matchAll(URL_RE)) {
      const url = m[0];
      if (LOCAL.test(url) || NAMESPACE.test(url)) continue;
      const before = text.slice(Math.max(0, m.index - 40), m.index);
      const host = url.replace(/^https?:\/\//, '').split('/')[0];
      const loading = LOAD_CONTEXT.test(before);
      if (loading || BLOCKED_HOST.test(host)) errors.push({ file: rel, url, reason: loading ? 'carregamento externo' : 'host proibido' });
      else info.push({ file: rel, url });
    }
    // CSS e HTML: qualquer url()/src/href absoluto externo já é carregamento.
    if (/\.(css|html)$/.test(file)) {
      for (const m of text.matchAll(/(?:url\(|src=|href=)\s*["']?(\/\/[^"')\s]+)/g)) errors.push({ file: rel, url: m[1], reason: 'URL relativa ao protocolo' });
    }
  }
  return { errors, info };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dist = path.resolve(process.argv[2] ?? 'dist');
  if (!fs.existsSync(dist)) { process.stderr.write(`pasta ${dist} não existe; rode npm run build\n`); process.exit(2); }
  const { errors, info } = auditOffline(dist);
  const unique = (list) => [...new Map(list.map((x) => [`${x.file} ${x.url}`, x])).values()];
  for (const e of unique(errors)) process.stderr.write(`ERRO  ${e.file}: ${e.url} (${e.reason})\n`);
  const hosts = [...new Set(info.map((x) => x.url.replace(/^https?:\/\//, '').split('/')[0]))];
  process.stdout.write(`auditoria offline: ${unique(errors).length} erro(s); ${info.length} URL(s) apenas textuais em ${hosts.length} host(s)${hosts.length ? `: ${hosts.join(', ')}` : ''}\n`);
  process.exit(errors.length ? 1 : 0);
}

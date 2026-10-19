// Carrega o pacote de conteúdo BASE empacotado (runtime §1.5, §21): manifesto → arquivo → hash JCS.
// Sem rede externa: caminhos relativos à origem local. Pacote ausente ou adulterado bloqueia tentativas.
import type { BuiltBundle } from '../../content/types.ts';
import { jcsHash } from '../../domain/hash/jcs.ts';

export type ContentManifest = { readonly packageId: string; readonly version: string; readonly contentHash: string; readonly bytes: number; readonly file: string };

export type ContentLoadError = { readonly ok: false; readonly code: 'CONTENT_MANIFEST_MISSING' | 'CONTENT_FILE_MISSING' | 'CONTENT_HASH_MISMATCH'; readonly message: string };

export async function loadBaseContent(base = './content/'): Promise<{ ok: true; bundle: BuiltBundle; manifest: ContentManifest } | ContentLoadError> {
  let manifest: ContentManifest;
  try {
    const r = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    manifest = (await r.json()) as ContentManifest;
  } catch (e) {
    return { ok: false, code: 'CONTENT_MANIFEST_MISSING', message: `Manifesto de conteúdo ausente (${String(e)}).` };
  }
  let bundle: BuiltBundle;
  try {
    const r = await fetch(`${base}${manifest.file}`);
    if (!r.ok) throw new Error(String(r.status));
    bundle = (await r.json()) as BuiltBundle;
  } catch (e) {
    return { ok: false, code: 'CONTENT_FILE_MISSING', message: `Arquivo de conteúdo ausente (${String(e)}).` };
  }
  const { contentHash, ...rest } = bundle;
  const actual = jcsHash(rest);
  if (contentHash !== manifest.contentHash || actual !== contentHash) {
    return { ok: false, code: 'CONTENT_HASH_MISMATCH', message: 'O pacote de conteúdo não confere com o manifesto. Reinstale o jogo a partir do ZIP original.' };
  }
  return { ok: true, bundle, manifest };
}

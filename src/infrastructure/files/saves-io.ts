// E/S do navegador para a tela de saves (S31): escolher arquivos com limite ANTES de ler, baixar bytes como
// arquivo, ZIP defensivo, SHA-256, worker descartável de validação de backup e o OPFS da origem (quota,
// persistência, cópias anteriores do banco). A apresentação usa esta fachada; a aplicação não conhece nada disto.
import { opfsList, opfsRead, opfsRemove, opfsRemoveTree, requestPersistence, storageStatus, type OpfsEntry } from '../storage/opfs-files.ts';
import { inspectBackupInWorker, type BackupInspector } from '../storage/restore-client.ts';
import { BACKUP_MAX_BYTES, BACKUPS_DIR, STAGING_DIR } from '../storage/restore.ts';
import { sha256HexAsync } from './hash.ts';
import { BACKUP_ZIP_LIMITS, MiB, PROFILE_ZIP_LIMITS, readZip, writeZip, type ZipFailureReason, type ZipLimits, type ZipWriteEntry } from './zip.ts';

export {
  BACKUP_MAX_BYTES, BACKUP_ZIP_LIMITS, BACKUPS_DIR, PROFILE_ZIP_LIMITS, STAGING_DIR, inspectBackupInWorker, opfsList, opfsRead, opfsRemove, opfsRemoveTree,
  readZip, requestPersistence, sha256HexAsync, storageStatus, writeZip,
};
export type { BackupInspector, OpfsEntry, ZipFailureReason, ZipLimits, ZipWriteEntry };

/** Limite de leitura por tipo de arquivo escolhido (persistencia §25: verificado antes de ler os bytes). */
export function sizeLimitFor(name: string): number {
  const lower = name.toLowerCase();
  if (lower.endsWith('.campaign-profile.zip')) return PROFILE_ZIP_LIMITS.maxArchiveBytes;
  if (lower.endsWith('.zip')) return Math.max(PROFILE_ZIP_LIMITS.maxArchiveBytes, BACKUP_ZIP_LIMITS.maxArchiveBytes);
  if (lower.endsWith('.json')) return MiB;
  return BACKUP_MAX_BYTES;
}

export type PickedFile = { readonly name: string; readonly bytes: Uint8Array };

/** Lê os arquivos escolhidos; recusa pelo tamanho declarado antes de carregar qualquer byte. */
export async function readPickedFiles(list: FileList | readonly File[]): Promise<{ readonly ok: true; readonly files: PickedFile[] } | { readonly ok: false; readonly name: string; readonly size: number; readonly limit: number }> {
  const files = [...list];
  for (const file of files) {
    const limit = sizeLimitFor(file.name);
    if (file.size > limit) return { ok: false, name: file.name, size: file.size, limit };
  }
  const out: PickedFile[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const limit = sizeLimitFor(file.name);
    if (bytes.length > limit) return { ok: false, name: file.name, size: bytes.length, limit };
    out.push({ name: file.name, bytes });
  }
  return { ok: true, files: out };
}

/** Abre o seletor de arquivos do sistema e devolve a lista escolhida (vazia se cancelado). */
export function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    let settled = false;
    const done = (files: File[]) => { if (settled) return; settled = true; input.remove(); resolve(files); };
    input.addEventListener('change', () => done([...(input.files ?? [])]));
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}

/** Baixa bytes como arquivo escolhido pelo usuário (nenhum envio a serviço algum). */
export function downloadBytes(name: string, bytes: Uint8Array, mediaType: string): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Entradas aceitas num backup em .zip: o banco e o manifesto acompanhante. */
export function isBackupZipEntry(name: string): boolean {
  return /^[^/]+\.(sqlite3|sqlite|db)$/i.test(name) || /^[^/]+\.backup\.json$/i.test(name) || name === 'manifest.json';
}

/** Remove os dados de preferência deste dispositivo (localStorage com prefixo do jogo). */
export function clearDevicePreferences(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('card-campaign')) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // sem localStorage: nada a limpar
  }
}

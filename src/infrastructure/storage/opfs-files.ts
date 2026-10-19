// Operações de arquivo no OPFS da origem (persistencia-sqlite.md §3, §25.1): staging de restauração, cópias
// anteriores do banco em /card-campaign/backups/ e “Apagar todos os dados locais”. Caminhos lógicos absolutos
// (`/card-campaign/...`). Nunca toca o banco aberto: a troca do principal só acontece com a conexão fechada.

type MovableHandle = FileSystemFileHandle & { move?: (parent: FileSystemDirectoryHandle, name: string) => Promise<void> };
type SyncHandle = { write: (data: Uint8Array, options?: { at: number }) => number; truncate: (size: number) => void; flush: () => void; close: () => void };
type SyncCapable = FileSystemFileHandle & { createSyncAccessHandle?: () => Promise<SyncHandle> };

function parts(path: string): { readonly dirs: string[]; readonly name: string } {
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.some((s) => s === '.' || s === '..')) throw new Error(`caminho OPFS inválido: ${path}`);
  const name = segments.pop();
  if (!name) throw new Error(`caminho OPFS vazio: ${path}`);
  return { dirs: segments, name };
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError');
}

/**
 * O VFS do SQLite libera os sync access handles de forma assíncrona depois de fechar a conexão: um arquivo
 * recém-fechado pode recusar remoção/movimento por instantes (NoModificationAllowedError). Repetir algumas vezes.
 */
async function withRetry<T>(body: () => Promise<T>, attempts = 8, delayMs = 150): Promise<T> {
  for (let i = 1; ; i += 1) {
    try {
      return await body();
    } catch (error) {
      const busy = error instanceof DOMException && (error.name === 'NoModificationAllowedError' || error.name === 'InvalidStateError');
      if (!busy || i >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export function opfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}

async function directory(dirs: readonly string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
  let dir = await navigator.storage.getDirectory();
  for (const name of dirs) {
    try {
      dir = await dir.getDirectoryHandle(name, { create });
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }
  return dir;
}

async function fileHandle(path: string, create: boolean): Promise<FileSystemFileHandle | null> {
  const { dirs, name } = parts(path);
  const dir = await directory(dirs, create);
  if (!dir) return null;
  try {
    return await dir.getFileHandle(name, { create });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function opfsExists(path: string): Promise<boolean> {
  return (await fileHandle(path, false)) !== null;
}

export async function opfsRead(path: string): Promise<Uint8Array | null> {
  const handle = await fileHandle(path, false);
  if (!handle) return null;
  return new Uint8Array(await (await handle.getFile()).arrayBuffer());
}

/** Grava o arquivo inteiro (cria diretórios). `createWritable` quando existe; senão sync access handle (worker). */
export async function opfsWrite(path: string, bytes: Uint8Array): Promise<void> {
  const handle = await fileHandle(path, true);
  if (!handle) throw new Error(`não foi possível criar ${path}`);
  if (typeof (handle as { createWritable?: unknown }).createWritable === 'function') {
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes as Uint8Array<ArrayBuffer>);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
    return;
  }
  const sync = (handle as SyncCapable).createSyncAccessHandle;
  if (typeof sync !== 'function') throw new Error('OPFS sem escrita disponível neste contexto');
  const access = await sync.call(handle);
  try {
    access.truncate(0);
    if (access.write(bytes, { at: 0 }) !== bytes.length) throw new Error(`gravação incompleta de ${path}`);
    access.flush();
  } finally {
    access.close();
  }
}

export async function opfsRemove(path: string): Promise<void> {
  const { dirs, name } = parts(path);
  const dir = await directory(dirs, false);
  if (!dir) return;
  try {
    await withRetry(() => dir.removeEntry(name));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

/** Move/renomeia: `FileSystemFileHandle.move` quando o navegador oferece; senão cópia verificada + remoção. */
export async function opfsMove(from: string, to: string): Promise<void> {
  const source = (await fileHandle(from, false)) as MovableHandle | null;
  if (!source) throw new Error(`${from} não existe`);
  const target = parts(to);
  const targetDir = await directory(target.dirs, true);
  if (!targetDir) throw new Error(`não foi possível criar o diretório de ${to}`);
  if (typeof source.move === 'function') {
    const move = source.move.bind(source);
    await opfsRemove(to);
    await withRetry(() => move(targetDir, target.name));
    return;
  }
  const bytes = new Uint8Array(await (await source.getFile()).arrayBuffer());
  await opfsWrite(to, bytes);
  const copied = await opfsRead(to);
  if (!copied || copied.length !== bytes.length) throw new Error(`cópia de ${from} para ${to} incompleta`);
  await opfsRemove(from);
}

export type OpfsEntry = { readonly name: string; readonly path: string; readonly size: number; readonly lastModified: number };

/** Arquivos de um diretório (não recursivo); vazio se o diretório não existe. */
export async function opfsList(dirPath: string): Promise<OpfsEntry[]> {
  const dir = await directory(dirPath.split('/').filter(Boolean), false);
  if (!dir) return [];
  const out: OpfsEntry[] = [];
  const iterable = dir as unknown as { values: () => AsyncIterable<FileSystemHandle> };
  for await (const entry of iterable.values()) {
    if (entry.kind !== 'file') continue;
    const file = await (entry as FileSystemFileHandle).getFile();
    out.push({ name: entry.name, path: `${dirPath.replace(/\/$/, '')}/${entry.name}`, size: file.size, lastModified: file.lastModified });
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

/** Remove um diretório inteiro (recursivo); ausente = nada a fazer. */
export async function opfsRemoveTree(dirPath: string): Promise<void> {
  const { dirs, name } = parts(dirPath);
  const parent = await directory(dirs, false);
  if (!parent) return;
  try {
    await withRetry(() => parent.removeEntry(name, { recursive: true }));
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

/** Estimativa de quota/uso e persistência solicitada (runtime §7.4; interface §31.6). */
export async function storageStatus(): Promise<{ readonly usage: number | null; readonly quota: number | null; readonly persisted: boolean | null }> {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted: boolean | null = null;
  try {
    const estimate = await storage?.estimate?.();
    usage = typeof estimate?.usage === 'number' ? estimate.usage : null;
    quota = typeof estimate?.quota === 'number' ? estimate.quota : null;
  } catch {
    // estimativa indisponível
  }
  try {
    persisted = typeof storage?.persisted === 'function' ? await storage.persisted() : null;
  } catch {
    persisted = null;
  }
  return { usage, quota, persisted };
}

/** Pede persistência ao navegador; não substitui backup externo (runtime §7.4). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    return typeof navigator.storage?.persist === 'function' ? await navigator.storage.persist() : null;
  } catch {
    return null;
  }
}

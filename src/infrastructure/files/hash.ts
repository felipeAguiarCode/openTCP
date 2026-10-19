// SHA-256 de arquivos recebidos/exportados (fingerprint de importação, `databaseSha256` do backup). Usa
// WebCrypto quando disponível (contexto seguro / Node ≥ 20) e cai para a implementação pura do domínio.
import { sha256Hex } from '../../domain/hash/jcs.ts';

export async function sha256HexAsync(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // WebCrypto indisponível neste contexto: usar a implementação pura.
    }
  }
  return sha256Hex(bytes);
}

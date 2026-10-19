// Menu de exportação (editor-de-cartas.md §29): “Exportar imagem” (PNG de apresentação), “Exportar dados”
// (.card.json, sem bytes de mídia) e “Exportar pacote completo” (.cardpack.zip com assets e testes).
import type { GameContext } from '../../../application/context.ts';
import { collectCardpack, exportCardJson, printingsOf } from '../../../application/studio.ts';
import { cardFace, catalogNames } from '../../../domain/cards/text.ts';
import { definitionKey, type CardPrinting } from '../../../domain/cards/types.ts';
import { writeCardJson, writeCardpack } from '../../../infrastructure/files/cardpack.ts';
import { toast } from '../app/store.ts';
import { bundledArtUrl } from '../../assets/card-art.ts';
import { renderCardPng } from './png.ts';
import { downloadBytes, safeFilename } from './shared.tsx';

export async function exportImage(ctx: GameContext, printing: CardPrinting): Promise<void> {
  const content = ctx.content.get();
  try {
    const def = content.catalog.definition(definitionKey(printing.cardDefinitionId, printing.cardDefinitionVersion));
    const face = cardFace(def, printing, catalogNames(content.catalog));
    let url: string | null = null;
    if (printing.artAssetId) {
      const a = await ctx.storage.query({ kind: 'GET_ASSET', assetId: printing.artAssetId });
      if (a) url = URL.createObjectURL(new Blob([a.bytes as unknown as BlobPart], { type: a.mediaType }));
    }
    // Arte empacotada (artKey) não é BLOB: usa o arquivo do pacote, sem object URL.
    const blob = await renderCardPng(face, printing, url ?? bundledArtUrl(printing.artKey));
    if (url) URL.revokeObjectURL(url);
    downloadBytes(new Uint8Array(await blob.arrayBuffer()), `${safeFilename(def.name)}-${safeFilename(printing.collectorNumber)}.png`, 'image/png');
    toast('Imagem exportada (apresentação; não é carta jogável).', 'success');
  } catch (e) {
    toast(`Falha ao exportar imagem: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

export async function exportData(ctx: GameContext, definitionId: string, version: number): Promise<void> {
  const doc = await exportCardJson(ctx, definitionId, version);
  if ('ok' in doc) { toast(doc.message, 'error'); return; }
  downloadBytes(writeCardJson(doc), `${safeFilename(doc.rules.name)}-v${version}.card.json`, 'application/json');
  toast(doc.assetRefs.length ? 'Dados exportados. A arte própria NÃO vai junto: use o pacote completo para levar a carta.' : 'Dados exportados.', 'success');
}

export async function exportPack(ctx: GameContext, keys: readonly { readonly definitionId: string; readonly version: number }[]): Promise<void> {
  const contents = await collectCardpack(ctx, keys);
  if ('ok' in contents) { toast(contents.message, 'error'); return; }
  const zip = writeCardpack(contents);
  const name = keys.length === 1 ? `${safeFilename(contents.cards[0]!.name)}-v${keys[0]!.version}` : `pacote-${keys.length}-cartas`;
  downloadBytes(zip, `${name}.cardpack.zip`, 'application/zip');
  toast(`Pacote exportado: ${contents.cards.length} carta(s), ${contents.printings.length} impressão(ões), ${contents.assets.length} asset(s), ${contents.tests.length} teste(s). Sem saldos nem progresso.`, 'success');
}

export function firstPrinting(ctx: GameContext, definitionId: string, version: number): CardPrinting | null {
  return printingsOf(ctx.content.get(), definitionId, version)[0] ?? null;
}

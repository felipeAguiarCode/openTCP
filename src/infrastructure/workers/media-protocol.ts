// Mensagens tipadas do Media Worker (editor-de-cartas.md §18, §21): importação de arte e de máscaras de foil.
// Bytes viajam como ArrayBuffer transferível; o worker nunca recebe URLs nem toca o banco.

export type MediaAsset = {
  readonly assetId: string;
  readonly mediaType: 'image/png' | 'image/webp';
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
};

export type ArtImport = {
  readonly master: MediaAsset;
  /** Miniatura regenerável (cache; não vai para `assets`). */
  readonly thumbnail: { readonly mediaType: string; readonly bytes: Uint8Array; readonly width: number; readonly height: number };
  readonly source: { readonly mediaType: string; readonly width: number; readonly height: number; readonly bytes: number };
  readonly resized: boolean;
};

export type MaskImport = { readonly mask: MediaAsset; readonly coverage: number };

export type MediaRequest =
  | { readonly id: number; readonly op: 'IMPORT_ART'; readonly bytes: ArrayBuffer }
  | { readonly id: number; readonly op: 'IMPORT_MASK'; readonly bytes: ArrayBuffer; readonly width: number; readonly height: number }
  | { readonly id: number; readonly op: 'MASK_FROM_PIXELS'; readonly rgba: ArrayBuffer; readonly width: number; readonly height: number };

export type MediaError = { readonly ok: false; readonly code: string; readonly message: string };

export type MediaResponse =
  | { readonly id: number; readonly ok: true; readonly op: 'IMPORT_ART'; readonly result: ArtImport }
  | { readonly id: number; readonly ok: true; readonly op: 'IMPORT_MASK' | 'MASK_FROM_PIXELS'; readonly result: MaskImport }
  | ({ readonly id: number } & MediaError);

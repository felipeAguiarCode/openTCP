// API pública da camada Three.js (runtime §12–§23). A UI (Preact) cria um único RenderSystem por canvas
// e os palcos sobre ele; nenhum palco cria outro contexto WebGL.
export {
  createRenderSystem, probeWebGL2, CLEAR_COLOR,
  type RenderSystem, type RenderSystemOptions, type RenderSystemErrorCode, type CreateRenderSystemResult, type RenderDiagnostics,
  type ViewportSpec, type ViewportHandle, type PointerTarget, type CanvasPointer,
} from './core/render-system.ts';
export { type Quality, QUALITY_PROFILES, effectivePixelRatio } from './core/quality.ts';
export {
  cssRectToRendererRect, cssRectToDrawingBuffer, toViewportNdc, clientToCanvas, rectContains, type CssRect, type ClientRect,
} from './core/viewport.ts';
export { createResourceRegistry, createTextureCache, type ResourceRegistry, type TextureCache } from './core/resources.ts';
export { COLORS, TYPE_COLORS, STRIP_COLORS } from './core/tokens.ts';
export { createVisualRng, type VisualRng } from './core/rng.ts';

export {
  createCardVisual, PICK_LAYER,
  type CardVisual, type CardDescriptor, type MarkerState, type FaceVisibility, type PickTarget,
} from './card/card-visual.ts';
export { DEFAULT_SLEEVE, drawCardFace, templateKindOf, type SleeveStyle, type TemplateKind } from './card/face-canvas.ts';
export { type FinishKind } from './card/finish-material.ts';
export { loadCardFonts, cardFontsReady, CARD_FONT_STACK } from './card/fonts.ts';
export { acquireFaceTexture, faceTextureKey, type FaceResolution } from './card/textures.ts';

export {
  createBattleStage,
  type BattleStage, type BattleStageOptions, type PresentBatch, type Highlights, type DragIntent, type DragDenied, type AnchorRect, type ResolvedCard,
  type BattleStageDiagnostics,
} from './battle/battle-stage.ts';
export { type BattleCue } from './battle/executors.ts';
export {
  resolveDisplayedPlaymat, sleeveStyleOf, NEUTRAL_PLAYMAT, DEFAULT_PRESENTATION,
  type BattlePresentationInput, type CosmeticsLoadout, type CosmeticVisualInput, type PlaymatDisplayMode, type DisplayedPlaymat,
} from './battle/playmat.ts';
export {
  MAT_IMAGE_OPACITY, coverBox4x3, cropTexCoord, matImageKey, type MatImageSource, type MatImageStatus,
} from './battle/mat-image.ts';
export {
  ANCHOR_IDS, SLOT_ANCHOR_IDS, PROFILES, selectFrame, fitBounds, computeAnchors,
  type AnchorId, type LayoutProfileId, type LayoutFrame, type BattleProfile,
} from './battle/layout.ts';
export { handFanLayout, handFocusPose, type HandSlot } from './battle/hand-layout.ts';
export { coinPoseAt, type CoinFace } from './battle/coin-math.ts';

// Palcos de painel (mesmo RenderSystem; cada um registra seu viewport no retângulo CSS que a UI define).
export { createPanelStage, type PanelStage, type StageBackground } from './stages/stage-base.ts';
export {
  createCardInspectorStage, clampInspectorRotation, INSPECTOR_LIMITS,
  type CardInspectorStage, type CardInspectorOptions, type InspectorSide,
} from './stages/card-inspector.ts';
export {
  createPackOpeningStage, type PackOpeningStage, type PackOpeningOptions, type PackProductInput, type PackPick,
} from './stages/pack-opening.ts';
export { isSpecialReveal, revealPresetFor, packReduce, summaryGrid, type PackPhase, type PackState } from './stages/pack-sequence.ts';
export {
  createCampaignMapStage, nodeShape, type CampaignMapStage, type CampaignMapOptions, type MapNodeInput, type MapPick, type MapStatuses,
} from './stages/campaign-map.ts';
export { ISLAND_CENTERS, nodeWorld, islandBounds, mapEdges, clampMapView, fitOrthoHalfHeight, panDelta, type MapView } from './stages/map-layout.ts';
export { createShowcaseStage, showcasePoses, type ShowcaseStage, type ShowcaseOptions, type ShowcaseCard, type ShowcasePick } from './stages/showcase.ts';
export { createDiscoveryStage, discoveryPositions, type DiscoveryStage, type DiscoveryOptions } from './stages/discovery.ts';
export { CHAPTER_THEMES, themeOf, themeOfProduct, type ChapterTheme, type BiomeId } from './stages/themes.ts';
export { type DeckBoxInput } from './stages/props.ts';
export { createStagePresenter, type StagePresenter, type ConfirmedUpdate } from './battle/presenter.ts';

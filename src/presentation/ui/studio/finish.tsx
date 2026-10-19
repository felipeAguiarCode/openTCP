// Aba Acabamento (editor-de-cartas.md §20–§21): um único `finish` exclusivo por impressão (nunca flags
// paralelas), presets, parâmetros limitados pelo schema, máscara de foil (área da arte, importada ou pintada
// num Canvas 2D auxiliar) e proteção de texto sempre ligada. Acabamento nunca muda regras, pontos ou raridade.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameContext } from '../../../application/context.ts';
import { storeAsset } from '../../../application/studio.ts';
import type { CardPrinting, Finish } from '../../../domain/cards/types.ts';
import { DEFAULT_PRESET_BY_FINISH, FINISH_PRESETS, FINISHES, withDerivedBindings, withFinish, withPreset, type EditorDraft, type FinishPresetId } from '../../../domain/editor/draft.ts';
import { toast } from '../app/store.ts';
import { finishLabel } from '../components/cards.tsx';
import { Button, Segmented } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import type { Updater } from './forms.tsx';
import { CheckField, mediaClient, pickFile, RangeField, Section, SelectField, useAssetUrl, type Path } from './shared.tsx';

type FS = CardPrinting['finishSettings'];

const MASK_W = 252;
const MASK_H = 352;
/** Janela de arte do template pocket-light-card-v1 em coordenadas normalizadas da carta. */
const ART_WINDOW = { x: 0.07, y: 0.12, w: 0.86, h: 0.36 };
/** Regiões de texto protegidas (nome/HP, corpo, rodapé). */
const TEXT_REGIONS = [{ x: 0.03, y: 0.03, w: 0.94, h: 0.08 }, { x: 0.05, y: 0.5, w: 0.9, h: 0.45 }];

function MaskPainter({ onApply, busy }: { readonly onApply: (rgba: Uint8ClampedArray, w: number, h: number) => void; readonly busy: boolean }): JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'BRUSH' | 'ERASER'>('BRUSH');
  const [size, setSize] = useState(18);
  const [hardness, setHardness] = useState(0.7);
  const [overlay, setOverlay] = useState(true);
  const undo = useRef<ImageData[]>([]);
  const redo = useRef<ImageData[]>([]);
  const drawing = useRef(false);
  const g = () => canvas.current?.getContext('2d', { willReadFrequently: true }) ?? null;
  const snapshot = () => { const c = g(); if (c) { undo.current.push(c.getImageData(0, 0, MASK_W, MASK_H)); if (undo.current.length > 30) undo.current.shift(); redo.current = []; } };
  const fill = (color: string, region?: { x: number; y: number; w: number; h: number }) => {
    const c = g();
    if (!c) return;
    snapshot();
    c.fillStyle = color;
    if (region) c.fillRect(region.x * MASK_W, region.y * MASK_H, region.w * MASK_W, region.h * MASK_H);
    else c.fillRect(0, 0, MASK_W, MASK_H);
  };
  useEffect(() => { const c = g(); if (c) { c.fillStyle = '#000'; c.fillRect(0, 0, MASK_W, MASK_H); } }, []);
  const stroke = (e: PointerEvent) => {
    const c = g();
    const el = canvas.current;
    if (!c || !el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * MASK_W;
    const y = ((e.clientY - rect.top) / rect.height) * MASK_H;
    const grad = c.createRadialGradient(x, y, 0, x, y, size);
    const color = tool === 'BRUSH' ? '255,255,255' : '0,0,0';
    grad.addColorStop(0, `rgba(${color},1)`);
    grad.addColorStop(Math.max(0.01, hardness), `rgba(${color},1)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = grad;
    c.beginPath();
    c.arc(x, y, size, 0, Math.PI * 2);
    c.fill();
  };
  const restore = (from: { current: ImageData[] }, to: { current: ImageData[] }) => {
    const c = g();
    const img = from.current.pop();
    if (!c || !img) return;
    to.current.push(c.getImageData(0, 0, MASK_W, MASK_H));
    c.putImageData(img, 0, 0);
  };
  return (
    <div class="studio-mask-painter">
      <div class="studio-mask-stage">
        <canvas ref={canvas} width={MASK_W} height={MASK_H} class="studio-mask-canvas" aria-label="Máscara de foil: branco permite acabamento, preto bloqueia"
          onPointerDown={(e) => { snapshot(); drawing.current = true; (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); stroke(e); }}
          onPointerMove={(e) => { if (drawing.current) stroke(e); }}
          onPointerUp={() => { drawing.current = false; }} />
        {overlay ? <div class="studio-mask-overlay" aria-hidden="true">{TEXT_REGIONS.map((r, i) => <span key={i} style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} />)}</div> : null}
      </div>
      <div class="stack">
        <Segmented label="Ferramenta" value={tool} onChange={setTool} options={[{ id: 'BRUSH', label: 'Pincel' }, { id: 'ERASER', label: 'Borracha' }]} />
        <RangeField label="Tamanho" value={size} min={2} max={60} step={1} onChange={setSize} format={(v) => `${v}px`} />
        <RangeField label="Dureza" value={hardness} min={0.05} max={1} step={0.05} onChange={setHardness} />
        <CheckField label="Mostrar regiões de texto protegidas" checked={overlay} onChange={setOverlay} />
        <div class="row">
          <Button size="sm" onClick={() => restore(undo, redo)}>Desfazer traço</Button>
          <Button size="sm" onClick={() => restore(redo, undo)}>Refazer traço</Button>
        </div>
        <div class="row">
          <Button size="sm" onClick={() => fill('#000')}>Limpar</Button>
          <Button size="sm" onClick={() => fill('#fff', ART_WINDOW)}>Preencher área da arte</Button>
          <Button size="sm" onClick={() => fill('#fff')}>Carta inteira</Button>
        </div>
        <small class="muted">Alternativa sem pintura fina: use os preenchimentos por região. A proteção de texto do template vale sempre.</small>
        <Button variant="primary" loading={busy} onClick={() => { const c = g(); if (c) onApply(c.getImageData(0, 0, MASK_W, MASK_H).data, MASK_W, MASK_H); }}>Aplicar máscara pintada</Button>
      </div>
    </div>
  );
}

export function FinishTab({ ctx, draft, index, update, reducedMotion, onMaskStored }: {
  readonly ctx: GameContext; readonly draft: EditorDraft; readonly index: number; readonly update: Updater; readonly reducedMotion: boolean; readonly onMaskStored: () => void;
}): JSX.Element {
  const p = draft.printings[index];
  const maskUrl = useAssetUrl(ctx, p?.finishSettings.foilMaskAssetId ?? null);
  const [busy, setBusy] = useState(false);
  if (!p) return <p class="muted">Crie uma impressão para configurar o acabamento.</p>;
  const path: Path = ['printings', index, 'finishSettings'];
  const fs = p.finishSettings;
  const setP = (fn: (x: CardPrinting) => CardPrinting, key?: string) => update((d) => ({ ...d, printings: d.printings.map((x, k) => (k === index ? withDerivedBindings(fn(x)) : x)) }), key);
  const setFs = (patch: Partial<FS>, key?: string) => setP((x) => ({ ...x, finishSettings: { ...x.finishSettings, ...patch } as FS }), key);
  const storeMask = async (r: Awaited<ReturnType<ReturnType<typeof mediaClient>['maskFromPixels']>>, mode: 'IMPORTED' | 'PAINTED') => {
    if (!r.ok) { toast(`Máscara recusada: ${r.message} A máscara anterior foi mantida.`, 'error', 6000); return; }
    const stored = await storeAsset(ctx, { assetId: r.mask.assetId, mediaType: r.mask.mediaType, bytes: r.mask.bytes, width: r.mask.width, height: r.mask.height, metadata: { role: 'FOIL_MASK', coverage: r.coverage } });
    if (!stored.ok) { toast(stored.message, 'error'); return; }
    // Editar a máscara cria outro asset/hash; outras impressões não mudam (ED-050).
    update((d) => ({
      ...d,
      printings: d.printings.map((x, k) => (k === index ? withDerivedBindings({ ...x, finishSettings: { ...x.finishSettings, maskMode: mode, foilMaskAssetId: r.mask.assetId } }) : x)),
      authoring: mode === 'PAINTED' ? { ...d.authoring, maskPaint: { printingId: p.printingId, maskAssetId: r.mask.assetId } } : d.authoring,
    }));
    onMaskStored();
    toast(r.coverage > 0.6 ? `Máscara aplicada (cobre ${Math.round(r.coverage * 100)}% da carta: verifique a leitura).` : 'Máscara aplicada.', r.coverage > 0.6 ? 'warning' : 'success');
  };
  const importMask = async () => {
    const file = await pickFile('image/png,image/jpeg,image/webp');
    if (!file) return;
    setBusy(true);
    try { await storeMask(await mediaClient().importMask(file, MASK_W, MASK_H), 'IMPORTED'); } finally { setBusy(false); }
  };
  const applyPainted = async (rgba: Uint8ClampedArray, w: number, h: number) => {
    setBusy(true);
    try { await storeMask(await mediaClient().maskFromPixels(rgba, w, h), 'PAINTED'); } finally { setBusy(false); }
  };
  const presets = (Object.keys(FINISH_PRESETS) as FinishPresetId[]);
  const normal = p.finish === 'NORMAL';
  return (
    <div class="stack">
      <Section title="Perfil de impressão" path={['printings', index, 'finish']}>
        <Segmented label="Acabamento" value={p.finish} options={FINISHES.map((f) => ({ id: f, label: finishLabel(f) }))} onChange={(f) => setP((x) => withFinish(x, f as Finish))} />
        <small class="muted">Normal, holográfico, foil e cromado são impressões da mesma regra: não mudam ataques, pontos, regra ex nem raridade.</small>
        <SelectField label="Preset" value={(fs.presetId as FinishPresetId) ?? DEFAULT_PRESET_BY_FINISH[p.finish]} options={presets.map((id) => ({ value: id, label: `${FINISH_PRESETS[id].label} (${finishLabel(FINISH_PRESETS[id].finish)})` }))}
          onChange={(id) => setP((x) => withPreset(x, id))} path={[...path, 'presetId']} />
      </Section>
      <Section title="Parâmetros" path={path}>
        <div class="studio-grid-2">
          <RangeField label="Intensidade" value={fs.intensity} min={0} max={1} step={0.05} disabled={normal} onChange={(intensity) => setFs({ intensity }, 'fs-intensity')} path={[...path, 'intensity']}
            format={(v) => (normal ? '0 (NORMAL)' : v.toFixed(2))} />
          <RangeField label="Roughness" value={fs.roughness} min={0.05} max={1} step={0.05} onChange={(roughness) => setFs({ roughness }, 'fs-rough')} />
          <RangeField label="Metalness" value={fs.metalness} min={0} max={1} step={0.05} onChange={(metalness) => setFs({ metalness }, 'fs-metal')} />
          {!normal ? <RangeField label="Ângulo do padrão" value={fs.patternAngleDegrees ?? 0} min={-180} max={180} step={5} onChange={(patternAngleDegrees) => setFs({ patternAngleDegrees }, 'fs-angle')} format={(v) => `${v}°`} /> : null}
          {!normal ? <RangeField label="Escala do padrão" value={fs.patternScale ?? 1} min={0.25} max={8} step={0.25} onChange={(patternScale) => setFs({ patternScale }, 'fs-scale')} /> : null}
          {!normal ? <RangeField label="Velocidade ambiente" value={fs.ambientSpeed ?? 0} min={0} max={0.25} step={0.01} onChange={(ambientSpeed) => setFs({ ambientSpeed }, 'fs-speed')} /> : null}
          {!normal ? <RangeField label="Resposta à inclinação" value={fs.tiltResponse ?? 0} min={0} max={1} step={0.05} onChange={(tiltResponse) => setFs({ tiltResponse }, 'fs-tilt')} /> : null}
          <RangeField label="Normal strength" value={fs.normalStrength ?? 0} min={0} max={1} step={0.05} onChange={(normalStrength) => setFs({ normalStrength }, 'fs-normal')} />
          <RangeField label="Brilho emissivo" value={fs.emissive ?? 0} min={0} max={0.25} step={0.01} onChange={(emissive) => setFs({ emissive }, 'fs-emissive')} />
        </div>
        {p.finish === 'FOIL' || p.finish === 'HOLOGRAPHIC' ? (
          <SelectField label="Paleta do foil" value={fs.foilPalette ?? 'SPECTRAL'} options={[{ value: 'SPECTRAL', label: 'Espectral' }, { value: 'PASTEL', label: 'Pastel' }, { value: 'SILVER', label: 'Prata' }, { value: 'GOLD', label: 'Dourada' }]}
            onChange={(foilPalette) => setFs({ foilPalette: foilPalette as FS['foilPalette'] })} />
        ) : null}
        {p.finish === 'CHROME' ? (
          <SelectField label="Ambiente do cromado" value={fs.chromeEnvironment ?? 'STUDIO_LIGHT'} options={[{ value: 'STUDIO_LIGHT', label: 'Luz de estúdio' }, { value: 'TABLE_LIGHT', label: 'Luz da mesa' }, { value: 'NEUTRAL', label: 'Neutro' }]}
            onChange={(chromeEnvironment) => setFs({ chromeEnvironment: chromeEnvironment as FS['chromeEnvironment'] })} />
        ) : null}
        <p class="studio-callout"><Icon name="lock" size={14} /> Proteção de texto: sempre ligada (nome, HP, custos, regras e caixa ex nunca recebem brilho que destrua a leitura).</p>
        {reducedMotion ? <p class="muted small">Movimento reduzido: a prévia fica estática, mas as configurações de acabamento são preservadas.</p> : null}
      </Section>
      <Section title="Máscara de foil" path={[...path, 'maskMode']}>
        <Segmented label="Modo da máscara" value={fs.maskMode} options={[{ id: 'ART_WINDOW', label: 'Somente área da ilustração' }, { id: 'IMPORTED', label: 'Importada' }, { id: 'PAINTED', label: 'Pintada' }]}
          onChange={(maskMode) => setFs(maskMode === 'ART_WINDOW' ? { maskMode, foilMaskAssetId: undefined } : { maskMode })} />
        {fs.maskMode !== 'ART_WINDOW' && !fs.foilMaskAssetId ? <p class="field-error">Máscara importada ou pintada exige o arquivo da máscara.</p> : null}
        {maskUrl && maskUrl !== 'MISSING' ? <img class="studio-mask-thumb" src={maskUrl} alt="Máscara atual em tons de cinza" /> : null}
        {fs.maskMode === 'IMPORTED' ? <Button icon="upload" loading={busy} onClick={() => void importMask()}>Importar máscara (tons de cinza)</Button> : null}
        {fs.maskMode === 'PAINTED' ? <MaskPainter busy={busy} onApply={(rgba, w, h) => void applyPainted(rgba, w, h)} /> : null}
      </Section>
    </div>
  );
}

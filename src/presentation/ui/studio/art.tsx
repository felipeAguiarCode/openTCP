// Aba Arte (editor-de-cartas.md §18–§19): impressões da carta (normal, holo, foil, cromada — cada uma uma
// impressão distinta da MESMA versão funcional), importação local de ilustração pelo Media Worker,
// modos de arte, recorte e transformação não destrutivos, template compatível, conjunto, número e artista.
import type { JSX } from 'preact';
import type { GameContext } from '../../../application/context.ts';
import { storeAsset } from '../../../application/studio.ts';
import type { CardPrinting, Finish, Rarity } from '../../../domain/cards/types.ts';
import {
  compatibleTemplates, FINISHES, newPrinting, RARITIES, TEMPLATE_LABEL, uniqueId, withDerivedBindings, withFinish, type EditorDraft, type TemplateId,
} from '../../../domain/editor/draft.ts';
import { confirmDialog, toast } from '../app/store.ts';
import { finishLabel, rarityLabel } from '../components/cards.tsx';
import { Button, Segmented } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { CheckField, mediaClient, pickFile, RangeField, Section, SelectField, TextField, type Path } from './shared.tsx';
import type { Updater } from './forms.tsx';

const ART_MODES: readonly { id: CardPrinting['artMode']; label: string; hint: string }[] = [
  { id: 'ART_WINDOW', label: 'Ilustração em janela', hint: 'A imagem ocupa a janela de arte; moldura e regras vêm do template.' },
  { id: 'FULL_ART', label: 'Arte completa', hint: 'A imagem se estende; as áreas de texto recebem proteção de leitura.' },
  { id: 'FULL_PRINTING', label: 'Impressão completa', hint: 'O arquivo já contém a carta visual. O texto da imagem NÃO vira regra: revise a correspondência.' },
  { id: 'TEMPLATE_ONLY', label: 'Sem arte', hint: 'Template + nome + dados com placeholder tipado. Publicável.' },
];

export function PrintingTabs({ draft, selected, onSelect, update, locked }: {
  readonly draft: EditorDraft; readonly selected: number; readonly onSelect: (i: number) => void; readonly update: Updater; readonly locked?: boolean;
}): JSX.Element {
  const add = (finish: Finish) => {
    // Atualização funcional: a nova impressão copia o estado ATUAL da impressão selecionada (arte inclusa).
    update((d) => {
      const base = d.printings[selected] ?? d.printings[0];
      const taken = d.printings.map((p) => p.printingId);
      const fresh = base
        ? { ...withFinish(base, finish), printingId: uniqueId(`${base.printingId.replace(/-(normal|holographic|foil|chrome|holog|holo)(-[a-z0-9]+)?$/, '')}-${finish.toLowerCase().slice(0, 5)}`, taken, 100),
          collectorNumber: `${base.collectorNumber.replace(/[A-Z]+$/, '')}${finish === 'NORMAL' ? '' : finish[0]}`.slice(0, 12) }
        : newPrinting({ rules: d.rules, definitionId: d.target.definitionId, version: d.target.version, finish, token: String(d.printings.length + 1), setId: d.authoring.setId, collectorNumber: '001' });
      return { ...d, printings: [...d.printings, withDerivedBindings(fresh)] };
    });
    onSelect(draft.printings.length);
  };
  const remove = async (i: number) => {
    const p = draft.printings[i]!;
    if (!(await confirmDialog({ title: 'Remover impressão?', body: `${finishLabel(p.finish)} ${p.setId.toUpperCase()} ${p.collectorNumber} sai do rascunho. A arte importada continua no armazenamento local.`, confirmLabel: 'Remover', tone: 'danger' }))) return;
    update((d) => ({ ...d, printings: d.printings.filter((_, k) => k !== i) }));
    onSelect(Math.max(0, i - 1));
  };
  return (
    <div class="studio-printings" role="group" aria-label="Impressões">
      <ul class="row">
        {draft.printings.map((p, i) => (
          <li key={p.printingId}>
            <button type="button" class={`chip ${i === selected ? 'is-active' : ''}`} aria-pressed={i === selected} onClick={() => onSelect(i)}>
              {finishLabel(p.finish)} · {p.collectorNumber}
            </button>
          </li>
        ))}
      </ul>
      <div class="row">
        <span class="muted small">Nova impressão:</span>
        {FINISHES.map((f) => <Button key={f} size="sm" icon="plus" disabledReason={draft.printings.length >= 8 ? 'Até 8 impressões por projeto' : null} onClick={() => add(f)}>{finishLabel(f)}</Button>)}
        {draft.printings.length > 1 && !locked ? <Button size="sm" variant="ghost" icon="trash" onClick={() => void remove(selected)}>Remover esta</Button> : null}
      </div>
    </div>
  );
}

export function ArtTab({ ctx, draft, index, update, onArtImported }: {
  readonly ctx: GameContext; readonly draft: EditorDraft; readonly index: number; readonly update: Updater; readonly onArtImported: () => void;
}): JSX.Element {
  const p = draft.printings[index];
  if (!p) return <p class="muted">Crie uma impressão para configurar a arte.</p>;
  const path: Path = ['printings', index];
  const setP = (patch: Partial<CardPrinting>, key?: string) => update((d) => ({ ...d, printings: d.printings.map((x, k) => (k === index ? withDerivedBindings({ ...x, ...patch }) : x)) }), key);
  const importArt = async () => {
    const file = await pickFile('image/png,image/jpeg,image/webp');
    if (!file) return;
    const r = await mediaClient().importArt(file);
    if (!r.ok) { toast(`Imagem recusada: ${r.message} A arte anterior foi mantida.`, 'error', 6000); return; }
    const stored = await storeAsset(ctx, { assetId: r.master.assetId, mediaType: r.master.mediaType, bytes: r.master.bytes, width: r.master.width, height: r.master.height,
      metadata: { source: 'studio-import', original: r.source } });
    if (!stored.ok) { toast(`Não foi possível gravar a arte: ${stored.message}`, 'error'); return; }
    let keepMask = true;
    if (p.finishSettings.maskMode !== 'ART_WINDOW' && p.finishSettings.foilMaskAssetId) {
      keepMask = await confirmDialog({
        title: 'Manter a máscara de foil?', confirmLabel: 'Manter máscara', cancelLabel: 'Reiniciar máscara',
        body: ['A arte mudou. Mantenha a máscara só se o alinhamento continua válido.', 'Reiniciar volta para “Somente área da ilustração”.'],
      });
    }
    setP({
      artAssetId: r.master.assetId, artKey: null, artMode: p.artMode === 'TEMPLATE_ONLY' ? 'ART_WINDOW' : p.artMode,
      ...(keepMask ? {} : { finishSettings: { ...p.finishSettings, maskMode: 'ART_WINDOW', foilMaskAssetId: undefined } }),
    });
    onArtImported();
    toast(`Arte importada (${r.source.width}×${r.source.height}${r.resized ? `, normalizada para ${r.master.width}×${r.master.height}` : ''}).`, 'success');
  };
  const t = p.artTransform;
  const c = p.crop;
  const setT = (patch: Partial<CardPrinting['artTransform']>) => setP({ artTransform: { ...t, ...patch } }, `transform-${index}`);
  const setC = (patch: Partial<CardPrinting['crop']>) => {
    const next = { ...c, ...patch };
    next.width = Math.min(next.width, 1 - next.x);
    next.height = Math.min(next.height, 1 - next.y);
    setP({ crop: next }, `crop-${index}`);
  };
  const templates = compatibleTemplates(draft.rules);
  return (
    <div class="stack">
      <Section title="Ilustração" path={[...path, 'artAssetId']}>
        <Segmented label="Modo de arte" value={p.artMode} options={ART_MODES.map((m) => ({ id: m.id, label: m.label }))}
          onChange={(artMode) => setP(artMode === 'TEMPLATE_ONLY' ? { artMode, artAssetId: null, artKey: null } : { artMode })} />
        <small class="muted">{ART_MODES.find((m) => m.id === p.artMode)?.hint}</small>
        {p.artMode === 'FULL_PRINTING' ? <p class="studio-callout warn"><Icon name="warning" size={16} /> O Estúdio não lê texto da imagem: confira que a arte corresponde às regras configuradas.</p> : null}
        <div class="row">
          <Button icon="upload" variant="primary" onClick={() => void importArt()} testId="import-art">Importar ilustração local</Button>
          {p.artAssetId ? <span class="muted small" title={p.artAssetId}>Arte: {p.artAssetId.slice(0, 12)}… (SHA-256)</span> : <span class="muted small">Sem arte importada.</span>}
          {p.artAssetId ? <Button size="sm" variant="ghost" onClick={() => setP({ artAssetId: null, artMode: 'TEMPLATE_ONLY' })}>Remover arte</Button> : null}
        </div>
        <small class="muted">PNG, JPEG ou WebP estáticos, até 10 MiB, 4096 px por eixo e 16,7 milhões de pixels. Sem rede: o arquivo é processado localmente.</small>
      </Section>
      {p.artMode !== 'TEMPLATE_ONLY' ? (
        <Section title="Recorte e transformação (não destrutivos)" path={[...path, 'crop']}>
          <div class="studio-grid-2">
            <RangeField label="Recorte X" value={c.x} min={0} max={0.9} step={0.01} onChange={(x) => setC({ x })} path={[...path, 'crop', 'x']} />
            <RangeField label="Recorte Y" value={c.y} min={0} max={0.9} step={0.01} onChange={(y) => setC({ y })} path={[...path, 'crop', 'y']} />
            <RangeField label="Largura do recorte" value={c.width} min={0.1} max={1} step={0.01} onChange={(width) => setC({ width })} path={[...path, 'crop', 'width']} />
            <RangeField label="Altura do recorte" value={c.height} min={0.1} max={1} step={0.01} onChange={(height) => setC({ height })} path={[...path, 'crop', 'height']} />
            <RangeField label="Escala" value={t.scale} min={0.25} max={4} step={0.05} onChange={(scale) => setT({ scale })} format={(v) => `${v.toFixed(2)}×`} />
            <RangeField label="Rotação" value={t.rotationDegrees} min={-15} max={15} step={1} onChange={(rotationDegrees) => setT({ rotationDegrees })} format={(v) => `${v}°`} />
            <RangeField label="Deslocamento X" value={t.offsetX} min={-1} max={1} step={0.02} onChange={(offsetX) => setT({ offsetX })} />
            <RangeField label="Deslocamento Y" value={t.offsetY} min={-1} max={1} step={0.02} onChange={(offsetY) => setT({ offsetY })} />
            <RangeField label="Exposição" value={t.exposure} min={-1} max={1} step={0.05} onChange={(exposure) => setT({ exposure })} />
          </div>
          <div class="row">
            <CheckField label="Espelhar só a ilustração" hint="nunca textos ou HP" checked={t.mirrorIllustration} onChange={(mirrorIllustration) => setT({ mirrorIllustration })} />
            <Button size="sm" icon="refresh" onClick={() => setP({ crop: { x: 0, y: 0, width: 1, height: 1 }, artTransform: { scale: 1, offsetX: 0, offsetY: 0, rotationDegrees: 0, mirrorIllustration: false, exposure: 0 } })}>Restabelecer</Button>
          </div>
        </Section>
      ) : null}
      <Section title="Impressão" path={[...path, 'templateId']}>
        <div class="studio-grid-2">
          <SelectField label="Template" value={p.templateId as TemplateId} options={templates.map((tpl) => ({ value: tpl, label: TEMPLATE_LABEL[tpl] }))} onChange={(templateId) => setP({ templateId })} path={[...path, 'templateId']} />
          <SelectField label="Raridade" value={p.rarity} options={RARITIES.map((r) => ({ value: r, label: rarityLabel(r) }))} onChange={(rarity) => setP({ rarity: rarity as Rarity })} path={[...path, 'rarity']}
            hint="Não altera chances de pacotes nem regras (ED-047)." />
          <TextField label="Conjunto (setId)" value={p.setId} max={40} onChange={(setId) => setP({ setId }, `set-${index}`)} path={[...path, 'setId']} />
          <TextField label="Número (collectorNumber)" value={p.collectorNumber} max={12} onChange={(collectorNumber) => setP({ collectorNumber }, `num-${index}`)} path={[...path, 'collectorNumber']} />
          <TextField label="Crédito de arte" value={p.artist ?? ''} max={80} onChange={(artist) => setP({ artist: artist || null }, `artist-${index}`)} path={[...path, 'artist']} />
          <div class="sf"><span class="sf-label">Versão de aparência</span><output class="studio-derived">appearanceVersion {p.appearanceVersion}</output></div>
        </div>
      </Section>
    </div>
  );
}

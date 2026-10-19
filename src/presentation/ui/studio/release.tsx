// S47 — Release imutável (editor-de-cartas.md §27–§29): a versão publicada, suas impressões (normal/holo/
// foil/cromada da MESMA regra), diff contra a versão anterior e ações: nova versão, variante, fork,
// exportar (imagem/dados/pacote), conceder cópias a perfil CUSTOM/LAB (GRANT_CUSTOM_COPIES com lote estável)
// e arquivar versão/impressão. Versão publicada nunca recebe UPDATE.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { createProject, grantCustomCopies, grantEligibility, releaseView, setCatalogArchived, type CreateProjectInput } from '../../../application/studio.ts';
import { cardFace, catalogNames } from '../../../domain/cards/text.ts';
import type { CardPrinting } from '../../../domain/cards/types.ts';
import { changeText } from '../../../domain/editor/diff.ts';
import { refreshCustomCatalog } from '../app/boot.ts';
import { go } from '../app/router.ts';
import { content, inventory, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, finishLabel, rarityLabel } from '../components/cards.tsx';
import { Button, EmptyState, KeyValue, PageHeader, Panel } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { exportData, exportImage, exportPack } from './exports.ts';
import { artOf, NumberField, useAssetUrl } from './shared.tsx';

function PrintingCard({ printing, onGrant, grantBlocked, owned, onArchive }: {
  readonly printing: CardPrinting; readonly onGrant: (qty: number) => void; readonly grantBlocked: string | null; readonly owned: number; readonly onArchive: () => void;
}): JSX.Element {
  const ctx = requireCtx();
  const c = content.value!;
  const def = c.catalog.definition(`${printing.cardDefinitionId}@${printing.cardDefinitionVersion}`);
  const url = useAssetUrl(ctx, printing.artMode !== 'TEMPLATE_ONLY' ? printing.artAssetId : null);
  const [qty, setQty] = useState(2);
  return (
    <article class="studio-printing-card">
      <CardFace face={cardFace(def, printing, catalogNames(c.catalog))} size="md" art={artOf(printing, url)} quantity={owned || undefined} />
      <KeyValue items={[
        ['Impressão', printing.printingId], ['Acabamento', finishLabel(printing.finish)], ['Raridade', rarityLabel(printing.rarity)],
        ['Conjunto / número', `${printing.setId} ${printing.collectorNumber}`], ['Template', printing.templateId], ['No inventário', String(owned)],
      ]} />
      <div class="row">
        <NumberField label="Cópias" value={qty} min={1} max={20} onChange={(v) => setQty(Math.max(1, Math.min(20, v ?? 2)))} />
        <Button variant="primary" disabledReason={grantBlocked} onClick={() => onGrant(qty)}>Adicionar {qty} cópia(s)</Button>
      </div>
      <div class="row">
        <Button size="sm" variant="ghost" icon="download" onClick={() => void exportImage(ctx, printing)}>Exportar imagem</Button>
        <Button size="sm" variant="ghost" onClick={onArchive}>Arquivar impressão</Button>
      </div>
    </article>
  );
}

export function StudioRelease({ definitionId, version }: { readonly definitionId: string; readonly version: number }): JSX.Element {
  const ctx = requireCtx();
  const c = content.value;
  const snap = snapshot.value;
  const [batches, setBatches] = useState<Record<string, string>>({});
  const view = c ? releaseView(c, definitionId, version) : null;
  if (!c || !snap) return <EmptyState title="Carregando…" />;
  if (!view) return <EmptyState title="Versão não encontrada" text="A release pode pertencer a outro perfil ou estar fora do catálogo local." action={<Button onClick={() => go('S43')}>Estúdio</Button>} />;
  const d = view.definition;
  const create = async (input: CreateProjectInput) => {
    const r = await createProject(ctx, input);
    if (!r.ok) { toast(r.message, 'error'); return; }
    go('S44', { projectId: r.projectId });
  };
  const grant = async (printing: CardPrinting, quantity: number) => {
    // O lote é estável por impressão até dar certo: repetir o clique após falha não duplica cópias.
    const grantBatchId = batches[printing.printingId] ?? ctx.platform.newId('grant');
    setBatches({ ...batches, [printing.printingId]: grantBatchId });
    const r = await grantCustomCopies(ctx, { printingId: printing.printingId, quantity, grantBatchId });
    if (!r.ok) { toast(`${r.message} Repita para usar o mesmo lote.`, 'error'); return; }
    toast(r.status === 'ALREADY_GRANTED' ? 'Este lote já tinha sido concedido; nada foi duplicado.' : `${r.quantity} cópia(s) adicionada(s) ao perfil ${snap.profile.displayName}.`, 'success');
    const next = { ...batches };
    delete next[printing.printingId];
    setBatches(next);
  };
  const archive = async (kind: 'VERSION' | 'PRINTING', id: string, v: number) => {
    const r = await setCatalogArchived(ctx, kind, id, v, true);
    if (!r.ok) { toast(r.message, 'error'); return; }
    await refreshCustomCatalog(snap.profile.profileId);
    toast('Arquivado: sai das novas escolhas sem quebrar replays e coleções.', 'success');
  };
  return (
    <div class="studio-release">
      <PageHeader title={`${d.name} · v${d.version}`} backTo="/card-studio" subtitle={view.isBase ? 'Catálogo base — somente leitura.' : 'Release publicada e imutável. Corrigir regras cria nova versão; trocar arte cria variante.'}
        actions={(
          <>
            {!view.isBase ? <Button onClick={() => void create({ mode: 'NEW_VERSION', sourceDefinitionId: d.id, sourceVersion: d.version })}>Nova versão</Button> : null}
            <Button onClick={() => void create({ mode: 'VARIANT', sourceDefinitionId: d.id, sourceVersion: d.version })}>Variante visual</Button>
            <Button onClick={() => void create({ mode: 'FORK', sourceDefinitionId: d.id, sourceVersion: d.version })}>{view.isBase ? 'Editar como cópia' : 'Duplicar como nova'}</Button>
          </>
        )} />
      <div class="row">
        <span class="badge">Versões: {view.versions.map((v) => (v === version ? `v${v} (esta)` : `v${v}`)).join(' · ')}</span>
        {view.versions.filter((v) => v !== version).map((v) => <Button key={v} size="sm" variant="ghost" onClick={() => go('S47', { definitionId, version: v })}>Ver v{v}</Button>)}
        {!view.isBase ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => void exportData(ctx, d.id, d.version)}>Exportar dados (.card.json)</Button>
            <Button size="sm" variant="ghost" onClick={() => void exportPack(ctx, [{ definitionId: d.id, version: d.version }])}>Exportar pacote completo</Button>
            <Button size="sm" variant="ghost" onClick={() => void archive('VERSION', d.id, d.version)}>Arquivar versão</Button>
          </>
        ) : null}
      </div>
      {snap.profile.progressionMode === 'STANDARD' ? <p class="studio-callout"><Icon name="info" size={14} /> Perfil STANDARD: cópias autorais só entram em perfis CUSTOM ou LAB.</p> : null}
      <div class="studio-release-grid">
        {view.printings.map((p) => (
          <PrintingCard key={p.printingId} printing={p} owned={inventory.value.get(p.printingId) ?? 0} grantBlocked={grantEligibility(snap, c, p.printingId)}
            onGrant={(q) => void grant(p, q)} onArchive={() => void archive('PRINTING', p.printingId, 0)} />
        ))}
      </div>
      <Panel title={view.previous ? `Diferenças contra v${view.previous.version}` : 'Primeira versão'}>
        {view.diff.length ? <ul class="studio-diff">{view.diff.slice(0, 80).map((ch, i) => <li key={i} class={`diff-${ch.kind.toLowerCase()}`}>{changeText(ch)}</li>)}</ul> : <p class="muted">{view.previous ? 'Sem diferenças de regra.' : 'Nada a comparar.'}</p>}
      </Panel>
    </div>
  );
}

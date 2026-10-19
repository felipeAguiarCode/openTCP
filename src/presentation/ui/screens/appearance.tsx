// Oficina de aparência (interface §23.21–§23.29): S41 aparência padrão do perfil e S42 aparência do
// deck. Biblioteca, prévia da mesa e propriedades; rascunho separado e aplicação atômica.
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  DEFAULT_PARAMS, cosmeticCatalog, decksUsingPreset, defaultMatCrop, effectiveConfig, inheritProfileAppearance, loadDraft, matCrop, saveDraft, savePreset,
  storeMatImage, validatePreset, type AppearanceTarget, type CustomMatImage, type PresetConfig, type PresetParams,
} from '../../../application/appearance.ts';
import { createMediaClient, type MediaClient } from '../../../infrastructure/workers/media-client.ts';
import { MatImageSurface, useMatImage } from '../components/mat-image.tsx';
import type { Cosmetic } from '../../../content/types.ts';
import { go } from '../app/router.ts';
import { confirmDialog, content, reducedMotion, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { CosmeticSwatch } from '../components/cosmetics.tsx';
import { CoinDisc } from '../components/coin.tsx';
import { sleeveArtUrl } from '../../assets/sleeves.ts';
import type { CardFaceData } from '../../../domain/cards/text.ts';
import type { CoinFace } from '../../assets/coins.ts';
import { Button, EmptyState, PageHeader, Panel, Segmented, Skeleton, Slider, Tabs, Toggle } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';

type Kind = Cosmetic['kind'];
const KIND_TABS: { id: Kind; label: string }[] = [{ id: 'PLAYMAT', label: 'Tapete' }, { id: 'SLEEVE', label: 'Verso' }, { id: 'COIN', label: 'Moeda' }, { id: 'FLAIR', label: 'Efeito de entrada' }];
const FIELD: Record<Kind, keyof Pick<PresetConfig, 'playmatId' | 'sleeveId' | 'coinId' | 'defaultEntryFlairId'>> = { PLAYMAT: 'playmatId', SLEEVE: 'sleeveId', COIN: 'coinId', FLAIR: 'defaultEntryFlairId' };

const kindOf = (tab: string | undefined): Kind | null => (KIND_TABS.some((t) => t.id === tab) ? tab as Kind : null);

export function AppearanceScreen({ query }: { query: Readonly<Record<string, string>> }): JSX.Element {
  return <Workshop deckId={null} preview={query.preview ?? null} initialTab={kindOf(query.tab)} />;
}

/** S42: aberta pela ficha do deck (Acessórios) direto na aba pedida (`?tab=SLEEVE` abre o Verso). */
export function DeckAppearanceScreen({ params, query }: { params: Readonly<Record<string, string>>; query?: Readonly<Record<string, string>> }): JSX.Element {
  return <Workshop deckId={params.deckId ?? null} preview={null} initialTab={kindOf(query?.tab)} />;
}

function Workshop({ deckId, preview, initialTab }: { readonly deckId: string | null; readonly preview: string | null; readonly initialTab: Kind | null }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const contextId = deckId ? `deck:${deckId}` : 'profile';
  const deck = deckId ? snap?.decks.find((d) => d.deckId === deckId) ?? null : null;
  const base = useMemo(() => (c && snap ? effectiveConfig(c, snap, deckId) : null), [c, snap?.profile.revision, deckId]);
  const [config, setConfig] = useState<PresetConfig | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Kind>(initialTab ?? 'PLAYMAT');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<'MINE' | 'NPC'>('MINE');
  const [showSafe, setShowSafe] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const matImage = useMatImage(config?.customImage);

  useEffect(() => {
    if (!base) return;
    void loadDraft(requireCtx(), contextId).then((d) => {
      const start = d ? d.config : base.config;
      setConfig(preview && c?.cosmetics.get(preview) ? { ...start, [FIELD[c.cosmetics.get(preview)!.kind]]: preview } : start);
      setDraftRevision(d?.revision ?? 0);
      setDirty(!!d || !!preview);
      if (preview && c?.cosmetics.get(preview)) setTab(c.cosmetics.get(preview)!.kind);
    });
  }, [contextId, !!base]);

  if (!c || !snap || !config || !base) return <Skeleton lines={8} />;
  if (deckId && !deck) return <EmptyState title="Deck não encontrado" action={<Button onClick={() => go('S11')}>Decks</Button>} />;
  const catalog = cosmeticCatalog(c, snap);
  const items = catalog.filter((x) => x.cosmetic.kind === tab);
  const errors = validatePreset(c, snap, config);

  const update = (next: Partial<PresetConfig>) => {
    const cfg = { ...config, ...next };
    setConfig(cfg);
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Rascunho automático separado; não altera a próxima batalha até ser aplicado (§23.24).
    saveTimer.current = window.setTimeout(() => {
      const rev = draftRevision + 1;
      void saveDraft(requireCtx(), contextId, rev, cfg).then((ok) => { if (ok) setDraftRevision(rev); });
    }, 800);
  };
  const setParam = <K extends keyof PresetParams>(k: K, v: PresetParams[K]) => update({ params: { ...config.params, [k]: v } });

  const apply = async (target: AppearanceTarget) => {
    const affected = decksUsingPreset(snap, config.presetId).filter((n) => n !== deck?.name);
    if (affected.length && !(await confirmDialog({ title: 'Atualizar preset compartilhado?', body: `Também afeta: ${affected.join(', ')} (nas próximas tentativas).`, confirmLabel: 'Atualizar' }))) return;
    setBusy(true);
    const r = await savePreset(requireCtx(), config, target, contextId);
    setBusy(false);
    if (!r.ok) { toast(r.message, 'error'); return; }
    setDirty(false);
    setDraftRevision(0);
    toast(target.kind === 'DECK' ? 'Aparência aplicada a este deck. Vale a partir da próxima tentativa.' : target.kind === 'PROFILE_DEFAULT' ? 'Aparência padrão salva.' : 'Preset salvo.', 'success');
  };
  const cancel = () => { setConfig(base.config); setDirty(false); };
  const playmat = c.cosmetics.get(config.playmatId);
  const sleeve = c.cosmetics.get(config.sleeveId);
  const sample = [...c.starterPrintingIds].slice(0, 4);
  return (
    <>
      <PageHeader title={deck ? `Aparência de “${deck.name}”` : 'Aparência padrão'} subtitle={dirty ? 'Alterações não salvas' : base.source === 'DECK' ? 'Aparência própria do deck' : base.source === 'PROFILE' ? 'Usando a aparência padrão do perfil' : 'Usando o preset neutro'}
        backTo={deck ? '/decks' : '/profile'} />
      <div class="workshop">
        <Panel title="Biblioteca">
          <Tabs label="Categorias" value={tab} onChange={setTab} tabs={KIND_TABS} />
          <ul class={`workshop-items ${tab === 'COIN' || tab === 'SLEEVE' ? 'is-grid' : ''} is-${tab.toLowerCase()}`}>
            {items.map(({ cosmetic, owned, how }) => {
              const active = config[FIELD[tab]] === cosmetic.cosmeticId;
              return (
                <li key={cosmetic.cosmeticId}>
                  <button type="button" class={`workshop-item ${active ? 'is-selected' : ''} ${owned ? '' : 'is-locked'}`} aria-pressed={active}
                    onClick={() => update({ [FIELD[tab]]: cosmetic.cosmeticId } as Partial<PresetConfig>)}
                    aria-label={`${cosmetic.names['pt-BR']}, ${how}${owned ? '' : ' — só prévia'}`}>
                    <CosmeticSwatch cosmetic={cosmetic} />
                    <span class="grow"><strong>{cosmetic.names['pt-BR']}</strong><br /><small class="muted">{how}</small></span>
                    {owned ? null : <Icon name="lock" size={16} />}
                  </button>
                </li>
              );
            })}
          </ul>
          {tab === 'PLAYMAT' ? <MatImageEditor image={config.customImage ?? null} missing={matImage.missing} onChange={(customImage) => update({ customImage })} /> : null}
        </Panel>
        <div class="workshop-stage">
          {tab === 'COIN' ? <CoinPreview coin={c.cosmetics.get(config.coinId) ?? null} /> : null}
          {tab === 'SLEEVE' ? <SleevePreview sleeve={sleeve ?? null} front={faceOf(c, sample[0] ?? '')} /> : null}
          <div class={`workshop-table ${showSafe ? 'show-safe' : ''}`} style={{ '--mat-a': playmat?.visual.palette[0] ?? '#EAF4FA', '--mat-b': playmat?.visual.palette[1] ?? '#86BCE7' } as JSX.CSSProperties} aria-label="Prévia da mesa">
            {config.customImage && matImage.url && !config.params.hideArt ? <MatImageSurface image={config.customImage} state={matImage} />
              : playmat && !config.params.hideArt ? <div class="workshop-mat"><CosmeticSwatch cosmetic={playmat} large /></div> : null}
            {showSafe ? <div class="workshop-safe-band" aria-hidden="true"><span>Mão</span></div> : null}
            <div class="workshop-row far">{[0, 1, 2].map((i) => <div key={i} class="workshop-slot" />)}</div>
            <div class="workshop-row"><div class="workshop-slot active"><CardFace face={faceOf(c, sample[1] ?? '')} size="xs" /></div></div>
            <div class="workshop-row"><div class="workshop-slot active"><CardFace face={faceOf(c, sample[0] ?? '')} size="xs" /></div></div>
            <div class="workshop-row">{[2, 3].map((i) => <div key={i} class="workshop-slot"><CardFace face={faceOf(c, sample[i] ?? '')} size="xs" /></div>)}<div class="workshop-slot" /></div>
            <div class="workshop-hand" style={{ '--sleeve-a': sleeve?.visual.palette[0] ?? '#5aa9e6', '--sleeve-b': sleeve?.visual.palette[1] ?? '#2f6fb9', ...backVar(sleeve) } as JSX.CSSProperties}>
              {Array.from({ length: 5 }, (_, i) => <CardFace key={i} face={null} hidden size="xs" />)}
            </div>
          </div>
          <div class="row">
            <Segmented label="Demonstração" value={demo} onChange={setDemo} options={[{ id: 'MINE', label: 'Meu turno' }, { id: 'NPC', label: 'Turno do NPC' }]} />
            <Toggle label="Mostrar zonas seguras" checked={showSafe} onChange={setShowSafe} />
            <span class="muted small">A prévia não usa RNG de batalha nem altera tentativas.</span>
          </div>
        </div>
        <Panel title="Propriedades">
          <div class="stack">
            <div class="field">Material<Segmented label="Material" value={config.params.material} onChange={(v) => setParam('material', v)} options={[{ id: 'FABRIC', label: 'Tecido' }, { id: 'MATTE', label: 'Fosco' }, { id: 'SYNTHETIC', label: 'Sintético' }]} /></div>
            <Slider label="Opacidade do padrão" value={config.params.patternOpacity} min={0} max={0.25} step={0.01} onChange={(v) => setParam('patternOpacity', v)} />
            <div class="field">Borda<Segmented label="Borda" value={config.params.border} onChange={(v) => setParam('border', v)} options={[{ id: 'SIMPLE', label: 'Simples' }, { id: 'DOUBLE', label: 'Dupla' }, { id: 'STITCH', label: 'Costura' }, { id: 'GLOW', label: 'Luz' }]} /></div>
            <div class="field">Ambiente<Segmented label="Ambiente" value={config.params.ambient} onChange={(v) => setParam('ambient', v)} options={[{ id: 'OFF', label: 'Desligado' }, { id: 'LIGHT', label: 'Leve' }, { id: 'DEFAULT', label: 'Padrão' }]} /></div>
            <div class="field">Reação ao ataque<Segmented label="Reação ao ataque" value={config.params.attackReaction} onChange={(v) => setParam('attackReaction', v)} options={[{ id: 'OFF', label: 'Desligada' }, { id: 'WAVE', label: 'Onda curta' }]} /></div>
            <Toggle label="Ocultar arte do tapete" checked={config.params.hideArt} onChange={(v) => setParam('hideArt', v)} />
            <label class="field">Nome do preset<input class="input" value={config.name} maxLength={40} onInput={(e) => update({ name: (e.target as HTMLInputElement).value })} /></label>
            <Button variant="ghost" onClick={() => update({ params: DEFAULT_PARAMS })}>Restaurar propriedades</Button>
            {errors.length ? <ul class="field-error small">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          </div>
        </Panel>
      </div>
      <div class="workshop-footer row">
        <Button variant="ghost" onClick={cancel} disabledReason={dirty ? null : 'Nada para desfazer.'}>Cancelar</Button>
        <Button onClick={() => void apply({ kind: 'PRESET_ONLY' })} loading={busy} disabledReason={errors[0] ?? null}>Salvar como preset</Button>
        <Button onClick={() => void apply({ kind: 'PROFILE_DEFAULT' })} loading={busy} disabledReason={errors[0] ?? null}>Usar como padrão</Button>
        {deck ? <>
          <Button variant="primary" onClick={() => void apply({ kind: 'DECK', deckId: deck.deckId })} loading={busy} disabledReason={errors[0] ?? null} testId="apply-deck">Aplicar a este deck</Button>
          {deck.appearance?.mode === 'OVERRIDE' ? <Button variant="ghost" onClick={async () => { if (await inheritProfileAppearance(requireCtx(), deck.deckId)) toast('O deck volta a usar a aparência padrão.', 'success'); }}>Herdar padrão do perfil</Button> : null}
        </> : null}
      </div>
    </>
  );
}

/** Verso desenhado em HTML com o sleeve do Pocket (variável `--card-back-image`); sem imagem, o verso padrão. */
function backVar(sleeve: Cosmetic | null | undefined): Record<string, string> {
  const url = sleeveArtUrl(sleeve?.visual.assetKey);
  return url ? { '--card-back-image': `url("${url}")` } : {};
}

/**
 * Verso do deck: o sleeve aparece atrás das cartas deste deck — no baralho, nas cartas viradas da preparação e para o
 * rival. Carta de exemplo que vira entre a frente e o verso (giro em Y; sem giro com movimento reduzido).
 */
function SleevePreview({ sleeve, front }: { readonly sleeve: Cosmetic | null; readonly front: CardFaceData | null }): JSX.Element {
  const [back, setBack] = useState(true);
  const name = sleeve?.names['pt-BR'] ?? 'Verso Neutro';
  return (
    <div class="workshop-sleeve" data-testid="workshop-sleeve">
      <div class={`workshop-sleeve-card ${back ? 'is-back' : ''} ${reducedMotion.value ? 'is-reduced' : ''}`} style={backVar(sleeve) as JSX.CSSProperties}>
        <span class="workshop-sleeve-face is-front"><CardFace face={front} size="md" /></span>
        <span class="workshop-sleeve-face is-back"><CardFace face={null} hidden size="md" /></span>
      </div>
      <div class="workshop-coin-info">
        <strong>{name}</strong>
        <span class="muted small">O verso das cartas deste deck: aparece no baralho, nas cartas viradas da preparação e para o rival na mesa.</span>
        <Button onClick={() => setBack((b) => !b)} testId="workshop-sleeve-flip">{back ? 'Ver a frente' : 'Ver o verso'}</Button>
      </div>
    </div>
  );
}

/**
 * Moeda do deck (gameplay-pocket §3): a que este deck lança no cara ou coroa de quem começa e em todo efeito com moeda
 * dos seus Pokémon. Cara e coroa lado a lado e um lançamento de demonstração (alterna as faces; sem RNG de batalha).
 */
function CoinPreview({ coin }: { readonly coin: Cosmetic | null }): JSX.Element {
  const [flip, setFlip] = useState<{ readonly face: CoinFace; readonly n: number }>({ face: 'HEADS', n: 0 });
  const name = coin?.names['pt-BR'] ?? 'Moeda';
  return (
    <div class="workshop-coin" data-testid="workshop-coin">
      <CoinDisc key={`${coin?.cosmeticId}:${flip.n}`} coin={coin} face={flip.face} toss={flip.n > 0 && !reducedMotion.value} size={148} label={name} />
      <div class="workshop-coin-info">
        <strong>{name}</strong>
        <span class="muted small">Lançada no cara ou coroa de quem começa e em todo efeito com moeda dos seus Pokémon.</span>
        <div class="workshop-coin-faces">
          <span><CoinDisc coin={coin} face="HEADS" size={52} />Cara</span>
          <span><CoinDisc coin={coin} face="TAILS" size={52} />Coroa</span>
        </div>
        <Button onClick={() => setFlip((f) => ({ face: f.face === 'HEADS' ? 'TAILS' : 'HEADS', n: f.n + 1 }))} testId="workshop-coin-flip">Lançar a moeda</Button>
      </div>
    </div>
  );
}

/**
 * Imagem local do tapete (interface §23.26): validação e normalização no worker de mídia (PNG/JPEG/WebP
 * estáticos, 10 MiB, 4096 px, 16,7 Mpx), cópia guardada como asset, recorte 4:3 não destrutivo e cor de base.
 * Recusa aparece antes de qualquer mudança no preset salvo (UI-112).
 */
function MatImageEditor({ image, missing, onChange }: { readonly image: CustomMatImage | null; readonly missing: boolean; readonly onChange: (img: CustomMatImage | null) => void }): JSX.Element {
  const file = useRef<HTMLInputElement>(null);
  const media = useRef<MediaClient | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => media.current?.dispose(), []);
  const pick = async (f: File) => {
    setBusy(true);
    setError(null);
    media.current ??= createMediaClient();
    const r = await media.current.importArt(f);
    if (!r.ok) { setBusy(false); setError(r.message); return; }
    const stored = await storeMatImage(requireCtx(), r.master);
    setBusy(false);
    if (!stored.ok) { setError(stored.message); return; }
    onChange(stored.image);
    toast('Imagem pronta. Ajuste o recorte e aplique o preset para usá-la nas próximas batalhas.', 'success');
  };
  const full = image ? defaultMatCrop(image.width, image.height) : null;
  const zoom = image && full ? full.w / image.crop.w : 1;
  const cx = image ? image.crop.x + image.crop.w / 2 : 0.5;
  const cy = image ? image.crop.y + image.crop.h / 2 : 0.5;
  const recrop = (z: number, x: number, y: number) => image && onChange({ ...image, crop: matCrop(image.width, image.height, z, x, y) });
  return (
    <section class="mat-image-editor stack" aria-label="Imagem própria do tapete">
      <h3>Imagem própria</h3>
      <p class="small muted">PNG, JPEG ou WebP estático, até 10 MiB e 4096 px. A imagem fica neste dispositivo; para levá-la a outro, use um backup completo.</p>
      <div class="row">
        <Button icon="upload" onClick={() => file.current?.click()} loading={busy} testId="mat-image-import">{image ? 'Trocar imagem' : 'Importar imagem…'}</Button>
        {image ? <Button variant="ghost" onClick={() => onChange(null)}>Remover imagem</Button> : null}
        <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void pick(f); (e.target as HTMLInputElement).value = ''; }} />
      </div>
      {error ? <p class="field-error small" role="alert" data-testid="mat-image-error">{error} O preset salvo não foi alterado.</p> : null}
      {image && missing ? <p class="badge badge-warn" role="status">Imagem não encontrada neste dispositivo — a mesa usa o tapete neutro.</p> : null}
      {image ? (
        <>
          <Slider label="Zoom do recorte" value={zoom} min={1} max={4} step={0.05} onChange={(v) => recrop(v, cx, cy)} />
          <Slider label="Posição horizontal" value={cx} min={0} max={1} step={0.01} onChange={(v) => recrop(zoom, v, cy)} />
          <Slider label="Posição vertical" value={cy} min={0} max={1} step={0.01} onChange={(v) => recrop(zoom, cx, v)} />
          <label class="field">Cor de base (transparência)<input type="color" value={image.baseHex} onInput={(e) => onChange({ ...image, baseHex: (e.target as HTMLInputElement).value.toUpperCase() })} /></label>
        </>
      ) : null}
    </section>
  );
}


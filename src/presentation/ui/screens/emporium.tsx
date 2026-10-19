// S33 — Empório (interface §32; campanha §17): Créditos obtidos na campanha, sem dinheiro real e sem
// ofertas com prazo. Cada compra é uma operação única com recibo; a prévia não altera saldo.
import { Fragment, type JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { buyProduct, productOffers, type ProductOffer } from '../../../application/economy.ts';
import type { PokemonType } from '../../../domain/cards/types.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { confirmDialog, content, credits, inventory, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, faceOf, symbolText } from '../components/cards.tsx';
import { Button, Chip, EmptyState, FilterBar, PageHeader, Panel, SearchInput, Skeleton, Tabs, Toggle } from '../components/controls.tsx';
import { RARITY_SYMBOL_LABEL, RARITY_SYMBOL_ORDER } from '../../../domain/cards/rarity.ts';
import { Icon, TypeIcon } from '../components/icons.tsx';
import { searchKeyV1 } from '../../../domain/cards/naming.ts';
import { CosmeticSwatch } from '../components/cosmetics.tsx';
import { PackArt } from '../components/pack-art.tsx';

type Tab = 'packs' | 'cards' | 'cosmetics';

/** Itens desenhados por vez (“Mostrar mais” acrescenta outro bloco): são ~1.850 cartas dirigidas. */
const PAGE = 60;

export function EmporiumScreen({ query }: { query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [state, setState] = useState(() => {
    // Estado salvo antes dos filtros de expansão/raridade não tem esses campos.
    const saved = loadViewState('S33', { tab: (query.focus ? 'cards' : 'packs') as Tab, search: '', type: '' as string, selected: query.focus ?? '', setId: '', rarity: '', onlyAvailable: false });
    return { ...saved, setId: saved.setId ?? '', rarity: saved.rarity ?? '', onlyAvailable: saved.onlyAvailable ?? false };
  });
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const update = (next: Partial<typeof state>) => { const s = { ...state, ...next }; setState(s); setLimit(PAGE); saveViewState('S33', s); };
  const offers = useMemo(() => (c && snap ? productOffers(requireCtx()) : []), [c, snap]);
  if (!c || !snap) return <Skeleton />;
  const inv = inventory.value;
  const byTab: Record<Tab, ProductOffer[]> = {
    packs: offers.filter((o) => o.product.kind === 'RANDOM_PACK' || o.product.kind === 'FIXED_PACK'),
    cards: offers.filter((o) => o.product.kind === 'DIRECTED_CARD'),
    cosmetics: offers.filter((o) => o.product.kind === 'COSMETIC'),
  };
  // Set de um pacote = set da impressão da capa (o tutorial e os do Genetic Apex ficam no A1).
  const setOf = (o: ProductOffer) => (o.product.coverPrintingId ? c.catalog.printings.get(o.product.coverPrintingId)?.setId ?? '' : '');
  let list = byTab[state.tab];
  if (state.onlyAvailable) list = list.filter((o) => o.available && !o.owned);
  if (state.tab === 'packs' && state.setId) list = list.filter((o) => setOf(o) === state.setId);
  if (state.tab === 'cards') {
    const q = searchKeyV1(state.search);
    list = list.filter((o) => {
      const face = o.product.directedPrintingId ? faceOf(c, o.product.directedPrintingId) : null;
      if (!face) return false;
      if (state.setId && face.setId !== state.setId) return false;
      if (state.rarity && face.raritySymbol !== state.rarity) return false;
      if (q && !searchKeyV1(face.name).includes(q)) return false;
      if (state.type && !face.types.includes(state.type as PokemonType) && !(state.type === 'TRAINER' && face.category === 'TRAINER')) return false;
      return true;
    });
  }
  const setName = new Map(c.bundle.sets.map((s) => [s.setId, s.name]));
  const selected = offers.find((o) => o.product.productId === state.selected || o.product.directedPrintingId === state.selected) ?? list[0] ?? null;
  const buy = async (offer: ProductOffer) => {
    const price = offer.product.price?.credits ?? 0;
    const ok = await confirmDialog({
      title: `Comprar ${offer.product.name}?`,
      body: [`Custa ${price} Créditos. Saldo após a compra: ${credits.value - price} Créditos.`, offer.product.kind === 'DIRECTED_CARD' ? 'Você recebe 1 cópia desta impressão; nenhuma carta é destruída.' : offer.product.kind === 'COSMETIC' ? 'O cosmético fica disponível em todos os decks deste perfil.' : 'O pacote fica guardado até você abrir.'],
      confirmLabel: `Comprar por ${price} Créditos`,
    });
    if (!ok) return;
    setBusy(true);
    const r = await buyProduct(requireCtx(), offer.product.productId);
    setBusy(false);
    if (!r.ok) { toast(r.message, 'error'); return; }
    toast('Compra concluída e salva neste dispositivo.', 'success');
  };
  const types: (PokemonType | 'TRAINER')[] = ['GRASS', 'FIRE', 'WATER', 'LIGHTNING', 'PSYCHIC', 'FIGHTING', 'DARKNESS', 'METAL', 'COLORLESS', 'TRAINER'];
  return (
    <>
      <PageHeader title="Empório" subtitle="Use Créditos obtidos na campanha. Itens não expiram e não há compra com dinheiro." />
      <Tabs label="Seções do Empório" value={state.tab} onChange={(tab) => update({ tab, selected: '' })} tabs={[
        { id: 'packs', label: 'Pacotes' }, { id: 'cards', label: 'Cartas dirigidas' }, { id: 'cosmetics', label: 'Cosméticos' },
      ]} />
      <div class="split mt">
        <div>
          {state.tab !== 'cosmetics' ? (
            <FilterBar applied={(state.search ? 1 : 0) + (state.type ? 1 : 0) + (state.setId ? 1 : 0) + (state.rarity ? 1 : 0) + (state.onlyAvailable ? 1 : 0)}
              onClear={() => update({ search: '', type: '', setId: '', rarity: '', onlyAvailable: false })}>
              {state.tab === 'cards' ? <SearchInput value={state.search} onInput={(search) => update({ search })} placeholder="Buscar carta" /> : null}
              <select class="input compact" aria-label="Expansão" value={state.setId} onChange={(e) => update({ setId: (e.target as HTMLSelectElement).value })}>
                <option value="">Todas as expansões</option>
                {c.bundle.sets.map((s) => <option key={s.setId} value={s.setId}>{s.name}</option>)}
              </select>
              {state.tab === 'cards' ? (
                <select class="input compact" aria-label="Raridade" value={state.rarity} onChange={(e) => update({ rarity: (e.target as HTMLSelectElement).value })}>
                  <option value="">Raridade</option>
                  {RARITY_SYMBOL_ORDER.filter((r) => r !== 'PROMO').map((r) => <option key={r} value={r} aria-label={RARITY_SYMBOL_LABEL[r]}>{symbolText(r)}</option>)}
                </select>
              ) : null}
              <Toggle checked={state.onlyAvailable} onChange={(onlyAvailable) => update({ onlyAvailable })} label="Só disponíveis" />
              {state.tab === 'cards' ? types.map((t) => <Chip key={t} active={state.type === t} onClick={() => update({ type: state.type === t ? '' : t })} label={t === 'TRAINER' ? 'Treinador' : undefined}>{t === 'TRAINER' ? 'Treinador' : <TypeIcon type={t} size={18} />}</Chip>) : null}
            </FilterBar>
          ) : null}
          {list.length ? (
            <ul class="emporium-grid">
              {list.slice(0, limit).map((o, i, shown) => {
                const face = o.product.directedPrintingId ? faceOf(c, o.product.directedPrintingId) : null;
                const cosmetic = o.product.cosmeticId ? c.cosmetics.get(o.product.cosmeticId) : null;
                const unlockNode = o.product.availability.afterNodeId ? c.nodes.get(o.product.availability.afterNodeId) : null;
                // Pacotes agrupados por expansão: um título antes do primeiro pacote de cada set.
                const heading = state.tab === 'packs' && (i === 0 || setOf(shown[i - 1]!) !== setOf(o)) ? setName.get(setOf(o)) ?? null : null;
                return (
                  <Fragment key={o.product.productId}>
                  {heading ? <li key={`h-${setOf(o)}`} class="emporium-group"><h3>{heading}</h3></li> : null}
                  <li key={o.product.productId}>
                    <button type="button" class={`emporium-item ${selected?.product.productId === o.product.productId ? 'is-selected' : ''} ${o.available ? '' : 'is-unavailable'}`} onClick={() => update({ selected: o.product.productId })}
                      aria-label={`${o.product.name}, ${o.product.price?.credits ?? 0} Créditos${o.reason ? `, ${o.reason}` : ''}`}>
                      {face ? <CardFace face={face} size="xs" /> : cosmetic ? <CosmeticSwatch cosmetic={cosmetic} /> : <PackArt product={o.product} size="mini" />}
                      <span class="grow emporium-item-text"><strong>{o.product.name}</strong>
                        <small class="muted">{o.owned ? 'Já adquirido' : !o.available && unlockNode ? `Após ${unlockNode.title}` : face ? `${face.setId.toUpperCase()} ${face.collectorNumber} · ${symbolText(face.raritySymbol)} · você tem ${inv.get(face.printingId) ?? 0}` : ''}</small>
                      </span>
                      <span class="price"><Icon name="credits" size={16} />{o.product.price?.credits}</span>
                    </button>
                  </li>
                  </Fragment>
                );
              })}
            </ul>
          ) : null}
          {list.length > limit ? <Button variant="ghost" icon="plus" label={`Mostrar mais (${list.length - limit})`} onClick={() => setLimit(limit + PAGE)} /> : null}
          {list.length ? null : <EmptyState title="Nada encontrado" text={state.tab === 'cards' ? 'Ajuste os filtros ou avance na campanha para liberar mais cartas.' : 'Novos itens chegam com o avanço da campanha.'} />}
        </div>
        <Panel title="Detalhes" class="emporium-detail">
          {selected ? (
            <div class="stack">
              {selected.product.directedPrintingId ? <CardFace face={faceOf(c, selected.product.directedPrintingId)} size="lg" /> : null}
              {selected.product.kind === 'RANDOM_PACK' || selected.product.kind === 'FIXED_PACK' ? <div class="emporium-pack"><PackArt product={selected.product} size="lg" /></div> : null}
              {selected.product.cosmeticId && c.cosmetics.get(selected.product.cosmeticId) ? <CosmeticSwatch cosmetic={c.cosmetics.get(selected.product.cosmeticId)!} large /> : null}
              <strong class="emporium-detail-name">{selected.product.name}</strong>
              <span class="muted">{selected.product.kind === 'RANDOM_PACK' ? `${selected.product.cardsPerPack} cartas sorteadas com as probabilidades do pacote.` : selected.product.kind === 'DIRECTED_CARD' ? 'Quantidade: 1 cópia desta impressão exata.' : selected.product.kind === 'COSMETIC' ? 'Cosmético permanente do perfil.' : ''}</span>
              {selected.product.kind === 'RANDOM_PACK' ? <Button variant="ghost" onClick={() => go('S05', { packId: selected.product.productId })}>Ver probabilidades</Button> : null}
              {selected.product.kind === 'COSMETIC' ? <Button variant="ghost" onClick={() => go('S41', {}, { preview: selected.product.cosmeticId ?? '' })}>Experimentar visual</Button> : null}
              <div class="row">
                <span class="price big"><Icon name="credits" />{selected.product.price?.credits} Créditos</span>
                <Button variant="primary" onClick={() => buy(selected)} loading={busy} testId="buy"
                  disabledReason={selected.reason ?? null}>Comprar</Button>
              </div>
              <span class="muted small">Saldo: {credits.value} Créditos</span>
            </div>
          ) : <p class="muted">Selecione um item.</p>}
        </Panel>
      </div>
    </>
  );
}

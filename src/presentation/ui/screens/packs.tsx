// Pacotes (interface §8–§9): S04 possuídos/catálogo, S05 conteúdo e probabilidades, S06 revelação
// de um recibo existente. O resultado já está confirmado no SQLite antes de qualquer carta aparecer.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { findOpening, openOwnedPack, productOffers, type Opening } from '../../../application/economy.ts';
import type { Product, RarityCategory } from '../../../content/types.ts';
import { isTierPack, packRateTable, packResource, printingOdds, type PackRateTable } from '../../../domain/economy/packs.ts';
import { RARITY_SYMBOL_LABEL, RARITY_SYMBOL_ORDER, raritySymbol, type RaritySymbol } from '../../../domain/cards/rarity.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { content, inventory, reducedMotion, requireCtx, snapshot, toast } from '../app/store.ts';
import { CardFace, CardTile, faceOf, symbolText } from '../components/cards.tsx';
import { Button, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { PackOpeningScene } from '../components/scenes.tsx';
import { PackArt } from '../components/pack-art.tsx';

const CATEGORY_LABEL: Record<RarityCategory, string> = { COMMON: 'Comum', UNCOMMON: 'Incomum', RARE: 'Rara', ULTRA: 'Ultra' };

/** Percentual com 3 casas no formato brasileiro ("2,571%"), como a tela de taxas do Pocket. */
const PCT3 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const pct3 = (fraction: number): string => `${PCT3.format(fraction * 100)}%`;

/** "5 cartas por abertura", "4 cartas…", "5 cartas (+1 em 8,330% dos pacotes)". */
export function packSizeText(p: Product): string {
  if (p.kind === 'FIXED_PACK') return `Conteúdo fixo · ${p.fixedContents?.length ?? 0} cartas`;
  const extra = p.bonusSlot ? ` (+1 em ${pct3(p.bonusSlot.chance / 100000)} dos pacotes)` : '';
  return `${p.cardsPerPack} cartas por abertura${extra}`;
}

/** Tabela oficial de um pacote por símbolo: símbolo × posição, pacote raro e 6ª carta (interface §8.4). */
function TierOddsTable({ table }: { readonly table: PackRateTable }): JSX.Element {
  const label = (s: RaritySymbol) => <span aria-label={RARITY_SYMBOL_LABEL[s]}>{symbolText(s)}</span>;
  return (
    <>
      <table class="odds-table">
        <caption class="sr-only">Chance de cada símbolo de raridade em cada posição do pacote</caption>
        <thead>
          <tr><th scope="col">Raridade</th>{table.columns.map((col) => <th key={col.label} scope="col">{col.label}</th>)}{table.bonus ? <th scope="col">6ª</th> : null}</tr>
        </thead>
        <tbody>
          {RARITY_SYMBOL_ORDER.filter((s) => table.rows.some((r) => r.symbol === s) || table.bonus?.rows.some((r) => r.symbol === s)).map((s) => {
            const row = table.rows.find((r) => r.symbol === s);
            const bonus = table.bonus?.rows.find((r) => r.symbol === s);
            return (
              <tr key={s}>
                <th scope="row">{label(s)}</th>
                {table.columns.map((col, i) => <td key={col.label}>{row && row.total[i] ? pct3(row.total[i]!) : '—'}</td>)}
                {table.bonus ? <td>{bonus ? pct3(bonus.total) : '—'}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {table.rare ? <p class="small">Pacote raro: {pct3(table.rare.chance)} dos pacotes — todas as cartas ☆ ou superior, {pct3(table.rare.perCard)} cada ({table.rare.poolSize} cartas).</p> : null}
      {table.bonus ? <p class="small">6ª carta: {pct3(table.bonus.chance)} dos pacotes normais trazem uma carta a mais, só de Pokémon bebê ({table.bonus.rows.map((r) => `${symbolText(r.symbol)} ${pct3(r.perCard)} cada`).join(' · ')}).</p> : null}
      <p class="muted small">{table.rows.every((r) => r.symbol === 'PROMO')
        ? 'Taxa do projeto: o Pocket não vende pacote de promos, então cada carta PROMO do pool sai com chance igual.'
        : 'Taxas oficiais do Pokémon TCG Pocket.'} Dentro de cada raridade a carta é sorteada com chance igual; o percentual em cada carta é a quantidade esperada por pacote.</p>
    </>
  );
}

export function PacksScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [busy, setBusy] = useState<string | null>(null);
  if (!c || !snap) return <Skeleton />;
  const offers = new Map(productOffers(requireCtx()).map((o) => [o.product.productId, o]));
  const packs = c.bundle.products.filter((p) => p.kind === 'RANDOM_PACK' || p.kind === 'FIXED_PACK');
  const owned = (p: Product) => snap.wallets[packResource(p.productId)] ?? 0;
  const ownedList = packs.filter((p) => owned(p) > 0);
  const open = async (p: Product) => {
    setBusy(p.productId);
    const r = await openOwnedPack(requireCtx(), p.productId);
    setBusy(null);
    if (!r.ok) { toast(r.message, 'error'); return; }
    go('S06', { openingId: r.opening.openingId });
  };
  return (
    <>
      <PageHeader title="Pacotes" subtitle="Abrir consome um pacote possuído. Comprar pacotes é feito no Empório, com Créditos." />
      <Panel title="Possuídos">
        {ownedList.length ? (
          <div class="pack-grid">
            {ownedList.map((p) => (
              <div key={p.productId} class="pack-tile">
                <PackArt product={p} owned={owned(p)} />
                <strong>{p.name}</strong>
                <span class="muted small">{packSizeText(p)}</span>
                <div class="pack-actions">
                  <Button variant="primary" onClick={() => open(p)} loading={busy === p.productId} testId={`open-${p.productId}`}>Abrir 1</Button>
                  <Button variant="ghost" size="sm" onClick={() => go('S05', { packId: p.productId })}>Probabilidades</Button>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState title="Nenhum pacote para abrir" text="Encontros da campanha e o Empório dão novos pacotes." action={<Button onClick={() => go('S33')}>Ir ao Empório</Button>} />}
      </Panel>
      {catalogGroups(packs.filter((p) => p.kind === 'RANDOM_PACK'), c).map((group, gi) => (
      <Panel key={group.setId} title={gi === 0 ? `Catálogo de pacotes — ${group.name}` : group.name} class="mt">
        <div class="pack-grid">
          {group.packs.map((p) => {
            const offer = offers.get(p.productId);
            const unlockNode = p.availability.afterNodeId ? c.nodes.get(p.availability.afterNodeId) : null;
            const locked = offer ? !offer.available && offer.reason === 'Bloqueado pela campanha' : !p.availability.fromStart;
            return (
              <button key={p.productId} type="button" class={`pack-tile pack-tile-button ${locked ? 'is-locked' : ''}`} onClick={() => go('S05', { packId: p.productId })}>
                <PackArt product={p} owned={owned(p)} />
                <strong>{p.name}</strong>
                <span class="muted small">{locked ? <><Icon name="lock" size={14} /> Após {unlockNode?.title ?? p.availability.afterNodeId}</> : p.price ? `${p.price.credits} Créditos no Empório` : 'Concedido pela campanha'}</span>
              </button>
            );
          })}
        </div>
      </Panel>
      ))}
    </>
  );
}

/** Pacotes do catálogo agrupados pela expansão da capa, na ordem dos sets do conteúdo. */
function catalogGroups(packs: readonly Product[], c: NonNullable<typeof content.value>): { setId: string; name: string; packs: Product[] }[] {
  const order = c.bundle.sets.map((s) => s.setId);
  const groups = new Map<string, Product[]>();
  for (const p of packs) {
    const setId = (p.coverPrintingId ? c.catalog.printings.get(p.coverPrintingId)?.setId : undefined) ?? '';
    groups.set(setId, [...(groups.get(setId) ?? []), p]);
  }
  return [...groups.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([setId, list]) => ({ setId, name: c.bundle.sets.find((s) => s.setId === setId)?.name ?? 'Outros', packs: list }));
}

export function PackDetailScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return <Skeleton />;
  const product = c.products.get(params.packId ?? '');
  if (!product) return <EmptyState title="Pacote desconhecido" action={<Button onClick={() => go('S04')}>Voltar</Button>} />;
  const owned = snap.wallets[packResource(product.productId)] ?? 0;
  const odds = printingOdds(product).sort((a, b) => a.expectedCopies - b.expectedCopies);
  const inv = inventory.value;
  return (
    <>
      <PageHeader title={product.name} subtitle={product.kind === 'FIXED_PACK' ? 'Produto de tutorial com cartas fixas.' : `${packSizeText(product)} · probabilidades próprias deste pacote`} backTo="/packs"
        lead={<PackArt product={product} owned={owned} size="sm" />}
        actions={owned > 0 ? <Button variant="primary" onClick={() => go('S04')}>Possui {owned} — abrir</Button> : product.price ? <Button onClick={() => go('S33')}>Comprar no Empório ({product.price.credits})</Button> : null} />
      {product.kind === 'FIXED_PACK' ? (
        <Panel title="Conteúdo fixo">
          <div class="grid-cards">{(product.fixedContents ?? []).map((id, i) => <CardTile key={`${id}-${i}`} face={faceOf(c, id)} quantity={inv.get(id) ?? 0} owned={(inv.get(id) ?? 0) > 0} onClick={() => go('S08', { printingId: id })} />)}</div>
        </Panel>
      ) : (
        <div class="split">
          <Panel title="Cartas possíveis">
            {isTierPack(product) ? bySymbol(odds, c).map((g) => (
              <section key={g.symbol} class="odds-group">
                <h3 class="odds-group-title"><span aria-label={RARITY_SYMBOL_LABEL[g.symbol]}>{symbolText(g.symbol)}</span> <span class="muted small">{g.items.length} cartas</span></h3>
                <div class="grid-cards">
                  {g.items.map((o) => (
                    <CardTile key={o.printingId} face={faceOf(c, o.printingId)} quantity={inv.get(o.printingId) ?? 0} owned={(inv.get(o.printingId) ?? 0) > 0}
                      badge={pct3(o.expectedCopies)} onClick={() => go('S08', { printingId: o.printingId })} />
                  ))}
                </div>
              </section>
            )) : (
              <div class="grid-cards">
                {odds.map((o) => (
                  <CardTile key={o.printingId} face={faceOf(c, o.printingId)} quantity={inv.get(o.printingId) ?? 0} owned={(inv.get(o.printingId) ?? 0) > 0}
                    badge={`${(o.expectedCopies * 100).toLocaleString('pt-BR', { minimumFractionDigits: o.expectedCopies < 0.1 ? 2 : 1, maximumFractionDigits: o.expectedCopies < 0.1 ? 2 : 1 })}%`} onClick={() => go('S08', { printingId: o.printingId })} />
                ))}
              </div>
            )}
          </Panel>
          {isTierPack(product) ? <Panel title="Probabilidades por posição"><TierOddsTable table={packRateTable(product)!} /></Panel> : <Panel title="Probabilidades por posição">
            <table class="odds-table">
              <caption class="sr-only">Chance de cada categoria em cada posição do pacote</caption>
              <thead><tr><th scope="col">Posição</th>{(Object.keys(CATEGORY_LABEL) as RarityCategory[]).map((k) => <th key={k} scope="col">{CATEGORY_LABEL[k]}</th>)}</tr></thead>
              <tbody>
                {[...(product.slots ?? [])].sort((a, b) => a.position - b.position).map((slot) => {
                  const total = Object.values(slot.categoryWeights).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={slot.position}>
                      <th scope="row">{slot.position}</th>
                      {(Object.keys(CATEGORY_LABEL) as RarityCategory[]).map((k) => <td key={k}>{slot.categoryWeights[k] ? `${((slot.categoryWeights[k] / total) * 100).toFixed(0)}%` : '—'}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p class="muted small">Dentro de cada categoria, a carta é sorteada pelo peso declarado no pool. O percentual em cada carta é a quantidade esperada por pacote. Cartas promocionais só saem dos pacotes promocionais.</p>
          </Panel>}
        </div>
      )}
    </>
  );
}

/** Cartas do pacote agrupadas pelo símbolo de raridade (da mais rara para a mais comum). */
function bySymbol(odds: ReturnType<typeof printingOdds>, c: NonNullable<typeof content.value>): { symbol: RaritySymbol; items: ReturnType<typeof printingOdds> }[] {
  const groups = new Map<RaritySymbol, ReturnType<typeof printingOdds>>();
  for (const o of odds) {
    const p = c.catalog.printings.get(o.printingId);
    if (!p) continue;
    const s = raritySymbol(p);
    groups.set(s, [...(groups.get(s) ?? []), o]);
  }
  return [...RARITY_SYMBOL_ORDER].reverse().filter((s) => groups.has(s)).map((symbol) => ({ symbol, items: groups.get(symbol)! }));
}

export function OpeningScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const openingId = params.openingId ?? '';
  const [opening, setOpening] = useState<Opening | null | undefined>(undefined);
  const [stage, setStage] = useState(() => loadViewState(`S06:${openingId}`, { index: -1, done: false }));
  useEffect(() => {
    if (!snap) return;
    void findOpening(requireCtx(), openingId).then(setOpening, () => setOpening(null));
  }, [openingId, !!snap]);
  const update = (next: Partial<typeof stage>) => { const s = { ...stage, ...next }; setStage(s); saveViewState(`S06:${openingId}`, s); };
  if (!c || !snap || opening === undefined) return <div class="bare-screen"><Skeleton /></div>;
  if (opening === null) return <div class="bare-screen"><ErrorState title="Recibo de abertura não encontrado" text="Nenhuma carta foi sorteada novamente." onRetry={() => go('S04')} /></div>;
  const product = c.products.get(opening.productId);
  const inv = inventory.value;
  const counts = new Map<string, number>();
  for (const id of opening.printingIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const isNew = (id: string) => (inv.get(id) ?? 0) - (counts.get(id) ?? 0) <= 0;
  const remainingPacks = snap.wallets[packResource(opening.productId)] ?? 0;
  const total = opening.printingIds.length;
  const current = stage.index >= 0 && stage.index < total ? opening.printingIds[stage.index]! : null;
  const face = current ? faceOf(c, current) : null;
  const next = () => (stage.index + 1 >= total ? update({ done: true }) : update({ index: stage.index + 1 }));
  const openAnother = async () => {
    const r = await openOwnedPack(requireCtx(), opening.productId);
    if (!r.ok) { toast(r.message, 'error'); return; }
    go('S06', { openingId: r.opening.openingId }, {}, { replace: true });
  };
  return (
    <div class="opening-stage">
      <header class="opening-bar">
        <Button variant="ghost" icon="back" onClick={() => go('S04')}>Pacotes</Button>
        <span class="muted">{product?.name} · cartas adicionadas à coleção{opening.rarePack ? <strong class="badge badge-rare-pack"> Pacote raro!</strong> : null}</span>
        {!stage.done ? <Button onClick={() => update({ done: true })} testId="reveal-all">Revelar todas</Button> : <span />}
      </header>
      {stage.done ? (
        <section class="opening-summary" aria-live="polite">
          <h1 id="page-title" tabIndex={-1}>Cartas recebidas</h1>
          <div class="opening-summary-cards">
            {opening.printingIds.map((id, i) => (
              <button key={`${id}-${i}`} type="button" class="card-link opening-summary-card" onClick={() => go('S08', { printingId: id })}>
                <CardFace face={faceOf(c, id)} size="md" />
                {isNew(id) ? <span class="badge badge-new">Nova</span> : <span class="badge">×{inv.get(id) ?? 0}</span>}
              </button>
            ))}
          </div>
          <div class="row" style={{ justifyContent: 'center' }}>
            <Button onClick={() => go('S07')}>Ver coleção</Button>
            {remainingPacks > 0 ? <Button onClick={openAnother}>Abrir outro ({remainingPacks})</Button> : null}
            <Button variant="primary" onClick={() => go('S04')} testId="opening-done">Concluir</Button>
          </div>
        </section>
      ) : stage.index < 0 ? (
        <section class="opening-pack">
          <h1 id="page-title" tabIndex={-1} class="sr-only">Abrir pacote</h1>
          <PackOpeningScene product={product ?? null} reducedMotion={reducedMotion.value} onOpened={() => update({ index: 0 })} />
        </section>
      ) : (
        <section class="opening-reveal" aria-live="polite">
          <div class={`opening-card ${reducedMotion.value ? '' : 'animate'}`} key={stage.index}>
            <CardFace face={face} size="xl" />
          </div>
          <div class="opening-info">
            <span class="muted small">{stage.index + 1} de {total}{opening.bonus && stage.index === total - 1 ? ' · 6ª carta' : ''}</span>
            <h1 id="page-title" tabIndex={-1}>{face?.name}</h1>
            <span>{face ? `${face.subtitle} · ${symbolText(face.raritySymbol)}` : ''}</span>
            {current && isNew(current) ? <span class="badge badge-new">Nova na coleção</span> : current ? <span class="badge">Você tem {inv.get(current) ?? 0}</span> : null}
            <div class="row">
              <Button variant="primary" onClick={next} autoFocus testId="reveal-next">{stage.index + 1 >= total ? 'Ver resumo' : 'Próxima carta'}</Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

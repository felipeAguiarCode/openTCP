// S03 — Início (interface §7): mosaico de caixas no estilo dos menus da EA. A caixa grande é “Continuar” (próximo
// encontro com o retrato do rival, objetivos e progresso, ou o duelo suspenso / prêmio pendente); em volta, Jogar,
// Pacotes, Deck atual, Desafios, Arena, Coleção e Empório. Contagens são dados locais.
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { arenaList, campaignView, challengeList, continueTarget, nodeView } from '../../../application/campaign.ts';
import { collectionGroups } from '../../../application/collection.ts';
import { packResource } from '../../../domain/economy/packs.ts';
import { printedArtUrlNow } from '../../assets/card-art.ts';
import { energyOrbUrl } from '../../assets/energy.ts';
import { packArtUrl } from '../../assets/pack-art.ts';
import { go } from '../app/router.ts';
import { content, credits, packCount, settings, snapshot } from '../app/store.ts';
import { coverFace, rankedFaces } from '../components/cards.tsx';
import { Button, Skeleton } from '../components/controls.tsx';
import { DeckBox3D } from '../components/deck-box.tsx';
import { CHAPTER_TONE, MenuTile, RivalArt, TileGrid, TileIcon, TilePortrait, TileProgress, plural, type TileTone } from '../components/menu-tile.tsx';
import { PackArt } from '../components/pack-art.tsx';

export function HomeScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const groups = useMemo(() => (c && snap ? collectionGroups(c, snap) : []), [c, snap]);
  if (!c || !snap) return <Skeleton lines={8} />;
  const target = continueTarget(c, snap);
  const view = campaignView(c, snap);
  const favoriteId = settings.value.favoriteDeckId;
  const deck = snap.decks.find((d) => d.deckId === favoriteId && !d.archived) ?? snap.decks.find((d) => !d.archived && !!d.confirmed) ?? null;
  const deckPrintings = deck?.entries.map((e) => e.printingId) ?? [];
  const nodeId = target.kind === 'NODE' ? target.nodeId : target.kind === 'RESUME_ATTEMPT' ? target.nodeId : null;
  const nextNode = nodeId ? c.nodes.get(nodeId) ?? null : null;
  const chapter = nextNode ? c.chapters.get(nextNode.chapterId) : null;
  const rival = nextNode ? c.npcs.get(nextNode.npcId) : null;
  const nv = nextNode && target.kind === 'NODE' ? nodeView(c, snap, nextNode.nodeId) : null;
  const newCards = snap.inventory.filter((i) => !snap.marks.some((m) => m.markKind === 'SEEN' && m.subjectId === i.printingId) && !c.starterPrintingIds.has(i.printingId)).length;
  const isNew = view.completedNodes === 0;
  const finished = target.kind === 'COMPLETED';
  const cont = () => {
    if (target.kind === 'RESUME_ATTEMPT') go('S23', { matchId: target.attemptId });
    else if (target.kind === 'PENDING_REWARD') go('S35', {}, { reward: target.rewardId });
    else if (target.kind === 'NODE') go('S16', { nodeId: target.nodeId });
    else go('S18');
  };
  const contLabel = target.kind === 'RESUME_ATTEMPT' ? 'Retomar duelo' : target.kind === 'PENDING_REWARD' ? 'Escolher prêmio' : finished ? 'Ir para a Arena' : isNew ? 'Começar o prólogo' : 'Continuar';
  const heroTitle = target.kind === 'RESUME_ATTEMPT' ? 'Duelo suspenso' : target.kind === 'PENDING_REWARD' ? 'Prêmio aguardando' : finished ? 'Campanha concluída' : nextNode?.title ?? 'Campanha';
  const heroSub = target.kind === 'RESUME_ATTEMPT' ? `${rival ? `Contra ${rival.name} · ` : ''}salvo no ponto exato em que parou`
    : target.kind === 'PENDING_REWARD' ? 'Escolha o prêmio; ele não expira.'
    : finished ? 'A Arena e os objetivos de domínio continuam disponíveis.'
    : rival ? `${rival.name} · ${rival.title}` : '';
  const ownedPacks = c.bundle.products.filter((p) => (snap.wallets[packResource(p.productId)] ?? 0) > 0);
  const packShow = (ownedPacks.some((p) => packArtUrl(p.productId)) ? ownedPacks : c.bundle.products).filter((p) => packArtUrl(p.productId)).slice(0, 3);
  const fan = rankedFaces(c, snap.inventory.map((i) => i.printingId)).map((f) => printedArtUrlNow(f)).filter((u): u is string => !!u).slice(0, 3);
  const challenges = challengeList(c, snap).filter((x) => x.status === 'AVAILABLE' || x.status === 'IN_PROGRESS').length;
  const arena = arenaList(c, snap);
  const lastRival = arena.length ? c.npcs.get(arena[arena.length - 1]!.npcId) : null;
  const owned = groups.filter((g) => g.owned > 0).length;
  return (
    <div class="hub home">
      <h1 id="page-title" tabIndex={-1} class="sr-only">Início</h1>
      <TileGrid class="fill" label="Início">
        <MenuTile size="hero" tone={CHAPTER_TONE[nextNode?.chapterId ?? 'P00'] ?? 'blue'} kicker={chapter?.title ?? (finished ? 'Torneio de Kanto' : 'Campanha')} title={heroTitle} subtitle={heroSub}
          art={<RivalArt c={c} npc={rival} />} cta={contLabel} onClick={cont} testId="home-continue" autoFocus
          meta={<>
            {nv && nv.objectives.length ? (
              <ul class="tile-objectives">{nv.objectives.slice(0, 2).map((o) => <li key={o.objective.objectiveId} class={o.done ? 'is-done' : ''}>{o.objective.description}</li>)}</ul>
            ) : null}
            <TileProgress value={view.completedNodes} max={view.totalNodes} />
            <span>{view.completedNodes} de {view.totalNodes} encontros</span>
          </>} />
        <MenuTile tone="ink" title="Jogar" subtitle="Campanha, Desafios, Arena e Treino" onClick={() => go('S14')} testId="home-play"
          art={<span class="tile-orbs">{['FIRE', 'WATER', 'GRASS'].map((t) => <img key={t} src={energyOrbUrl(t) ?? ''} alt="" />)}</span>} />
        <MenuTile tone="gold" title="Pacotes" subtitle={packCount.value > 0 ? `${packCount.value} para abrir` : 'Catálogo e probabilidades'} badge={packCount.value > 0 ? packCount.value : null}
          art={<span class="tile-packs">{packShow.map((p) => <PackArt key={p.productId} product={p} size="sm" />)}</span>} onClick={() => go('S04')} testId="home-packs" />
        <MenuTile size="wide" tone={(deck?.energyTypes[0]?.toLowerCase() ?? 'blue') as TileTone} kicker="Deck atual" title={deck?.name ?? 'Nenhum deck'}
          subtitle={deck ? `${deck.entries.length}/20 cartas${deck.confirmed && deck.confirmed.entries.length === 20 ? ' · válido' : ' · incompleto'}` : 'Confirme um deck de 20 cartas'}
          art={deck ? <DeckBox3D face={coverFace(c, deckPrintings)} energyType={deck.energyTypes[0] ?? null} size="md" /> : <TileIcon name="decks" />} artClass="tile-deckbox"
          onClick={() => go(deck ? 'S12' : 'S11', deck ? { deckId: deck.deckId } : {})} testId="home-deck"
          actions={deck ? <><Button size="sm" onClick={() => go('S13', { deckId: deck.deckId })}>Testar</Button><Button size="sm" onClick={() => go('S11')}>Trocar</Button></> : null} />
        <MenuTile tone="lavender" title="Desafios" subtitle={challenges ? plural(challenges, 'disponível', 'disponíveis') : 'Puzzles, elites e domínio'} art={<TileIcon name="challenges" />} onClick={() => go('S15')} testId="home-challenges" />
        <MenuTile tone="coral" title="Arena" subtitle={arena.length ? `${plural(arena.length, 'rival', 'rivais')} para revanche` : 'Vença encontros para liberar'}
          art={lastRival ? <TilePortrait portraitKey={lastRival.portraitAssetKey} /> : <TileIcon name="arena" />} onClick={() => go('S18')} testId="home-arena" />
        <MenuTile tone="blue" title="Coleção" subtitle={`${owned} de ${groups.length} cartas${newCards ? ` · ${newCards} novas` : ''}`} badge={newCards ? 'NOVO' : null}
          art={fan.length ? <span class="tile-fan">{fan.map((u) => <img key={u} src={u} alt="" />)}</span> : <TileIcon name="collection" />} onClick={() => go('S07', {}, newCards ? { filter: 'new' } : {})} testId="home-collection" />
        <MenuTile tone="cyan" title="Empório" subtitle={`${credits.value} Créditos para gastar`} art={<TileIcon name="emporium" />} onClick={() => go('S33')} testId="home-emporium" />
      </TileGrid>
    </div>
  );
}

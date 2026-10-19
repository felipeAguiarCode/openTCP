// Batalhas solo (interface §15–§17, §20.7, §29.1): S14 hub, S15 desafios, S17 treino, S18 Arena de
// revanche, S38 histórico. Nunca há fila nem “procurando adversário”: o oponente é local e conhecido.
import type { JSX } from 'preact';
import { markFreshAttempt } from '../battle/duel-intro.tsx';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { startAttempt, type StartAttemptInput } from '../../../application/battle.ts';
import { arenaList, campaignView, challengeList } from '../../../application/campaign.ts';
import type { AttemptRow } from '../../../application/ports/storage.ts';
import type { ContentDeck, Difficulty } from '../../../content/types.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { battleSession, confirmDialog, content, requireCtx, settings, snapshot, toast } from '../app/store.ts';
import { DeckTile, coverFace } from '../components/cards.tsx';
import { Button, Chip, EmptyState, ErrorState, FilterBar, PageHeader, Panel, Segmented, Skeleton, Tabs } from '../components/controls.tsx';
import { CHAPTER_TONE, MenuTile, RivalArt, TileGrid, TileIcon, TilePortrait, TileProgress, chapterHost, plural } from '../components/menu-tile.tsx';
import { DIFFICULTY_LABEL, NodeBadge } from './campaign.tsx';

/** Inicia uma tentativa respeitando o slot único de duelo (interface §4.5, §15.4). */
export async function launchAttempt(input: StartAttemptInput): Promise<void> {
  const snap = snapshot.value;
  if (snap?.activeAttempt) {
    const resume = await confirmDialog({ title: 'Há um duelo suspenso', body: 'Existe somente um duelo por perfil. Retome ou abandone o duelo atual antes de iniciar outro.', confirmLabel: 'Retomar duelo', cancelLabel: 'Cancelar' });
    if (resume) go('S23', { matchId: snap.activeAttempt.attemptId });
    return;
  }
  const r = await startAttempt(requireCtx(), input);
  if (!r.ok) { toast(r.message, 'error'); return; }
  battleSession.value = r.session;
  markFreshAttempt(r.session.attemptId);
  go('S21', { attemptId: r.session.attemptId });
}

function useConfirmedDecks() {
  const snap = snapshot.value;
  return (snap?.decks ?? []).filter((d) => !d.archived && d.confirmed?.entries.length === 20);
}

export function BattleHubScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const decks = useConfirmedDecks();
  if (!c || !snap) return <Skeleton />;
  const favorite = decks.find((d) => d.deckId === settings.value.favoriteDeckId) ?? decks[0];
  const active = snap.activeAttempt;
  const view = campaignView(c, snap);
  const chapterId = view.recommended?.chapterId ?? c.bundle.chapters[c.bundle.chapters.length - 1]!.chapterId;
  const chapter = c.chapters.get(chapterId as never);
  const host = chapterHost(c, chapterId);
  const activeNode = active?.nodeId ? c.nodes.get(active.nodeId) : null;
  const activeRival = activeNode ? c.npcs.get(activeNode.npcId) : null;
  const challenges = challengeList(c, snap).filter((x) => x.status === 'AVAILABLE' || x.status === 'IN_PROGRESS').length;
  const arena = arenaList(c, snap);
  const known = c.bundle.npcs.filter((n) => view.chapters.some((ch) => ch.nodes.some((node) => node.npcId === n.npcId && view.statuses.get(node.nodeId) !== 'LOCKED')));
  const pendingObjectives = view.chapters.flatMap((ch) => ch.nodes).flatMap((n) => n.optionalObjectiveIds).length;
  return (
    <div class="hub">
      <header class="hub-head">
        <h1 id="page-title" tabIndex={-1}>Jogar</h1>
        <p>Todos os duelos são contra a IA local, neste dispositivo.</p>
      </header>
      <TileGrid class="fill" label="Modos de jogo">
        {active ? (
          <MenuTile size="hero" tone="coral" kicker="Duelo suspenso" title="Retomar duelo" subtitle={activeRival ? `Contra ${activeRival.name} · ${activeNode?.title ?? ''}` : 'Salvo no ponto exato em que parou'}
            art={<RivalArt c={c} npc={activeRival} />} cta="Retomar" onClick={() => go('S23', { matchId: active.attemptId })} testId="hub-resume" />
        ) : (
          <MenuTile size="hero" tone={CHAPTER_TONE[chapterId] ?? 'blue'} kicker={chapter?.title ?? 'Campanha'} title="Campanha" subtitle={host ? `${host.name} · ${host.title}` : 'História e mapa'}
            art={<RivalArt c={c} npc={host} />} cta="Abrir o mapa" onClick={() => go('S19')} testId="hub-campaign"
            meta={<><TileProgress value={view.completedNodes} max={view.totalNodes} /><span>{view.completedNodes} de {view.totalNodes} encontros</span></>} />
        )}
        <MenuTile tone="lavender" title="Desafios" subtitle={challenges ? plural(challenges, 'disponível', 'disponíveis') : 'Puzzles, elites e domínio'} art={<TileIcon name="challenges" />} onClick={() => go('S15')} testId="hub-challenges" />
        <MenuTile tone="coral" title="Arena" subtitle={arena.length ? `${plural(arena.length, 'rival', 'rivais')} para revanche` : 'Vença encontros para liberar'} art={<TileIcon name="arena" />} onClick={() => go('S18')} testId="hub-arena" />
        <MenuTile tone="water" title="Treino" subtitle={favorite ? `Com ${favorite.name}, sem recompensa` : 'Testar sem recompensa'} art={<TileIcon name="play" />} onClick={() => go('S17')} testId="hub-training" />
        <MenuTile tone="metal" title="Histórico" subtitle="Partidas encerradas e replays" art={<TileIcon name="history" />} onClick={() => go('S38')} testId="hub-history" />
        <MenuTile size="wide" tone="ink" kicker="Caderno" title="Adversários" subtitle={`${known.length} de ${c.bundle.npcs.length} ${c.bundle.npcs.length === 1 ? 'treinador conhecido' : 'treinadores conhecidos'}`}
          art={<span class="tile-portraits">{known.slice(-3).map((n) => <TilePortrait key={n.npcId} portraitKey={n.portraitAssetKey} />)}</span>} onClick={() => go('S29')} testId="hub-opponents" />
        <MenuTile tone="gold" title="Objetivos" subtitle={pendingObjectives ? `${pendingObjectives} objetivos de domínio` : 'Objetivos da campanha'} art={<TileIcon name="star" />} onClick={() => go('S25')} testId="hub-objectives" />
        <MenuTile tone="cyan" title="Diário" subtitle="Histórias já vividas" art={<TileIcon name="campaign" />} onClick={() => go('S26')} testId="hub-journal" />
      </TileGrid>
    </div>
  );
}

export function ChallengesScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [state, setState] = useState(() => loadViewState('S15', { tab: 'TUTORIAL' as 'TUTORIAL' | 'PUZZLE' | 'ELITE' | 'MASTERY', chapter: '', hideDone: false }));
  const update = (next: Partial<typeof state>) => { const s = { ...state, ...next }; setState(s); saveViewState('S15', s); };
  if (!c || !snap) return <Skeleton />;
  const list = state.tab === 'MASTERY'
    ? campaignView(c, snap).chapters.flatMap((ch) => ch.nodes).filter((n) => n.optionalObjectiveIds.length).map((node) => ({ node, status: campaignView(c, snap).statuses.get(node.nodeId)! }))
    : challengeList(c, snap).filter((x) => x.node.kind === state.tab);
  const filtered = list.filter((x) => (!state.chapter || x.node.chapterId === state.chapter) && (!state.hideDone || (x.status !== 'CLEARED' && x.status !== 'MASTERED')));
  return (
    <>
      <PageHeader title="Desafios" subtitle="Uma lista prática dos mesmos encontros do mapa." />
      <Tabs label="Tipos de desafio" value={state.tab} onChange={(tab) => update({ tab })} tabs={[{ id: 'TUTORIAL', label: 'Tutorial' }, { id: 'PUZZLE', label: 'Puzzles' }, { id: 'ELITE', label: 'Elites' }, { id: 'MASTERY', label: 'Domínio' }]} />
      <FilterBar applied={(state.chapter ? 1 : 0) + (state.hideDone ? 1 : 0)} onClear={() => update({ chapter: '', hideDone: false })}>
        {c.bundle.chapters.map((ch) => <Chip key={ch.chapterId} active={state.chapter === ch.chapterId} onClick={() => update({ chapter: state.chapter === ch.chapterId ? '' : ch.chapterId })}>{ch.chapterId}</Chip>)}
        <Chip active={state.hideDone} onClick={() => update({ hideDone: !state.hideDone })}>Ocultar concluídos</Chip>
      </FilterBar>
      {filtered.length ? (
        <div class="encounter-grid">
          {filtered.map(({ node, status }) => {
            const npc = c.npcs.get(node.npcId);
            const extra = [node.turnLimit ? `até ${node.turnLimit.ownTurns} turnos` : null, node.optionalObjectiveIds.length ? `${node.optionalObjectiveIds.length} objetivos` : null].filter(Boolean).join(' · ');
            return (
              <MenuTile key={node.nodeId} tone={CHAPTER_TONE[node.chapterId] ?? 'blue'} kicker={node.nodeId} title={node.title} subtitle={`${npc?.name ?? node.npcId}${extra ? ` · ${extra}` : ''}`}
                art={<TilePortrait portraitKey={npc?.portraitAssetKey} />} meta={<NodeBadge status={status} />} cta="Briefing"
                onClick={() => go('S16', { nodeId: node.nodeId })} disabledReason={status === 'LOCKED' ? 'Conclua os pré-requisitos no mapa.' : null} testId={`challenge-${node.nodeId}`} />
            );
          })}
        </div>
      ) : <EmptyState title="Nenhum desafio aqui ainda" text="Avance na campanha para desbloquear mais." />}
    </>
  );
}

function opponentDecks(): ContentDeck[] {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return [];
  const view = campaignView(c, snap);
  const reached = new Set(c.nodeList.filter((n) => view.statuses.get(n.nodeId) !== 'LOCKED').flatMap((n) => (n.difficultyProfiles ? Object.values(n.difficultyProfiles).map((p) => p.npcDeckId) : [])));
  return c.bundle.decks.filter((d) => d.kind === 'STARTER' || d.kind === 'SUPPORT' || (d.kind === 'NPC' && reached.has(d.deckId)));
}

export function TrainingScreen({ query }: { query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const decks = useConfirmedDecks();
  const options = useMemo(opponentDecks, [c, snapshot.value]);
  const [state, setState] = useState(() => loadViewState('S17', { deckId: query.deckId ?? settings.value.favoriteDeckId ?? '', opponent: '', difficulty: 'STANDARD' as Difficulty }));
  const [busy, setBusy] = useState(false);
  const update = (next: Partial<typeof state>) => { const s = { ...state, ...next }; setState(s); saveViewState('S17', s); };
  if (!c) return <Skeleton />;
  const deck = decks.find((d) => d.deckId === state.deckId) ?? decks[0] ?? null;
  const opponent = options.find((d) => d.deckId === state.opponent) ?? options[0] ?? null;
  const ai = c.bundle.aiProfiles.find((p) => p.policy === state.difficulty);
  const start = async () => {
    if (!deck || !opponent || !ai) return;
    setBusy(true);
    await launchAttempt({ mode: 'TRAINING', nodeId: null, difficulty: state.difficulty, deckId: deck.deckId, opponentDeckId: opponent.deckId, aiProfileId: ai.aiProfileId });
    setBusy(false);
  };
  return (
    <>
      <PageHeader title="Treino" subtitle="Treino: sem recompensas e sem avanço de campanha." backTo="/battle" />
      <div class="training">
        <Panel title="Seu deck">
          <div class="stack">
            {deck ? <DeckTile name={deck.name} energyTypes={deck.energyTypes} count={deck.entries.length} valid coverFace={coverFace(c, deck.entries.map((e) => e.printingId))} /> : <EmptyState title="Nenhum deck confirmado" action={<Button onClick={() => go('S11')}>Abrir decks</Button>} />}
            <select class="input" aria-label="Escolher deck" value={deck?.deckId ?? ''} onChange={(e) => update({ deckId: (e.target as HTMLSelectElement).value })}>
              {decks.map((d) => <option key={d.deckId} value={d.deckId}>{d.name}</option>)}
            </select>
          </div>
        </Panel>
        <Panel title="Adversário local">
          <p class="muted small">Cheren, professor da Escola de Treinadores, joga com o deck escolhido.</p>
          <ul class="list training-opponents">
            {options.map((d) => (
              <li key={d.deckId}>
                <button type="button" class={`list-row node-row ${opponent?.deckId === d.deckId ? 'is-active' : ''}`} onClick={() => update({ opponent: d.deckId })} aria-pressed={opponent?.deckId === d.deckId}>
                  <span class="grow"><strong>{d.name}</strong><br /><small class="muted">{d.kind === 'STARTER' ? 'Deck inicial' : d.kind === 'SUPPORT' ? 'Deck de apoio' : 'Deck de adversário'}{d.strategyNote ? ` · ${d.strategyNote}` : ''}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Regras">
          <div class="stack">
            <div class="field">Dificuldade da IA<Segmented label="Dificuldade" value={state.difficulty} onChange={(difficulty) => update({ difficulty })} options={(['STORY', 'STANDARD', 'EXPERT'] as const).map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] }))} /></div>
            <p class="muted small">Mesma mesa e mesmo motor da campanha. Ferramentas de laboratório (revelar mãos, forçar moedas) não existem no treino.</p>
            <Button variant="primary" size="lg" onClick={start} loading={busy} testId="start-training" disabledReason={!deck ? 'Confirme um deck de 20 cartas.' : !opponent ? 'Escolha um adversário.' : null}>Iniciar treino</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}

export function ArenaScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const decks = useConfirmedDecks();
  const [state, setState] = useState(() => loadViewState('S18', { deckId: settings.value.favoriteDeckId ?? '', difficulty: 'STANDARD' as Difficulty }));
  const update = (next: Partial<typeof state>) => { const s = { ...state, ...next }; setState(s); saveViewState('S18', s); };
  if (!c || !snap) return <Skeleton />;
  const list = arenaList(c, snap);
  const deck = decks.find((d) => d.deckId === state.deckId) ?? decks[0] ?? null;
  return (
    <>
      <PageHeader title="Arena de revanche" subtitle="Enfrente de novo adversários já vencidos. Vitórias dão a recompensa repetível do encontro; objetivos de campanha só contam no mapa." />
      <FilterBar>
        <label class="field">Deck
          <select class="input" value={deck?.deckId ?? ''} onChange={(e) => update({ deckId: (e.target as HTMLSelectElement).value })}>{decks.map((d) => <option key={d.deckId} value={d.deckId}>{d.name}</option>)}</select>
        </label>
        <div class="field">Dificuldade<Segmented label="Dificuldade" value={state.difficulty} onChange={(difficulty) => update({ difficulty })} options={(['STORY', 'STANDARD', 'EXPERT'] as const).map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] }))} /></div>
      </FilterBar>
      {list.length ? (
        <div class="encounter-grid">
          {list.map((node) => {
            const npc = c.npcs.get(node.npcId);
            const repeat = node.repeatRewardTableId ? c.rewardTables.get(node.repeatRewardTableId) : null;
            const supports = node.difficultyProfiles ? Object.keys(node.difficultyProfiles).includes(state.difficulty) : false;
            return (
              <MenuTile key={node.nodeId} tone={CHAPTER_TONE[node.chapterId] ?? 'blue'} kicker={`${node.title} · ${node.chapterId}`} title={npc?.name ?? node.npcId}
                subtitle={repeat?.credits ? `Vitória: ${repeat.credits} Créditos` : 'Sem recompensa repetível'} art={<TilePortrait portraitKey={npc?.portraitAssetKey} />} cta="Desafiar"
                onClick={() => void launchAttempt({ mode: 'ARENA', nodeId: node.nodeId, difficulty: state.difficulty, deckId: deck?.deckId ?? null })}
                disabledReason={!deck ? 'Confirme um deck de 20 cartas.' : !supports ? 'Dificuldade indisponível para este adversário.' : null} testId={`arena-${node.nodeId}`} />
            );
          })}
        </div>
      ) : <EmptyState title="Nenhum adversário vencido ainda" text="Vença encontros da campanha para enfrentá-los de novo aqui." action={<Button onClick={() => go('S19')}>Abrir campanha</Button>} />}
    </>
  );
}

type AttemptSummary = Omit<AttemptRow, 'state' | 'rng'>;
const MODE_LABEL: Record<string, string> = { CAMPAIGN: 'Campanha', ARENA: 'Arena', TRAINING: 'Treino', CUSTOM: 'Autoral', LAB: 'Laboratório' };
const OUTCOME_LABEL: Record<string, string> = { WIN: 'Vitória', LOSS: 'Derrota', DRAW: 'Empate', ABANDONED: 'Abandonada' };

export function HistoryScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [rows, setRows] = useState<readonly AttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState(() => loadViewState('S38', { mode: '', outcome: '' }));
  const update = (next: Partial<typeof filter>) => { const s = { ...filter, ...next }; setFilter(s); saveViewState('S38', s); };
  const load = () => { if (snap) requireCtx().storage.query({ kind: 'LIST_ATTEMPTS', profileId: snap.profile.profileId, limit: 500, offset: 0 }).then(setRows, (e) => setError(String(e))); };
  useEffect(load, [snap?.profile.profileId]);
  if (!c || !snap) return <Skeleton />;
  const list = (rows ?? []).filter((a) => a.status === 'FINISHED' || a.status === 'ABANDONED').filter((a) => {
    const outcome = (a.result as { outcome?: string } | null)?.outcome ?? 'ABANDONED';
    return (!filter.mode || a.mode === filter.mode) && (!filter.outcome || outcome === filter.outcome);
  });
  return (
    <>
      <PageHeader title="Histórico local" subtitle="Partidas encerradas neste perfil." backTo="/battle" />
      <FilterBar applied={(filter.mode ? 1 : 0) + (filter.outcome ? 1 : 0)} onClear={() => update({ mode: '', outcome: '' })}>
        {Object.entries(MODE_LABEL).map(([k, v]) => <Chip key={k} active={filter.mode === k} onClick={() => update({ mode: filter.mode === k ? '' : k })}>{v}</Chip>)}
        {Object.entries(OUTCOME_LABEL).map(([k, v]) => <Chip key={k} active={filter.outcome === k} onClick={() => update({ outcome: filter.outcome === k ? '' : k })}>{v}</Chip>)}
      </FilterBar>
      {error ? <ErrorState text={error} onRetry={load} /> : rows === null ? <Skeleton /> : list.length ? (
        <ul class="list">
          {list.map((a) => {
            const result = a.result as { outcome?: string; ownTurns?: number } | null;
            const node = a.nodeId ? c.nodes.get(a.nodeId) : null;
            const deck = snap.decks.find((d) => d.deckId === a.deckId);
            const minutes = Math.max(1, Math.round((Date.parse(a.updatedAt) - Date.parse(a.createdAt)) / 60000));
            return (
              <li key={a.attemptId} class="list-row">
                <span class={`badge ${result?.outcome === 'WIN' ? 'badge-done' : result?.outcome === 'LOSS' ? 'badge-danger' : ''}`}>{OUTCOME_LABEL[result?.outcome ?? 'ABANDONED']}</span>
                <span class="grow"><strong>{node ? `${node.title} · ${c.npcs.get(node.npcId)?.name ?? ''}` : MODE_LABEL[a.mode]}</strong><br />
                  <small class="muted">{MODE_LABEL[a.mode]} · {deck?.name ?? 'deck preparado'} · {new Date(a.createdAt).toLocaleString('pt-BR')} · {minutes} min{result?.ownTurns ? ` · ${result.ownTurns} turnos` : ''}</small></span>
                <Button size="sm" onClick={() => go('S39', { replayId: a.attemptId })}>Replay</Button>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState title="Nenhuma partida encerrada ainda" />}
    </>
  );
}


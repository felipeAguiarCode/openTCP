// Campanha (interface §17–§20, §30): mapa S19, capítulo S20, briefing S16, objetivos S25, diário
// S26/S27, Descoberta S28 e Caderno de adversários S29/S30. Mapa, lista e caderno apontam para a
// mesma definição de nó.
import type { JSX } from 'preact';
import { markFreshAttempt } from '../battle/duel-intro.tsx';
import { PortraitImage } from '../components/portrait.tsx';
import { useMemo, useState } from 'preact/hooks';
import { startAttempt } from '../../../application/battle.ts';
import { campaignView, nodeView, objectiveSummary, type NodeView } from '../../../application/campaign.ts';
import { claimDiscovery } from '../../../application/economy.ts';
import type { CampaignNode, Difficulty } from '../../../content/types.ts';
import type { NodeStatus } from '../../../domain/campaign/progress.ts';
import { go, loadViewState, saveViewState } from '../app/router.ts';
import { battleSession, confirmDialog, content, requireCtx, settings, snapshot, toast } from '../app/store.ts';
import { CardFace, DeckTile, RewardChip, coverFace, faceOf } from '../components/cards.tsx';
import { Button, EmptyState, PageHeader, Panel, ProgressBar, Segmented, Skeleton, Tabs } from '../components/controls.tsx';
import { Icon, type IconName } from '../components/icons.tsx';
import { CampaignMapScene } from '../components/scenes.tsx';
import { CHAPTER_TONE, MenuTile, TilePortrait, chapterHost } from '../components/menu-tile.tsx';

export const STATUS_LABEL: Record<NodeStatus, string> = { LOCKED: 'Bloqueado', AVAILABLE: 'Disponível', IN_PROGRESS: 'Em andamento', CLEARED: 'Concluído', MASTERED: 'Dominado' };
const KIND_LABEL: Record<CampaignNode['kind'], string> = { TUTORIAL: 'Tutorial', DUEL: 'Duelo', PUZZLE: 'Puzzle', DISCOVERY: 'Descoberta', ELITE: 'Elite', BOSS: 'Chefe', FINAL: 'Final' };
const KIND_ICON: Record<CampaignNode['kind'], IconName> = { TUTORIAL: 'help', DUEL: 'arena', PUZZLE: 'challenges', DISCOVERY: 'sparkle', ELITE: 'star', BOSS: 'medal', FINAL: 'flag' };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { STORY: 'História', STANDARD: 'Padrão', EXPERT: 'Especialista' };

export function NodeBadge({ status }: { readonly status: NodeStatus }): JSX.Element {
  const cls = status === 'LOCKED' ? 'badge-locked' : status === 'CLEARED' || status === 'MASTERED' ? 'badge-done' : status === 'IN_PROGRESS' ? 'badge-warn' : 'badge-new';
  return <span class={`badge ${cls}`}>{status === 'LOCKED' ? <Icon name="lock" size={14} /> : null}{STATUS_LABEL[status]}</span>;
}

function NodeRow({ node, status, selected, onSelect }: { readonly node: CampaignNode; readonly status: NodeStatus; readonly selected: boolean; readonly onSelect: () => void }): JSX.Element {
  return (
    <li>
      <button type="button" class={`list-row node-row ${selected ? 'is-active' : ''} status-${status.toLowerCase()}`} onClick={onSelect} aria-pressed={selected}
        aria-label={`${node.nodeId} ${node.title}, ${KIND_LABEL[node.kind]}, ${STATUS_LABEL[status]}${node.essential ? ', rota principal' : ', opcional'}`} data-testid={`node-${node.nodeId}`}>
        <span class={`node-icon kind-${node.kind.toLowerCase()}`}><Icon name={KIND_ICON[node.kind]} size={20} /></span>
        <span class="grow"><strong>{node.title}</strong><small class="muted"> · {node.nodeId} · {KIND_LABEL[node.kind]}{node.essential ? '' : ' · opcional'}</small></span>
        <NodeBadge status={status} />
      </button>
    </li>
  );
}

function NodeDetail({ view }: { readonly view: NodeView }): JSX.Element {
  const c = content.value!;
  const node = view.node;
  const locked = view.status === 'LOCKED';
  const missing = node.prerequisites.allOf.filter((id) => !snapshot.value?.campaignProgress.some((p) => p.nodeId === id && p.status === 'CLEARED'));
  return (
    <Panel title={node.title} class="node-detail">
      <div class="row"><NodeBadge status={view.status} /><span class="muted small">{KIND_LABEL[node.kind]} · {view.npcName}</span></div>
      <p class="muted">{dialogueText(node.dialogue.briefing)}</p>
      {locked ? <p class="small"><Icon name="lock" size={14} /> Requer: {missing.map((id) => c.nodes.get(id)?.title ?? id).join(', ')}</p> : null}
      {view.objectives.length ? (
        <ul class="list small">{view.objectives.map((o) => <li key={o.objective.objectiveId} class="row"><Icon name={o.done ? 'check' : 'star'} size={16} />{o.objective.description}</li>)}</ul>
      ) : null}
      <div class="row">
        {node.kind === 'DISCOVERY'
          ? <Button variant="primary" onClick={() => go('S28', { nodeId: node.nodeId })} disabledReason={locked ? 'Conclua os encontros anteriores.' : null}>{view.progress.discoveryChoice ? 'Ver escolha' : 'Escolher carta'}</Button>
          : <Button variant="primary" onClick={() => go('S16', { nodeId: node.nodeId })} disabledReason={locked ? 'Conclua os encontros anteriores.' : null} testId="open-briefing">{view.status === 'IN_PROGRESS' ? 'Retomar' : 'Abrir briefing'}</Button>}
      </div>
    </Panel>
  );
}

export function dialogueText(dialogueId: string): string {
  const d = content.value?.dialogues.get(dialogueId);
  return d ? d.lines.map((l) => l.text).join(' ') : dialogueId;
}

/** Rótulo curto do capítulo nas caixas: “Prólogo”, “Capítulo 3”, “Final”. */
function chapterKicker(chapterId: string): string {
  return chapterId === 'P00' ? 'Prólogo' : chapterId === 'F00' ? 'Final' : `Capítulo ${Number(chapterId.slice(1))}`;
}

/** Título sem o prefixo que a caixa já mostra (“Prólogo — Escola de Treinadores” → “Escola de Treinadores”). */
function chapterShortTitle(title: string): string {
  return title.replace(/^(Prólogo|Final)\s+—\s+/, '');
}

export function CampaignMapScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [state, setState] = useState(() => loadViewState('S19', { selected: '' as string, asList: false }));
  const update = (next: Partial<typeof state>) => { const s = { ...state, ...next }; setState(s); saveViewState('S19', s); };
  const view = useMemo(() => (c && snap ? campaignView(c, snap) : null), [c, snap]);
  if (!c || !snap || !view) return <Skeleton lines={8} />;
  const selectedId = state.selected || view.recommended?.nodeId || c.nodeList[0]!.nodeId;
  const nv = nodeView(c, snap, selectedId);
  return (
    <>
      <PageHeader title="Campanha" subtitle={`${view.completedNodes}/${view.totalNodes} encontros concluídos`}
        actions={<>
          <Button icon="map" onClick={() => update({ selected: view.recommended?.nodeId ?? selectedId })}>Centralizar progresso</Button>
          <Button onClick={() => update({ asList: !state.asList })} testId="toggle-list">{state.asList ? 'Ver mapa' : 'Ver como lista'}</Button>
          <Button variant="ghost" onClick={() => go('S26')}>Diário</Button>
        </>} />
      <nav class="chapter-strip" aria-label="Capítulos">
        {view.chapters.map((ch) => {
          const id = ch.chapter.chapterId;
          const host = chapterHost(c, id);
          const current = ch.nodes.some((n) => n.nodeId === selectedId);
          return (
            <MenuTile key={id} tone={CHAPTER_TONE[id] ?? 'blue'} class={current ? 'is-current' : ''} kicker={chapterKicker(id)} title={chapterShortTitle(ch.chapter.title)}
              subtitle={`${ch.cleared}/${ch.nodes.length} nós${ch.bossCleared ? ' · chefe vencido' : ''}`} art={<TilePortrait portraitKey={host?.portraitAssetKey} />}
              badge={ch.unlocked ? null : <Icon name="lock" size={16} />} onClick={() => go('S20', { chapterId: id })} testId={`chapter-${id}`}
              label={`${ch.chapter.title}, ${ch.cleared} de ${ch.nodes.length} concluídos${ch.unlocked ? '' : ', bloqueado'}`} />
          );
        })}
      </nav>
      <div class="campaign-body">
        <div class="campaign-center">
          {state.asList ? (
            <Panel title="Encontros">
              <ul class="list">{c.nodeList.map((n) => <NodeRow key={n.nodeId} node={n} status={view.statuses.get(n.nodeId)!} selected={n.nodeId === selectedId} onSelect={() => update({ selected: n.nodeId })} />)}</ul>
            </Panel>
          ) : (
            <CampaignMapScene nodes={c.nodeList} statuses={view.statuses} selected={selectedId} onSelect={(id) => update({ selected: id })} onOpen={(id) => go(c.nodes.get(id)?.kind === 'DISCOVERY' ? 'S28' : 'S16', { nodeId: id })} />
          )}
        </div>
        <div class="campaign-side">{nv ? <NodeDetail view={nv} /> : null}</div>
      </div>
    </>
  );
}

export function ChapterScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [selected, setSelected] = useState<string>('');
  if (!c || !snap) return <Skeleton />;
  const chapter = c.chapters.get(params.chapterId as never);
  if (!chapter) return <EmptyState title="Capítulo desconhecido" action={<Button onClick={() => go('S19')}>Voltar ao mapa</Button>} />;
  const view = campaignView(c, snap);
  const ch = view.chapters.find((x) => x.chapter.chapterId === chapter.chapterId)!;
  const selectedId = selected || ch.nodes.find((n) => view.statuses.get(n.nodeId) === 'AVAILABLE')?.nodeId || ch.nodes[0]!.nodeId;
  const nv = nodeView(c, snap, selectedId);
  return (
    <>
      <PageHeader title={chapter.title} subtitle={`${chapter.theme} · ${ch.cleared}/${ch.nodes.length} nós concluídos${ch.bossCleared ? ' · chefe vencido' : ''}`} backTo="/campaign"
        actions={<Button variant="ghost" onClick={() => go('S27', { chapterId: chapter.chapterId })}>Resumo do capítulo</Button>} />
      <div class="split">
        <div class="stack">
          <CampaignMapScene nodes={ch.nodes} statuses={view.statuses} selected={selectedId} chapterId={chapter.chapterId} onSelect={setSelected} onOpen={(id) => go(c.nodes.get(id)?.kind === 'DISCOVERY' ? 'S28' : 'S16', { nodeId: id })} />
          <Panel title="Encontros do capítulo">
            <ul class="list">{ch.nodes.map((n) => <NodeRow key={n.nodeId} node={n} status={view.statuses.get(n.nodeId)!} selected={n.nodeId === selectedId} onSelect={() => setSelected(n.nodeId)} />)}</ul>
          </Panel>
        </div>
        {nv ? <NodeDetail view={nv} /> : null}
      </div>
    </>
  );
}

export function BriefingScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const key = `S16:${params.nodeId}`;
  const [choice, setChoice] = useState(() => loadViewState(key, { difficulty: settings.value.defaultDifficulty as Difficulty, deckId: settings.value.favoriteDeckId ?? '', support: '' }));
  const [busy, setBusy] = useState(false);
  const update = (next: Partial<typeof choice>) => { const s = { ...choice, ...next }; setChoice(s); saveViewState(key, s); };
  if (!c || !snap) return <Skeleton />;
  const view = nodeView(c, snap, params.nodeId ?? '');
  if (!view) return <EmptyState title="Encontro desconhecido" action={<Button onClick={() => go('S19')}>Voltar ao mapa</Button>} />;
  const node = view.node;
  const npc = c.npcs.get(node.npcId);
  const prepared = !!node.fixtureId;
  const decks = snap.decks.filter((d) => !d.archived && d.confirmed?.entries.length === 20);
  const deck = decks.find((d) => d.deckId === choice.deckId) ?? decks[0] ?? null;
  const support = node.supportDeckIds.map((id) => c.decks.get(id)).filter((d) => !!d);
  const usingSupport = !!choice.support && support.some((d) => d.deckId === choice.support);
  const difficulty: Difficulty = view.difficulties.includes(choice.difficulty) ? choice.difficulty : view.difficulties[0] ?? 'STANDARD';
  const firstTable = c.rewardTables.get(node.firstClearRewardTableId);
  const repeatTable = node.repeatRewardTableId ? c.rewardTables.get(node.repeatRewardTableId) : null;
  const active = snap.activeAttempt;
  const locked = view.status === 'LOCKED';
  const start = async () => {
    if (active) {
      const resume = await confirmDialog({ title: 'Há um duelo suspenso', body: 'Retome ou abandone a tentativa atual antes de iniciar outra.', confirmLabel: 'Retomar duelo', cancelLabel: 'Ficar aqui' });
      if (resume) go('S23', { matchId: active.attemptId });
      return;
    }
    setBusy(true);
    const r = await startAttempt(requireCtx(), {
      mode: 'CAMPAIGN', nodeId: node.nodeId, difficulty, deckId: usingSupport || prepared ? null : deck?.deckId ?? null,
      ...(usingSupport ? { loanDeckId: choice.support } : {}),
    });
    setBusy(false);
    if (!r.ok) { toast(r.message, 'error'); return; }
    battleSession.value = r.session;
    markFreshAttempt(r.session.attemptId);
    go('S21', { attemptId: r.session.attemptId });
  };
  const noDeck = !prepared && !usingSupport && !deck;
  return (
    <>
      <PageHeader title={node.title} subtitle={`${node.nodeId} · ${KIND_LABEL[node.kind]}${node.essential ? ' · rota principal' : ' · opcional'}`} backTo="/campaign" />
      <div class="briefing">
        <Panel title={npc?.name ?? node.npcId} class="briefing-npc">
          <PortraitImage portraitKey={npc?.portraitAssetKey} label={`Retrato de ${npc?.name ?? 'adversário'}`} class="npc-portrait" />
          <p class="muted small">{npc?.title}</p>
          <p class="small">{npc?.style}</p>
          {npc && view.progress.wins + view.progress.losses > 0 && npc.notebook.hints[0] ? <p class="small"><Icon name="info" size={14} /> {npc.notebook.hints[0]}</p> : null}
          <Button size="sm" variant="ghost" onClick={() => go('S30', { npcId: node.npcId })}>Caderno de adversários</Button>
        </Panel>
        <Panel class="briefing-story">
          {prepared ? <span class="badge badge-warn">Cenário preparado</span> : null}
          <p>{dialogueText(node.dialogue.briefing)}</p>
          {prepared ? <p class="muted small">Mão e estado inicial fixos{node.turnLimit ? `, limite de ${node.turnLimit.ownTurns} turnos próprios` : ''}. O cenário é parte da lição, não uma vantagem escondida do adversário.</p> : null}
          {node.turnLimit && !prepared ? <p class="small">Regra especial: vencer em até {node.turnLimit.ownTurns} turnos próprios.</p> : null}
          {!prepared && view.difficulties.length ? (
            <div class="field">Dificuldade
              <Segmented label="Dificuldade" value={difficulty} onChange={(d) => update({ difficulty: d })} options={view.difficulties.map((d) => ({ id: d, label: DIFFICULTY_LABEL[d] }))} />
              <small>{difficulty === 'STORY' ? 'IA mais tolerante e lista com menos sinergia.' : difficulty === 'EXPERT' ? 'IA com busca mais profunda e lista afinada.' : 'Comportamento e lista de referência do encontro.'}</small>
            </div>
          ) : null}
          {view.assistance !== 'NONE' && support.length ? <p class="small"><Icon name="info" size={14} /> Dica: um deck de apoio está disponível para este encontro.</p> : null}
        </Panel>
        <div class="briefing-side stack-lg">
          <Panel title="Objetivos">
            {view.objectives.length ? (
              <ul class="list">{view.objectives.map((o) => (
                <li key={o.objective.objectiveId} class="list-row">
                  <Icon name={o.done ? 'check' : 'star'} size={18} />
                  <span class="grow small">{o.objective.description}{o.objective.requiresVictory ? '' : ' (não exige vitória)'}</span>
                  {o.done ? <span class="badge badge-done">Recebida</span> : o.objective.reward.credits ? <RewardChip kind="credits" amount={o.objective.reward.credits} label="Créditos" /> : null}
                </li>
              ))}</ul>
            ) : <p class="muted">Sem objetivos adicionais.</p>}
          </Panel>
          <Panel title="Recompensas">
            {!view.firstClearGranted && firstTable ? (
              <div class="stack">
                <span class="muted small">Primeira vitória</span>
                <div class="row">
                  {firstTable.credits ? <RewardChip kind="credits" amount={firstTable.credits} label="Créditos" /> : null}
                  {firstTable.packs.map((p) => <RewardChip key={p.productId} kind="pack" amount={p.count} label={c.products.get(p.productId)?.name ?? p.productId} />)}
                  {firstTable.medal ? <RewardChip kind="medal" label="Medalha" /> : null}
                  {node.keyCardReward ? <RewardChip kind="card" label={node.keyCardReward.mode === 'CHOICE' ? 'Carta-chave à escolha' : 'Carta-chave'} amount={node.keyCardReward.copies} /> : null}
                  {firstTable.cosmetics.map((id) => <RewardChip key={id} kind="cosmetic" label={c.cosmetics.get(id)?.names['pt-BR'] ?? id} />)}
                </div>
              </div>
            ) : <p class="small"><Icon name="check" size={14} /> Primeira recompensa já recebida.</p>}
            {repeatTable && repeatTable.credits ? <p class="small muted">Repetição: {repeatTable.credits} Créditos por vitória.</p> : null}
          </Panel>
          <Panel title="Deck">
            {prepared ? <p class="small">Este cenário usa um deck preparado.</p> : (
              <div class="stack">
                {deck && !usingSupport ? <DeckTile name={deck.name} energyTypes={deck.energyTypes} count={deck.entries.length} valid coverFace={coverFace(c, deck.entries.map((e) => e.printingId))} /> : null}
                {usingSupport ? <p class="small">Usando deck de apoio: <strong>{c.decks.get(choice.support)?.name}</strong>. Vitórias contam normalmente.</p> : null}
                <label class="field">Escolher deck
                  <select class="input" value={usingSupport ? `support:${choice.support}` : deck?.deckId ?? ''} onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    if (v.startsWith('support:')) update({ support: v.slice(8) });
                    else update({ deckId: v, support: '' });
                  }}>
                    {decks.map((d) => <option key={d.deckId} value={d.deckId}>{d.name}</option>)}
                    {support.map((d) => <option key={d.deckId} value={`support:${d.deckId}`}>Apoio: {d.name}</option>)}
                  </select>
                </label>
                {deck && !usingSupport ? <Button size="sm" variant="ghost" onClick={() => go('S12', { deckId: deck.deckId }, { returnTo: `/campaign/nodes/${node.nodeId}` })}>Editar deck</Button> : null}
              </div>
            )}
          </Panel>
          <div class="row">
            <Button variant="ghost" onClick={() => go('S19')}>Voltar ao mapa</Button>
            <Button variant="primary" size="lg" onClick={start} loading={busy} testId="start-node"
              disabledReason={locked ? 'Conclua os encontros anteriores.' : noDeck ? 'Confirme um deck de 20 cartas ou escolha um deck de apoio.' : null}>
              {active?.nodeId === node.nodeId ? 'Retomar tentativa' : view.status === 'CLEARED' || view.status === 'MASTERED' ? 'Repetir encontro' : 'Iniciar encontro'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ObjectivesScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [tab, setTab] = useState<'campaign' | 'mastery' | 'medals'>('campaign');
  if (!c || !snap) return <Skeleton />;
  const granted = new Set(snap.grants);
  const summary = objectiveSummary(c, snap);
  const rows = c.nodeList.flatMap((node) => [node.completionObjectiveId, ...node.optionalObjectiveIds].filter((x): x is string => !!x).map((id) => ({ node, objective: c.objectives.get(id)!, completion: id === node.completionObjectiveId })))
    .filter((r) => r.objective && (tab === 'campaign' ? r.completion : !r.completion));
  const medals = c.bundle.chapters.filter((ch) => ch.medalId);
  return (
    <>
      <PageHeader title="Objetivos e conquistas" subtitle={`${summary.done}/${summary.total} objetivos · ${summary.creditsEarned} Créditos recebidos · ${summary.creditsAvailable} ainda disponíveis`} />
      <Tabs label="Categorias" value={tab} onChange={setTab} tabs={[{ id: 'campaign', label: 'Campanha' }, { id: 'mastery', label: 'Domínio de encontros' }, { id: 'medals', label: 'Conquistas' }]} />
      <div style={{ marginTop: '16px' }}>
        {tab === 'medals' ? (
          <div class="grid-tiles">
            {medals.map((ch) => {
              const boss = c.nodeList.find((n) => n.chapterId === ch.chapterId && n.kind === 'BOSS');
              const won = boss ? snap.campaignProgress.some((p) => p.nodeId === boss.nodeId && p.status === 'CLEARED') : false;
              return <Panel key={ch.chapterId} title={ch.title}><div class="row"><Icon name="medal" size={32} /><span class={`badge ${won ? 'badge-done' : 'badge-locked'}`}>{won ? 'Medalha conquistada' : 'Vença o chefe do capítulo'}</span></div></Panel>;
            })}
          </div>
        ) : (
          <ul class="list">
            {rows.map(({ node, objective }) => {
              const done = granted.has(objective.grantKey);
              return (
                <li key={objective.objectiveId} class="list-row">
                  <Icon name={done ? 'check' : 'star'} />
                  <span class="grow"><strong class="small">{node.title}</strong><br /><span class="small">{objective.description}</span></span>
                  {done ? <span class="badge badge-done">Recebida</span> : <RewardChip kind="credits" amount={objective.reward.credits} label="Créditos" />}
                  <Button size="sm" variant="ghost" onClick={() => go('S16', { nodeId: node.nodeId })}>Ir</Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

export function JournalScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return <Skeleton />;
  const view = campaignView(c, snap);
  return (
    <>
      <PageHeader title="Diário da campanha" subtitle="Histórias já vividas, personagens conhecidos e cartas-chave." backTo="/campaign" />
      <div class="grid-tiles">
        {view.chapters.map((ch) => (
          <Panel key={ch.chapter.chapterId} title={ch.chapter.title}>
            {ch.unlocked ? (
              <div class="stack">
                <p class="small">{ch.chapter.journal.intro}</p>
                <ProgressBar value={ch.cleared} max={ch.nodes.length} label={`${ch.chapter.title}: progresso`} />
                <span class="muted small">{ch.cleared}/{ch.nodes.length} nós concluídos{ch.bossCleared ? ' · chefe vencido' : ''}</span>
                <Button size="sm" onClick={() => go('S27', { chapterId: ch.chapter.chapterId })}>Ler resumo</Button>
              </div>
            ) : <p class="muted small"><Icon name="lock" size={14} /> Capítulo ainda não alcançado.</p>}
          </Panel>
        ))}
      </div>
    </>
  );
}

export function JournalChapterScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return <Skeleton />;
  const view = campaignView(c, snap);
  const ch = view.chapters.find((x) => x.chapter.chapterId === params.chapterId);
  if (!ch) return <EmptyState title="Capítulo desconhecido" />;
  const npcs = [...new Set(ch.nodes.filter((n) => view.statuses.get(n.nodeId) !== 'LOCKED').map((n) => n.npcId))].map((id) => c.npcs.get(id)).filter((n) => !!n);
  const keyCards = ch.nodes.flatMap((n) => (n.keyCardReward && view.statuses.get(n.nodeId) !== 'LOCKED' ? n.keyCardReward.printingIds : []));
  return (
    <>
      <PageHeader title={ch.chapter.title} subtitle={ch.chapter.theme} backTo="/journal" />
      <div class="split">
        <Panel title="História">
          <div class="stack">
            <p>{ch.chapter.journal.intro}</p>
            {ch.bossCleared ? <p>{ch.chapter.journal.outro}</p> : <p class="muted small">O desfecho aparece depois de vencer o chefe do capítulo.</p>}
          </div>
        </Panel>
        <div class="stack-lg">
          <Panel title="Personagens conhecidos">
            <ul class="list">{npcs.map((n) => <li key={n.npcId} class="list-row"><Icon name="profile" /><span class="grow"><strong>{n.name}</strong><br /><small class="muted">{n.title}</small></span><Button size="sm" variant="ghost" onClick={() => go('S30', { npcId: n.npcId })}>Caderno</Button></li>)}</ul>
          </Panel>
          {keyCards.length ? <Panel title="Cartas-chave"><div class="row">{keyCards.map((id) => <CardFace key={id} face={faceOf(c, id)} size="xs" />)}</div></Panel> : null}
        </div>
      </div>
    </>
  );
}

export function DiscoveryScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!c || !snap) return <Skeleton />;
  const view = nodeView(c, snap, params.nodeId ?? '');
  if (!view || view.node.kind !== 'DISCOVERY' || !view.node.discoveryOffer) return <EmptyState title="Descoberta desconhecida" />;
  const chosen = view.progress.discoveryChoice;
  const confirm = async () => {
    if (!selected) return;
    setBusy(true);
    const r = await claimDiscovery(requireCtx(), view.node.nodeId, selected);
    setBusy(false);
    if (!r.ok) { toast(r.message, 'error'); return; }
    toast(`${faceOf(c, selected)?.name ?? 'Carta'} adicionada à coleção.`, 'success');
    setSelected(null);
  };
  const locked = view.status === 'LOCKED';
  return (
    <>
      <PageHeader title={chosen ? 'Descoberta concluída' : 'Escolha 1 recompensa'} subtitle={view.node.title} backTo="/campaign" />
      {locked ? <EmptyState title="Descoberta bloqueada" text="Conclua os encontros anteriores para escolher." /> : null}
      <div class="discovery-options" role="radiogroup" aria-label="Opções de Descoberta">
        {view.node.discoveryOffer.map((pid) => {
          const face = faceOf(c, pid);
          const isChosen = chosen === pid;
          return (
            <div key={pid} class={`discovery-option ${selected === pid || isChosen ? 'is-selected' : ''} ${chosen && !isChosen ? 'is-other' : ''}`}>
              <button type="button" role="radio" aria-checked={selected === pid || isChosen} disabled={!!chosen || locked} onClick={() => setSelected(pid)} class="card-link" data-testid={`discovery-${pid}`}>
                <CardFace face={face} size="lg" />
              </button>
              <strong>{face?.name}</strong>
              <span class="muted small">{face?.subtitle}</span>
              {isChosen ? <span class="badge badge-done">Sua escolha</span> : chosen ? <Button size="sm" variant="ghost" onClick={() => go('S33', {}, { focus: pid })}>Ver no Empório</Button> : null}
            </div>
          );
        })}
      </div>
      {selected && !chosen ? (
        <Panel title="Confirmar escolha" class="discovery-confirm">
          <p>Você receberá 1 cópia de <strong>{faceOf(c, selected)?.name}</strong>. A escolha é definitiva; as outras opções continuam à venda no Empório.</p>
          <div class="row">
            <Button variant="ghost" onClick={() => setSelected(null)}>Voltar às opções</Button>
            <Button variant="primary" onClick={confirm} loading={busy} testId="discovery-confirm">Receber esta carta</Button>
          </div>
        </Panel>
      ) : null}
    </>
  );
}

export function OpponentsScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return <Skeleton />;
  const view = campaignView(c, snap);
  const met = new Set(c.nodeList.filter((n) => view.statuses.get(n.nodeId) !== 'LOCKED').map((n) => n.npcId));
  return (
    <>
      <PageHeader title="Caderno de adversários" subtitle="Personagens encontrados e o que você já descobriu sobre cada um." />
      <div class="encounter-grid">
        {c.bundle.npcs.map((npc) => {
          const known = met.has(npc.npcId);
          return (
            <MenuTile key={npc.npcId} tone={known ? CHAPTER_TONE[npc.chapterId] ?? 'blue' : 'metal'} title={known ? npc.name : '???'} subtitle={known ? npc.title : 'Ainda não encontrado'}
              art={<PortraitImage portraitKey={npc.portraitAssetKey} label="" class="tile-portrait" unknown={!known} />} onClick={() => go('S30', { npcId: npc.npcId })}
              label={known ? `${npc.name}, ${npc.title}` : 'Adversário ainda não encontrado'} testId={`opponent-${npc.npcId}`} />
          );
        })}
      </div>
    </>
  );
}

export function OpponentScreen({ params }: { params: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return <Skeleton />;
  const npc = c.npcs.get(params.npcId ?? '');
  if (!npc) return <EmptyState title="Adversário desconhecido" />;
  const view = campaignView(c, snap);
  const nodes = c.nodeList.filter((n) => n.npcId === npc.npcId);
  const known = nodes.some((n) => view.statuses.get(n.nodeId) !== 'LOCKED');
  const fought = nodes.reduce((sum, n) => { const p = view.progress.get(n.nodeId); return sum + (p ? p.wins + p.losses : 0); }, 0);
  const won = nodes.some((n) => (view.progress.get(n.nodeId)?.wins ?? 0) > 0);
  const hintsShown = won ? npc.notebook.hints.length : fought > 0 ? Math.min(1, npc.notebook.hints.length) : 0;
  return (
    <>
      <PageHeader title={known ? npc.name : 'Adversário desconhecido'} subtitle={known ? npc.title : undefined} backTo="/opponents" />
      {!known ? <EmptyState title="Ainda não encontrado" text="Avance na campanha para conhecer este adversário." /> : (
        <div class="split">
          <Panel title="Perfil">
            <div class="stack">
              <PortraitImage portraitKey={npc.portraitAssetKey} label={`Retrato de ${npc.name}`} class="npc-portrait" />
              <p>{npc.notebook.origin}</p>
              <p class="small muted">Estilo: {npc.style}</p>
              <h3>Dicas reveladas</h3>
              {hintsShown ? <ul>{npc.notebook.hints.slice(0, hintsShown).map((h, i) => <li key={i} class="small">{h}</li>)}</ul> : <p class="muted small">Enfrente este adversário para revelar dicas.</p>}
            </div>
          </Panel>
          <Panel title="Encontros">
            <ul class="list">
              {nodes.map((n) => {
                const p = view.progress.get(n.nodeId);
                return (
                  <li key={n.nodeId} class="list-row">
                    <span class="grow"><strong>{n.title}</strong><br /><small class="muted">{p ? `${p.wins} vitórias · ${p.losses} derrotas` : 'Sem tentativas'}</small></span>
                    <NodeBadge status={view.statuses.get(n.nodeId)!} />
                    <Button size="sm" onClick={() => go('S16', { nodeId: n.nodeId })} disabledReason={view.statuses.get(n.nodeId) === 'LOCKED' ? 'Encontro bloqueado.' : null}>Briefing</Button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}


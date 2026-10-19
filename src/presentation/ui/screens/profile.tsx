// Perfil e registros locais (interface §33): S34 perfil/medalhas/estatísticas, S35 recibos e prêmios
// pendentes. S41/S42 (aparência) ficam em appearance.tsx.
import type { JSX } from 'preact';
import { playerPortraitKey } from '../../assets/portraits.ts';
import { PortraitPicker } from '../components/portrait.tsx';
import { useEffect, useState } from 'preact/hooks';
import { claimPendingReward } from '../../../application/economy.ts';
import { saveSettings } from '../../../application/profiles.ts';
import type { AttemptRow, QueryResultMap } from '../../../application/ports/storage.ts';
import { go } from '../app/router.ts';
import { content, credits, inventory, requireCtx, settings, snapshot, toast } from '../app/store.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { Button, EmptyState, ErrorState, KeyValue, PageHeader, Panel, Skeleton, Tabs } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';

export { AppearanceScreen, DeckAppearanceScreen } from './appearance.tsx';

type Attempts = readonly Omit<AttemptRow, 'state' | 'rng'>[];

function outcomeOf(a: Omit<AttemptRow, 'state' | 'rng'>): string | null {
  const r = a.result as { outcome?: string } | null;
  return r?.outcome ?? (a.status === 'ABANDONED' ? 'ABANDONED' : null);
}

export function ProfileScreen(): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [attempts, setAttempts] = useState<Attempts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(snap?.profile.displayName ?? '');
  useEffect(() => {
    if (!snap) return;
    requireCtx().storage.query({ kind: 'LIST_ATTEMPTS', profileId: snap.profile.profileId, limit: 1000, offset: 0 }).then(setAttempts, (e) => setError(String(e)));
  }, [snap?.profile.profileId]);
  if (!c || !snap) return <Skeleton />;
  const inv = inventory.value;
  const distinct = c.bundle.printings.filter((p) => (inv.get(p.printingId) ?? 0) > 0).length;
  const medals = c.bundle.chapters.filter((ch) => {
    const boss = c.nodeList.find((n) => n.chapterId === ch.chapterId && n.kind === 'BOSS');
    return boss && snap.campaignProgress.some((p) => p.nodeId === boss.nodeId && p.status === 'CLEARED');
  });
  const stats = (mode: string) => {
    const list = (attempts ?? []).filter((a) => a.mode === mode && (a.status === 'FINISHED' || a.status === 'ABANDONED'));
    const wins = list.filter((a) => outcomeOf(a) === 'WIN').length;
    const losses = list.filter((a) => outcomeOf(a) === 'LOSS').length;
    const other = list.length - wins - losses;
    return `${wins} vitórias · ${losses} derrotas${other ? ` · ${other} empates/abandonos` : ''}`;
  };
  const favorite = snap.decks.find((d) => d.deckId === settings.value.favoriteDeckId);
  return (
    <>
      <PageHeader title="Perfil local" subtitle="Dados deste save, guardados apenas neste dispositivo." />
      <div class="split">
        <div class="stack-lg">
          <Panel title="Identidade">
            <div class="stack">
              <label class="field">Nome de exibição
                <div class="row"><input class="input grow" value={name} maxLength={40} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
                  <Button onClick={async () => { if (!name.trim()) return; await saveSettings(requireCtx(), { displayNameOverride: name.trim() }); toast('Nome salvo.', 'success'); }}>Salvar</Button></div>
                <small>O nome original do perfil continua no histórico de operações.</small>
              </label>
              <div class="field">Avatar
                <PortraitPicker value={playerPortraitKey(snap.settings.avatar)} testId="profile-avatar"
                  onChange={async (avatar) => { await saveSettings(requireCtx(), { avatar }); toast('Avatar salvo.', 'success'); }} />
              </div>
              <KeyValue items={[
                ['Deck de destaque', favorite?.name ?? '—'],
                ['Créditos', credits.value],
                ['Cartas distintas', `${distinct} de ${c.bundle.printings.length} impressões`],
                ['Encontros concluídos', `${snap.campaignProgress.filter((p) => p.status === 'CLEARED').length} de ${c.nodeList.length}`],
                ['Criado em', new Date(snap.profile.createdAt).toLocaleDateString('pt-BR')],
              ]} />
            </div>
          </Panel>
          <Panel title="Estatísticas">
            {error ? <ErrorState text={error} /> : attempts === null ? <Skeleton lines={3} /> : (
              <KeyValue items={[['Campanha', stats('CAMPAIGN')], ['Arena', stats('ARENA')], ['Treino', stats('TRAINING')]]} />
            )}
            <p class="muted small">Calculadas a partir das tentativas registradas neste save.</p>
          </Panel>
        </div>
        <Panel title="Medalhas">
          {medals.length ? <ul class="list">{medals.map((ch) => <li key={ch.chapterId} class="list-row"><Icon name="medal" size={28} /><span class="grow"><strong>{ch.title}</strong><br /><small class="muted">Primeira vitória sobre o chefe do capítulo</small></span></li>)}</ul>
            : <EmptyState title="Nenhuma medalha ainda" text="Vença o chefe de um capítulo para ganhar sua medalha." />}
          <p class="muted small">Medalhas não concedem vantagens em combate.</p>
        </Panel>
      </div>
    </>
  );
}

type Receipts = QueryResultMap['LIST_RECEIPTS'];

const COMMAND_LABEL: Record<string, string> = {
  CREATE_PROFILE_ONBOARDING: 'Boas-vindas', BUY_PRODUCT: 'Compra no Empório', BUY_COSMETIC: 'Cosmético comprado', OPEN_PACK: 'Pacote aberto',
  CLAIM_DISCOVERY: 'Descoberta', CLAIM_PENDING_REWARD: 'Prêmio escolhido', FINISH_ATTEMPT: 'Resultado de duelo', PUBLISH_CARD: 'Carta publicada',
  GRANT_CUSTOM_COPIES: 'Cópias autorais', IMPORT_PROFILE: 'Perfil importado', CONFIRM_DECK: 'Deck confirmado', START_ATTEMPT: 'Duelo iniciado',
};

const RECEIPT_KINDS = ['CREATE_PROFILE_ONBOARDING', 'BUY_PRODUCT', 'BUY_COSMETIC', 'OPEN_PACK', 'CLAIM_DISCOVERY', 'CLAIM_PENDING_REWARD', 'FINISH_ATTEMPT', 'PUBLISH_CARD', 'GRANT_CUSTOM_COPIES', 'IMPORT_PROFILE'];

export function ReceiptsScreen({ query }: { query: Readonly<Record<string, string>> }): JSX.Element {
  const c = content.value;
  const snap = snapshot.value;
  const [receipts, setReceipts] = useState<Receipts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'all'>(query.reward ? 'pending' : snap?.pendingRewards.some((r) => r.status === 'PENDING') ? 'pending' : 'all');
  const load = () => {
    if (!snap) return;
    requireCtx().storage.query({ kind: 'LIST_RECEIPTS', profileId: snap.profile.profileId, limit: 300, offset: 0 }).then(setReceipts, (e) => setError(String(e)));
  };
  useEffect(load, [snap?.profile.revision]);
  if (!c || !snap) return <Skeleton />;
  const pending = snap.pendingRewards.filter((r) => r.status === 'PENDING');
  const readUntil = settings.value.receiptsReadUntil;
  const visible = (receipts ?? []).filter((r) => RECEIPT_KINDS.includes(r.commandType));
  const unread = visible.filter((r) => r.committedRevision > readUntil).length;
  const markRead = async () => {
    const max = Math.max(readUntil, ...visible.map((r) => r.committedRevision));
    await saveSettings(requireCtx(), { receiptsReadUntil: max });
  };
  const claim = async (rewardId: string, printingId: string) => {
    const r = await claimPendingReward(requireCtx(), rewardId, printingId);
    if (!r.ok) { toast(r.message, 'error'); return; }
    toast(`${faceOf(c, printingId)?.name ?? 'Carta'} adicionada à coleção.`, 'success');
  };
  return (
    <>
      <PageHeader title="Recibos e notificações" subtitle="Registro local de cartas recebidas, compras, pacotes e desbloqueios."
        actions={unread ? <Button onClick={markRead}>Marcar {unread} como lidos</Button> : null} />
      <Tabs label="Registros" value={tab} onChange={setTab} tabs={[{ id: 'pending', label: 'Prêmios pendentes', badge: pending.length }, { id: 'all', label: 'Recibos', badge: unread }]} />
      <div class="mt">
        {tab === 'pending' ? (
          pending.length ? (
            <div class="stack-lg">
              {pending.map((r) => {
                const options = r.options as { printingIds: string[]; copies: number };
                return (
                  <Panel key={r.rewardId} title="Escolha sua carta-chave">
                    <p class="muted small">Recebida em {new Date(r.createdAt).toLocaleString('pt-BR')} · {options.copies} cópia(s) da escolhida. Não expira.</p>
                    <div class="discovery-options">
                      {options.printingIds.map((pid) => (
                        <div key={pid} class="discovery-option">
                          <CardFace face={faceOf(c, pid)} size="md" />
                          <Button variant="primary" onClick={() => claim(r.rewardId, pid)}>Escolher</Button>
                        </div>
                      ))}
                    </div>
                  </Panel>
                );
              })}
            </div>
          ) : <EmptyState title="Nenhum prêmio pendente" />
        ) : error ? <ErrorState text={error} onRetry={load} /> : receipts === null ? <Skeleton /> : visible.length ? (
          <ul class="list">
            {visible.map((r) => (
              <li key={r.operationId} class={`list-row ${r.committedRevision > readUntil ? 'is-active' : ''}`}>
                <Icon name={r.commandType === 'OPEN_PACK' ? 'pack' : r.commandType.startsWith('BUY') ? 'emporium' : r.commandType === 'FINISH_ATTEMPT' ? 'arena' : 'check'} />
                <span class="grow"><strong>{COMMAND_LABEL[r.commandType] ?? r.commandType}</strong><br /><small class="muted">{describeReceipt(r.receipt.summary)} · {new Date(r.committedAt).toLocaleString('pt-BR')} · recibo {r.operationId.slice(-8)}</small></span>
                {r.commandType === 'OPEN_PACK' ? <Button size="sm" variant="ghost" onClick={() => go('S06', { openingId: String((r.receipt.summary as { openingId?: string }).openingId) })}>Rever</Button> : null}
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Nenhum recibo ainda" />}
      </div>
    </>
  );
}

function describeReceipt(summary: unknown): string {
  const s = (summary ?? {}) as Record<string, unknown>;
  const c = content.value;
  if (typeof s.productId === 'string') return c?.products.get(s.productId)?.name ?? s.productId;
  if (typeof s.printingId === 'string') return c ? faceOf(c, s.printingId)?.name ?? s.printingId : s.printingId;
  if (typeof s.nodeId === 'string') return c?.nodes.get(s.nodeId)?.title ?? s.nodeId;
  if (typeof s.credits === 'number') return `${s.credits} Créditos`;
  return '';
}

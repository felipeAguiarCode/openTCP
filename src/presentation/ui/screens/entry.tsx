// Entrada e perfis (interface §6): S00 boot, S48 entrada, S01 perfis, S02 novo jogo, S49 créditos,
// S50 diagnóstico e a tela de segunda aba (runtime §9). Sem login, sem rede.
import type { JSX } from 'preact';
import { DEFAULT_PLAYER_PORTRAIT, playerPortraitKey } from '../../assets/portraits.ts';
import { PortraitPicker } from '../components/portrait.tsx';
import { MenuTile, TileGrid, TileIcon, TilePortrait } from '../components/menu-tile.tsx';
import { useEffect, useState } from 'preact/hooks';
import { createProfile, listProfiles, archiveProfile } from '../../../application/profiles.ts';
import type { ProfileRow } from '../../../application/ports/storage.ts';
import { bootOutcome, bootServices, bootSteps, capabilityReport, closeProfile, gameContext, openProfile, profileIsLegacy, runBoot, webglAvailable } from '../app/boot.ts';
import { LEGACY_PROFILE_MESSAGE } from '../../../application/legacy.ts';
import { go, navigate, route } from '../app/router.ts';
import { confirmDialog, content, ctx, saveDeviceSettings, settings, snapshot, toast } from '../app/store.ts';
import { DeckTile, coverFace } from '../components/cards.tsx';
import { Button, ErrorState, Panel, Segmented, Skeleton } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import { contentDeckEntries } from '../../../application/content.ts';

declare const __APP_VERSION__: string;

export function BootScreen(): JSX.Element {
  useEffect(() => {
    const svc = bootServices();
    if (bootOutcome.value || !svc) return;
    void runBoot(svc).then((outcome) => {
      if (outcome.kind === 'READY') navigate(route.value.query.next ?? '/start', { replace: true });
      else if (outcome.kind === 'BLOCKED') navigate('/diagnostics', { replace: true });
    });
  }, []);
  const outcome = bootOutcome.value;
  if (outcome?.kind === 'SECOND_TAB') return <SecondTab />;
  return (
    <div class="bare-screen">
      <div class="panel entry-card" aria-busy={!outcome}>
        <div class="entry-title">Card Campaign</div>
        <p class="muted">Preparando o jogo neste dispositivo…</p>
        <BootChecklist />
      </div>
    </div>
  );
}

function BootChecklist(): JSX.Element {
  return (
    <ul class="boot-steps" aria-live="polite">
      {bootSteps.value.map((s) => (
        <li key={s.id}>
          <span class={s.status === 'OK' ? 'step-ok' : s.status === 'FAILED' ? 'step-fail' : 'step-pending'}>
            <Icon name={s.status === 'OK' ? 'check' : s.status === 'FAILED' || s.status === 'WARN' ? 'warning' : 'refresh'} size={18} />
          </span>
          <span class="grow">{s.label}{s.detail ? <small class="muted"> — {s.detail}</small> : null}</span>
        </li>
      ))}
    </ul>
  );
}

/** Outra aba detém o banco: nenhuma conexão aberta aqui (runtime §9; DB §20). */
function SecondTab(): JSX.Element {
  const [busy, setBusy] = useState(false);
  const transfer = async () => {
    const svc = bootServices();
    if (!svc?.requestTransfer) return;
    setBusy(true);
    const ok = await svc.requestTransfer();
    setBusy(false);
    if (ok) location.reload();
    else toast('A outra aba não liberou o jogo. Feche-a e tente novamente.', 'warning');
  };
  return (
    <div class="bare-screen">
      <div class="panel entry-card" role="alert">
        <div class="entry-title">O jogo já está aberto</div>
        <p>Outra aba deste navegador está usando o save. Para proteger seus dados, apenas uma aba pode jogar por vez.</p>
        <div class="entry-actions">
          <Button variant="primary" onClick={transfer} loading={busy}>Usar o jogo nesta aba</Button>
          <Button onClick={() => location.reload()} icon="refresh">Verificar novamente</Button>
        </div>
        <p class="muted small">A outra aba pausa o duelo em andamento, grava e libera o banco antes da transferência.</p>
      </div>
    </div>
  );
}

export function StartScreen(): JSX.Element {
  const snap = snapshot.value;
  const [profiles, setProfiles] = useState<readonly ProfileRow[] | null>(null);
  useEffect(() => { const c = ctx.value; if (c) void listProfiles(c).then(setProfiles); }, []);
  const chapter = snap ? currentChapterLabel() : null;
  const cont = () => {
    if (snap?.activeAttempt) go('S23', { matchId: snap.activeAttempt.attemptId });
    else if (snap) go('S03');
    else if (profiles?.length) go('S01');
    else go('S02');
  };
  const blocked = profiles !== null && profiles.length === 0 && !snap ? 'Nenhum perfil ainda — comece um novo jogo.' : null;
  const status = snap ? `${snap.profile.displayName}${chapter ? ` · ${chapter}` : ''} · salvo neste dispositivo` : profiles === null ? 'Lendo saves locais…' : profiles.length ? `${profiles.length} perfil(is) neste dispositivo` : 'Nenhum save neste dispositivo ainda.';
  return (
    <div class="bare-screen start-screen">
      <div class="start-layout">
        <div class="start-brand">
          <h1 class="entry-title">Card Campaign</h1>
          <p class="muted">Uma campanha de cartas para um jogador, inteira neste dispositivo.</p>
          <p class="muted small" role="status">Save: {status}</p>
          <a href="#/diagnostics" class="small">Diagnóstico</a>
        </div>
        <TileGrid class="start-tiles" label="Menu principal">
          <MenuTile size="hero" tone="blue" kicker={snap ? snap.profile.displayName : 'Saves locais'} title={snap?.activeAttempt ? 'Retomar duelo' : 'Continuar'}
            subtitle={chapter ?? (profiles?.length ? 'Escolha um perfil para continuar' : 'Nenhum save ainda')} cta={snap?.activeAttempt ? 'Retomar' : 'Jogar'}
            art={snap ? <TilePortrait portraitKey={playerPortraitKey(snap.settings.avatar)} /> : <TileIcon name="play" />}
            onClick={cont} testId="start-continue" autoFocus disabledReason={blocked} />
          <MenuTile tone="gold" title="Novo jogo" subtitle="Perfil novo com os oito decks iniciais" art={<TileIcon name="plus" />} onClick={() => go('S02')} testId="start-new" />
          <MenuTile tone="lavender" title="Perfis e saves" subtitle="Trocar de perfil, importar e exportar" art={<TileIcon name="profile" />} onClick={() => go('S01')} testId="start-profiles" />
          <MenuTile tone="metal" title="Configurações" subtitle="Vídeo, áudio, acessibilidade" art={<TileIcon name="settings" />} onClick={() => go('S36')} testId="start-settings" />
          <MenuTile tone="cyan" title="Créditos" subtitle="Licenças e origem dos dados" art={<TileIcon name="info" />} onClick={() => go('S49')} testId="start-credits" />
        </TileGrid>
      </div>
    </div>
  );
}

function currentChapterLabel(): string | null {
  const c = content.value;
  const snap = snapshot.value;
  if (!c || !snap) return null;
  const cleared = new Set(snap.campaignProgress.filter((p) => p.status === 'CLEARED').map((p) => p.nodeId));
  const next = c.nodeList.find((n) => n.essential && !cleared.has(n.nodeId));
  if (!next) return 'Campanha concluída';
  return c.chapters.get(next.chapterId)?.title ?? next.chapterId;
}

export function ProfilesScreen(): JSX.Element {
  const [profiles, setProfiles] = useState<readonly ProfileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState<ReadonlySet<string>>(new Set());
  const load = () => {
    const c = ctx.value;
    if (!c) return;
    listProfiles(c).then(async (rows) => {
      setProfiles(rows);
      const flags = await Promise.all(rows.map(async (r) => [r.profileId, await profileIsLegacy(r.profileId)] as const));
      setLegacy(new Set(flags.filter(([, old]) => old).map(([id]) => id)));
    }, (e) => setError(String(e)));
  };
  useEffect(load, []);
  const open = async (p: ProfileRow) => {
    const ok = await openProfile(p.profileId);
    if (ok) go('S03');
    else toast('Não foi possível abrir este perfil.', 'error');
  };
  const archive = async (p: ProfileRow) => {
    const ok = await confirmDialog({ title: `Arquivar “${p.displayName}”?`, body: ['O perfil sai da lista, mas os dados continuam no banco local e podem ser exportados em Saves.', 'Esta ação não apaga coleção nem campanha.'], confirmLabel: 'Arquivar perfil', tone: 'danger' });
    if (!ok || !ctx.value) return;
    if (snapshot.value?.profile.profileId === p.profileId) await closeProfile();
    await archiveProfile(ctx.value, p.profileId);
    load();
  };
  return (
    <div class="bare-screen">
      <div class="panel entry-card" style={{ width: 'min(760px, 100%)' }}>
        <div class="row-between"><h1>Perfis locais</h1><Button variant="ghost" icon="back" onClick={() => go('S48')}>Voltar</Button></div>
        <p class="muted">Cada perfil tem coleção, decks e campanha próprios. Nada é compartilhado entre eles.</p>
        {error ? <ErrorState text={error} onRetry={load} /> : profiles === null ? <Skeleton /> : (
          <ul class="list">
            {profiles.map((p) => (
              <li key={p.profileId} class={`list-row ${snapshot.value?.profile.profileId === p.profileId ? 'is-active' : ''}`}>
                <Icon name="profile" />
                <div class="grow"><strong>{p.displayName}</strong><div class="muted small">Atualizado em {new Date(p.updatedAt).toLocaleString('pt-BR')}{p.progressionMode !== 'STANDARD' ? ` · ${p.progressionMode}` : ''}</div>
                  {legacy.has(p.profileId) ? <div class="small legacy-profile" role="note" data-testid="legacy-profile">{LEGACY_PROFILE_MESSAGE}</div> : null}</div>
                <Button variant="primary" onClick={() => open(p)} disabledReason={legacy.has(p.profileId) ? LEGACY_PROFILE_MESSAGE : null}>Jogar</Button>
                <Button variant="ghost" onClick={() => archive(p)}>Arquivar</Button>
              </li>
            ))}
            {profiles.length === 0 ? <li class="muted">Nenhum perfil ainda.</li> : null}
          </ul>
        )}
        <div class="row">
          <Button variant="primary" icon="plus" onClick={() => go('S02')} disabledReason={profiles && profiles.length >= 3 ? 'Limite de 3 perfis ativos — arquive um para criar outro.' : null}>Novo perfil</Button>
          <Button icon="saves" onClick={() => go('S31')} disabledReason={ctx.value ? null : 'O banco local ainda não abriu.'}>Saves e backups</Button>
        </div>
      </div>
    </div>
  );
}


export function OnboardingScreen(): JSX.Element {
  const c = content.value;
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_PLAYER_PORTRAIT);
  const [textSize, setTextSize] = useState(settings.value.textSize);
  const [motion, setMotion] = useState(settings.value.reducedMotion);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c) return <div class="bare-screen"><Skeleton /></div>;
  const starters = c.bundle.onboarding.starterDeckIds.map((id) => c.decks.get(id)).filter((d) => !!d);
  const submit = async (e: Event) => {
    e.preventDefault();
    const game = gameContext();
    if (!game) return;
    if (!name.trim()) { setError('Escolha um nome de 1 a 40 caracteres.'); return; }
    if (!deckId) { setError('Escolha um deck de destaque.'); return; }
    setBusy(true);
    saveDeviceSettings({ textSize, reducedMotion: motion });
    const r = await createProfile(game, { displayName: name, favoriteDeckId: deckId, accessibility: { textSize, reducedMotion: motion, avatar } });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    await openProfile(r.profileId);
    toast('Perfil criado e salvo neste dispositivo.', 'success');
    go('S03');
  };
  return (
    <div class="bare-screen">
      <form class="panel entry-card" style={{ width: 'min(980px, 100%)' }} onSubmit={submit}>
        <div class="row-between"><h1>Novo jogo</h1><Button variant="ghost" icon="back" onClick={() => go('S48')}>Voltar</Button></div>
        <label class="field">Nome de exibição
          <input class="input" value={name} maxLength={40} onInput={(e) => setName((e.target as HTMLInputElement).value)} autoFocus data-testid="onboarding-name" />
          <small>Local, não precisa ser único. Pode ser alterado depois.</small>
        </label>
        <div class="field">Avatar <small>Um treinador da franquia; dá para trocar depois no Perfil.</small>
          <PortraitPicker value={avatar} onChange={setAvatar} testId="avatar-picker" />
        </div>
        <div class="row">
          <div class="field">Tamanho do texto<Segmented label="Tamanho do texto" value={textSize} onChange={setTextSize} options={[{ id: 'M', label: 'Padrão' }, { id: 'L', label: 'Grande' }, { id: 'XL', label: 'Muito grande' }]} /></div>
          <div class="field">Movimento<Segmented label="Movimento" value={motion} onChange={setMotion} options={[{ id: 'SYSTEM', label: 'Do sistema' }, { id: 'OFF', label: 'Completo' }, { id: 'ON', label: 'Reduzido' }]} /></div>
        </div>
        <div class="field">Deck de destaque <small>Todos os decks iniciais ficam disponíveis; a escolha só define o favorito.</small>
          <div class="grid-tiles" role="radiogroup" aria-label="Deck de destaque">
            {starters.map((d) => {
              const entries = contentDeckEntries(d);
              return (
                <div key={d.deckId} role="radio" aria-checked={deckId === d.deckId} data-testid={`starter-${d.deckId}`}>
                  <DeckTile name={d.name} energyTypes={d.energyTypes} count={entries.length} valid coverFace={coverFace(c, entries)} active={deckId === d.deckId} status={d.strategyNote} onClick={() => setDeckId(d.deckId)} />
                </div>
              );
            })}
          </div>
        </div>
        <p class="muted small">Seus dados ficam neste navegador. Faça uma cópia em Saves e backups.</p>
        {error ? <p class="field-error" role="alert">{error}</p> : null}
        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary" size="lg" type="submit" loading={busy} testId="onboarding-submit">Começar</Button>
        </div>
      </form>
    </div>
  );
}

export function CreditsScreen(): JSX.Element {
  return (
    <div class="bare-screen">
      <div class="panel entry-card" style={{ width: 'min(820px, 100%)' }}>
        <div class="row-between"><h1>Créditos do projeto</h1><Button variant="ghost" icon="back" onClick={() => history.length > 1 ? history.back() : go('S48')}>Voltar</Button></div>
        <p>Card Campaign é um projeto de fã, não oficial e sem fins comerciais, para uso local. As cartas são dos sets do Pokémon TCG Pocket do Genetic Apex (A1) ao Deluxe Pack ex (A4b), do Promo-A e do Promo-B: Pokémon e os nomes das cartas são marcas e propriedade de The Pokémon Company, Nintendo, Creatures e GAME FREAK. Os dados das cartas vêm do Limitless TCG; as regras foram reescritas e os textos traduzidos para este projeto. Os rivais são treinadores da franquia Pokémon, e os avatares usam os retratos deles; a campanha, os encontros e as falas foram escritos para este projeto.</p>
        <h2>Bibliotecas</h2>
        <ul>
          <li>Three.js — MIT</li>
          <li>SQLite (WASM, @sqlite.org/sqlite-wasm) — domínio público</li>
          <li>Preact e @preact/signals — MIT</li>
          <li>fflate — MIT</li>
          <li>Fonte Nunito — SIL Open Font License 1.1</li>
        </ul>
        <h2>Assets</h2>
        <p>Cada carta mostra a imagem da carta impressa (dados e imagens do Limitless TCG, © The Pokémon Company). O verso das cartas, os retratos dos treinadores, as bolas de Energia, os ícones de efeito e a frente dos pacotes são imagens de terceiros fornecidas pelo autor do projeto (as dos pacotes do Genetic Apex vêm do Serebii); as moedas e os sleeves do Pokémon TCG Pocket vêm do Serebii (a coroa da moeda é derivada da face). Tudo para uso local; tapetes e as demais moedas são texturas procedurais geradas a partir da paleta. Os textos completos das licenças estão na pasta <code>LICENSES/</code> do pacote.</p>
        <p class="muted small">Versão {typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'} · conteúdo {content.value?.bundle.version ?? '—'}</p>
      </div>
    </div>
  );
}

export function DiagnosticsScreen(): JSX.Element {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [deep, setDeep] = useState(false);
  const caps = capabilityReport();
  useEffect(() => {
    const c = ctx.value;
    if (!c) return;
    void c.storage.query({ kind: 'DIAGNOSTICS', deep }).then((r) => setReport(r as unknown as Record<string, unknown>), (e) => setReport({ error: String(e) }));
  }, [deep]);
  const exportReport = () => {
    const data = {
      generatedAt: new Date().toISOString(), app: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev', origin: location.origin, userAgent: navigator.userAgent,
      capabilities: caps, webgl2: webglAvailable.value, boot: bootSteps.value, outcome: bootOutcome.value, database: report,
      content: content.value ? { version: content.value.bundle.version, hash: content.value.bundle.contentHash } : null,
      activeAttempt: snapshot.value?.activeAttempt?.attemptId ?? null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `card-campaign-diagnostico-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const outcome = bootOutcome.value;
  return (
    <div class="bare-screen">
      <div class="panel entry-card" style={{ width: 'min(920px, 100%)' }}>
        <div class="row-between"><h1>Diagnóstico e recuperação</h1><Button variant="ghost" icon="back" onClick={() => go(snapshot.value ? 'S03' : 'S48')}>Voltar</Button></div>
        {outcome?.kind === 'BLOCKED' ? <ErrorState title="O jogo não pode gravar neste navegador" text={`${outcome.message} (${outcome.code}). Nenhum save foi apagado.`} /> : null}
        <Panel title="Verificações de boot" class="soft"><BootChecklist /></Panel>
        <Panel title="Capacidades" class="soft">
          <ul class="boot-steps">
            {Object.entries(caps).map(([k, v]) => <li key={k}><span class={v ? 'step-ok' : 'step-fail'}><Icon name={v ? 'check' : 'warning'} size={18} /></span>{k}</li>)}
            <li><span class={webglAvailable.value ? 'step-ok' : 'step-fail'}><Icon name={webglAvailable.value ? 'check' : 'warning'} size={18} /></span>WebGL2</li>
          </ul>
        </Panel>
        {report ? (
          <Panel title="Banco local" class="soft" actions={<Button size="sm" onClick={() => setDeep(true)} disabledReason={deep ? 'Verificação completa já executada.' : null}>Verificação completa</Button>}>
            <pre class="small" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(report, null, 2)}</pre>
          </Panel>
        ) : null}
        <div class="row">
          <Button icon="download" onClick={exportReport}>Exportar relatório</Button>
          <Button icon="refresh" onClick={() => location.reload()}>Tentar novamente</Button>
          {ctx.value ? <Button icon="saves" onClick={() => go('S31')}>Exportar backup</Button> : null}
          {webglAvailable.value === false ? <Button onClick={() => { saveDeviceSettings({ presentation2d: true }); go(snapshot.value ? 'S03' : 'S48'); }}>Continuar em 2D</Button> : null}
        </div>
        <p class="muted small">Nenhuma ação desta tela apaga saves. Apagar dados fica em Saves e backups, com confirmação própria.</p>
      </div>
    </div>
  );
}


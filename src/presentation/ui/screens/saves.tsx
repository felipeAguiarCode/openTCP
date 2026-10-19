// S31 — Saves, backup e importação (interface-16x9.md §31; persistencia-sqlite.md §23–§25; runtime §7).
// Perfis à esquerda, detalhes ao centro, ações à direita; abaixo, armazenamento do navegador, cópias anteriores do
// banco e a zona de risco. Toda validação de arquivo acontece antes de qualquer escrita; nada aqui pede senha de
// nuvem nem envia dados a serviço algum.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { reloadSnapshot } from '../../../application/context.ts';
import type { BackupInspection } from '../../../application/ports/storage.ts';
import {
  archiveFromExportData, archiveProfileById, exportFullBackup, exportProfileArchive, formatBytes, importProfileArchive, listProfileSummaries,
  parseProfileArchive, pickBackupFiles, planRestore, precheckBackup, previewProfileImport, renameProfile, restoreInstallation, savesFailure,
  SAVE_STATE_LABEL, spaceShortfall, stateForArchiveReason, stateForCode, wipeAllLocalData,
  type ImportPreview, type ParsedProfileArchive, type ProfileSummary, type RestorePlan, type SaveFileState, type SavesFailure,
} from '../../../application/saves.ts';
import * as io from '../../../infrastructure/files/saves-io.ts';
import { closeProfile, openProfile } from '../app/boot.ts';
import { LEGACY_PROFILE_MESSAGE } from '../../../application/legacy.ts';
import { suspendForTransfer, transferredAway } from '../app/lifecycle.ts';
import { go } from '../app/router.ts';
import { confirmDialog, content, ctx, requireCtx, snapshot, toast } from '../app/store.ts';
import { Button, EmptyState, ErrorState, KeyValue, Modal, PageHeader, Panel, ProgressBar, Segmented, Skeleton } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';
import '../styles/saves.css';

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
/** Perfis ativos propostos na tela inicial (interface §7; limite configurável). */
const ACTIVE_PROFILE_LIMIT = 3;

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

function StateBadge({ state }: { readonly state: SaveFileState }): JSX.Element {
  const tone = state === 'VALID' ? 'badge-done' : state === 'MISSING_CONTENT' || state === 'NO_SPACE' || state === 'OTHER_TAB' ? 'badge-warn' : 'badge-danger';
  return <span class={`badge ${tone}`} data-testid="save-state">{SAVE_STATE_LABEL[state]}</span>;
}

function FailureBox({ failure }: { readonly failure: SavesFailure }): JSX.Element {
  return (
    <div class="saves-failure" role="alert">
      <div class="row"><Icon name="warning" /><StateBadge state={failure.state} /><code class="small">{failure.code}</code></div>
      <p>{failure.message}</p>
      {failure.details?.length ? <ul class="small">{failure.details.slice(0, 8).map((d) => <li key={d}>{d}</li>)}</ul> : null}
      <p class="muted small">Nada foi gravado: o banco atual continua como estava.</p>
    </div>
  );
}

// ---------------------------------------------------------------- importação de perfil

type ImportFlow =
  | { readonly step: 'working'; readonly fileName: string; readonly label: string }
  | { readonly step: 'failed'; readonly fileName: string; readonly failure: SavesFailure }
  | { readonly step: 'preview'; readonly fileName: string; readonly archive: ParsedProfileArchive; readonly preview: ImportPreview; readonly fingerprint: string; readonly shortfall: number; readonly sourceKind: 'PROFILE_ZIP_4' | 'DATABASE_BACKUP' }
  | { readonly step: 'done'; readonly fileName: string; readonly profileId: string; readonly name: string; readonly replaced: string | null };

function ImportModal({ flow, onClose, onImport, activeCount, currentName }: {
  readonly flow: ImportFlow; readonly onClose: () => void; readonly onImport: (replace: boolean) => void; readonly activeCount: number; readonly currentName: string | null;
}): JSX.Element {
  const title = flow.step === 'done' ? 'Perfil importado' : 'Importar perfil';
  if (flow.step === 'working') {
    return <Modal open title={title}><div class="stack" aria-live="polite"><p>{flow.label}</p><p class="muted small">{flow.fileName}</p><Skeleton lines={3} /></div></Modal>;
  }
  if (flow.step === 'failed') {
    return <Modal open title={title} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>Fechar</Button>}><p class="muted small">{flow.fileName}</p><FailureBox failure={flow.failure} /></Modal>;
  }
  if (flow.step === 'done') {
    return (
      <Modal open title={title} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>Concluir</Button>}>
        <div class="stack" role="status"><p><StateBadge state="VALID" /> “{flow.name}” agora é um perfil novo neste navegador, com identidade própria.</p>
          {flow.replaced ? <p>O perfil “{flow.replaced}” foi arquivado: continua no banco, com recibos e replays, e pode ser exportado.</p> : null}</div>
      </Modal>
    );
  }
  const p = flow.preview;
  const state: SaveFileState = flow.shortfall > 0 ? 'NO_SPACE' : p.state;
  const reason = flow.shortfall > 0 ? `Falta espaço no navegador (${formatBytes(flow.shortfall)}).` : p.blocking[0] ?? null;
  return (
    <Modal open wide title={title} onClose={onClose} actions={<>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      {currentName ? <Button variant="danger" onClick={() => onImport(true)} disabledReason={reason} testId="import-replace">Substituir “{currentName}”…</Button> : null}
      <Button variant="primary" icon="upload" onClick={() => onImport(false)} disabledReason={reason} testId="import-as-new">Importar como novo perfil</Button>
    </>}>
      <div class="saves-preview">
        <div class="stack">
          <div class="row"><StateBadge state={state} /><span class="muted small">{flow.fileName}</span></div>
          <KeyValue items={[
            ['Perfil', <strong data-testid="import-name">{p.profileName}</strong>],
            ['Modo', p.progressionMode === 'STANDARD' ? 'Campanha padrão' : p.progressionMode],
            ['Capítulo', p.chapterLabel ?? '—'],
            ['Nós concluídos', p.nodesCleared],
            ['Cartas possuídas', `${p.cardsOwned} (${p.distinctCards} diferentes)`],
            ['Decks', p.decks],
            ['Duelo suspenso', p.suspendedDuel ? 'Sim — volta pausado' : 'Não'],
            ['Cartas autorais', p.customCards],
            ['Artes importadas', `${p.assets} (${formatBytes(p.assetBytes)})`],
            ['Exportado em', `${fmtDate(p.exportedAt)} · jogo ${p.appVersion}`],
            ['Versões', `perfil portátil formato ${p.formatVersion}${p.campaignVersions.length ? ` · campanha ${p.campaignVersions.join(', ')}` : ''}`],
          ]} />
        </div>
        <div class="stack">
          <h3>Pacotes de conteúdo exigidos</h3>
          <ul class="saves-checks">
            {p.packages.map((pkg) => <li key={`${pkg.packageId}@${pkg.version}`}><Icon name={pkg.status === 'OK' ? 'check' : 'warning'} size={18} />{pkg.packageId} {pkg.version} — {pkg.status === 'OK' ? 'instalado' : pkg.status === 'MISSING' ? 'ausente' : 'versão diferente'}</li>)}
          </ul>
          {p.blocking.length ? <div class="saves-failure" role="alert"><strong>Não é possível importar</strong><ul class="small">{p.blocking.map((b) => <li key={b}>{b}</li>)}</ul></div> : null}
          {flow.shortfall > 0 ? <div class="saves-failure" role="alert"><StateBadge state="NO_SPACE" /> Libere {formatBytes(flow.shortfall)} no navegador antes de importar.</div> : null}
          {p.warnings.length ? <ul class="saves-warnings small">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
          {activeCount >= ACTIVE_PROFILE_LIMIT ? <p class="saves-warnings small">Você já tem {activeCount} perfis ativos; a tela inicial propõe até {ACTIVE_PROFILE_LIMIT}. Importar como novo cria mais um — arquive um perfil se preferir.</p> : null}
          <p class="muted small">Importar como novo é o padrão: o arquivo vira um perfil independente, com IDs locais novos. Substituir não mescla carteiras, coleções nem tentativas — o perfil atual é arquivado depois da importação.</p>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- restauração de backup completo

type RestoreFlow =
  | { readonly step: 'working'; readonly fileName: string; readonly label: string }
  | { readonly step: 'failed'; readonly fileName: string; readonly failure: SavesFailure }
  | { readonly step: 'plan'; readonly plan: RestorePlan; readonly inspector: io.BackupInspector; readonly shortfall: number }
  | { readonly step: 'restoring' };

function RestoreModal({ flow, onClose, onRestore, onImportOne, onExportFirst, currentProfiles }: {
  readonly flow: RestoreFlow; readonly onClose: () => void; readonly onRestore: () => void; readonly onImportOne: (profileId: string) => void;
  readonly onExportFirst: () => void; readonly currentProfiles: number;
}): JSX.Element {
  const [pick, setPick] = useState<string | null>(null);
  const title = 'Restaurar backup completo';
  if (flow.step === 'working' || flow.step === 'restoring') {
    const label = flow.step === 'restoring' ? 'Trocando o banco deste navegador pelo backup validado… Não feche a aba.' : flow.label;
    return <Modal open title={title}><div class="stack" aria-live="polite"><p>{label}</p>{flow.step === 'working' ? <p class="muted small">{flow.fileName}</p> : null}<Skeleton lines={3} /></div></Modal>;
  }
  if (flow.step === 'failed') {
    return <Modal open title={title} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>Fechar</Button>}><p class="muted small">{flow.fileName}</p><FailureBox failure={flow.failure} /></Modal>;
  }
  const { plan } = flow;
  const insp: BackupInspection = plan.inspection;
  const reason = flow.shortfall > 0 ? `Falta espaço no navegador (${formatBytes(flow.shortfall)}).` : null;
  const selected = pick ?? plan.profiles[0]?.profileId ?? null;
  return (
    <Modal open wide title={title} onClose={onClose} actions={<>
      <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      <Button icon="download" onClick={onExportFirst}>Exportar o backup atual antes</Button>
      <Button variant="danger" onClick={onRestore} disabledReason={reason ?? (plan.profiles.length ? null : 'O backup não contém perfis.')} testId="restore-confirm">Substituir a instalação inteira…</Button>
    </>}>
      <div class="saves-preview">
        <div class="stack">
          <div class="row"><StateBadge state={reason ? 'NO_SPACE' : 'VALID'} /><span class="muted small">{plan.precheck.fileName}</span></div>
          <KeyValue items={[
            ['Tamanho', formatBytes(plan.precheck.bytes)],
            ['SHA-256', <code class="small">{plan.precheck.sha256.slice(0, 16)}…</code>],
            ['Manifesto', plan.precheck.manifest ? `conferido · criado em ${fmtDate(plan.precheck.manifest.createdAt)}` : 'ausente'],
            ['Jogo que gravou', insp.appVersion ?? plan.precheck.manifest?.appVersion ?? '—'],
            ['Schema do banco', `user_version ${insp.userVersion}`],
            ['Artes importadas', `${insp.importedAssets} (${formatBytes(insp.importedAssetBytes)})`],
            ['Linhas validadas', insp.rows.toLocaleString('pt-BR')],
          ]} />
          <h3>Verificações aprovadas</h3>
          <ul class="saves-checks small">{insp.checks.map((c) => <li key={c}><Icon name="check" size={16} />{c}</li>)}</ul>
        </div>
        <div class="stack">
          <h3>Perfis no backup ({plan.profiles.length})</h3>
          <ul class="list" role="radiogroup" aria-label="Perfis do backup">
            {plan.profiles.map((p) => (
              <li key={p.profileId}>
                <label class={`list-row saves-radio ${selected === p.profileId ? 'is-active' : ''}`}>
                  <input type="radio" name="backup-profile" checked={selected === p.profileId} onChange={() => setPick(p.profileId)} />
                  <div class="grow"><strong>{p.displayName}</strong>{p.archived ? <span class="badge badge-locked">Arquivado</span> : null}
                    <div class="muted small">{p.chapterLabel ?? 'Campanha'} · {p.nodesCleared} nós · {p.cardsOwned} cartas · {p.decks} decks{p.activeAttempt ? ' · duelo suspenso' : ''} · {fmtDate(p.updatedAt)}</div></div>
                </label>
              </li>
            ))}
          </ul>
          <Button size="sm" icon="upload" onClick={() => selected && onImportOne(selected)} disabledReason={selected ? null : 'Escolha um perfil.'} testId="restore-import-one">Importar só este perfil como novo</Button>
          {plan.warnings.length ? <ul class="saves-warnings small">{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
          <p class="small"><strong>Substituir a instalação</strong> troca os {currentProfiles} perfil(is) atuais pelos {plan.profiles.length} do backup. O banco atual fica guardado neste navegador em “Cópias anteriores” até você descartá-lo. Duelos em andamento são pausados antes da troca.</p>
          {reason ? <div class="saves-failure" role="alert"><StateBadge state="NO_SPACE" /> {reason}</div> : null}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- tela

type Storage = { readonly usage: number | null; readonly quota: number | null; readonly persisted: boolean | null };

export function SavesScreen(): JSX.Element {
  const [profiles, setProfiles] = useState<readonly ProfileSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(snapshot.value?.profile.profileId ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [previous, setPrevious] = useState<readonly io.OpfsEntry[] | null>(null);
  const [lastState, setLastState] = useState<{ state: SaveFileState; text: string } | null>(null);
  const [renaming, setRenaming] = useState<{ profileId: string; name: string } | null>(null);
  const [backupFormat, setBackupFormat] = useState<'FILES' | 'ZIP'>('FILES');
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importFlow, setImportFlow] = useState<ImportFlow | null>(null);
  const [restoreFlow, setRestoreFlow] = useState<RestoreFlow | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeAck, setWipeAck] = useState(false);
  const currentId = snapshot.value?.profile.profileId ?? null;
  const c = content.value;

  const load = async (select?: string): Promise<void> => {
    const game = ctx.value;
    if (!game) return;
    try {
      const list = await listProfileSummaries(game, content.value);
      setProfiles(list);
      setLoadError(null);
      if (select) setSelectedId(select);
      else if (!list.some((p) => p.profileId === selectedId)) setSelectedId(currentId ?? list[0]?.profileId ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };
  const refreshStorage = async (): Promise<void> => {
    setStorage(await io.storageStatus());
    try { setPrevious(await io.opfsList(io.BACKUPS_DIR)); } catch { setPrevious([]); }
  };
  useEffect(() => { void load(); void refreshStorage(); }, []);

  const selected = profiles?.find((p) => p.profileId === selectedId) ?? null;
  const active = profiles?.filter((p) => !p.archived) ?? [];
  const currentName = profiles?.find((p) => p.profileId === currentId)?.displayName ?? null;
  const otherTab = transferredAway.value;
  const blockReason = otherTab ? SAVE_STATE_LABEL.OTHER_TAB : busy ? 'Aguarde a operação em andamento.' : null;

  const run = async (key: string, body: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(key);
    try { await body(); } catch (e) {
      const failure = savesFailure('SAVE_WRITE_FAILED', e instanceof Error ? e.message : String(e));
      setLastState({ state: failure.state, text: failure.message });
      toast(failure.message, 'error');
    } finally { setBusy(null); }
  };
  const reportFailure = (f: SavesFailure): void => {
    setLastState({ state: f.state, text: f.message });
    toast(f.message, 'error');
  };

  // ---- ações de perfil

  const resume = (p: ProfileSummary) => run('resume', async () => {
    if (p.legacyCatalog) { toast(LEGACY_PROFILE_MESSAGE, 'error'); return; }
    if (p.profileId !== currentId) {
      const ok = await openProfile(p.profileId);
      if (!ok) { toast('Não foi possível abrir este perfil.', 'error'); return; }
    }
    go('S03');
  });

  const saveRename = () => run('rename', async () => {
    if (!renaming) return;
    const r = await renameProfile(requireCtx(), renaming.profileId, renaming.name);
    if (!r.ok) { toast(r.message, 'error'); return; }
    if (renaming.profileId === currentId) await reloadSnapshot(requireCtx());
    setRenaming(null);
    toast('Nome salvo neste dispositivo. O histórico do perfil não muda.', 'success');
    await load(renaming.profileId);
  });

  const exportProfile = (p: ProfileSummary) => run('export-profile', async () => {
    const ok = await confirmDialog({
      title: `Exportar “${p.displayName}”`,
      body: [
        'Inclui só este perfil: coleção, carteira, decks e revisões, campanha, duelos (inclusive o suspenso), replays, recompensas, aparência, fichários, projetos do Estúdio, cartas autorais que ele usa e as artes importadas (bytes incluídos).',
        'Não inclui outros perfis. Artes, sons e modelos distribuídos com o jogo continuam exigindo o pacote de conteúdo compatível.',
        'Formato: .campaign-profile.zip (perfil portátil, formato 4).',
      ],
      confirmLabel: 'Exportar perfil',
    });
    if (!ok) return;
    const r = await exportProfileArchive(requireCtx(), p.profileId, { appVersion: APP_VERSION });
    if (!r.ok) { reportFailure(r); return; }
    io.downloadBytes(r.fileName, io.writeZip(r.files.map((f) => ({ name: f.name, bytes: f.bytes, compress: f.compress }))), 'application/zip');
    setLastState({ state: 'VALID', text: `Perfil exportado: ${r.fileName}` });
    toast(`Perfil exportado: ${r.fileName}`, 'success');
  });

  const archive = (p: ProfileSummary) => run('archive', async () => {
    const ok = await confirmDialog({
      title: `Arquivar “${p.displayName}”?`,
      body: ['O perfil sai das listas de jogo, mas os dados continuam no banco local — recibos, replays e coleção — e podem ser exportados aqui.', 'Arquivar não é apagar.'],
      confirmLabel: 'Arquivar perfil', tone: 'danger',
    });
    if (!ok) return;
    // Arquivar o perfil atual: pausa o duelo em curso antes (o arquivamento preserva a tentativa).
    if (p.profileId === currentId) await suspendForTransfer();
    const done = await archiveProfileById(requireCtx(), p.profileId);
    if (!done) { toast('Não foi possível arquivar o perfil.', 'error'); return; }
    toast(`“${p.displayName}” foi arquivado.`, 'success');
    if (p.profileId === currentId) { await closeProfile(); go('S01'); return; }
    await load();
  });

  // ---- backup completo

  const doExportBackup = async (format: 'FILES' | 'ZIP'): Promise<boolean> => {
    const r = await exportFullBackup(requireCtx(), { appVersion: APP_VERSION, sha256: io.sha256HexAsync });
    if (!r.ok) { reportFailure(r); return false; }
    const { database, manifest, files } = r.backup;
    const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
    if (format === 'ZIP') {
      io.downloadBytes(files.zipName, io.writeZip([{ name: files.databaseName, bytes: database }, { name: files.manifestName, bytes: manifestBytes }]), 'application/zip');
    } else {
      io.downloadBytes(files.databaseName, database, 'application/vnd.sqlite3');
      setTimeout(() => io.downloadBytes(files.manifestName, manifestBytes, 'application/json'), 500);
    }
    setLastState({ state: 'VALID', text: `Backup exportado: ${files.databaseName} (${formatBytes(database.length)})` });
    toast(`Backup completo exportado (${formatBytes(database.length)}).`, 'success');
    return true;
  };

  // ---- importar perfil

  const startImport = () => run('import', async () => {
    const files = await io.pickFiles('.zip,application/zip', false);
    const file = files[0];
    if (!file) return;
    setImportFlow({ step: 'working', fileName: file.name, label: 'Lendo e validando o arquivo… nada é aplicado antes do resumo.' });
    const fail = (f: SavesFailure) => { setImportFlow({ step: 'failed', fileName: file.name, failure: f }); setLastState({ state: f.state, text: f.message }); };
    const read = await io.readPickedFiles([file]);
    if (!read.ok) { fail(savesFailure('IMPORT_INVALID', `O arquivo tem ${formatBytes(read.size)}; o limite é ${formatBytes(read.limit)}.`, 'SIZE_LIMIT')); return; }
    const bytes = read.files[0]!.bytes;
    const zip = io.readZip(bytes, io.PROFILE_ZIP_LIMITS, (name) => /^(manifest|profile)\.json$|^content\/[a-z-]+\.json$|^assets\/[0-9a-f]{64}\.(png|jpg|webp)$/.test(name));
    if (!zip.ok) { fail(savesFailure('IMPORT_INVALID', `Arquivo recusado: ${zip.message}`, stateForArchiveReason(zip.reason))); return; }
    const parsed = parseProfileArchive(zip.entries);
    if (!parsed.ok) { fail(parsed); return; }
    const fingerprint = await io.sha256HexAsync(bytes);
    const preview = await previewProfileImport(requireCtx(), parsed.archive, fingerprint, content.value);
    const status = await io.storageStatus();
    setImportFlow({ step: 'preview', fileName: file.name, archive: parsed.archive, preview, fingerprint, shortfall: spaceShortfall(status, bytes.length * 2), sourceKind: 'PROFILE_ZIP_4' });
    setLastState({ state: preview.state, text: `${file.name}: ${SAVE_STATE_LABEL[preview.state]}` });
  });

  const confirmImport = (replace: boolean) => {
    const flow = importFlow;
    if (!flow || flow.step !== 'preview') return;
    void run('import-commit', async () => {
      const replaceId = replace ? currentId : null;
      if (replace && currentName) {
        const ok = await confirmDialog({
          title: `Substituir “${currentName}”?`,
          body: [
            `“${flow.preview.profileName}” entra como um perfil novo e “${currentName}” é arquivado logo depois — com coleção, recibos e replays preservados no banco.`,
            'Nada é mesclado: carteiras, coleções e tentativas não se misturam.',
            `Recomendado: exporte “${currentName}” antes (Exportar perfil).`,
          ],
          confirmLabel: `Substituir “${currentName}”`, tone: 'danger',
        });
        if (!ok) return;
        await suspendForTransfer();
      }
      setImportFlow({ step: 'working', fileName: flow.fileName, label: 'Importando numa única transação…' });
      const r = await importProfileArchive(requireCtx(), flow.archive, { fingerprint: flow.fingerprint, sourceKind: flow.sourceKind, replaceProfileId: replaceId, content: content.value });
      if (!r.ok) { setImportFlow({ step: 'failed', fileName: flow.fileName, failure: r }); setLastState({ state: r.state, text: r.message }); return; }
      if (r.archiveFailed) toast('O perfil novo foi importado, mas arquivar o anterior falhou; arquive-o manualmente.', 'warning');
      if (replaceId && r.archivedProfileId === replaceId) await openProfile(r.profileId);
      setImportFlow({ step: 'done', fileName: flow.fileName, profileId: r.profileId, name: flow.preview.profileName, replaced: replaceId ? currentName : null });
      setLastState({ state: 'VALID', text: `Importado como novo perfil: ${flow.preview.profileName}` });
      await load(r.profileId);
    });
  };

  // ---- restaurar backup completo

  const closeRestore = () => {
    if (restoreFlow?.step === 'plan') {
      const path = restoreFlow.inspector.stagingPath;
      restoreFlow.inspector.dispose();
      if (path) void io.opfsRemove(path).catch(() => undefined);
    }
    setRestoreFlow(null);
  };

  const startRestore = () => run('restore', async () => {
    const picked = await io.pickFiles('.sqlite3,.sqlite,.db,.zip,.json,application/zip,application/json', true);
    if (!picked.length) return;
    const fileName = picked.map((f) => f.name).join(' + ');
    setRestoreFlow({ step: 'working', fileName, label: 'Conferindo tamanho, cabeçalho e manifesto…' });
    const fail = (f: SavesFailure) => { setRestoreFlow({ step: 'failed', fileName, failure: f }); setLastState({ state: f.state, text: f.message }); };
    const read = await io.readPickedFiles(picked);
    if (!read.ok) { fail(savesFailure('IMPORT_INVALID', `${read.name} tem ${formatBytes(read.size)}; o limite é ${formatBytes(read.limit)}.`, 'SIZE_LIMIT')); return; }
    let entries: io.PickedFile[] = read.files;
    const zipped = entries.find((f) => /\.zip$/i.test(f.name));
    if (zipped) {
      if (entries.length > 1) { fail(savesFailure('IMPORT_INVALID', 'Escolha o .zip do backup sozinho, ou o .sqlite3 com o .backup.json.')); return; }
      const zip = io.readZip(zipped.bytes, io.BACKUP_ZIP_LIMITS, io.isBackupZipEntry);
      if (!zip.ok) { fail(savesFailure('IMPORT_INVALID', `Arquivo recusado: ${zip.message}`, stateForArchiveReason(zip.reason))); return; }
      entries = [...zip.entries].map(([name, bytes]) => ({ name, bytes }));
    }
    const input = pickBackupFiles(entries);
    if ('ok' in input) { fail(input); return; }
    const precheck = await precheckBackup(requireCtx(), input, content.value, io.sha256HexAsync);
    if (!precheck.ok) { fail(precheck); return; }
    setRestoreFlow({ step: 'working', fileName, label: 'Validando o banco num worker separado (estrutura, integridade e referências)…' });
    const inspected = await io.inspectBackupInWorker(input.database, { stagingId: requireCtx().platform.newId('restore'), now: new Date().toISOString() });
    if (!inspected.ok) { fail(savesFailure(inspected.code, `Backup recusado: ${inspected.message}`, stateForCode(inspected.code))); return; }
    const plan = await planRestore(requireCtx(), precheck, inspected.inspector.inspection, content.value);
    if (!plan.ok) {
      const path = inspected.inspector.stagingPath;
      inspected.inspector.dispose();
      if (path) void io.opfsRemove(path).catch(() => undefined);
      fail(plan);
      return;
    }
    const status = await io.storageStatus();
    setRestoreFlow({ step: 'plan', plan, inspector: inspected.inspector, shortfall: spaceShortfall(status, input.database.length) });
    setLastState({ state: 'VALID', text: `${input.fileName}: backup válido` });
  });

  const confirmRestore = () => {
    const flow = restoreFlow;
    if (!flow || flow.step !== 'plan') return;
    void run('restore-commit', async () => {
      const ok = await confirmDialog({
        title: 'Substituir todos os dados deste navegador?',
        body: [
          `Os ${active.length} perfil(is) ativos e todo o conteúdo atual serão trocados pelos ${flow.plan.profiles.length} perfil(is) do backup.`,
          'O banco atual fica guardado em “Cópias anteriores” neste navegador até você descartá-lo — ainda assim, exporte um backup antes se não exportou.',
          'O jogo recarrega ao terminar.',
        ],
        confirmLabel: 'Substituir a instalação', tone: 'danger',
      });
      if (!ok) return;
      const path = flow.inspector.stagingPath;
      if (!path) return;
      await suspendForTransfer();
      setRestoreFlow({ step: 'restoring' });
      const r = await restoreInstallation(requireCtx(), { stagingPath: path, stagingSha256: flow.inspector.stagingSha256 });
      flow.inspector.dispose();
      if (!r.ok) { setRestoreFlow({ step: 'failed', fileName: flow.plan.precheck.fileName, failure: r }); setLastState({ state: r.state, text: r.message }); return; }
      toast('Backup restaurado. Reiniciando o jogo…', 'success');
      setTimeout(() => location.reload(), 400);
    });
  };

  const importOneFromBackup = (profileId: string) => {
    const flow = restoreFlow;
    if (!flow || flow.step !== 'plan') return;
    void run('restore-import', async () => {
      const data = await flow.inspector.exportProfile(profileId);
      if ('ok' in data) { reportFailure(savesFailure(data.code, data.message)); return; }
      const archived = archiveFromExportData(data, { appVersion: APP_VERSION, exportedAt: new Date().toISOString() });
      if (!archived.ok) { reportFailure(archived); return; }
      const preview = await previewProfileImport(requireCtx(), archived.archive, flow.plan.precheck.sha256, content.value);
      const fileName = flow.plan.precheck.fileName;
      closeRestore();
      setImportFlow({ step: 'preview', fileName, archive: archived.archive, preview, fingerprint: flow.plan.precheck.sha256, shortfall: 0, sourceKind: 'DATABASE_BACKUP' });
    });
  };

  // ---- apagar tudo

  const wipe = () => run('wipe', async () => {
    const ok = await confirmDialog({
      title: 'Apagar todos os dados locais?',
      body: ['Remove o banco inteiro deste navegador: todos os perfis, coleções, campanhas, cartas autorais, artes importadas e cópias anteriores.', 'Não há como desfazer sem um backup exportado.'],
      confirmLabel: 'Apagar tudo', tone: 'danger',
    });
    if (!ok) return;
    await suspendForTransfer();
    const r = await wipeAllLocalData(requireCtx());
    if (!r.ok) { reportFailure(r); return; }
    io.clearDevicePreferences();
    location.hash = '#/start';
    location.reload();
  });

  // ---- cópias anteriores

  const downloadPrevious = (e: io.OpfsEntry) => run('previous', async () => {
    const bytes = await io.opfsRead(e.path);
    if (!bytes) { toast('A cópia não está mais disponível.', 'warning'); await refreshStorage(); return; }
    io.downloadBytes(e.name, bytes, 'application/vnd.sqlite3');
  });
  const discardPrevious = (e: io.OpfsEntry) => run('previous', async () => {
    const ok = await confirmDialog({ title: 'Descartar a cópia anterior?', body: [`${e.name} (${formatBytes(e.size)}) será removida deste navegador. O banco em uso não é afetado.`], confirmLabel: 'Descartar cópia', tone: 'danger' });
    if (!ok) return;
    await io.opfsRemove(e.path);
    await refreshStorage();
  });

  // ---- render

  const usagePct = storage?.usage !== null && storage?.quota ? Math.min(100, Math.round(((storage.usage ?? 0) / storage.quota) * 100)) : null;
  return (
    <>
      <PageHeader title="Saves e backups" subtitle="Tudo fica neste navegador. Exporte backups para guardar fora dele." backTo={currentId ? '/home' : '/start'} />
      <div class="saves-notice" role="note">
        <Icon name="warning" />
        <p><strong>Seus saves vivem só neste navegador, nesta origem ({location.origin}).</strong> Limpar os dados do site, usar navegação privada ou trocar de navegador, porta ou endereço pode esconder ou apagar o progresso. Exporte um backup de vez em quando. Nenhuma tela pede senha de nuvem.</p>
      </div>
      {otherTab ? <div class="saves-failure" role="alert"><StateBadge state="OTHER_TAB" /> O jogo está aberto em outra aba; esta aba não grava nada.</div> : null}
      {lastState ? <div class="row saves-last" role="status"><StateBadge state={lastState.state} /><span class="small">{lastState.text}</span></div> : null}

      <div class="saves-layout">
        <Panel title="Perfis">
          {loadError ? <ErrorState text={loadError} onRetry={() => void load()} /> : profiles === null ? <Skeleton /> : profiles.length === 0 ? <EmptyState title="Nenhum perfil" text="Importe um perfil ou restaure um backup." /> : (
            <ul class="list" aria-label="Perfis deste navegador">
              {profiles.map((p) => (
                <li key={p.profileId}>
                  <button type="button" class={`list-row saves-profile ${selectedId === p.profileId ? 'is-active' : ''}`} aria-pressed={selectedId === p.profileId} onClick={() => setSelectedId(p.profileId)} data-testid="saves-profile">
                    <Icon name="profile" />
                    <span class="grow"><strong>{p.displayName}</strong>
                      <span class="muted small saves-sub">{p.chapterLabel ?? 'Campanha'} · {p.cardsOwned} cartas</span></span>
                    {p.profileId === currentId ? <span class="badge badge-new">Atual</span> : null}
                    {p.archived ? <span class="badge badge-locked">Arquivado</span> : null}
                    {p.legacyCatalog ? <span class="badge badge-locked" title={LEGACY_PROFILE_MESSAGE}>Catálogo antigo</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={selected ? selected.displayName : 'Detalhes'}>
          {!selected ? <EmptyState title="Escolha um perfil" text="Os detalhes aparecem aqui." /> : (
            <div class="stack">
              <KeyValue items={[
                ['Nome', <span data-testid="saves-detail-name">{selected.displayName}{selected.baseName !== selected.displayName ? <span class="muted small"> (criado como {selected.baseName})</span> : null}</span>],
                ['Modo', selected.progressionMode === 'STANDARD' ? 'Campanha padrão' : selected.progressionMode],
                ['Capítulo', selected.chapterLabel ?? '—'],
                ['Nós concluídos', selected.totalNodes ? `${selected.nodesCleared} de ${selected.totalNodes}` : selected.nodesCleared],
                ['Cartas possuídas', `${selected.cardsOwned} (${selected.distinctCards} diferentes)`],
                ['Decks', selected.decks],
                ['Última gravação', fmtDate(selected.lastWrite)],
                ['Versão', `${selected.campaignVersion ? `conteúdo ${selected.campaignVersion} · ` : ''}revisão ${selected.revision} · jogo ${APP_VERSION}`],
                ['Duelo suspenso', selected.suspendedDuel ? (selected.duelStatus === 'RUNNING' ? 'Sim (em andamento)' : 'Sim') : 'Não'],
                ['Situação', selected.archived ? 'Arquivado' : selected.profileId === currentId ? 'Perfil atual' : 'Ativo'],
              ]} />
              {selected.totalNodes ? <ProgressBar value={selected.nodesCleared} max={selected.totalNodes} label="Progresso da campanha" /> : null}
              <p class="muted small">Datas são informativas: o progresso é validado pelos registros do banco, não pelo relógio.</p>
            </div>
          )}
        </Panel>

        <Panel title="Ações">
          <div class="saves-actions">
            <Button variant="primary" icon="play" onClick={() => selected && void resume(selected)} disabledReason={blockReason ?? (!selected ? 'Escolha um perfil.' : selected.archived ? 'Perfil arquivado: importe-o como novo para jogar.' : null)} loading={busy === 'resume'}>{selected?.profileId === currentId ? 'Continuar este perfil' : 'Retomar perfil'}</Button>
            <Button icon="edit" onClick={() => selected && setRenaming({ profileId: selected.profileId, name: selected.displayName })} disabledReason={blockReason ?? (!selected ? 'Escolha um perfil.' : null)}>Renomear</Button>
            <Button icon="download" onClick={() => selected && void exportProfile(selected)} disabledReason={blockReason ?? (!selected ? 'Escolha um perfil.' : null)} loading={busy === 'export-profile'} testId="export-profile">Exportar perfil (.campaign-profile.zip)</Button>
            <Button variant="danger" onClick={() => selected && void archive(selected)} disabledReason={blockReason ?? (!selected ? 'Escolha um perfil.' : selected.archived ? 'Este perfil já está arquivado.' : null)} loading={busy === 'archive'}>Arquivar perfil</Button>
          </div>
          <h3 class="saves-h3">Instalação inteira</h3>
          <div class="saves-actions">
            <Button icon="download" onClick={() => setExportingBackup(true)} disabledReason={blockReason} testId="export-backup">Backup completo (.sqlite3)</Button>
            <Button icon="upload" onClick={() => void startImport()} disabledReason={blockReason} loading={busy === 'import'} testId="import-profile">Importar como novo perfil</Button>
            <Button icon="refresh" onClick={() => void startRestore()} disabledReason={blockReason} loading={busy === 'restore'} testId="restore-backup">Restaurar backup completo</Button>
          </div>
          <p class="muted small">Um pacote de cartas (.cardpack.zip) não é backup de progresso. Exportar funciona mesmo sem GPU.</p>
        </Panel>
      </div>

      <div class="saves-bottom">
        <Panel title="Armazenamento deste navegador">
          {storage === null ? <Skeleton lines={2} /> : (
            <div class="stack">
              <KeyValue items={[
                ['Origem local', <code>{location.origin}</code>],
                ['Versão do jogo', `${APP_VERSION}${c ? ` · conteúdo ${c.bundle.packageId} ${c.bundle.version}` : ''}`],
                ['Uso estimado', storage.usage !== null && storage.quota !== null ? `${formatBytes(storage.usage)} de ${formatBytes(storage.quota)}` : 'indisponível neste navegador'],
                ['Persistência', storage.persisted === null ? 'não informada' : storage.persisted ? 'concedida — o navegador evita apagar os dados sozinho' : 'não concedida — o navegador pode apagar dados sob pouco espaço'],
              ]} />
              {usagePct !== null ? <ProgressBar value={usagePct} max={100} label="Uso da quota" /> : null}
              <div class="row">
                <Button size="sm" onClick={() => void run('persist', async () => {
                  const granted = await io.requestPersistence();
                  toast(granted ? 'Persistência concedida pelo navegador.' : 'O navegador não concedeu persistência agora. Backups continuam sendo a proteção real.', granted ? 'success' : 'warning');
                  await refreshStorage();
                })} disabledReason={storage.persisted ? 'Persistência já concedida.' : blockReason}>Solicitar persistência</Button>
                <Button size="sm" variant="ghost" icon="refresh" onClick={() => void refreshStorage()}>Atualizar</Button>
              </div>
              <p class="muted small">Persistência solicitada não substitui um backup fora do navegador.</p>
            </div>
          )}
        </Panel>

        <Panel title="Cópias anteriores do banco">
          {previous === null ? <Skeleton lines={2} /> : previous.length === 0 ? <p class="muted small">Nenhuma. Ao restaurar um backup, o banco substituído fica guardado aqui até você descartá-lo.</p> : (
            <ul class="list">
              {previous.map((e) => (
                <li key={e.path} class="list-row">
                  <Icon name="saves" />
                  <span class="grow"><strong class="small">{e.name}</strong><span class="muted small saves-sub">{formatBytes(e.size)} · {new Date(e.lastModified).toLocaleString('pt-BR')}</span></span>
                  <Button size="sm" icon="download" onClick={() => void downloadPrevious(e)} label={`Baixar ${e.name}`} />
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => void discardPrevious(e)} label={`Descartar ${e.name}`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Zona de risco">
          <div class="stack">
            <p class="small">“Arquivar perfil” preserva bytes e histórico. <strong>Apagar todos os dados locais</strong> é outra coisa: remove a instalação persistida inteira deste navegador.</p>
            <Button variant="danger" icon="trash" onClick={() => { setWipeAck(false); setWipeOpen(true); }} disabledReason={blockReason} testId="wipe-open">Apagar todos os dados locais…</Button>
          </div>
        </Panel>
      </div>

      {renaming ? (
        <Modal open title="Renomear perfil" onClose={() => setRenaming(null)} actions={<>
          <Button variant="ghost" onClick={() => setRenaming(null)}>Cancelar</Button>
          <Button variant="primary" onClick={() => void saveRename()} disabledReason={renaming.name.trim().length < 1 || renaming.name.trim().length > 40 ? 'Use de 1 a 40 caracteres.' : null} loading={busy === 'rename'}>Salvar nome</Button>
        </>}>
          <label class="field">Nome exibido
            <input class="input" maxLength={40} value={renaming.name} data-autofocus onInput={(e) => setRenaming({ ...renaming, name: (e.target as HTMLInputElement).value })} />
            <small>O nome é local; recibos e histórico continuam com o nome original.</small>
          </label>
        </Modal>
      ) : null}

      {exportingBackup ? (
        <Modal open title="Backup completo da instalação" onClose={() => setExportingBackup(false)} actions={<>
          <Button variant="ghost" onClick={() => setExportingBackup(false)}>Cancelar</Button>
          <Button variant="primary" icon="download" loading={busy === 'backup'} testId="export-backup-confirm"
            onClick={() => void run('backup', async () => { if (await doExportBackup(backupFormat)) setExportingBackup(false); })}>Exportar backup</Button>
        </>}>
          <div class="stack">
            <p><strong>Este backup inclui todos os perfis locais</strong> ({profiles?.length ?? 0}, inclusive arquivados), cartas autorais, projetos do Estúdio, históricos, replays e as artes importadas (bytes incluídos).</p>
            <p class="small">As artes, sons e modelos distribuídos com o jogo não vão no arquivo: restaurar exige o pacote de conteúdo compatível instalado.</p>
            <div class="field">Formato
              <Segmented label="Formato do backup" value={backupFormat} onChange={setBackupFormat} options={[{ id: 'FILES', label: '.sqlite3 + manifesto (.backup.json)' }, { id: 'ZIP', label: 'Um .zip com os dois' }]} />
              <small>O .sqlite3 abre em qualquer ferramenta SQLite; o manifesto confere tamanho e SHA-256 na restauração.</small>
            </div>
          </div>
        </Modal>
      ) : null}

      {importFlow ? <ImportModal flow={importFlow} onClose={() => setImportFlow(null)} onImport={confirmImport} activeCount={active.length} currentName={currentName} /> : null}
      {restoreFlow ? <RestoreModal flow={restoreFlow} onClose={closeRestore} onRestore={confirmRestore} onImportOne={importOneFromBackup} currentProfiles={active.length}
        onExportFirst={() => void run('backup', async () => { await doExportBackup('FILES'); })} /> : null}

      {wipeOpen ? (
        <Modal open title="Apagar todos os dados locais" onClose={() => setWipeOpen(false)} actions={<>
          <Button variant="ghost" onClick={() => setWipeOpen(false)}>Cancelar</Button>
          <Button icon="download" onClick={() => void run('backup', async () => { await doExportBackup('FILES'); })} loading={busy === 'backup'}>Exportar backup antes</Button>
          <Button variant="danger" icon="trash" onClick={() => void wipe()} disabledReason={wipeAck ? blockReason : 'Confirme que entendeu.'} loading={busy === 'wipe'} testId="wipe-confirm">Apagar tudo</Button>
        </>}>
          <div class="stack">
            <p>Isto remove <strong>toda a instalação persistida</strong> deste navegador: {profiles?.length ?? 0} perfil(is), coleções, campanhas, decks, cartas autorais, artes importadas, cópias anteriores e preferências deste dispositivo.</p>
            <p class="small">Antes de apagar, o jogo pausa o duelo em andamento, conclui a gravação em curso e fecha a conexão com o banco. Depois, recarrega como uma instalação nova.</p>
            <label class="toggle"><input type="checkbox" checked={wipeAck} onChange={(e) => setWipeAck((e.target as HTMLInputElement).checked)} data-testid="wipe-ack" />
              <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb" /></span><span class="toggle-text"><span>Entendo que isto não pode ser desfeito sem um backup exportado.</span></span></label>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

// Sistema (interface §31, §34, §37): S36 ajustes, S37 ajuda local, S40 laboratório (somente build de
// desenvolvimento) e S31 saves (em saves.tsx). Preferências de conforto aplicam sem reiniciar o duelo.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { saveSettings } from '../../../application/profiles.ts';
import { TYPE_LABEL, CONDITION_LABEL } from '../../../domain/cards/text.ts';
import { go } from '../app/router.ts';
import { asJson, content, ctx, saveDeviceSettings, settings, snapshot, toast, type Settings } from '../app/store.ts';
import { Button, PageHeader, Panel, Segmented, Slider, Tabs, Toggle } from '../components/controls.tsx';
import { TypeIcon } from '../components/icons.tsx';
import { ENERGY_TYPES } from '../../../domain/cards/types.ts';
import { appMixer } from '../../audio/index.ts';

export { SavesScreen } from './saves.tsx';

type SettingsTab = 'general' | 'video' | 'table' | 'audio' | 'a11y' | 'controls' | 'data' | 'content';

/** Grava no perfil quando há um; sempre também no dispositivo, para telas sem perfil. */
async function setPrefs(values: Partial<Settings>): Promise<void> {
  saveDeviceSettings(values);
  const c = ctx.value;
  if (c && snapshot.value) await saveSettings(c, asJson(values));
}

export function SettingsScreen(): JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('general');
  const s = settings.value;
  const c = content.value;
  const set = (values: Partial<Settings>) => { void setPrefs(values); };
  return (
    <>
      <PageHeader title="Ajustes" subtitle="Preferências deste perfil e deste dispositivo. Nada muda regras, RNG ou dificuldade." backTo={snapshot.value ? '/home' : '/start'} />
      <Tabs label="Seções de ajustes" value={tab} onChange={setTab} tabs={[
        { id: 'general', label: 'Geral' }, { id: 'video', label: 'Vídeo' }, { id: 'table', label: 'Mesa e animações' }, { id: 'audio', label: 'Áudio' },
        { id: 'a11y', label: 'Acessibilidade' }, { id: 'controls', label: 'Controles' }, { id: 'data', label: 'Dados locais' }, { id: 'content', label: 'Conteúdo' },
      ]} />
      <Panel class="mt settings-panel">
        {tab === 'general' ? (
          <div class="stack-lg">
            <p>Idioma instalado: Português (Brasil).</p>
            <Toggle label="Confirmar antes de finalizar o turno" checked={s.confirmEndTurn} onChange={(v) => set({ confirmEndTurn: v })} />
            <Toggle label="Confirmar antes de atacar" hint="Mostra um resumo do dano antes de declarar o ataque." checked={s.confirmAttack} onChange={(v) => set({ confirmAttack: v })} />
            <div class="field">Dificuldade padrão nos briefings<Segmented label="Dificuldade padrão" value={s.defaultDifficulty} onChange={(v) => set({ defaultDifficulty: v })} options={[{ id: 'STORY', label: 'História' }, { id: 'STANDARD', label: 'Padrão' }, { id: 'EXPERT', label: 'Especialista' }]} /></div>
          </div>
        ) : tab === 'video' ? (
          <div class="stack-lg">
            <div class="field">Qualidade<Segmented label="Qualidade" value={s.quality} onChange={(v) => set({ quality: v })} options={[{ id: 'AUTO', label: 'Automática' }, { id: 'LOW', label: 'Baixa' }, { id: 'MEDIUM', label: 'Média' }, { id: 'HIGH', label: 'Alta' }]} />
              <small>Baixa: pixel ratio 1 e sem sombras. Média: até 1,5. Alta: até 2, foil e reflexos completos.</small></div>
            <Button icon="refresh" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => toast('O navegador não permitiu tela cheia.', 'warning')); }}>Alternar tela cheia</Button>
          </div>
        ) : tab === 'table' ? (
          <div class="stack-lg">
            <div class="field">Tapete exibido<Segmented label="Tapete exibido" value={s.playmatDisplay} onChange={(v) => set({ playmatDisplay: v })} options={[{ id: 'TURN_OWNER', label: 'Do jogador do turno' }, { id: 'PLAYER_FIXED', label: 'Sempre o meu' }, { id: 'NEUTRAL', label: 'Neutro' }]} /></div>
            <div class="field">Velocidade das animações<Segmented label="Velocidade" value={s.animationSpeed} onChange={(v) => set({ animationSpeed: v })} options={[{ id: 'NORMAL', label: 'Normal' }, { id: 'FAST', label: 'Rápida' }, { id: 'INSTANT', label: 'Instantânea' }]} />
              <small>Todas as velocidades mostram o mesmo resultado; só muda o tempo de apresentação.</small></div>
            <div class="field">Organização da mesa<Segmented label="Organização" value={s.battleLayout} onChange={(v) => set({ battleLayout: v })} options={[{ id: 'TABLE_FOCUS', label: 'Mesa em foco' }, { id: 'TACTICAL_PANELS', label: 'Painéis táticos' }]} /></div>
          </div>
        ) : tab === 'audio' ? (
          <div class="stack">
            <Slider label="Música" value={s.volumeMusic} onChange={(v) => set({ volumeMusic: v })} />
            <Slider label="Batalha" value={s.volumeBattle} onChange={(v) => set({ volumeBattle: v })} />
            <Slider label="Interface" value={s.volumeUi} onChange={(v) => set({ volumeUi: v })} />
            <Slider label="Pacotes" value={s.volumePacks} onChange={(v) => set({ volumePacks: v })} />
            <p class="muted small">O som começa após a primeira interação. Silêncio nunca impede jogar.</p>
            <AudioStatus />
          </div>
        ) : tab === 'a11y' ? (
          <div class="stack-lg">
            <div class="field">Movimento<Segmented label="Movimento" value={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} options={[{ id: 'SYSTEM', label: 'Do sistema' }, { id: 'OFF', label: 'Completo' }, { id: 'ON', label: 'Reduzido' }]} />
              <small>Reduzido remove tremores, órbitas, paralaxe e trajetórias amplas, mantendo a cena 3D estática.</small></div>
            <div class="field">Tamanho do texto<Segmented label="Tamanho do texto" value={s.textSize} onChange={(v) => set({ textSize: v })} options={[{ id: 'M', label: 'Padrão' }, { id: 'L', label: 'Grande' }, { id: 'XL', label: 'Muito grande' }]} /></div>
            <Toggle label="Alto contraste" hint="Reforça linhas e textos secundários; o tapete neutro também pode ser fixado em Mesa e animações." checked={s.highContrast} onChange={(v) => set({ highContrast: v })} />
            <Toggle label="Apresentação 2D" hint="Usa a mesa em HTML no lugar da cena 3D. As regras e o save são os mesmos." checked={s.presentation2d} onChange={(v) => set({ presentation2d: v })} />
          </div>
        ) : tab === 'controls' ? (
          <div class="stack-lg">
            <Toggle label="Atalhos de letra na batalha" hint="H histórico, I inspecionar, E Energia, A ataques, R recuo." checked={s.letterShortcuts} onChange={(v) => set({ letterShortcuts: v })} />
            <table class="odds-table shortcuts"><tbody>
              {[['Tab / Shift+Tab', 'Navegar controles'], ['Enter / Espaço', 'Ativar controle'], ['Esc', 'Fechar camada ou abrir menu da partida'], ['/', 'Focar a busca'], ['Ctrl+S', 'Salvar no editor'], ['Ctrl+Z', 'Desfazer no editor'], ['Shift+Enter', 'Finalizar turno (com confirmação)']].map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}
            </tbody></table>
          </div>
        ) : tab === 'data' ? (
          <div class="stack">
            <p>Seus saves ficam no armazenamento privado deste navegador, para a origem <code>{location.origin}</code>. Outro navegador ou endereço mostra outro conjunto de dados.</p>
            <div class="row"><Button icon="saves" onClick={() => go('S31')} disabledReason={ctx.value ? null : 'O banco local ainda não abriu.'}>Saves e backups</Button><Button onClick={() => go('S50')}>Diagnóstico</Button></div>
            <Button variant="ghost" onClick={async () => { try { const keys = await caches?.keys?.(); await Promise.all((keys ?? []).map((k) => caches.delete(k))); toast('Cache visual limpo. Saves não foram alterados.', 'success'); } catch { toast('Nada para limpar.', 'info'); } }}>Limpar cache visual</Button>
          </div>
        ) : (
          <div class="stack">
            <p>Pacote de conteúdo: <strong>{c?.bundle.packageId} {c?.bundle.version}</strong></p>
            <p class="muted small">Hash: <code>{c?.bundle.contentHash}</code></p>
            <p class="muted small">{c?.bundle.cards.length} definições · {c?.bundle.printings.length} impressões · {c?.nodeList.length} encontros</p>
            <Button onClick={() => go('S50')}>Verificar integridade</Button>
          </div>
        )}
      </Panel>
    </>
  );
}

type HelpTopic = 'rules' | 'energy' | 'conditions' | 'deck' | 'campaign' | 'saves';

export function HelpScreen(): JSX.Element {
  const [topic, setTopic] = useState<HelpTopic>('rules');
  return (
    <>
      <PageHeader title="Ajuda" subtitle="Regras e guias incluídos no jogo. Funciona sem conexão." backTo={snapshot.value ? '/home' : '/start'} actions={<Button variant="ghost" onClick={() => go('S49')}>Créditos e licenças</Button>} />
      <Tabs label="Tópicos" value={topic} onChange={setTopic} tabs={[{ id: 'rules', label: 'Regras' }, { id: 'energy', label: 'Energia' }, { id: 'conditions', label: 'Condições' }, { id: 'deck', label: 'Deck' }, { id: 'campaign', label: 'Campanha' }, { id: 'saves', label: 'Saves' }]} />
      <Panel class="mt help-text">
        {topic === 'rules' ? (
          <div class="stack">
            <h2>Como vencer</h2>
            <p>Faça 3 pontos primeiro. Nocautear um Pokémon comum vale 1 ponto; um <strong>ex</strong> vale 2 e um <strong>Mega ex</strong> vale 3. Você também vence se o adversário ficar sem Pokémon em jogo. Se o limite de 60 turnos for atingido, a partida termina empatada.</p>
            <h2>Seu turno</h2>
            <ol>
              <li>Compre 1 carta (o primeiro jogador não compra no primeiro turno).</li>
              <li>Jogue Pokémon Básicos no Banco (até 3), evolua (não no primeiro turno nem no turno em que o Pokémon entrou), jogue Itens à vontade, 1 Apoiador e 1 Estádio por turno.</li>
              <li>Ligue 1 Energia da Zona de Energia a um Pokémon seu (não no primeiro turno do primeiro jogador).</li>
              <li>Recue o Ativo uma vez por turno, pagando o custo de Recuo em Energia.</li>
              <li>Ataque com o Ativo para encerrar o turno, ou finalize sem atacar.</li>
            </ol>
            <h2>Dano</h2>
            <p>O dano do ataque recebe os modificadores do atacante, depois a Fraqueza (+20 no tipo indicado) e por fim as reduções do defensor. O resultado nunca é menor que zero.</p>
          </div>
        ) : topic === 'energy' ? (
          <div class="stack">
            <p>Cada deck declara de 1 a 3 tipos de Energia. A Zona de Energia mostra a Energia pronta deste turno e a próxima. Ligar Energia da Zona é a ligação manual do turno; efeitos de cartas podem mover ou ligar Energias extras.</p>
            <div class="row">{ENERGY_TYPES.map((t) => <span key={t} class="row"><TypeIcon type={t} size={22} /> {TYPE_LABEL[t]}</span>)}</div>
            <p>Custos com o símbolo incolor aceitam qualquer tipo de Energia.</p>
          </div>
        ) : topic === 'conditions' ? (
          <div class="stack">
            <p>Condições especiais afetam apenas o Pokémon Ativo. Recuar, ser trocado ou evoluir remove todas elas.</p>
            <ul>
              <li><strong>{CONDITION_LABEL.POISONED}</strong>: 10 de dano em cada verificação entre turnos.</li>
              <li><strong>{CONDITION_LABEL.BURNED}</strong>: 20 de dano em cada verificação; jogue uma moeda — cara remove a Queimadura.</li>
              <li><strong>{CONDITION_LABEL.ASLEEP}</strong>: não ataca nem recua; jogue uma moeda em cada verificação — cara acorda.</li>
              <li><strong>{CONDITION_LABEL.PARALYZED}</strong>: não ataca nem recua; termina no fim do próximo turno do dono.</li>
              <li><strong>{CONDITION_LABEL.CONFUSED}</strong>: ao atacar, jogue uma moeda — coroa faz o ataque falhar. Pode recuar e usar Habilidades.</li>
            </ul>
          </div>
        ) : topic === 'deck' ? (
          <div class="stack">
            <p>Um deck tem exatamente 20 cartas, no máximo 2 cópias de cartas com o mesmo nome e pelo menos 1 Pokémon Básico. Fósseis contam como Item e não satisfazem o Básico obrigatório.</p>
            <p>O editor salva rascunhos automaticamente; somente decks confirmados entram em duelos. Avisos de estratégia (por exemplo, poucos Básicos) não bloqueiam a confirmação.</p>
          </div>
        ) : topic === 'campaign' ? (
          <div class="stack">
            <p>A campanha tem 45 encontros: prólogo, seis capítulos e a final. Em cada capítulo, a rota principal é E01 → E03 → E06; os demais encontros são opcionais.</p>
            <p>A primeira vitória em um encontro concede a recompensa inicial; vitórias seguintes concedem a recompensa repetível. Objetivos opcionais pagam Créditos uma única vez. Descobertas permitem escolher 1 de 3 cartas; as outras continuam à venda no Empório.</p>
            <p>Não há tarefas diárias, prazos ou compras com dinheiro.</p>
          </div>
        ) : (
          <div class="stack">
            <p>O jogo grava cada ação confirmada imediatamente no banco SQLite local deste navegador. Fechar a aba no meio de um duelo não perde a partida: ao voltar, ela continua exatamente do ponto salvo.</p>
            <p>Exporte backups em Saves e backups. Limpar os dados do site ou usar navegação privada pode apagar o progresso.</p>
          </div>
        )}
      </Panel>
    </>
  );
}

/** S40 — só existe em build de desenvolvimento (rota não registrada em produção). */
export function LabScreen(): JSX.Element {
  return (
    <>
      <PageHeader title="Laboratório (desenvolvimento)" subtitle="Ferramentas isoladas da progressão: nenhum resultado concede recompensas." />
      <Panel>
        <div class="stack">
          <p>Use o Estúdio de Cartas → Laboratório da carta para cenários com mãos reveladas, moedas forçadas e estados preparados.</p>
          <Button onClick={() => go('S43')}>Abrir Estúdio de Cartas</Button>
        </div>
      </Panel>
    </>
  );
}

/** Estado do mixer local: desbloqueio pelo navegador e slots de som ainda sem arquivo (placeholders). */
function AudioStatus(): JSX.Element {
  const d = appMixer().diagnostics();
  return (
    <p class="small" data-testid="audio-status">
      {!d.supported ? 'Este navegador não oferece Web Audio; o jogo segue em silêncio.' : d.unlocked ? 'Áudio liberado neste navegador.' : 'Áudio aguardando a primeira interação.'}
      {d.placeholders.length ? ` ${d.placeholders.length} sons ainda sem arquivo neste pacote (silenciosos).` : ''}
      {d.failures.length ? ` ${d.failures.length} arquivo(s) de som não puderam ser lidos.` : ''}
    </p>
  );
}

# Checklist manual de aceite

Critérios das specs que dependem de GPU, navegador real, percepção visual/sonora ou interação humana e por isso não
têm teste automatizado equivalente. Cada item é referenciado em `src/tests/criteria-map.json` como
`src/tests/manual-checklist.md#<ID>`. Pré-requisitos comuns: `npm run build`, `npm run preview` (runner local em
`http://localhost:4173/`), Chromium/Edge atual com aceleração de GPU, perfil de navegador limpo e DevTools aberto na
aba Rede com “Offline” quando o item pedir. Registre build, viewport, DPR e data em cada rodada (ver VS-060).

Formato: `- [ ] ID — passos → resultado esperado`.

## Gameplay (gameplay.md §30)

- [ ] G-074 — Restaure o mesmo backup duas vezes e jogue a mesma sequência de ações, uma com WebGL e outra no modo de compatibilidade 2D (aceleração de GPU desligada); exporte o backup `.sqlite3` de cada rodada e compare `battle_checkpoints.snapshot_hash` do último checkpoint e o `result_json` da tentativa → idênticos.
- [ ] G-076 — Durante um duelo, force perda de contexto (DevTools › Rendering ou `WEBGL_lose_context.loseContext()`) → partida pausa, checkpoint preservado; restaurar o contexto (ou cair no 2D) retoma o mesmo estado sem derrota técnica.
- [ ] G-078 — Com rede desligada desde o boot, leve um perfil (por fixture/backup) até um capítulo nunca visitado e abra o mapa e um duelo → nenhuma requisição externa na aba Rede; cena, cartas e sons carregam do pacote.
- [ ] G-086 — Em um duelo, jogue um Estádio → efeitos de regra mudam (HUD/inspector), mas o playmat equipado e o preset do perfil continuam os mesmos (Oficina S41 inalterada).
- [ ] G-088 — Na Oficina (S41/S42), rode a prévia completa (entrada/ataque de teste) → saldo, inventário, pontos e progresso do perfil inalterados (Perfil/Recibos sem nova operação).

## Campanha (campanha.md §22)

- [ ] C-043 — Remova/renomeie um asset de cena de capítulo no `dist/` e abra o capítulo → placeholder local aparece; nenhum duelo é marcado como derrota nem o progresso muda.
- [ ] C-044 — No mapa da campanha, use só teclado (Tab/Enter) e a “Lista de encontros” → todos os nós disponíveis são alcançáveis e iniciáveis; estados iguais aos do mapa 3D.
- [ ] C-045 — Perca o contexto WebGL em um duelo de campanha e retome → mesmo nó, tentativa e estado; nenhuma derrota técnica nem perda de progresso.
- [ ] C-046 — Instalação limpa, rede desligada: avance (fixture/backup) até um capítulo novo e abra-o → nenhum asset externo solicitado; capítulo jogável.
- [ ] C-048 — Em Diagnóstico, gere o relatório local → arquivo salvo localmente (sem envio), com seções separando o que está implementado das metas ainda não aprovadas/medidas.

## Persistência SQLite (persistencia-sqlite.md §26)

- [ ] DB-004 — Abra o jogo em outra origem (porta/hostname diferente) com um save existente na origem original → ajuda explica que cada origem tem armazenamento próprio e não afirma que os dados foram apagados.
- [ ] DB-040 — Com o jogo aberto na aba 1, abra a aba 2 e escolha “transferir para esta aba” → aba 1 fecha conexão e worker antes de a aba 2 assumir o lock; aba 1 fica sem escrita (mensagem de sessão transferida).
- [ ] DB-053 — Em Ajustes › “Limpar cache visual”, limpe o cache → arte master, cartas, coleção e progresso continuam iguais após recarregar (Coleção/Perfil).
- [ ] DB-055 — Em Saves › “Apagar todos os dados locais”, inicie o fluxo → exige confirmação explícita e oferece backup antes; ao confirmar, fecha handles e recarrega vazio. Arquivar um perfil, por outro lado, só o oculta (os demais dados permanecem).

## Runtime offline e Three.js (runtime-offline-threejs.md §27)

- [ ] R-002 — Rede desligada, perfil levado por fixture/backup até C06 → C06 abre e joga sem nenhuma requisição externa.
- [ ] R-003 — Inspecione `dist/` e `package-lock.json` → Three.js e addons vêm do bundle local e têm a mesma versão (`three@0.186.1`); nenhuma importação de CDN.
- [ ] R-005 — Rode `npm run audit:offline` e procure GLB/decoders no `dist/` → não há GLB comprimido nem decoder (Draco/KTX2/meshopt); se houver, o WASM do decoder é local e nada remoto é buscado.
- [ ] R-006 — Rede desligada, recarregue o jogo → interface e faces das cartas usam fontes locais (Nunito empacotada/system-ui), sem requisição de fonte.
- [ ] R-007 — Leia `runner/server.mjs` e `start-local.*` e execute o launcher sem rede → nenhum download, `npx` remoto ou instalação.
- [ ] R-008 — Ocupe a porta 4173 e rode o launcher → erro claro de porta ocupada; não troca de origem/porta silenciosamente.
- [ ] R-009 — Abra `index.html` via `file://` → página de ajuda explicando o launcher suportado.
- [ ] R-010 — Acesse por `127.0.0.1` em vez de `localhost` → Diagnóstico identifica a origem atual e indica que o armazenamento é outro.
- [ ] R-021 — Durante o turno da IA, troque de aba por 30 s e volte → simulação e IA ficaram pausadas (nenhuma ação aplicada enquanto oculta); apresentação retoma sem saltar vários turnos.
- [ ] R-032 — Abra um replay (S39) de duelo vencido e reproduza até o fim → saldo, objetivos e progresso inalterados (Recibos sem nova operação).
- [ ] R-036 — Em navegador sem WebGL2 (flag desativada) → Diagnóstico informa a capacidade real e oferece compatibilidade 2D; nada promete WebGL1.
- [ ] R-037 — Inspecione uma carta no inspector, girando-a → frente, verso, espessura visível e perspectiva real.
- [ ] R-038 — DevTools › Elements durante coleção/duelo → um único `<canvas>` WebGL principal; miniaturas não criam canvas próprio.
- [ ] R-039 — Abra o inspector sobre a mesa e com a mão aberta → nenhum vazamento de profundidade entre mesa, mão e inspector (sem cartas atravessando viewports).
- [ ] R-041 — Redimensione a janela durante um duelo com uma carta selecionada → câmera, HUD e seleção permanecem alinhados; a seleção é preservada.
- [ ] R-042 — Com um modal aberto sobre a mesa, clique sobre uma carta atrás → o clique não atravessa para a cena.
- [ ] R-043 — Clique em bordas decorativas/guia do playmat sobre uma carta → a carta é selecionada (decoração não intercepta o picking).
- [ ] R-044 — Arraste uma carta para um alvo inválido e solte → ela volta; Recibos e estado salvo não mudam (recarregar mostra o mesmo estado).
- [ ] R-045 — Jogue um turno completo (colocar, ligar Energia, atacar) só com teclado → fluxo equivalente sem arrasto.
- [ ] R-046 — Em 1280×720, observe as cartas do NPC no campo → nome e HP legíveis.
- [ ] R-047 — Inspecione cartas holográficas/foil em vários ângulos → a máscara de brilho nunca cobre texto de regras.
- [ ] R-048 — Compare a mesma arte numa carta e no arquivo original → sem dupla conversão de cor (nem lavada nem saturada); máscaras não aparecem como textura de cor.
- [ ] R-051 — Abra e feche o inspector 100 vezes; compare heap/memória de GPU antes e depois (DevTools › Memory) → sem crescimento indefinido.
- [ ] R-053 — Force perda de contexto WebGL num duelo → partida pausa e retoma recuperável no mesmo estado.
- [ ] R-054 — Remova um asset de arte do `dist/` e abra a carta → fallback cosmético; regras, custo e HP iguais.
- [ ] R-059 — Rode o relatório de performance → registra hardware, build, viewport/DPR e métricas medidas (fps, frame time, memória).
- [ ] R-060 — Ajustes › Qualidade Baixa → mesa e cartas continuam 3D; partículas/sombras reduzidas.
- [ ] R-061 — Desative a aceleração de GPU → compatibilidade 2D permite gerenciar coleção/decks e jogar ações essenciais.
- [ ] R-062 — Volume zero/áudio desligado, jogue um duelo até o fim → resultados, moedas e Nocautes compreensíveis só pela tela.
- [ ] R-063 — Abra manualmente `#/matches/<id-inexistente>/result` → nenhum prêmio é concedido nem exibido como novo; tela explica que não há recibo.
- [ ] R-064 — Com DevTools › Rede aberto, percorra uma sessão completa (boot, duelo, pacote, Empório, saves) e rode `npm run audit:offline` → nenhuma requisição ou beacon para fora da origem local.
- [ ] R-065 — Troque o playmat durante a prévia/turno → transição usa dois samplers; zonas de picking e posições das cartas não mudam.
- [ ] R-067 — Com câmera de duelo, observe guias e arte do playmat → sem z-fighting/cintilação nem silhuetas cobrindo cartas.
- [ ] R-068 — Compre e jogue cartas entre mão e mesa observando quadro a quadro → posição e escala contínuas, uma única instância de carta.
- [ ] R-084 — Instalação limpa offline: visite os nove temas (mapa/duelo), shaders e sons → tudo funciona sem cache externo, CDN ou download.

## Interface 16:9 (interface-16x9.md §37)

- [ ] UI-001 — Em 1920×1080 percorra Início, Mapa, Coleção, Deck e Duelo → todos os elementos essenciais dentro da área segura.
- [ ] UI-002 — Em 1280×720 percorra as mesmas telas → sem rolagem horizontal da página.
- [ ] UI-003 — Em 1366×768 → menus e ações legíveis no perfil compacto.
- [ ] UI-005 — Selecione uma carta e redimensione a janela → estado e seleção preservados.
- [ ] UI-006 — Navegue pelo menu principal → exatamente uma área ativa destacada.
- [ ] UI-007 — Em Coleção, aplique filtros e role; abra o detalhe e volte → filtros e rolagem restaurados.
- [ ] UI-008 — Do briefing de um desafio, vá ao editor de deck e volte → retorna ao mesmo confronto.
- [ ] UI-011 — Perfil sem cartas num filtro vazio → estado “coleção vazia” distinto de erro de leitura do save.
- [ ] UI-012 — Carta sem arte (template) → nome, dados e ações continuam disponíveis.
- [ ] UI-018 — No editor de deck, adicione/remova cartas com a Energia definida manualmente → a Zona de Energia não muda sem confirmação.
- [ ] UI-019 — Use Auto-build → a proposta é exibida (diferenças) e só substitui o deck após confirmar.
- [ ] UI-020 — Edite um deck confirmado sem confirmar → UI indica “rascunho” versus “versão confirmada”.
- [ ] UI-023 — Primeiro jogador no turno 1 → aviso correto de “sem Energia neste turno”, sem bloquear ataques de custo zero.
- [ ] UI-026 — Mão com 10 cartas (1080p) → todas acessíveis e inspecionáveis (passar/abrir cada uma).
- [ ] UI-028 — Faça as mesmas ações (colocar, evoluir, ligar, atacar) só com cliques → mesmo resultado do arrasto.
- [ ] UI-029 — Aplique condições → cada uma tem texto e ícone além da cor.
- [ ] UI-030 — Abra o Recuo → mostra o custo e permite escolher quais Energias descartar.
- [ ] UI-031 — Use Troca Tática → nenhum custo de Recuo exibido nem cobrado.
- [ ] UI-033 — Use uma Habilidade que encerra o turno → confirmação informa a consequência antes.
- [ ] UI-034 — Ataque com moeda → nenhum dano definitivo antes de as moedas terminarem.
- [ ] UI-035 — Barra de ações → “Atacar” e “Finalizar turno” claramente distintos (posição, rótulo, cor).
- [ ] UI-037 — Quando o NPC precisa escolher (promoção, alvo) → indicação clara de “aguardando adversário”.
- [ ] UI-045 — Compre no Empório → diálogo de consentimento explícito em Créditos; nenhum meio de pagamento real.
- [ ] UI-047 — Tela de resultado → distingue Créditos creditados automaticamente de itens a resgatar.
- [ ] UI-052 — Complete o fluxo principal (novo perfil → tutorial → pacote → deck → duelo) só com teclado.
- [ ] UI-053 — Abra e feche modais → foco preso no modal e devolvido ao elemento de origem.
- [ ] UI-054 — Em tela de toque (emulação) → nenhuma ação depende de hover.
- [ ] UI-055 — Com leitor de tela (NVDA/Narrator) → nome, custo de ataque e condições anunciados.
- [ ] UI-056 — Ative movimento reduzido → nenhuma informação perdida (todos os resultados aparecem).
- [ ] UI-057 — Sem WebGL → fallback funcional (compatibilidade 2D).
- [ ] UI-058 — Áudio desativado → todo feedback essencial é visual.
- [ ] UI-059 — Digite letras em campos de texto (nome do deck, busca) → atalhos de teclado não disparam ações.
- [ ] UI-060 — Negue o pedido de tela cheia → aplicação segue utilizável.
- [ ] UI-061 — No Histórico, aplique filtros → os dados da partida não mudam (abrir o replay mostra o mesmo).
- [ ] UI-062 — Assista a um replay inteiro → nenhuma recompensa nova (Recibos inalterados).
- [ ] UI-063 — Restaure um backup cujo replay referencia catálogo divergente e abra o replay → aviso de indisponibilidade/versão; não reproduz com regras incorretas.
- [ ] UI-064 — Itens de menu de recursos desativados → aparecem como indisponíveis com motivo; não fingem funcionar.
- [ ] UI-065 — Telas com dados de demonstração (harness/prévia) → identificadas como fictícias.
- [ ] UI-066 — Sessão completa com DevTools › Rede → nenhum envio externo de dados do perfil.
- [ ] UI-067 — Oculte a aba durante o duelo → duelo suspenso, sem contagem regressiva.
- [ ] UI-068 — Coleção com todas as cartas → rolagem estável (blocos com “Mostrar mais” ou virtualização), sem saltos.
- [ ] UI-069 — Excluir deck, arquivar perfil, apagar dados → confirmação contextual clara para cada ação destrutiva.
- [ ] UI-073 — Tela Início com perfil em andamento → “Continuar” é a ação primária.
- [ ] UI-075 — Compare mapa 3D e lista de encontros → mesmos nós, estados e desbloqueios.
- [ ] UI-076 — Com a sidebar aberta, clique em cartas na mesa → seleciona o objeto sob o ponteiro no viewport correto.
- [ ] UI-077 — No mapa, arraste começando sobre um nó → faz pan; clique simples abre o nó.
- [ ] UI-078 — Modal sobre a mesa → sem click-through.
- [ ] UI-079 — Abra inspector e palco simultaneamente → um único contexto WebGL compartilhado (DevTools).
- [ ] UI-080 — Gire uma carta no inspector → frente, verso e texto não espelhados.
- [ ] UI-081 — Cartas holográficas/cromadas → textos e HP legíveis em todos os ângulos.
- [ ] UI-082 — Perfil de qualidade Baixa → cartas continuam com geometria 3D.
- [ ] UI-083 — Em 1280×720 com 10 cartas na mão → todas selecionáveis por mouse e por teclado (o leque é coberto por `hand-layout.test.ts`).
- [ ] UI-086 — Rede desligada, abra um capítulo nunca visitado → nenhum asset remoto solicitado.
- [ ] UI-087 — Rede desligada em toda a sessão → nenhum banner de falha de rede.
- [ ] UI-088 — Simule falha de gravação (quota cheia) ao terminar um duelo → a UI nunca mostra “Salvo”/crédito antes da confirmação; mensagem de falha recuperável.
- [ ] UI-091 — Gire/aproxime a câmera durante o duelo → regras e resultados idênticos (sem consumo de RNG).
- [ ] UI-093 — Abra o editor de deck a partir de um nó → retorno mantém capítulo, dificuldade e objetivo selecionados.
- [ ] UI-094 — “Limpar cache visual” → saves intactos (perfil, coleção e progresso iguais).
- [ ] UI-096 — Perda de contexto no duelo de chefe → retoma o mesmo duelo, sem derrota técnica.
- [ ] UI-097 — Layout FOCUS_TABLE → inicia com inspector/histórico recolhidos e ambos os Ativos totalmente visíveis.
- [ ] UI-098 — Alterne o layout de painéis táticos com uma carta selecionada → estado, seleção e IDs de alvo preservados, sem nova distribuição.
- [ ] UI-100 — Mesa de duelo → deck/descarte do humano à direita e do NPC à esquerda, contadores e controles distintos.
- [ ] UI-101 — Playmat → uma única superfície contínua, sem dividir a arte em dois tapetes.
- [ ] UI-102 — Troca de turno → só arte/material do playmat muda; cartas, HUD e câmera estáveis.
- [ ] UI-103 — Responda uma escolha no turno do adversário → playmat e faixa de turno não mudam.
- [ ] UI-104 — Ajustes de conforto PLAYER_FIXED e NEUTRAL → aplicados imediatamente, sem alterar lógica ou inventário.
- [ ] UI-105 — Jogue um Estádio → a animação não simula troca cosmética da mesa.
- [ ] UI-106 — Entre na Oficina S41/S42 a partir do perfil e do deck e volte → rascunho e rolagem preservados.
- [ ] UI-107 — Na Oficina, aplique, herde, duplique e cancele um preset → resultados distintos e mensagens claras para cada ação.
- [ ] UI-108 — Com um duelo suspenso, equipe um novo preset → mensagem informa que vale para a próxima tentativa (comportamento coberto em `attempts.test.ts`, G-087).
- [ ] UI-109 — Selecione um tapete bloqueado → permite experimentar, explica desbloqueio/preço e não permite equipar sem posse.
- [ ] UI-110 — Todas as variantes de playmat sob a mesma iluminação → nome, HP, Energia, alvo e condição legíveis.
- [ ] UI-111 — Oficina (S41) → Tapete → Importar imagem → ligar “Mostrar zonas seguras”: slots e faixa da mão aparecem tracejados sobre o recorte 4:3; mudar zoom/posição não distorce a imagem.
- [ ] UI-113 — Aplique um tapete com imagem própria, restaure um backup anterior à importação (o asset some) e abra um duelo → a mesa usa o tapete neutro, mostra “Imagem do tapete indisponível — usando o tapete neutro” e a partida segue; a oficina indica a imagem ausente.
- [ ] UI-114 — Passe o mouse sobre cartas da mão e do campo → não consome ação nem redispara flair de entrada.
- [ ] UI-115 — Compra própria → a carta sai do deck, revela-se ao humano e encaixa na mão mantendo identidade.
- [ ] UI-117 — Compra múltipla (Estudioso) com deck quase vazio/mão quase cheia → contagem e movimentos mostram só as cartas realmente compradas.
- [ ] UI-118 — Mão com 10 cartas → todas acessíveis por clique/teclado e o leque não cobre ações essenciais.
- [ ] UI-119 — Cancele um arrasto (Esc) ou solte em alvo inválido → volta à mão sem flair nem consumo.
- [ ] UI-121 — Evolua um Pokémon com dano e anexos → nova carta assenta sobre a pilha, dano e anexos corretos, sem cura visual falsa.
- [ ] UI-122 — Efeito com revelação temporária e embaralhamento → identidade visível só durante a autorização; não rastreável depois.
- [ ] UI-123 — Destaque de ataque (cut-in) → carta e nome aparecem sem permitir interação com a cópia fictícia.
- [ ] UI-124 — Impactos de zero, redução, cura e Nocaute → origem, alvo e tipo corretos, sem feedback contraditório.
- [ ] UI-128 — Movimento reduzido → sem tremor, zoom brusco ou flashes; toda informação consultável.
- [ ] UI-131 — Prévia/ataque de teste da Oficina com duelo suspenso → a partida suspensa e as recompensas não mudam.
- [ ] UI-132 — Oficina e seleção de flair só com teclado → funcionam sem arrasto e devolvem o foco ao fechar.

## Direção visual Pocket (direcao-visual-pocket.md §15)

- [ ] VS-001 — Boot a frio → shell claro desde o primeiro quadro, sem cenário escuro ou gradiente preto.
- [ ] VS-006 — Mesa padrão → arena com metade distante coral e próxima azul-clara, entorno claro em cima e azul embaixo, aro claro.
- [ ] VS-007 — Duelos com decks de tipos diferentes → as metades da arena (coral distante, azul-clara próxima) não mudam com a cor de Energia; só o turno as acende.
- [ ] VS-009 — Placar → exatamente três posições de pontos, independentemente do HP das cartas.
- [ ] VS-010 — Pilhas e contadores da fixture de prévia → compatíveis com baralho de 20.
- [ ] VS-012 — Câmera de duelo → quase superior, frente das cartas legível e sem rotação ao trocar de turno.
- [ ] VS-014 — Abrir duelo → inspector recolhido por padrão.
- [ ] VS-015 — Abra o inspector com uma decisão obrigatória pendente → ele não encobre a decisão.
- [ ] VS-016 — Campo → sem DOF/desfoque sobre mão e slots.
- [ ] VS-017 — Cartas e borda → espessura discreta, não placas maciças.
- [ ] VS-018 — Cartas com arte → sem corte fora da composição cadastrada.
- [ ] VS-019 — Template de carta → sem custo universal de mana.
- [ ] VS-020 — Template de carta → sem campo de Resistência.
- [ ] VS-021 — Compare ex, foil e raridade em cartas distintas → eixos visuais independentes.
- [ ] VS-022 — Arte-base → ilustração estilizada clara, sem estética dark fantasy.
- [ ] VS-023 — Retratos de personagens/NPC → mesmo catálogo de direção artística.
- [ ] VS-024 — Cartas full art → contraste preservado na área de ataques.
- [ ] VS-025 — Foil no ângulo frontal → texto legível.
- [ ] VS-026 — Desligue o brilho (Ajustes) → identidade e regras da impressão iguais.
- [ ] VS-027 — Compras/jogadas ocultas do NPC → raridade não revelada por material, som ou trajetória.
- [ ] VS-028 — Compra humana → vai do deck à mão sem cut-in de ataque.
- [ ] VS-030 — Compra em lote do NPC → contagem correta e flair não repetido por carta oculta.
- [ ] VS-031 — Arrasto inválido → carta volta à posição sem consumir ação.
- [ ] VS-032 — Entrada de Básico → assenta no slot, sem invocar criatura independente.
- [ ] VS-033 — Evolução → dano e anexos visuais preservados.
- [ ] VS-034 — Cut-in de ataque → carta, nome do ataque, faixa e retorno ao campo.
- [ ] VS-035 — Escurecimento do ataque → temporário, luminosidade restaurada ao fim.
- [ ] VS-036 — Ataque composto (dano + efeito) → tempos de foco/impacto não duplicados.
- [ ] VS-037 — Ataques de Fogo e outros tipos → efeitos localizados; o tema dos menus não muda.
- [ ] VS-040 — Nocaute → não sugere destruição permanente da carta possuída.
- [ ] VS-042 — Faixa de pontos → azul/ciano com discos amarelos legíveis.
- [ ] VS-043 — Playmat → cobre a superfície inteira sem alterar hitboxes.
- [ ] VS-044 — Troque o playmat → cartas e câmera não se movem.
- [ ] VS-045 — Arte customizada/tema de capítulo → marcadores funcionais (zonas, pontos) sem recoloração.
- [ ] VS-047 — Abertura de pacote → abre pela costura/tira, fundo claro, raios suaves.
- [ ] VS-048 — Revelação → deslizamento de pilha, sem flip compulsório por carta.
- [ ] VS-050 — Modo imersivo → opcional e retorna à posição correta.
- [ ] VS-051 — Mapa → estilizado; o combate não herda sala cinematográfica.
- [ ] VS-052 — Editor de decks → contador 20/20 derivado da soma real e limite de cópias respeitado na UI.
- [ ] VS-053 — Estúdio → mesmo CardVisual, template e acabamento da batalha.
- [ ] VS-055 — Fluxo do Estúdio offline → nenhum botão de geração remota de arte.
- [ ] VS-058 — Qualidade baixa → paleta, cartas 3D e informação preservadas.
- [ ] VS-059 — Retome após perda de contexto → cena clara restaurada, sem repetir ganhos.
- [ ] VS-060 — Capturas de homologação → cada captura registra build, viewport, DPR e estado.

## Gameplay no estilo Pocket (gameplay-pocket.md §13)

- [ ] UI-140 — Ataque com a mesa 3D em 1080p → faixa larga e inclinada na cor do tipo abrindo do lado de quem ataca (pontas esmaecidas), com o nome do ataque centralizado e o do Pokémon à direita entrando e deslizando, um brilho atravessando e o fechamento para o lado oposto; véu, linhas de velocidade e a carta atacante no centro; em 720p, a faixa compacta.
- [ ] UI-141 — Dano e cura → número grande no centro da carta (sem sinal de menos no dano, verde na cura); PS vermelho contando de 10 em 10; com movimento reduzido, troca direta.
- [ ] UI-142 — Nocaute → orbe e anel ciano no slot da carta antes de ela ir ao descarte.
- [ ] UI-144 — Ataque com moeda (ex.: um ataque "jogue 1 moeda") → véu na cor de quem joga e "Cara!"/"Coroa!" digitado letra a letra; várias moedas mostram a sequência em pílula.
- [ ] UI-148 — Zona de Energia nos dois lados, com e sem Energia pronta (3D e 2D) → prato branco-lilás com aro; orbe do tipo com halo ciano pulsando; próxima Energia escura na borda de baixo (direita no seu prato, esquerda no do adversário); compare com .specs/referencias/batalha/energy-*.png.
- [ ] UI-151 — Mesa 3D com uma evolução jogável na mão (T04, Rapidash) → contorno amarelo nela; as outras jogáveis em ciano.
- [ ] UI-152 — Compra própria no início do turno e Básico jogado (3D, harness ou partida) → verso vai ao centro, vira grande e desce à ponta direita da mão; o Básico gira em Y, fica grande no centro e encolhe até o slot, com o PS só depois; o do adversário vira do verso.
- [ ] UI-153 — Item e Apoiador jogados (3D) → prévia grande no centro, placa branca e molduras na cor do subtipo (Item ciano, Apoiador dourado) se expandindo; a carta reaparece no descarte; na 2D, a prévia HTML faz a mesma dissolução.

## Sets do Pocket (conteúdo 3.0.0; interface §8, §10, §11, §32)

- [ ] UI-155 — S04 → catálogo agrupado por expansão; Deluxe Pack ex mostra “4 cartas por abertura”; Lugia, Ho-Oh e Secluded Springs mostram “5 cartas por abertura (+1 em 8,330% dos pacotes)”.
- [ ] UI-160 — Empório › Cartas dirigidas com Expansão, raridade ✵ e “Só disponíveis” → só itens daquele set e símbolo, sem bloqueados nem adquiridos; subtítulo “A3 042 · ☆ · você tem N”; na aba Pacotes, um título por set.
- [ ] UI-161 — S08 de um Pikachu ex › Comparar com → grupo “Outras versões de Pikachu ex” antes de “Outras cartas”.
- [ ] UI-162 — S08 › Como obter de uma carta do A4 e de uma do A1 → “Pode sair em <pacote> · X,XXX% por pacote”, com três casas.

## Rivais, avatares, abertura VS e bolas de Energia (conteúdo 3.1.0; interface §5.5, §22.1, §23.10)

- [ ] UI-167 — Inicie um encontro pelo briefing (S16), outro pela Arena e use “Reiniciar encontro”, na mesa 3D e na 2D → faixa vermelha do rival em cima entrando pela esquerda e azul do jogador embaixo pela direita, retratos caindo com tremor curto, “VS.”, os dois nomes e a saudação do rival; some em ~2,6 s e só então a preparação aceita toques e a IA age; com movimento reduzido, só a pose final com fade (~1,2 s); depois de Salvar e sair, retomar o duelo não mostra a abertura.
- [ ] UI-168 — Novo jogo (S02) e Perfil › Identidade (S34): escolha um retrato no seletor agrupado por treinador → o escolhido cresce, os demais esmaecem, sem contorno; placa da mesa, “+1 ponto!”, abertura VS, cabeçalho, briefing S16, caderno S29/S30 (não encontrado em silhueta) e Arena mostram retratos inteiros, sem borda, sombra ou fundo; um perfil antigo com avatar por tipo abre com o retrato padrão.
- [ ] UI-169 — Ligue Energias de vários tipos e observe a Zona dos dois lados, na mesa 3D e na 2D → Energias ligadas, orbe pronto, próxima Energia (esmaecida, aro branco) e voo da ligação com a bola do tipo (compare com src/presentation/assets/source/energy/energys.png); um custo Incolor nos ataques continua com o ícone de tipo.

## Menus em caixas, promoção por arrasto, arte dos pacotes e mesa em arena (16/10/2026; interface §2.2, §5.6, §8.5, §23.2, §26.1; gameplay-pocket §2, §6.2)

- [ ] UI-170 — Navegue por todas as abas e sub-abas em 1920×1080 → sem rail lateral; aba ativa em pílula branca com sublinhado ciano e sub-aba com sublinhado grosso; Saves, Ajuda e Ajustes como ícones do cabeçalho, sem aba ativa; Q/E trocam de aba, mas não com o foco num campo de texto nem com um modal aberto; Loja e Pacotes mostram a contagem de pacotes, Jogar mostra “•” com duelo suspenso e “!” com prêmio pendente; em 1100 px somem os rótulos dos recursos e as teclas Q/E; em retrato (≤760 px), as abas viram barra embaixo e as sub-abas rolam na horizontal.
- [ ] UI-171 — Entrada, Início, Jogar, Campanha, Desafios, Arena e Adversários em 1920×1080 e 1280×720 → caixas sem rolagem horizontal; CONTINUAR do Início com foco ao entrar e sem rolar; hover e Tab dão aro branco com brilho azul e leve subida (com movimento reduzido, só o aro); caixa bloqueada (desafio sem pré-requisito, Arena sem deck) fica esmaecida com cadeado e o leitor de tela anuncia o motivo; capítulos da Campanha em oito caixas iguais, com o atual em aro ciano, e o detalhe do nó abaixo do mapa em 1280 px.
- [ ] UI-172 — Deixe seu Ativo ser nocauteado com 2+ Pokémon no Banco, na mesa 3D (ou harness `promoteDemo()`) e na 2D → nenhum painel nem Finalizar turno; mensagem no centro, entre os Ativos; Banco flutuando e balançando (com movimento reduzido, só erguido) e Ativo vazio pulsando; arraste um até o Ativo (na 3D, Energias e Ferramenta vão junto e a promoção parte do ponto da soltura) e solte outro fora (volta ao Banco); sem arrasto, toque no Pokémon, toque de novo para desfazer e depois no Ativo; com 1 Pokémon no Banco, ele sobe sozinho.
- [ ] UI-173 — S04, S05, Empório (miniaturas e detalhe) e caixa Pacotes do Início → frente oficial de cada um dos 15 pacotes de expansão, sem margens nem fundo branco; abra um pacote do A2 e um do A1 → a frente do pacote 3D é a imagem, mais alta que o pacote gerado, com o logotipo na tira que se rasga; sem WebGL, o fallback mostra a mesma imagem; pacote tutorial, Promo-A e Promo-B seguem com a arte gerada.
- [ ] UI-176 — Comece um duelo novo (3D e 2D) → depois da VS, sem tocar em nada, a moeda equipada no deck aparece, gira sozinha e cai; cara: “Você começa.” com véu azul; coroa: “<rival> começa.” com véu vermelho; o aviso da preparação diz o mesmo; a IA não age antes de a moeda sair; com movimento reduzido, a face aparece parada; salve e retome → sem VS nem moeda.
- [ ] UI-178 — COLEÇÃO → Receitas (ou Receitas no S11) → 55 cartões com selo, caixa, destaques e barra de cobertura; filtre por Meta, por um tipo e busque uma carta (“Misty”) → só as receitas certas; “Só as que posso montar” esconde as incompletas; abra uma receita → estratégia, 20 cartas com as que faltam em cinza e “Falta”, painel do que falta levando à ficha da carta; Montar → o editor abre com nome, Energia e as 20 cartas, como rascunho se faltar algo.
- [ ] UI-181 — Num duelo (3D e 2D), deixe um Pokémon ser envenenado ou receber “não pode recuar/atacar” (ex.: Treino contra Apoio do Observatório: Sombra Densa) → o ícone estoura grande no centro da carta, com anel e brilho na cor do efeito, e voa para a coluna da borda direita; dois efeitos juntos estouram um de cada vez; passe o mouse no selo → texto do efeito; quando o efeito acaba, o selo encolhe e some; com movimento reduzido, sem estouro.
- [ ] UI-180 — Na ficha do deck, toque em Acessórios → a aparência abre na aba Verso, com os sleeves do Pocket em grade; escolha um e use Ver a frente/Ver o verso → a carta de exemplo gira; aplique ao deck e comece um duelo (3D e 2D) → o baralho, os Básicos virados da preparação e as cartas que viram mostram o sleeve; num encontro da campanha, o rival mostra o sleeve dele.
- [ ] UI-179 — S11, S12, S51, S52 e a caixa Deck atual do Início → a caixa é um retângulo em pé, como no Pocket: a carta de capa inteira na janela da frente, tampa na cor da Energia em cima, base clara, emblema do tipo na lateral; nos cartões, as duas cartas em destaque encostam na frente da caixa.
- [ ] UI-177 — Na oficina do deck (aba Moeda), escolha a Moeda Pikachu e aplique; num duelo, use um ataque com moeda → a moeda 3D mostra o Pikachu (cara colorida, coroa prata), véu azul; quando o rival lança (ataque dele, ou a moeda do defensor), aparece a moeda dele, véu vermelho; na 2D, a mesma moeda gira antes do “Cara!/Coroa!”.
- [ ] UI-175 — Comece um duelo (3D e 2D) e coloque Básicos no Ativo e no Banco → ficam de verso para cima, sem PS; toque em Iniciar duelo → as cartas não voltam à mão por nenhum instante; na revelação, as suas e as do adversário desviram juntas (na 2D, giro em Y); com movimento reduzido, a 2D mostra a frente direto.
- [ ] UI-174 — Duelo com o tapete neutro na mesa 3D em 1920×1080 e 1280×720 e na 2D → círculo grande e redondo na tela envolvendo os dois Bancos, metade de cima coral e de baixo azul-clara, aro branco com filete lilás, faixa clara no centro de borda a borda e disco menor atrás dos Ativos; fora da arena, claro em cima e azul embaixo; pilhas e pratos de Energia sobre o aro ou junto dele; sem faixas finas coral/ciano nas bordas; passe o turno → no do adversário o coral fica mais forte e no seu a metade de baixo fica mais azul; com um tapete de capítulo, só o entorno muda de tom e aparece o decalque; com uma imagem local de tapete, a arena vira película translúcida sobre ela.

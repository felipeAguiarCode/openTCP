# 📝 Changelog do pacote

## 🗂️ 3.3.0 (em preparação) — catálogo Genetic Apex (conteúdo 2.0.0), todos os sets do Pocket (conteúdo 3.0.0/3.0.1), rivais da franquia (conteúdo 3.1.0), menus em caixas, mesa em arena, moedas do Pocket (conteúdo 3.2.0), receitas de deck (conteúdo 3.3.0), sleeves do Pocket (conteúdo 3.4.0) e IA mais agressiva (conteúdo 3.5.0)

### IA mais agressiva em todas as dificuldades (conteúdo 3.5.0; decisão do autor, 18/10/2026)
- Problema medido (chefe de cada capítulo × deck de apoio jogado pelo Padrão, 21 partidas por dificuldade): nos turnos em que podia atacar, o NPC passava sem atacar em 42% (História), 19% (Padrão) e 21% (Especialista) — recuando um Ativo ferido para um reserva sem Energia, evoluindo o Ativo para um estágio que não pagava o ataque ou encerrando o turno pelo erro tolerado.
- Conteúdo **3.5.0**: peso novo `weights.aggression` no perfil de IA (schema `ai-profile`, gerado por `gen_content_schemas.py`); base 1, Wallace 0,7, Blue 0,85, Tenente Surge 1,1, Bea e Giovanni 1,2; `preservePoints` base 1 → 0,8 (`campanha.md` §14.1). Ids `<npcId>-<dificuldade>-v1` mantidos.
- IA (`gameplay.md` §25.3): bônus de ritmo para a linha que termina num ataque que afetou o adversário (`attackTempo`); penalidade do Ativo ocioso; recuo para quem não ataca fora da busca com ataque disponível, salvo para não entregar a partida (`isPassiveRetreat`); penalidade para quem recua e encerra sem atacar; a História compara jogadas que tiram o ataque com o melhor ataque; o erro tolerado nunca escolhe END_TURN nem RETREAT.
- Avaliação: ameaça do reserva que o adversário traz pelo Recuo (`switchInThreat`) — nocautear um Ativo fraco deixou de parecer pior só por promover um atacante forte; dano sustentado da corrida com o potencial de longo prazo como piso (um reserva fraco pronto não derruba mais a estimativa).
- Resultado (mesmas 21 partidas): 10% (História), 6% (Padrão), 8% (Especialista); pontos de Nocaute do NPC no Especialista 26 → 37. EXPERT × STANDARD em `strength.test.ts`: 20 de 30 (antes 17). Evoluir o Ativo para um estágio que não paga o ataque continua a cargo da avaliação.
- `playMatch` ganhou `onStep` (estado antes/depois de cada ação). Critério G-089. Testes: `domain/ai/aggression.test.ts` (catálogo real, ≥ 88% dos turnos com ataque legal terminam em ataque; antes 67%/78%/78% nas mesmas sementes) e casos novos em `domain/ai/tactics.test.ts`; mapa de critérios atualizado.

### Ícones de efeito nas cartas em campo (decisão do autor, 17/10/2026)
- Ícones do Pocket em `.inspo/effects` (5 Condições e 7 efeitos contínuos) copiados por `npm run inspo:effects` (`tools/inspo-import/effect-icons.py`, com `--check`) para `src/presentation/assets/effects/<id>.webp`; resolvedor `assets/effects.ts`. `UISprite.png` não é ícone de efeito e fica de fora.
- Domínio (`domain/battle/effect-badges.ts`): `EntityView.effects` — cada efeito temporário em jogo (`temporaryEffects` em `derived.ts`, com os alvos atuais, inclusive dinâmicos, e o valor do modificador) vira um selo no Pokémon afetado, com tipo de ícone (bloqueio, carta azul, escudo, ▲, ▼, estrelas) e texto em PT-BR; restrição só do jogador aparece no Ativo dele. Nenhuma regra muda.
- Apresentação: `PresentedEntity.effects` entra no `EFFECT_STARTED` e sai no `EFFECT_EXPIRED` (`board-model.ts`); `ui/battle/effect-marks.tsx` desenha a coluna de selos e o estouro (ícone grande, anel e brilho na cor do efeito, voo até a coluna; um efeito de cada vez) e a saída (encolhe no lugar), na mesa 2D e no overlay da 3D, no lugar das antigas etiquetas de texto das Condições (`interface-16x9.md` §25.21, `gameplay-pocket.md` §10.6.1).
- Licenças: linha `effects/` em `ASSETS.md`, `tools/licenses.mjs`, `thirdPartyData`, LEIA-ME e créditos.
- Critério UI-181. Testes: `domain/battle/effect-badges.test.ts`, `ui/battle/effect-marks.test.ts`; mapa de critérios e checklist manual atualizados.

### Sleeves do Pocket no verso das cartas (conteúdo 3.4.0; decisão do autor, 17/10/2026)
- Conteúdo **3.4.0**: 78 cosméticos `SLEEVE` gratuitos `sleeve-pocket-<stem>` (`assetKey` `sleeve-art:<stem>`), gerados de `src/content/source/sleeves.generated.ts`; o jogador segue com o Verso Neutro e cada rival ganha um sleeve do Pocket (`campanha.md` §21.6). Cartas, impressões, pacotes, economia, objetivos e grafo não mudam.
- Imagens: a página de sleeves do Serebii, em tamanho cheio (734×1024), baixada uma vez para `.inspo/sleeves/serebii/` (`npm run inspo:sleeves -- --fetch`). `tools/inspo-import/sleeves.py` (com `--check`) reduz para 367×512, aplica os cantos arredondados da carta e grava `src/presentation/assets/sleeves/<stem>.webp`. Resolvedor `assets/sleeves.ts`; validador `sleeveArtErrors`.
- Mesa 3D: `SleeveStyle.assetKey`; `acquireSleeveTexture` desenha a imagem do sleeve (chave de cache própria) ou o verso padrão enquanto carrega; `three/card/sleeve-art.ts` carrega os sleeves dos dois decks e a mesa refaz os versos ao chegar. Mesa 2D: `--back-human`/`--back-npc` no `.board2d`, aplicados pelo `data-anchor` de cada lado (`sideSleeveUrls`).
- Aparência do deck (`interface-16x9.md` §23.22): Acessórios da ficha abre S42 na aba Verso (`?tab=SLEEVE`); versos em grade com a imagem; prévia que vira a carta (`SleevePreview`); `CosmeticSwatch` mostra o sleeve.
- Licenças: linha `sleeves/` em `ASSETS.md`, `tools/licenses.mjs`, `thirdPartyData`, LEIA-ME e créditos.
- Critério UI-180. Testes: `assets/sleeves.test.ts`, caso novo em `content/validation.test.ts`, `e2e/sleeves.spec.ts`; mapa de critérios e checklist manual atualizados.

### Receitas de deck e caixa de deck retangular (conteúdo 3.3.0; decisões do autor, 16/10/2026)
- Conteúdo **3.3.0**: coleção nova `deckRecipes` (schema `deck-recipe`, gerado por `gen_content_schemas.py`) com **55 receitas** — 22 do meta (A1 ao A4b), 18 por tipo (duas por tipo de Energia, mais Dragão e Incolor) e 15 da comunidade (`campanha.md` §3.7). Fonte `src/content/source/recipes.ts`: listas escritas pelos nomes em inglês das cartas, resolvidos para a definição e a impressão canônica (`en(nome, set?)`, `num(set, número)`); nome com mais de uma versão de regras exige o set. Cartas, impressões, pacotes, economia, objetivos e grafo não mudam.
- content-build: schema, ids únicos, impressões existentes, deck jogável, evolução com o estágio anterior, capa Pokémon na lista, era de um set do pacote e mínimos por categoria e por tipo (C-068); seção 6.1 no catálogo gerado.
- Aplicação (`application/recipes.ts`): cobertura da receita pela coleção (qualquer impressão da mesma definição conta), rascunho para o editor (cópias da coleção primeiro; as que faltam com a impressão da receita) e filtros. Montar nunca concede cartas.
- Telas S51 (`#/decks/recipes`) e S52 (`#/decks/recipes/:recipeId`) (`interface-16x9.md` §3.1, §13.8): sub-aba Receitas em COLEÇÃO, botão Receitas no S11 e “Ver receitas” na biblioteca vazia. O cartão de deck do S11 vira componente (`components/deck-card.tsx`) com selo e barra de cobertura; `components/download.ts` para exportar listas.
- Caixa de deck retangular como a do Pocket (`interface-16x9.md` §13.6; `components/deck-box.tsx`): frente em pé com a carta de capa inteira numa janela, tampa na cor da Energia na metade de cima, base clara e emblema do tipo na lateral; nos cartões, as duas cartas em destaque encostam na frente da caixa.
- A mensagem de cópias faltando no editor diz o nome da carta (“Você possui 0 de 2 cópias de Pikachu ex.”), não o id da impressão.
- Critérios UI-178 (receitas) e UI-179 (caixa retangular), C-068 (conteúdo das receitas). Testes: `content/recipes.test.ts`, `application/recipes.test.ts`, `e2e/recipes.spec.ts`; `e2e/menus.spec.ts` confere S51 e S52 sem rolagem horizontal; mapa `src/tests/criteria-map.json` e checklist manual atualizados.

### Moedas do Pocket, cara ou coroa de abertura e moeda do deck (conteúdo 3.2.0; decisões do autor, 16/10/2026)
- Conteúdo **3.2.0**: 84 cosméticos `COIN` gratuitos `coin-pocket-<stem>` (`assetKey` `coin-art:<stem>`), gerados de `src/content/source/coins.generated.ts`; preset padrão do jogador com a Poké Bola e cada rival com uma moeda do Pocket (`campanha.md` §21.6). Cartas, impressões, pacotes, economia, objetivos e grafo não mudam.
- Imagens: o Bulbagarden recusa acesso automatizado; as moedas vêm da página de moedas do Serebii, baixadas uma vez para `.inspo/coins/serebii/` (`npm run inspo:coins -- --fetch`). `tools/inspo-import/coins.py` (com `--check`) remove o fundo, recorta a face num círculo e grava `src/presentation/assets/coins/<stem>-heads.webp` e `-tails.webp` (256 × 256, com alfa). O Serebii só mostra a cara; a coroa é derivada em prata dessaturada com aro claro. Resolvedor `assets/coins.ts`; validador `coinArtErrors` (as duas faces empacotadas).
- Cara ou coroa de abertura (`gameplay-pocket.md` §3, `interface-16x9.md` §22.1): depois da VS de toda tentativa nova, `CoinToss` joga a moeda do deck do jogador e cai na face do `firstPlayer` do motor (cara, o jogador começa; coroa, o rival), ~2,9 s; movimento reduzido mostra a face parada; a IA espera. O `startNode`/`waitOpening` dos e2e espera a VS e a moeda.
- Moeda do deck em todo lançamento (`gameplay-pocket.md` §10.6, `interface-16x9.md` §25.17): o passo `COIN` e o cue `COIN_RESULT` levam quem lança; a mesa 3D tem uma `CoinVisual` por lado com as imagens da cara e da coroa (`three/battle/coin-art.ts`, discos no lugar das tampas do cilindro, para a imagem ficar em pé); na 2D, `CoinResult` gira a moeda de quem lança antes do texto; o véu toma a cor de quem lança.
- Oficina (S41/S42, `interface-16x9.md` §23.22): aba Moeda em grade, prévia com cara, coroa e “Lançar a moeda”; `CosmeticSwatch` mostra a cara das moedas do Pocket (oficina, Empório, ficha do deck). Componente `CoinDisc` (`components/coin.tsx`).
- Licenças: linha `coins/` em `ASSETS.md`, `tools/licenses.mjs`, `thirdPartyData` do pacote, LEIA-ME e créditos.
- Critérios UI-176 (cara ou coroa de abertura) e UI-177 (moeda do deck em todo lançamento). Testes: `assets/coins.test.ts`, `three/battle/coin-owner.test.ts`, caso novo em `content/validation.test.ts` e `e2e/pocket.spec.ts`; mapa `src/tests/criteria-map.json` e checklist manual atualizados.

### Preparação virada para baixo (decisão do autor, 16/10/2026)
- Os Básicos colocados na preparação ficam com o verso para cima, sem PS, na mesa 3D (`EntityVisual.setFaceDown`, `BattleStage.setFaceDown`) e na 2D (`CardFace` oculto); `stagedFaceDown` em `ui/battle/setup-stage.ts`.
- Iniciar duelo não devolve mais as cartas à mão antes da revelação (sai o `resetToConfirmed`): a disposição continua virada até o `SETUP_REVEAL` substituí-la no mesmo lugar, e todas as cartas do campo desviram juntas. Na 2D, um giro em Y de ~0,7 s, que sobrevive à troca de rota S22 → S23.
- O `startNode` dos e2e espera a abertura VS aparecer antes de esperar que ela suma.
- Critério UI-175 (`gameplay-pocket.md` §3–§4, `interface-16x9.md` §40).

### Mesa em arena no estilo do Pocket (decisão do autor, 16/10/2026)
- Pedido do autor: deixar a mesa de batalha mais parecida com uma captura de batalha do Pokémon TCG Pocket. Mesa 3D (`three/battle/board-root.ts`, `layout.ts`) e 2D (`ui/battle/Board2D.tsx`, `styles/battle.css`) com geometria e cores compartilhadas em `three/battle/arena.ts` (`gameplay-pocket.md` §2, §5.1; `interface-16x9.md` §1.2, §23.2, §23.5, §23.8, §23.11, §23.14, §23.16–§23.18; `runtime-offline-threejs.md` §14.6, §14.7; `direcao-visual-pocket.md` §3, §5.1, §5.5, §8, §14.1, §16.6).
- Arena: círculo de tela no centro de espelho com raio = canto de Banco mais distante × 1,04 (≈ 427 px em `desktop1080`, ≈ 307 px em `compact720`), envolvendo os dois Bancos; na 3D é projetado no plano da mesa e aparece redondo. Metade do adversário em coral (`#EE9095` → `#F2ABAC`) e a do jogador azul-clara (`#D3E0F8` → `#C3D8F6`), aro branco de 16 px com filete lilás de 3 px (`#D3D0EE`).
- Faixa central clara (`#ECEFF6`, 85 %) de 56 px de borda a borda, com a linha central fina mantida. Disco central atrás dos Ativos com raio 1,0 × largura do Ativo (antes 1,35), `#ECEFF6` com disco interno `#D6DFFC` a 0,66 do raio.
- Entorno da arena: claro em cima (`#E8F2FB` → `#DCE3F5`) e azul embaixo (`#CBDBF6` → `#45A9F6`). Tapetes cosméticos só tingem o entorno (`playmatTint`, k = 0,32) e acrescentam o decalque periférico; com imagem local, as metades viram película de 38 % sobre ela (3D e 2D).
- Turno: saem as faixas finas coral/ciano das bordas (`PlayerBand`/`OpponentBand` ocultas; na 2D, sem `.board2d::before/::after`). O dono do turno acende a sua metade — coral mais forte (`#E8767D` → `#EE9499`) no turno do adversário e azul mais forte (`#C4DAFA` → `#A7CBF8`) no seu —, com a mesma suavização (`.turn-npc`/`.turn-human` na 2D).
- Ordem de desenho na 3D: superfície < imagem local (−3) < metades (−2,8) < filete (−2,7) < aro (−2,6) < faixa (−2,5) < decalque (−2) < disco, linha central e guias (−1); tudo fora do picking. Slots, pilhas, pratos de Energia, cartas e HUD não mudam; pilhas e pratos ficam sobre o aro ou junto dele.
- Critério novo UI-174 (mesa em arena, igual em 3D e 2D); VS-006 e VS-007 passam a falar das metades da arena em vez das faixas. Teste `three/battle/table-surface.test.ts` (disco = `ARENA.discK` × largura do Ativo e arena que envolve os dois Bancos, por perfil); mapa `src/tests/criteria-map.json` e checklist manual atualizados.

### Menus em caixas no estilo EA, promoção por arrasto e arte oficial dos pacotes (decisões do autor, 16/10/2026)
- Shell (`interface-16x9.md` §2.2, §3.1, [navegação por abas](interface-16x9.md#interface-navrail); `direcao-visual-pocket.md` §13.1): sai o rail lateral. Cabeçalho de 64 px (marca, Créditos e Pacotes, status de gravação, ícones Saves/Ajuda/Ajustes, sino → S35 e menu do perfil), faixa de abas de 56 px em gradiente azul profundo com **Início · Jogar · Coleção · Loja · Criar** (ativa em pílula branca com sublinhado ciano) e sub-abas de 46 px; conteúdo na largura toda. Mapa `NAV_GROUPS` em `components/shell.tsx`: Jogar (Visão geral, Campanha, Desafios, Arena, Treino, Histórico, Adversários), Coleção (Cartas, Decks, Fichários, Galeria), Loja (Pacotes, Empório, Recibos), Criar (Estúdio, Importar); Perfil e Aparência no menu do perfil. Q/E trocam de aba como os bumpers LB/RB, fora de campos de texto e modais. Indicadores: Loja e Pacotes com a contagem de pacotes, Jogar com “!” (prêmio pendente) ou “•” (duelo suspenso). Responsivo: até 1280 px o status de gravação fica só no ícone; até 1100 px saem os rótulos dos recursos e as teclas Q/E; até 760 px as abas viram barra embaixo. Batalha, abertura de pacote e telas de entrada seguem sem shell. Nos menus, o token `cyan` só aparece em linhas e selos pequenos (`direcao-visual-pocket.md` §3.1).
- Caixas de menu (`interface-16x9.md` §5.6): componente `MenuTile` (`components/menu-tile.tsx`, `styles/menus.css`) — tom em gradiente, arte, título em caixa alta, subtítulo, dados, chamada de ação e selo; a caixa inteira é um botão; tamanhos `hero`/`wide`/`tall`/`sq` numa grade densa de 4 colunas; foco e hover com aro branco, brilho azul e leve subida (só o aro com movimento reduzido); bloqueada anuncia o motivo e não navega; `RivalArt` (carta-chave do deck do rival com o retrato por cima) e `CHAPTER_TONE` por capítulo.
- Hubs em caixas: Entrada S48 (§6.2: Continuar, Novo jogo, Perfis e saves, Configurações, Créditos), Início S03 (§7: Continuar com o próximo rival, objetivos e progresso, Jogar, Pacotes, Deck atual, Desafios, Arena, Coleção e Empório; a vitrine 3D, “Novas cartas” e “Saves” saem do Início), Jogar S14 (§16.1), faixa de oito capítulos na Campanha S19 com mapa e detalhe lado a lado (§20.1), caixas de encontro em S15, S18 e S29 (§17.1, §20.7, §30.1); S04 e S33 em colunas de largura igual, com ações alinhadas embaixo (§8.1, §32.1).
- Promoção depois do nocaute (`gameplay-pocket.md` §6.2, `interface-16x9.md` §25.19, §26.1): com 2+ Pokémon no Banco, sem painel de decisão — mensagem simples no centro, entre os Ativos, Banco flutuando, Ativo vazio pulsando e arrasto até o Ativo (`RESOLVE_DECISION` com o `entityId`); soltar fora devolve ao Banco; sem arrasto, toque no Pokémon e depois no Ativo. Em 3D, realce `floating` e `onEntityDrop` no palco, com a animação partindo do ponto da soltura; em 2D, `ui/battle/entity-drag.tsx`. Lógica pura em `ui/battle/promotion.ts`. As outras decisões continuam no seletor universal.
- IA (`runtime-offline-threejs.md` §11.4, `gameplay-pocket.md` §5.3): plano descartado por revisão antiga (`AI_JOB_STALE`) agora faz a IA replanejar com o estado novo. Antes, se o jogador agisse enquanto a IA pensava (ex.: confirmar a preparação antes dela), o laço parava e o duelo travava na vez do adversário.
- Arte oficial dos pacotes (`interface-16x9.md` §8.5, §9.7; `direcao-visual-pocket.md` §12.1): o Bulbagarden recusa acesso automatizado; o autor decidiu usar as frentes de `.inspo/boosters/` e, nos três pacotes do Genetic Apex, as imagens da página do set no Serebii (baixadas uma vez para `.inspo/boosters/serebii/`). `npm run inspo:packs` (`tools/inspo-import/pack-art.py`, com `--check`) recorta margens, limita a 640 px de altura e grava WebP com alfa em `src/presentation/assets/packs/<productId>.webp` para os 15 pacotes de expansão; tutorial, Promo-A e Promo-B mantêm a arte gerada. `packArtUrl` + `PackArt` em S04, cabeçalho de S05, S33, caixa Pacotes do Início e na frente do pacote 3D do S06 (proporção da imagem, tira superior com a faixa do logotipo), inclusive no fallback sem WebGL.
- Critérios novos UI-170 (abas no topo), UI-171 (hubs em caixas, sem rolagem horizontal em 1920 × 1080 e 1280 × 720), UI-172 (promoção por arrasto ou clique, sem painel) e UI-173 (arte oficial dos pacotes); UI-071 fala em shell em vez de sidebar. Testes: `components/shell.test.ts`, `ui/battle/promotion.test.ts`, `assets/pack-art.test.ts`, `e2e/menus.spec.ts` e `e2e/promote.spec.ts`; mapa `src/tests/criteria-map.json` e checklist manual atualizados.

### Rivais da franquia, Ginásios, avatares, abertura VS e bolas de Energia (conteúdo 3.1.0; decisões do autor, 16/10/2026)
- Conteúdo **3.1.0**: toda mudança no pacote publicado sai com versão nova, porque a instalação recusa a mesma versão com outro `content_hash` (`IMPORT_INVALID`); o 3.1.0 instala por cima do 3.0.x sem apagar saves. Cartas, impressões, pacotes, economia, objetivos e grafo não mudam.
- Rivais (`campanha.md` §1.4): treinadores da franquia no lugar dos personagens autorais — Cheren (professor, P00 e exame da final), Líderes de Ginásio, Blue e Giovanni. Os `npcId` ficam os mesmos (duelos suspensos guardam o perfil de IA `<npcId>-<dificuldade>-v1`): `mara` é o Wallace, `lia` é o Cheren. Mudam só os textos de exibição — nomes, títulos, estilo, origem, dicas, nomes de decks (o do T06 vira “Cheren — Chama da Escola”), de nós, de capítulos, de tapetes e temas e os 194 diálogos, com as medalhas Arco-Íris, Chuva, Trovão, Pântano, de Lutador e Terra; cenas, arenas e texturas de tapete não mudam.
- Campanha como jornada de Ginásios (`campanha.md` §1.1, §4–§11): cada capítulo é um torneio de um tipo num Ginásio, com Líderes do mesmo tipo como desafiantes (E01, E03, E05) e o Líder anfitrião em E02, E04 e E06. Capítulos: P00 Prólogo — Escola de Treinadores; C01 Ginásio de Celadon (Erika); C02 Ginásio de Sootopolis (Wallace); C03 Ginásio de Vermilion (Tenente Surge); C04 Ginásio de Saffron (Sabrina); C05 Ginásio de Stow-on-Side (Bea); C06 Ginásio de Viridian (Blue); F00 Final — Torneio de Kanto (Cheren, revanche de Blue e Giovanni). O id da campanha continua `circuito-dos-arquivos-v1`.
- Retratos (`interface-16x9.md` §5.5): `npm run inspo:import` também copia `.inspo/portraits/` para `src/presentation/assets/portraits/` — 204 PNGs de 128×128 (≈3,8 MB) de 55 treinadores, sem as 2 cópias “(1)”, com nome normalizado (`Lt._Surge_Emote_1_Masters.png` → `lt-surge-emote-1.png`). Resolvedor `src/presentation/assets/portraits.ts`: chave `portrait:<arquivo>`, grupos por treinador com nome em PT-BR e variante, padrão `portrait:marnie-academy-emote-1`; avatar antigo por tipo, ausente ou sem arquivo cai no padrão.
- Avatar: o jogador escolhe o retrato no S02 e no S34 (Identidade), num seletor agrupado por treinador; cada rival tem o seu. O retrato é desenhado inteiro, sem contorno, sombra, raio nem fundo — o PNG já é um emblema redondo —, nas placas dos dois lados e no “+1 ponto!”, na abertura VS, no cabeçalho, no briefing S16, no caderno S29 (rival não encontrado em silhueta) e S30 e na Arena.
- Treino e duelo autoral, que não têm encontro: o adversário aparece como Cheren, professor da Escola de Treinadores, com nome e retrato dele e o deck e a IA escolhidos (`interface-16x9.md` §5.5). Assim, todo rival da mesa é um treinador da franquia.
- Validador (`campanha.md` §20.5): `portraitErrors` exige `Npc.portraitAssetKey` no formato `portrait:<arquivo>` com o PNG empacotado; antes era sempre `null`.
- Abertura VS (`interface-16x9.md` §22.1, `gameplay-pocket.md` §3): camada HTML `DuelIntro`, igual em 3D e em 2D. Faixas vermelha (rival, em cima) e azul (jogador, embaixo) fecham a tela, os retratos descem com impacto e tremor, e entram “VS.”, os nomes e a saudação do rival (primeira fala da introdução do nó). Uma vez por tentativa recém-iniciada (briefing, Arena, Treino ou “Reiniciar encontro”), nunca na retomada; entrada bloqueada e IA em espera enquanto aparece. Novo preset de interface `DUEL_INTRO` = 2600 ms em `uiPresets` (fora dos 38 presets de jogo, sem barreira de batalha); com movimento reduzido, pose final com fade por 1200 ms.
- Bolas de Energia (`interface-16x9.md` §23.10, `gameplay-pocket.md` §6.1, `direcao-visual-pocket.md` §11.4): `npm run inspo:energy` (`tools/inspo-import/energy-orbs.py`, Python + Pillow, com `--check`) recorta as 8 bolas do atlas `.inspo/scene/battle/energys.png` para `src/presentation/assets/energy/<tipo>.webp` (128×128, WebP sem perda com transparência). Usadas nas Energias ligadas, no orbe e na próxima Energia da Zona (esmaecida, com aro branco) e no voo da ligação, em 3D (texturas de canvas, com o desenho procedural enquanto carregam) e em 2D; Incolor, Dragão e os custos de ataque seguem com o ícone de tipo.
- Critérios novos UI-167 (abertura VS), UI-168 (avatar por retrato) e UI-169 (bolas de Energia), no mapa `src/tests/criteria-map.json` e no checklist manual.

### Conteúdo 3.0.1 e verso das cartas (16/10/2026)
- Conteúdo **3.0.1**: mesmas definições e impressões do 3.0.0, republicado com versão nova. Builds de desenvolvimento do 3.0.0 (antes dos oito decks iniciais e dos apoios) ficaram instalados em navegadores com outro `content_hash`, e a instalação recusa a mesma versão com hash diferente (`IMPORT_INVALID`, `persistencia-sqlite.md` §8); a versão nova instala por cima sem apagar saves, porque nenhuma definição ou impressão mudou. Regra reforçada: qualquer mudança no pacote publicado sai com versão nova.
- O `content:build` apaga de `public/content/` os pacotes de versões anteriores; o jogo só carrega o arquivo do manifesto.
- Verso das cartas trocado pela arte fornecida pelo autor (`.inspo/decks/_base/Card_Back.png` → `src/presentation/assets/card-back.webp`, 734×1024 com transparência): a imagem já traz a moldura prateada e os cantos arredondados, e é desenhada de borda a borda no 3D e no HTML, sem o filete branco anterior.

### Todos os sets do Pocket (conteúdo 3.0.0; decisões do autor, 16/10/2026)
- Conteúdo **3.0.0**: entram Mythical Island (A1a), Space-Time Smackdown (A2), Triumphant Light (A2a), Celestial Guardians (A3), Extradimensional Crisis (A3a), Eevee Grove (A3b), Wisdom of Sea and Sky (A4), Secluded Springs (A4a), Deluxe Pack ex (A4b), o resto do Promo-A e o Promo-B. O importador (`tools/inspo-import`) lê `.inspo/decks/<Set (CÓDIGO)>/` pelo registro `pocket/registry.ts`, na ordem canônica A1, P-A, A1a … A4b, P-B, e grava `pocket/data/<set>.generated.ts`. São 1.210 cartas de jogo e 2.069 impressões (220 PROMO, 100 brilhantes), todas em “Impressão completa” (`art:<set>:NNN`, `cards/<set>/<SET>-NNN.webp`, 1.777 artes novas). O A1 e as seis promos antigas continuam idênticos byte a byte aos da 2.2.0: o golden test guarda o hash (`campanha.md` C-059).
- Identidade entre sets (`campanha.md` §20.6): a mesma chave de jogo dá a mesma definição — reimpressões apontam para ela (A4b Pikachu ex → `pikachu-ex`). Regras diferentes com o mesmo nome dão uma definição nova `<chave>-<set>-<NNN>` (`blitzle-a3a-016`), com a mesma `deckLimitKey`, então o limite de duas cópias vale entre as versões. Ids de impressão: `<set>-<NNN>-<deckLimitKey>`. Seis promos P-A/P-B sem estágio anterior em nenhum set ficam só colecionáveis (`ORPHAN_EVOLUTIONS`). Formas regionais e especiais usam o nome oficial em PT-BR (Raichu de Alola, Dialga Forma Origem). Construtor compartilhado `pocket/build.ts`; o A1 passa a usá-lo, com o mesmo resultado.
- Raridade brilhante sem mudar schema: ✵ = ULTRA holográfica + `variant.shiny`, ✵✵ = ULTRA foil + `variant.shiny`. Ordem ◊ … ☆☆☆ < ✵ < ✵✵ < ♛ (`domain/cards/rarity.ts`), com glifo de estrela cintilante na face 3D (`campanha.md` §16.3).
- Pacotes (`campanha.md` §16): os três do A1 mantêm as probabilidades do projeto, sem mudança. Os 14 novos (`pack-a1a-mew` … `pack-a4b`, `pack-pa-promo`, `pack-pb-promo`) usam as taxas oficiais do Pocket por símbolo (`pocket/rates.ts`):
  - tabelas Clássica (A1a, A2, A2a), Brilhante (A3…A4a) e Deluxe (A4b, quatro cartas);
  - 6ª carta de bebês no A4/A4a (8,330%: ◊◊◊ 87,100%, ☆ 12,900%) e pacote raro (0,050%, uniforme em ☆…♛);
  - pesos em milésimos de ponto percentual, somando 100000 por posição, e chance uniforme dentro do símbolo;
  - o 0,001% que falta nas duas tabelas oficiais de 99,999% vai para o maior símbolo;
  - estimativas registradas: a 6ª carta do A4a repete a do A4; pares do Deluxe têm a mesma taxa por carta;
  - pacotes promocionais com cinco PROMO uniformes, taxa inventada pelo projeto.
- Sorteio do pacote por símbolo: pacote raro → símbolo e impressão de cada posição → 6ª carta. O recibo guarda os símbolos e indica pacote raro e 6ª carta. `RANDOM_PACK` ganha `tierSlots`, `tierPools`, `bonusSlot` e `rarePack` (schema de produto regenerado); o modelo do A1 mantém o mesmo consumo de RNG.
- Economia (`campanha.md` §15.2): os 14 pacotes custam 100 Créditos e estão à venda desde o início. Há uma carta dirigida por impressão não PROMO (1.849), com preço pela raridade (brilhante, ☆ e ♛ = ULTRA = 600); fora do A1 ficam à venda desde o início, e as travas do A1 continuam. PROMO não é vendida e só sai dos pacotes promocionais; o Pacote Promo-A exclui as seis promos da coleção inicial. A auditoria de Créditos não muda (4.010 / 7.730).
- Validador (`campanha.md` §20.5): `TIER_PACK_RULES`/`tierPackErrors` guardam uma cópia independente das tabelas e conferem cartas por pacote, preço, soma, pools coerentes e de um único set, PROMO, 6ª carta e pacote raro. Também exige que toda impressão tenha origem, aceita várias definições por `deckLimitKey` e só tolera evolução sem base nas promos órfãs.
- Effect DSL e motor (detalhes em [efeitos-dsl.md](efeitos-dsl.md) e [gameplay.md](gameplay.md)): filtros, escopo, fórmulas e condições novos; 20 opcodes novos, 54 no total, entre eles `MOVE_DAMAGE`, `SET_REMAINING_HP`, `DEVOLVE`, `CHOOSE_ONE`, `COPY_TRAINER`, `GRANT_RULE`, `SURVIVE_KNOCKOUT` e `REROLL_COINS`. O Nocaute passa a ter duas etapas, com reações enquanto o Pokémon ainda está em campo. Os 63 casos com cartas reais de `dsl-pocket.test.ts` acharam e corrigiram Lusamine, Doce Raro, Nocaute “por ataque” e o gatilho de Ferramenta.
- Texto gerado PT-BR: os ~590 textos de efeito novos (ataques, Habilidades e Treinadores do A1a ao A4b e das promos) estão no DSL, com os nomes oficiais em PT-BR. A forma compacta só é usada quando o parágrafo não cabe nas 3 linhas (`wrap.ts`, compartilhado com o encaixe do Estúdio). O gerador cobre as condições de jogo impressas nos Treinadores, a restrição de tipo/Ultracriatura nas Ferramentas e os nomes de ataques e Habilidades de outras cartas (`catalogNames`). `sets.test.ts` confere, set a set, numeração, brilhantes, bebês, evoluções entre sets, validação no Estúdio e texto sem inglês nem estouro.
- Decks (`campanha.md` §3): oito iniciais, um por tipo de Energia gerável. Os cinco novos (Faísca Veloz, Eco Psíquico, Punho Firme, Sombra Astuta, Aço Paciente) usam Pokémon comuns dos sets seguintes, só com ataques diretos; nenhum inicial cumpre um objetivo `-DECK`. A coleção inicial passa a 38 impressões × 2 = 76 cartas; C-005 e C-007 foram reescritos para os oito decks.
- Apoio (`campanha.md` §3.6): 8 modelos, um por set do A1a ao A4a, na aba “Modelos e apoio” e no Treino; 7 variações de campanha, uma por capítulo e com vantagem de tipo, oferecidas depois dos apoios recomendados (`SUPPORT_VARIANT_BY_CHAPTER`). O pacote passa a ter 116 decks (8/26/82), e a IA joga uma partida inteira com cada deck novo (C-067).
- Interface (`interface-16x9.md` §8–§11, §13, §14, §17, §25, §26, §32):
  - pacotes: S04 agrupa o catálogo por expansão e mostra o tamanho de cada pacote (“4 cartas por abertura”, “5 cartas por abertura (+1 em 8,330% dos pacotes)”); S05 mostra a tabela símbolo × posição com três casas em pt-BR, as linhas de pacote raro e 6ª carta e as cartas agrupadas por símbolo; S06 marca “Pacote raro!” e “6ª carta”; cada pacote real abre num tema 3D próprio (`PACK_THEME`);
  - Empório: filtros de Expansão, raridade e “Só disponíveis”, 60 itens por vez com “Mostrar mais (N)”, subtítulo “A3 042 · ☆ · você tem N” e pacotes agrupados por set;
  - Coleção: com uma Expansão escolhida, mostra a impressão daquele set, e raridade, número e ordenação só olham esse set; a grade vem em blocos de 120;
  - S08: “Comparar com” lista primeiro as outras versões do mesmo nome, e “Como obter” mostra a chance por pacote com três casas;
  - editor de deck: filtro de Expansão e blocos de 60;
  - perfil novo: oferece os oito iniciais;
  - duelo: a escolha de modo mostra rótulos (Bolsa de Eevee) e os ataques de evoluções anteriores aparecem na ficha com “· <carta>”;
  - critérios novos UI-155…UI-166; UI-068 passa a aceitar blocos com “Mostrar mais”.
- Catálogo: `catalogo-conteudo.md` vira índice (resumo, conjuntos, acabamentos, produtos com a tabela oficial de cada pacote novo, decks, campanha e auditoria), e as cartas de cada set ficam em `catalogo/cartas-<set>.md`. Tudo é gerado por `npm run content:build`.
- Critérios de campanha novos: C-057…C-067 (catálogo, identidade, conteúdo legado, pacotes por símbolo, ordem e convergência do sorteio, Deluxe, origem das impressões, oito iniciais, iniciais sem objetivo extra e decks dos sets novos). Todos estão no mapa `src/tests/criteria-map.json`.

### Cartas do Pokémon TCG Pocket no lugar das genéricas (decisão do autor, 15/10/2026)
- Conteúdo **2.0.0**: o set Genetic Apex (A1) — 225 cartas de jogo e 286 impressões, importadas de `.inspo/` por `npm run inspo:import` para `src/content/source/a1/a1-data.generated.ts` — mais 6 Treinadores Promo-A (Poção, Velocidade X, Lupa de Mão, Poké Bola, Cartão Vermelho, Pesquisa do Professor). Sem as artes (`TEMPLATE_ONLY`). Dados de terceiros (The Pokémon Company), uso local.
- Nomes de ataques, Habilidades e Treinadores traduzidos para PT-BR (`a1/pt-br.ts`); o texto de regras continua gerado do DSL (`a1/effects.ts` traduz cada efeito impresso em blocos).
- Raridade com os símbolos do Pocket sem mudar schema: ◊ COMMON · ◊◊ UNCOMMON · ◊◊◊ RARE · ◊◊◊◊ ULTRA · ☆ ULTRA holográfica · ☆☆ ULTRA foil · ☆☆☆ ULTRA foil imersiva · ♛ ULTRA cromada (`domain/cards/rarity.ts`); face, coleção (filtro e ordenação), Empório e pacotes mostram o símbolo.
- Três pacotes reais (`pack-a1-pikachu`, `pack-a1-charizard`, `pack-a1-mewtwo`) no lugar de Base/capítulo/Arquivo; pool por pacote de origem da impressão; ULTRA dirigida liberada pelo chefe que fecha cada pacote. Pacote tutorial: Pikachu, Meowth, Abra, Pidgey e Rattata ◊.
- Campanha refeita: decks iniciais (Charmander/Ponyta, Squirtle/Staryu, Bulbasaur/Exeggcute + promos), 11 decks de apoio, 27 decks de NPC, 6 tutoriais e 6 puzzles com solução verificada, cartas-chave (Erika, Misty, Tenente Surge, Sabrina, Brock e escolha entre Charizard ex, Pikachu ex e Blastoise ex), Descobertas e objetivos sem Ferramenta/Estádio/Mega. Composição por tipo (`minTypeCards`) substitui a contagem por conjunto de capítulo.
- Perfis criados com o catálogo antigo são recusados ao abrir, com aviso para criar um jogo novo (`application/legacy.ts`).
- Conteúdo **2.1.0**: as 286 impressões A1 usam a imagem da carta impressa (`.inspo` → `src/presentation/assets/cards/a1/`, `artKey` `art:a1:NNN`) em “Impressão completa”; nesse modo as faces HTML e 3D e a exportação PNG mostram só a imagem, sem o template por cima (`editor-de-cartas.md` §18). A instalação aceita, numa versão nova do pacote, impressão BASE que só mudou a arte empacotada (`persistencia-sqlite.md` §8). O content-build exige o arquivo de cada `artKey`. Conteúdo **2.2.0**: as seis promos também usam a imagem impressa (`.inspo/Promo-A (P-A)` → `cards/pa/`, `art:pa:NNN`).
- O catálogo genérico anterior virou fixture de teste (`src/tests/support/generic-cards.ts`).
- Ajustes de regra pedidos pelo set: “usar um efeito de troca” conta a troca do Ativo dos dois lados (Sabrina, Victreebel); o filtro `turnOf` vale também em `DAMAGE_APPLIED` (Contra-ataque do Poliwrath); bônus “se …, N a mais” codificados pela §9.1, nunca por fórmula crua; `CARD_TEXT_OVERFLOW` volta a falhar o `content:build`.

### Gameplay no estilo Pocket — fase 1 (decisão do autor, 15/10/2026; vídeo `.inspo/gameplay/video.mp4`)
- Nova spec [gameplay-pocket.md](gameplay-pocket.md) com a adaptação do vídeo de referência (observações em `referencias/`): layout em 16:9, ordem da partida e do turno, interação, botões, avisos, tempos-alvo e fases.
- Fase 1 implementada: preparação na própria mesa (sem painel à parte; Recomeçar/Iniciar duelo na divisória), aviso no topo (região `toast`), faixa de turno ciano/coral com “Turno atual: N”, “Pronto? Já!” e mosaico de hexágonos, menu ≡ em folha (Histórico, Pausa e ajustes, Salvar e sair, Desistir) e tutorial preso à borda direita (região `guide`). Critérios UI-133…UI-137.
- Fase 2 implementada (§9, §10): linhas de ataque com texto e borda brilhante quando prontas; bloqueadas em cinza, com o motivo no aviso do topo ao tocar ("Energia insuficiente"); Recuar em pílula com o custo; ações escondidas durante a animação. Também: cut-in em faixa larga na cor do tipo, número de dano grande e PS contando de 10 em 10, orbe ciano no nocaute, tela "+1 ponto!" com avatar e medalhões, resultado da moeda digitado, e pílula Vitória/Derrota antes do S24. Presets retemporizados: `TURN_BANNER` 1000, `PLAYMAT_TRANSITION` 600, `ATTACK_STANDARD` 2600, `ATTACK_SPECIAL` 3000, `KNOCKOUT` 1500, `POINTS` 2600 e `COIN_FIRST` 2400 ms (`interface-16x9.md`, tabela de presets). Critérios UI-138…UI-145.
- Faixa do ataque fluida (decisão do autor, 15/10/2026), na mesma linguagem das outras faixas e em camadas: o fundo abre do lado de quem ataca, com pontas esmaecidas; o texto entra sem esticar e desliza; um brilho atravessa a faixa, que fecha para o lado oposto (`gameplay-pocket.md` §10.2, UI-140).
- Zona de Energia como prato e arrasto livre do orbe (decisão do autor, 15/10/2026; referências `.inspo/scene/battle/energy-*.png`). O prato é um disco branco-lilás. Com Energia pronta, mostra um orbe do tipo com halo ciano pulsando; a próxima Energia aparece escura na borda de baixo. O orbe pode ser arrastado livremente, com rastro, e o Pokémon válido sob ele cresce de leve. Ao soltar, a Energia voa até a fileira de Energias da carta, com anel e partículas; solto fora, o orbe volta ao prato. A prévia da carta da mão some durante o arrasto. Critérios UI-148 e UI-149 (`gameplay-pocket.md` §6.1).
- Hover (decisão do autor, 15/10/2026): a carta da mesa sob o ponteiro sobe em direção à tela, cresce, inclina de frente e flutua, sem prévia à parte, e o PS em HTML acompanha. A prévia grande fica só para a carta da mão, centrada na tela (`interface-16x9.md` §24.2). Critério UI-147.
- Ficha de ações (decisão do autor, 15/10/2026; referência `.inspo/scene/battle`): ataques, Habilidades e Recuar saem dos botões sempre à vista e aparecem ao tocar no Pokémon. A carta sobe ampliada no centro da mesa com o PS atual, e as linhas ficam sobre a metade de baixo dela. A ficha fecha ao tocar fora ou com Esc. O Pokémon que pode agir ganha contorno ciano. Critério UI-146 (`gameplay-pocket.md` §7.4).
- Fase 3 implementada (§5.2, §6, §9): zona verde translúcida (nova região `trainerZone`) ao arrastar Item, Apoiador ou Estádio — soltar dentro joga, fora volta à mão sem aviso; evolução jogável com contorno amarelo; compra própria com prévia grande no centro e descida até a ponta direita da mão; Básico jogado com giro em Y, prévia no centro e PS só depois; Item e Apoiador com prévia e dissolução na cor do subtipo, reaparecendo no descarte; cartas do adversário viram do verso; Energia gerada só depois da compra, com flash no prato e o rótulo "Próxima Energia gerada"; aviso "Sem cartas no deck: não é possível comprar." A mesa 2D mostra as prévias em HTML. Presets: `DRAW_SELF` 1100, `PLAY_BASIC` 1200, `PLAY_SPECIAL` 1400, `PLAY_ITEM` e `PLAY_SUPPORTER` 1200 ms (`interface-16x9.md` §36.2; `direcao-visual-pocket.md` §10). Critérios UI-150…UI-154.
- Mensagens de destaque centradas na tela (decisão do autor, 15/10/2026): a faixa "Seu turno"/"Turno do adversário" e o "Pronto? Já!" saem da divisória para o centro da tela, numa linha do tempo única e fluida (a faixa abre do lado de quem joga, o texto desliza, um brilho atravessa e tudo sai pelo lado oposto). A faixa de nome da tela de ponto abre com o mesmo movimento. "+1 ponto!" e a pílula de fim deixam de herdar a inclinação do "Pronto? Já!".

### Telas de deck (decisão do autor, 15/10/2026; inspiração `.inspo/scene/deck`)
- Biblioteca “Escolha um baralho”: cartões com faixa na cor da Energia, número, caixa de deck 3D com a capa escolhida, duas cartas em destaque e ações do selecionado em barra flutuante de ícones (`interface-16x9.md` §13.1, §13.6).
- Editor como ficha do deck minimalista: nome em pílula, caixa 3D com troca de capa, painéis Energia/Acessórios/Destaques, 20 vagas em cartas (clique remove), coleção ao lado (clique adiciona), ações em ícones (§14.1). Capa por deck na preferência `deckCovers` (`persistencia-sqlite.md` §7.1).

### Novo (catálogo `base` 1.0.0, substituído pelo 2.0.0)
- `catalogo-conteudo.md`, gerado por `npm run content:build` a partir de `src/content/`: 110 definições, 135 impressões (todas `TEMPLATE_ONLY`), 96 decks (3 iniciais, apoio por capítulo e NPC por nó × dificuldade), 157 produtos, 45 nós, 93 objetivos, 12 fixtures (5 tutoriais e 6 puzzles com solução verificada pelo motor) e 165 diálogos.
- Auditoria de Créditos recalculada dos dados no build: rota obrigatória 4.010, renda opcional 3.720 e máximo único 7.730; nenhum objetivo de composição é cumprido pelos decks iniciais.

### Effect DSL — extensões para o set Genetic Apex (A1), compatíveis com as cartas existentes
- `efeitos-dsl.md`: escopo `DEFENDING` (Pokémon Defensor fixo na entidade, só em ataques, inclusive o copiado); fórmulas `EXTRA_ENERGY_UNITS` (Energia além do custo do ataque) e `DAMAGE_DEALT_BY_ATTACK`; opcodes `ATTACK_FAILS` (falha como a Confusão) e `SHUFFLE_HAND_INTO_DECK` (34 opcodes); `ATTACH_ENERGY.count` aceita fórmula e `distribute: true` (um alvo por unidade); `MOVE_ENERGY.count` aceita `"ALL"` com várias origens; `SWITCH_ACTIVE.filter`; Fóssil conta como Básico em `filter.stages`; `PREVENT_EFFECTS` barra todos os efeitos (não dano) de ataques adversários, inclusive troca, restrição e modificador; §9.1 padrões de autoria; critérios `FX-013`…`FX-024`; erros `SELECTOR_IMPOSSIBLE` (Defensor) e `ATTACK_ONLY_OPERATION`.
- Texto gerado PT-BR (§15): nomes por `deckLimitKeys`, plural “cada um dos seus Pokémon”, restrição de jogador, bônus de dano em frase (“Se sair cara, este ataque causa 30 de dano a mais.”), busca por tipo/nome, alvo aleatório repetido, Habilidades ativadas em uma frase; `content:build` mede o limite de linhas do template (`CARD_TEXT_OVERFLOW`, aviso enquanto o catálogo `base` tiver o estouro herdado de Dínamo).
- `deck-limit-key-v2` (`persistencia-sqlite.md` §9, `gameplay.md`, `editor-de-cartas.md`, `$comment` do schema): “♀” → “ f”, “♂” → “ m” antes da v1 — Nidoran♀/Nidoran♂ deixam de colidir; nenhuma chave existente muda.

### Persistência e Estúdio — lacunas encontradas na implementação
- `IMPORT_PROFILE` reaplica as operações históricas do perfil (ledgers, eventos, concessões e publicações têm FK para `operations`); `profile.json` leva ledgers completos com `ledgerSummary`.
- `profile_imports.source_kind` segue a origem do arquivo (`PROFILE_ZIP_4` ou `DATABASE_BACKUP`), não a ação; o remapeamento inclui `card_test_runs.run_id`.
- Substituir a instalação suspende as tentativas antes da troca (não exige ausência delas); limites do `.zip` de backup (260/257 MiB, 4 entradas); pacote exigido aceito se o build o distribui ou o banco já o registra.
- Catálogo CUSTOM do perfil inclui definições de outros autores de que ele tem cópias; testes obrigatórios da publicação = cenários salvos no rascunho, executados na versão-alvo; importação de `.card.json`/`.cardpack.zip` publica cada carta por `PUBLISH_CARD`.

### Mesa de batalha (decisão do autor, 15/10/2026)
- `FOCUS_TABLE` sem painéis laterais: barra do adversário no topo e do jogador no rodapé, com os contadores de pontos no centro das barras; ações em popover transitório junto à seleção; Finalizar turno, Menu/Pausa e Histórico como botões flutuantes (regiões `humanBar`, `endTurn`, `menu`, `history`; âncora `HUMAN_END_TURN`).
- Mão grande em leque sempre sobreposto (176×246,4 px em 1080p; 129,2×180,88 px em 720p), saindo pela borda inferior atrás da barra; a carta em foco sobe inteira (`handPolicy.bottomBleedPx`, `focusLiftPx`, `fanStepRatio`).
- Mão do NPC como leque de versos no topo central, atrás da barra do adversário.
- 720p: campo de 976 px centralizado (+136 px em X para campo, slots, pilhas e Energia; centro de espelho (636, 323)); câmera e sementes inalteradas.

## 🔧 3.2.0 — correções da auditoria e lacunas de implementação

**Data:** 14 de outubro de 2026. Correções in-place; o schema SQLite 1 nunca foi publicado, por isso foi corrigido no próprio v1, sem migração.

### Novo
- `efeitos-dsl.md`: linguagem executável normativa — blocos, `failurePolicy`, seletores, fórmulas (com `SUBTRACT`), condições, durações por referência de turno, gatilhos, custos adicionais, 32 opcodes, ordem de resolução, modificadores contínuos, texto gerado, erros e critérios `FX-001`…`FX-012`.
- Schemas: definição de carta completa (Habilidades, `trainerRules`, Fóssil por `fieldBehavior`, `baseName`, `damageTarget`), impressão (`setId`, `collectorNumber`, `artist`, `artTransform`, `artKey`, `TEMPLATE_ONLY`) e nove schemas de conteúdo (deck, produto, objetivo, nó, tabela de prêmio, NPC, perfil de IA, fixture, cosmético, diálogo) mais o rascunho do Estúdio.
- `database/build_seed.py` gera o seed a partir dos exemplos com hashes RFC 8785 (JCS).

### Regras (gameplay)
- Primeiro jogador por moeda de `battleRng`; ordem normativa de sorteios da preparação.
- Zona de Energia: 8 tipos configuráveis, até 3, pesos uniformes, algoritmo exato de geração.
- Piso 0 no dano; condições só no Ativo, removidas ao evoluir ou sair do Ativo; ordem do checkup por jogador; Confuso pode recuar.
- Promoções simultâneas ocultas; máquina de estados com `SETUP`, `AWAITING_DECISION`, `PROMOTION`, `TERMINAL`.
- `rng-v1` normativo (xoshiro128** + SplitMix32, Fisher–Yates, sorteio ponderado).
- Efeito obrigatório impossível torna o Treinador injogável; `evolvesFrom` usa `deckLimitKey`; Fóssil representável.
- ex/Mega somente por `ruleBox`; exemplo de abertura corrigido (Fraqueza Planta→Fogo: 60, não 40).

### Campanha e economia
- Chaves de concessão únicas, sem `profileId` e sem versão de conteúdo (a versão na chave repetiria a primeira vitória após atualização).
- Alternativas de Descoberta permanecem no Empório; preço de `pack-archive-v1`; regra de PROMO.
- Objetivos de composição reescritos: os antigos eram cumpridos automaticamente pelos decks iniciais (~1.080 Créditos “opcionais” garantidos); auditoria da renda opcional (máximo único 7.730).
- Pacote tutorial passa a conter cinco cartas novas do conjunto Base (antes: 3ª cópia de Treinadores inúteis pelo limite de 2).
- Status persistidos da tentativa: RUNNING/SUSPENDED/FINISHED/ABANDONED; setup é fase da partida.

### Persistência e editor
- DDL: migração atômica pelo runner (arquivo sem BEGIN/COMMIT/PRAGMA); 47 tabelas (`binders`, `binder_slots`, `collection_marks`, `catalog_archive_marks`; `legacy_imports` → `profile_imports`); `campaign_progress` sem versão na chave; colunas de nó/dificuldade/deck em `attempts`; vínculo projeto↔publicação; gatilhos de imutabilidade que faltavam; `printing_assets` só aceita bindings declarados; miniatura fora da tabela append-only; índices novos.
- Catálogo de comandos, `CommandEnvelope` com `payloadHash`/`writerEpoch`, schema mínimo de recibo, mapa de erros, formatos de exportação completos, restauração em OPFS com staging e retenção de revisões do Estúdio.
- Flair de entrada vive só em `deck_entries`.

### Runtime, interface e visual
- Runner Node especificado (127.0.0.1 + ::1, porta fixa, cabeçalhos, host canônico); árvore de distribuição com `dist/manifest.json` e `vendor/sqlite/`; threads e workers; fallback 2D DOM/CSS; catálogo de cenas completo; glossário de objetos 3D.
- Segunda aba nunca abre o banco, nem em leitura; R-024/R-026 alinhados.
- Âncoras `HUMAN_*`/`NPC_*`; câmeras e sementes de mundo recalculadas por perfil; geometria completa de batalha (pilhas, Energia, pontos, Estádio, leque do NPC, política da mão, escala para outros viewports); mão de 720p centralizada.
- Mapa evento → preset, easings nas fases, presets de interface; crossfade de playmat; NavRail canônica com **Criar**; rotas S48–S50; fonte OFL nas faces das cartas; faixas de ataque com contraste ≥ 4,5:1.
- Arte do catálogo base por `artKey` lógico, substituível sem mudar `printingId`.

### Escopo
- Conversor IndexedDB/JSON 2–3 não aplicável (nunca houve implementação 2.x): R-076, R-078, DB-042, DB-043 e C-054 marcados N/A.

### Validação
- `validate_specs.py` ampliado (exemplos em blocos JSON, numeração de seções, chaves de concessão, tabelas × JSON, rotas, contagens e contiguidade de critérios, opcodes do DSL × schema, contraste das faixas) e sem reescrever arquivos do manifesto por padrão.
- `test_schema.py`: 89 verificações com controle positivo (antes 53).

---

## 🎨 3.1.0 — direção visual Pocket Light

**Data:** 14 de outubro de 2026.

- Acrescenta `direcao-visual-pocket.md` como sétima spec e `referencias-visuais.md` com fontes oficiais identificadas.
- Revoga as imagens conceituais escuras como referência de UI, paleta, arte e regras.
- Reescreve a direção de interface, Home, câmera/campo, materiais, composição da carta, capítulos e prévia do Estúdio.
- Mantém campo claro azul/lavanda, aro branco, cores de lado ciano/coral e UI branca/azul suave.
- Detalha compra de mão, revelação por deslizamento, rasgo de pacote e cut-in de ataque, sem alterar os 38 tempos-base autorais existentes.
- Acrescenta tokens JSON/CSS, âncoras de layout, doze coreografias, cinco briefs e matriz de capturas.
- Versiona o visual dos nove playmats em 2, mantendo IDs, preços, requisitos e entitlements.
- Preserva SQLite schema 1, ruleset, dados funcionais de cartas, SQL, fixtures e schemas do editor.
- Acrescenta 60 critérios VS de conformidade visual e validação documental reproduzível.
- Não inclui artes, fontes, imagens conceituais, jogo executável ou testes de GPU.

A revisão não afirma copiar os tokens internos ou durações medidas do aplicativo. Esses valores são alvos de implementação a homologar contra as capturas identificadas.

---

## 📚 Histórico preservado

# 📝 Changelog — SQLite, autoria e apresentação local

## 🗄️ 3.0.0 — 14 de outubro de 2026

### Persistência
SQLite WASM/OPFS passa a ser a fonte única de verdade, substituindo IndexedDB. Nova spec completa com schema SQL 1, worker proprietário, lock por banco, transações, recibos, BLOBs, migrações, importação legada, backup SQLite e perfil portátil formato 4.

Inclui DDL de 43 tabelas e fixture técnica validada em SQLite nativo. A versão do runtime SQLite deve ser fixada durante a implementação; nenhuma biblioteca WASM acompanha estas specs.

### Autoria de cartas
Novo Estúdio de Cartas com biblioteca, rascunhos, versões imutáveis, modelos, ataques, Habilidades, efeitos, condições, custos, ex/Mega ex, arte, recorte, máscara de foil, materiais e prévia Three.js.

Dados funcionais passam a explicitar `ruleBox` no formato de carta 2. Alterações visuais criam impressões; alterações mecânicas criam versões/definições. Perfis CUSTOM/LAB permitem usar conteúdo criado, sem alterar silenciosamente STANDARD.

### Integração
Atualizadas as quatro specs existentes, rotas S43–S47, formato de exportação, política de segunda aba e relação com campanha. O conteúdo de combate, 45 nós, nove playmats e 38 presets de animação é preservado.

Arquivar perfil não é exclusão física; limpar toda a instalação é uma ação separada com confirmação/backup. IndexedDB aparece apenas como histórico/conversão, não como banco paralelo.

### Verificação
Verificações nativas do DDL e dados de referência, JSON Schemas estruturais e links internos. Nenhum teste nativo equivale a homologação do navegador, implementação do editor ou validação completa das regras.

---

## 🎨 2.1.0 — 14 de outubro de 2026

### 🃏 Interface e apresentação

A seção 23 da interface foi reescrita: mesa em foco por padrão, painéis táticos opcionais, mapa de regiões 1080p/720p, cartas físicas digitais, HUD legível, deck/descarte em laterais espelhadas e distinção entre cenário, playmat e Estádio.

Foram adicionados a oficina S41/S42, presets por deck/perfil, nove temas, personalização controlada, importação local de imagem, safe zones, prévias com mesa cheia e snapshots cosméticos por tentativa.

Compra própria/adversária, entrada comum/especial, flair, evolução, Treinadores, ferramentas, revelação temporária, descarte e retorno possuem contratos distintos. Ataques incluem destaque ampliado, VFX por tipo, moedas, impactos, condições, Nocaute e resultado.

A abertura de pacotes detalha rasgo, extração, revelação individual/especial, resumo e retomada do mesmo recibo. Um catálogo de 38 presets define durações autorais, modos de velocidade e movimento reduzido.

### 🧊 Runtime e dados

Diretor de animações com estado confirmado, projeção apresentada, cursor e barreiras de decisão. Trânsito de cartas entre câmeras por subcena compartilhada. Recursos de GPU, som, callbacks e seleção são reconciliados em skip/pausa/retomada.

Schema de IndexedDB passa de 2 a 3; o ruleset `local-campaign-v2` não muda. Presets, entitlements, imagens locais e snapshots são persistidos sem serializar objetos Three.js. Formato de exportação 3 contempla referências cosméticas; backup portátil com imagens é uma extensão especificada.

Materiais, blending de tapete inteiro, resolução de texturas, importação estática validada, cache e proteção de informações ocultas receberam critérios específicos.

### 🗺️ Campanha e economia

Neutro e Academia são gratuitos. Seis tapetes temáticos permanecem produtos de 500 Créditos após o chefe correspondente. F00-D03 concede o tema Circuito Completo uma única vez. Não há Créditos extras nessa concessão; a auditoria monetária anterior permanece.

NPCs usam presets próprios. Cenários periféricos preservam os mesmos slots. Migração não cobra novamente acessórios nem duplica prêmios de chefes.

### ✅ Entrega

Quatro specs atualizadas, README, changelog, validação estrutural e quatro exemplos JSON. A matriz passa de 288 a **360 critérios de produto planejados**: G 88, UI 132, C 56 e R 84.

Não foram implementados executável, assets ou testes de performance. O pacote continua exclusivamente documental.

---

## 🚀 2.0.0 — 14 de outubro de 2026

Esta revisão substitui o escopo funcional da v1 nos arquivos revisados. Os originais fornecidos não foram sobrescritos.

### 🔄 Escopo reformulado

| Antes | Agora |
|---|---|
| Possível produto conectado com modo local inicial. | Produto local-only, single-player, offline-first desde o início. |
| Batalhas solo junto de casual, ranqueada e salas. | Campanha, puzzles, Arena, treino e tutoriais. |
| Social, amigos, presença, troca e compartilhamento. | Caderno de NPCs, galeria pessoal, Descobertas locais e exportação de listas. |
| Eventos, temporadas e prazos. | Conteúdo permanente desbloqueado por progresso. |
| Possível recuperação temporal de pacotes. | Pacotes recebidos ou comprados com Créditos de jogo. |
| Autoridade remota e reconexão. | Motor local, transações IndexedDB, pausa e retomada. |
| 3D opcional. | Three.js obrigatório para objetos e cenários principais. |
| Futuro online como fase do roadmap. | Ampliação de conteúdo e robustez local; sem fase online implícita. |

### ➕ Novos documentos

`campanha.md` especifica Circuito dos Arquivos, prólogo, seis capítulos, final, 45 nós planejados, aquisição e economia.

`runtime-offline-threejs.md` especifica pacote integral, origem estável, saves, workers, renderização, assets locais, recuperação e testes.

### 🎮 Gameplay

Preservadas as regras detalhadas de baralho de 20 cartas, Energia, turnos, evolução, ataques, Habilidades, condições, Recuo e pontuação.

Substituídas as dependências de serviço por contratos locais. Acrescentados snapshots de tentativa, proteção contra duplicação involuntária, RNG independente da apresentação, dificuldade sem trapaça e mapa de campanha.

As decisões de reprodução aproximada da referência continuam sinalizadas. A revisão não transforma pontos próprios de regra em suposta confirmação oficial.

### 🖥️ Interface

Reorganização de menus com Campanha como área principal. Rotas hash, telas de perfis e saves, diário, NPCs, Arena e Empório. Removidos fluxos de login, busca online, sala, ranking e calendário.

Preservados o editor detalhado e o layout 16:9, com integração explícita de malhas, palco de carta, mapa em dioramas, mesa e HUD HTML. Baixa qualidade preserva 3D; ausência de GPU aciona recuperação 2D.

### 💾 Integridade

Operações registradas antes da animação. Mão e moeda não mudam ao retomar. Resultado e recompensa não dependem de clicar na tela final. Prêmios que exigem escolha preservam o direito até a seleção.

Uma tentativa ativa por perfil; único escritor entre abas; importação sem fusão automática de inventários; backup portátil e limites do armazenamento do navegador explicitados.

### 🧊 Runtime

Sem CDN, fontes remotas, APIs ou assets baixados em runtime. Um renderer principal com múltiplos viewports; WebGL2; cor e acabamentos controlados; raycast alinhado ao viewport; gestão de memória e descarte de recursos.

### ✅ Critérios

80 critérios de gameplay + 96 de interface + 48 de campanha + 64 técnicos = 288 critérios planejados.

A verificação desta entrega cobre a documentação. Não representa implementação, homologação de regras contra o aplicativo oficial, testes reais de campanha ou benchmark de performance.

# 🎨 Direção visual — campo, arte e animação na linguagem do TCG Pocket

> **Versão:** 3.2.0 · **Data:** 14 de outubro de 2026  
> **Perfil visual:** `pocket-light-v1`  
> **Destino:** jogo local/offline, campanha, 16:9, Three.js, SQLite e Estúdio de Cartas.  
> **Status:** especificação normativa de apresentação; não é um aplicativo ou pacote de artes prontas.  
> **Complementos:** [interface](interface-16x9.md) · [runtime](runtime-offline-threejs.md) · [editor](editor-de-cartas.md) · [fontes visuais](referencias-visuais.md).

> **Revisão 3.2:** `cyan` restrito à seleção/foco de cartas, faixas por `playerBand`/`opponentBand`, fonte OFL local na face das cartas, faixas de ataque com `attackStripColors`, easings com quatro IDs fixos, foco da mão ≤ 24 px e ≤ 1,15, NavRail canônica, glossário 3D único e briefs idênticos a `art-briefs.json`.

> **Revisão 3.3 (conteúdo 3.1.0, 16/10/2026):** avatares do jogador e dos rivais por retrato (emote) de treinador da franquia, desenhado inteiro e sem contorno (§4, §6.5); Energias ligadas e Zona de Energia com as bolas do atlas nos oito tipos geráveis (§11.4).

> **Revisão 3.3 (menus em caixas, 16/10/2026):** faixa de abas no topo e sub-abas no lugar do rail lateral, hubs em mosaico de caixas no estilo dos menus da EA (§13.1, §13.2), `cyan` admitido nos menus só em linhas e selos pequenos (§3.1) e frente oficial do booster nos pacotes, quando empacotada (§12.1).

> **Revisão 3.3 (mesa em arena, 16/10/2026):** o campo de batalha ganha a arena do Pocket — círculo que envolve os dois Bancos, metade do adversário coral e a do jogador azul-clara, aro branco com filete lilás, faixa clara no centro e disco atrás dos Ativos; fora dela, claro em cima e azul embaixo. Sem faixas `playerBand`/`opponentBand` nas bordas: o dono do turno acende a sua metade (§3.1, §3.2, §5.1, §5.5, §8, §14.1, §16.6, VS-006, VS-007).

## 🧭 Sumário
- [🎯 1. Resultado obrigatório e prioridade](#visual-01)
- [🔎 2. Referência, aproximação e limites](#visual-02)
- [🎨 3. Paleta e tokens](#visual-03)
- [🔤 4. Tipografia, formas e ícones](#visual-04)
- [🏟️ 5. Campo de batalha](#visual-05)
- [🃏 6. Cartas e linguagem de ilustração](#visual-06)
- [✨ 7. Acabamentos, flair e raridade](#visual-07)
- [🧶 8. Playmats e acessórios](#visual-08)
- [🎞️ 9. Gramática de movimento](#visual-09)
- [🖐️ 10. Comprar, jogar e revelar](#visual-10)
- [⚔️ 11. Ataques, Energia, dano e Nocaute](#visual-11)
- [🎁 12. Pacotes e revelações de coleção](#visual-12)
- [🖥️ 13. Menus, campanha, decks e Estúdio](#visual-13)
- [🧊 14. Tradução técnica para Three.js](#visual-14)
- [🗄️ 15. Dados visuais, versões e migração](#visual-15)
- [🎬 16. Briefings para produção de arte](#visual-16)
- [✅ 17. Critérios de aceite visual](#visual-17)
- [🚧 18. Gates de implementação](#visual-18)

<a id="visual-01"></a>
## 🎯 1. Resultado obrigatório e prioridade

O jogo deve se reconhecer visualmente na família de **Pokémon TCG Pocket**: campo claro com a arena do Pocket (metade do adversário coral, a do jogador azul-clara; §5.1), moldura branca, controles arredondados, seleção ciano, cartas colecionáveis coloridas, sombra discreta e animações centradas na própria carta.

**Não é uma troca de cor de um jogo de fantasia escura.** É uma revisão da composição, iluminação, materialidade, hierarquia, ilustração e ritmo. O visual padrão não usa sala medieval, madeira escura, bronze, runas, bordas ornamentadas, brasas permanentes, névoa cinematográfica ou botões laranja como identidade global.

A aparência rejeitada das imagens conceituais anteriores não será mantida como “tema alternativo padrão”. Nesta entrega, não há tema escuro de interface. Configurações de conforto reduzem movimento/brilho sem trocar a direção de arte.

### 1.1. Ordem de autoridade

1. `gameplay.md`: verdade das regras.
2. `persistencia-sqlite.md`: gravação, referências e versões.
3. Este documento: direção visual compartilhada.
4. `interface-16x9.md`: telas, geometria de viewport e interação.
5. `runtime-offline-threejs.md`: implementação gráfica, filas e recursos.
6. `editor-de-cartas.md`, `campanha.md` e `efeitos-dsl.md`: funcionalidades próprias dentro do mesmo sistema visual.

A precedência é por responsabilidade, não uma autorização para esconder conflitos. Ao alterar um contrato compartilhado, atualizar documentos e exemplos juntos.

### 1.2. O que não muda

Campanha permanente, execução sem internet, NPCs locais, SQLite WASM/OPFS, Three.js, criação de cartas e personalização de playmats permanecem obrigatórios. Não reintroduzir conta, loja real, ranking, espera diária, geração remota de imagens ou multiplayer para copiar a aparência do aplicativo.

Baralho de 20, três posições de Banco, três pontos e demais regras do projeto permanecem. Uma imagem conceitual não pode acrescentar custo universal de mana, resistência genérica ou cinco posições de criatura.

<a id="visual-02"></a>
## 🔎 2. Referência, aproximação e limites

Os registros RP01–RP09 estão em [referencias-visuais.md](referencias-visuais.md). Eles identificam as capturas oficiais utilizadas e o que foi observado.

| Parte | Aproximação desejada | O que é adaptação do projeto |
|---|---|---|
| Campo | Organização central, cores claras, aro, fichas, HP externo. | Layout horizontal, dimensões e painéis opcionais. |
| Ataque | Carta ampliada, faixa do golpe, velocidade e retorno. | Curvas, duração e orçamento gráfico. |
| Coleção | Cartas em evidência, UI clara e ornamentação leve. | Busca ampla e comparação lado a lado. |
| Arte | Variedade de ilustrações de criaturas e treinadores com linguagem de TCG. | Criaturas, pessoas e cenários autorais do catálogo. |
| Acessórios | Playmat ilustrado, verso uniforme e moeda. | Oficina de camadas, importação e presets. |
| Campanha | Mesma linguagem visual do resto do jogo. | História, mapa, encontros e progressão autorais. |
| Estúdio | Controles e prévias com aparência de produto da mesma família. | Editor de regras e imagens próprio, não uma tela oficial do Pocket. |

Os hexadecimais abaixo são **aproximações visuais de implementação**, não um design system oficial obtido do aplicativo. A meta é fidelidade de impressão visual. Não alegar precisão pixel a pixel ou igualdade das curvas de animação sem executar comparação.

Nomes e IDs funcionais autorais existentes são preservados. Não é necessário substituir Braseiro por uma espécie oficial para obter o estilo pedido. Se forem usados assets fornecidos pelo usuário, registrar origem; o pacote de specs não inclui logos, músicas, fontes proprietárias ou cartas extraídas do aplicativo.

<a id="visual-03"></a>
## 🎨 3. Paleta e tokens

### 3.1. Tokens canônicos

Arquivo consumível: [examples/visual-tokens.json](examples/visual-tokens.json). Espelho CSS: [design/theme-pocket.css](design/theme-pocket.css). Todos os valores são sRGB.

| Token | Valor | Uso |
|---|---|---|
| `canvas` | `#F4F8FC` | Fundo geral claro. |
| `surface` | `#FFFFFF` | Painéis e diálogos. |
| `surfaceSoft` | `#EAF4FA` | Superfícies secundárias. |
| `surfaceInset` | `#DFEBF5` | Campo de input e áreas rebaixadas leves. |
| `text` | `#263A50` | Texto principal; não usar cinza pálido para regras. |
| `textSecondary` | `#526780` | Rótulos e metadados. |
| `textDisabled` | `#8797AA` | Estado não interativo, acompanhado de motivo. |
| `line` | `#CBDCEB` | Divisores. |
| `primary` | `#75C7FA` | Botão principal e seleções de menus. |
| `primaryStrong` | `#357DE4` | Foco e realce de alto contraste. |
| `primaryInk` | `#153F65` | Texto sobre botão azul claro. |
| `cyan` | `#2DECE5` | Seleção e foco de cartas: contorno de carta utilizável, selecionada ou alvo legal. Nos menus, só em linhas e áreas pequenas: sublinhado da aba ativa, selo de contagem e aro do capítulo atual (§13.1). Não é a faixa do lado humano. |
| `cyanSoft` | `#C8FAF5` | Áreas de destaque suave. |
| `playerBand` | `#22DCEA` | Cor do lado humano. A faixa fina da borda próxima não é mais desenhada: o turno acende a metade da arena (§5.1). |
| `opponentBand` | `#F2857D` | Cor do lado distante; não é sinal de erro. Sem faixa desenhada na borda (§5.1). |
| `boardNear` | `#86BCE7` | Paleta padrão do tingimento de tapete, lado próximo. A mesa padrão usa as cores da arena (§5.1). |
| `boardFar` | `#D8D5F4` | Paleta padrão do tingimento de tapete, lado distante. |
| `boardLine` | `#F5FAFF` | Guias estruturais sobre o tapete. |
| `rim` | `#F4F8FF` | Borda clara da mesa. |
| `pointGold` | `#F6CE3D` | Discos de pontos; não ornamentação global. |
| `success` | `#15704B` | Texto de confirmação. |
| `hpFill` | `#57D995` | Barra de HP com trilho de contraste. |
| `warning` | `#875600` | Aviso textual. |
| `danger` | `#A93243` | Erro/ação destrutiva; não cor padrão de ataque. |
| `shadow` | `#647D9A` | Fonte cromática da sombra com baixa opacidade. |

### 3.2. Gradientes

Fundo de menus: `canvas → surfaceSoft`, com diferença sutil. Mesa padrão: a arena e o entorno da §5.1, sem textura de concreto ou madeira; o tapete neutro não tinge nada, e os demais tingem só o entorno com a sua paleta (padrão `boardFar`/`boardNear`). Faixa de vitória: ciano → azul vivo. Faixa de ataque: família do golpe, nunca a paleta do menu inteiro.

Ciano saturado aparece como uma linha ou área pequena. Não aplicar brilho emissivo a todas as superfícies brancas. Laranja continua permitido em cartas de Fogo e seus efeitos, não nos menus globais.

### 3.3. Cores dos tipos

| Tipo | Cor de apoio | Faixa de ataque | Branco sobre a faixa |
|---|---|---|---:|
| Planta | `#72B75D` | `#4B823A` | 4,61:1 |
| Fogo | `#EF785B` | `#D83B15` | 4,61:1 |
| Água | `#60ADE7` | `#1D79BF` | 4,63:1 |
| Elétrico | `#E8C83E` | `#8A7310` | 4,63:1 |
| Psíquico | `#A279CB` | `#8F5EC0` | 4,64:1 |
| Lutador | `#C48D61` | `#A0683C` | 4,63:1 |
| Noturno | `#536A80` | `#475B6D` | 7,03:1 |
| Metálico | `#A2B1BC` | `#627888` | 4,60:1 |
| Dragão | `#B8A65D` | `#837439` | 4,64:1 |
| Incolor | `#BAC5D0` | `#61778E` | 4,63:1 |

A cor de apoio não garante texto branco legível: com ela, o branco fica entre 1,65:1 e 3,42:1 (exceto Noturno). A faixa de ataque usa o tom escurecido do mesmo matiz, publicado como `attackStripColors` em [visual-tokens.json](examples/visual-tokens.json) e como `--pocket-strip-<tipo>` no CSS; os pares de contraste ficam em `stripContrastPairs`.

Essas cores são auxiliares. Símbolo, nome e texto são necessários. Incolor não cria uma Energia gerada pela Zona. O modo padrão não acrescenta “Ar”, “Arcano”, “Mana” ou “Magia” à taxonomia do gameplay.

### 3.4. Contraste e composição

Texto principal e secundário devem alcançar contraste de pelo menos 4,5:1 sobre a superfície efetiva; textos grandes e indicadores essenciais seguem metas de contraste adequadas ao contexto. O script de validação calcula pares fixos, mas não substitui avaliação sobre arte e gradientes.

`primaryInk` sobre `primary`, e não texto branco pequeno sobre ciano muito claro. Sobre playmat customizado, os rótulos ganham placa clara/escura controlada ou contorno; a cor do texto não é inferida a cada frame por amostra instável da imagem.

Toda informação central deve continuar legível sem bloom e sem sombras. Fundos claros não significam interfaces sem contraste.

<a id="visual-04"></a>
## 🔤 4. Tipografia, formas e ícones

UI sem serifa, arredondada de modo discreto, com boa leitura em PT-BR. O shell HTML pode usar a pilha de fontes do sistema (`typography.family`); a escolha tipográfica não deve exigir download. Não afirmar o nome da fonte proprietária do Pocket sem documentação.

A **face das cartas** — nome, HP, ataques, textos e faixa de ataque compostos no Canvas — usa uma fonte OFL empacotada como arquivo local do build: Nunito via `@fontsource` (`typography.cardFace`, `--pocket-card-font`). Assim a textura gerada é idêntica em Windows, macOS e Linux e o hash de cache da face não depende do sistema. A licença acompanha o pacote em `LICENSES/`; nenhuma fonte é carregada da rede.

Em 1080p: corpo 16–18 px; metadados 14–16; títulos 26–32; HP externo 28–36 (22–28 em 720p); números de dano 36–56. Em 720p, reduzir espaços antes da fonte. Texto da carta em miniatura pode ser pequeno, mas o inspector oferece cópia semântica.

Botões em cápsula, altura 44–52 px, borda suave, sombra azul-acinzentada discreta. Cards de seção com raio 16–24 px. Não usar cantos chanfrados de HUD militar, serrilhados ou molduras de metal envelhecido.

Ícones simples, traço regular, preenchimento quando selecionado. Avatar redondo: o retrato do treinador, desenhado inteiro, sem contorno, sombra ou fundo acrescentados (§6.5). Pontos em **três** discos; vazios cinza e obtidos amarelos. Bordas e estrelas de raridade não devem ser confundidas com pontuação.

Focus ring usa `primaryStrong` com separação clara. Hover eleva no máximo 2–4 px em botões e altera levemente a sombra. Inputs não pulsam, tremem ou possuem chamas nas bordas.

<a id="visual-05"></a>
## 🏟️ 5. Campo de batalha

### 5.1. Composição canônica

A mesa deve parecer uma **superfície digital de batalha**, não uma mesa de madeira fotografada numa sala. Base clara arredondada, sombra suave abaixo, aro branco e, no centro, a **arena** do Pocket. O pano de fundo é um gradiente muito claro.

**Arena (decisão do autor, 16/10/2026; [gameplay-pocket §2](gameplay-pocket.md#pocket-2)):** círculo grande no centro de espelho que envolve os dois Bancos (raio = canto de Banco mais distante × 1,04), igual na mesa 3D e na 2D. Cores sRGB de `three/battle/arena.ts`:

| Elemento | Repouso | Turno daquele lado |
|---|---|---|
| Metade do adversário (distante), da borda à linha central | `#EE9095` → `#F2ABAC` | `#E8767D` → `#EE9499` |
| Metade do jogador (próxima), da linha central à borda | `#D3E0F8` → `#C3D8F6` | `#C4DAFA` → `#A7CBF8` |
| Aro (16 px) / filete externo (3 px) | `#FFFFFF` / `#D3D0EE` | — |
| Faixa central (56 px, 85 %) | `#ECEFF6` | — |
| Disco central (1,0 × largura do Ativo) / disco interno (0,66 do raio) | `#ECEFF6` / `#D6DFFC` | — |
| Entorno em cima / embaixo | `#E8F2FB` → `#DCE3F5` / `#CBDBF6` → `#45A9F6` | — |

Não há faixas `playerBand`/`opponentBand` nas bordas: o dono do turno acende a sua metade da arena. Pilhas e pratos de Energia ficam sobre o aro ou junto dele. O tapete cosmético tinge só o entorno e acrescenta o seu decalque; com imagem local, as metades viram película de 38 % sobre ela.

A superfície inteira pode receber o playmat ilustrado. Não desenhar um palco gigante com colunas, velas, astrolábios, tempestade, mar realista ou cidade ao fundo. Elementos de capítulo ficam nos menus/mapa e em arte cosmética; durante a luta, o campo permanece limpo.

Organização obrigatória:
```text
  MÃO NPC (versos)      BANCO 0   BANCO 1   BANCO 2      PONTOS NPC
  DECK · DESCARTE NPC
  ENERGIA NPC                     ATIVO NPC
                      ───────── faixa de turno ─────────   ESTÁDIO
                                  ATIVO HUMANO           ENERGIA HUMANA
                                                         DESCARTE · DECK
  PONTOS HUMANOS        BANCO 0   BANCO 1   BANCO 2
                          MÃO HUMANA — FRENTES
```

Deck/descarte do humano à direita; os do NPC à esquerda, espelhados. Energia atual e próxima em fichas circulares na diagonal correspondente. Estádio é um indicador inspecionável ao lado do corredor central, não uma quinta criatura. A mão do NPC é um leque compacto de versos com contador ao lado do Banco do NPC, porque não há altura livre acima dele. Coordenadas em [battle-layout.json](examples/battle-layout.json) e na seção 23 da interface.

### 5.2. 16:9 sem esticar o aplicativo de celular

`FOCUS_TABLE` é o padrão. Campo central grande; inspector e histórico fechados até solicitação. Há margens funcionais para ações e detalhes, mas não duas colunas pretas permanentes.

Os limites de tela estão em [examples/battle-layout.json](examples/battle-layout.json) e na seção 23 da interface. O viewport Three.js ocupa o campo; não renderizar um retrato 9:16 dentro de uma captura estática esticada.

Em 1280×720, manter as oito posições, recolher inspector e simplificar etiquetas. Nunca remover dois lugares do Banco para abrir espaço. Abrir detalhes pode sobrepor a margem ou pausar a interação, mas não espremer as cartas a uma escala ilegível.

### 5.3. Profundidade e câmera

Visão quase superior, aproximadamente 12° a partir da vertical como ponto de partida. FOV vertical inicial 28°. Esses valores são parâmetros autorais; enquadramento final depende de `fitBounds` e do layout.

Ativos aparecem maiores que cartas do Banco, conforme escala de apresentação, sem alterar alcance. Frente sempre legível ao observador local. Rotação de carta em destaque não vira rotação permanente de toda a mesa.

Não mostrar mãos humanas, cartas tombadas de lado em perspectiva extrema, órbita livre em combate, depth of field ou desfoque na mão. Movimentos de carta criam profundidade por elevação curta e sombra de contato.

### 5.4. Zonas e HUD

Guias de Banco: retângulos finos claros, raio moderado, integrados ao tapete. Ativos podem ter contorno de seleção mais forte. Slots vazios continuam reconhecíveis, mas não parecem botões gigantes com símbolo “+” no meio da luta.

HP externo no canto superior direito, barra verde curta, Energia junto à base, Ferramenta e condições em badges pequenos. Não repetir um painel completo de nome/tipo/raridade em cima de cada carta.

Deck mostra quantidade real ≤20 na configuração padrão. Mão inicial de cinco. O fixture visual não deve apresentar “27 no baralho” ou um deck de 24 cartas. O editor não pode marcar válido um baralho com três cópias do mesmo nome.

### 5.5. Cenário de estado

A mudança de turno acende a metade da arena de quem joga (§5.1) e atualiza o botão. Um ataque só fica habilitado em estado legal. Uma captura marcada “Turno do oponente” não mostra “Usar ataque” habilitado para o humano.

Pausa, decisão pendente, carregamento e falha de save têm rótulos próprios. Nenhum deles troca silenciosamente a arte do campo por uma tela genérica de conexão.

<a id="visual-06"></a>
## 🃏 6. Cartas e linguagem de ilustração

### 6.1. Geometria

Carta vertical 5:7, cantos suavizados, borda fina e espessura aparente discreta. É um objeto Three.js, não uma placa de pedra, um livro metálico ou um painel de vidro grosso. Frente e verso separados; sem texto invertido ou refletido.

O verso é uniforme dentro do deck. Uma carta oculta não recebe brilho, recorte, som ou espessura exclusiva que revele sua raridade.

### 6.2. Composição clássica

Template-base: moldura prateada/cinza clara; cabeçalho de nome, estágio e HP; janela de arte com moldura fina; área de ataques em tonalidade do tipo; rodapé com Fraqueza, Recuo, regra especial, identificação e raridade. A área textual tem contraste estável.

Não acrescentar círculo de mana no canto superior esquerdo. Os ícones de Energia pertencem aos custos dos ataques. Não acrescentar faixa “Resistência −30” ao template se o ruleset não oferece essa propriedade.

Texto de estágio e compatibilidade evolutiva deve caber sem encobrir a arte. Se houver dois ataques, ambos continuam legíveis e não viram notas decorativas.

### 6.3. ex, arte completa e impressão especial

`EX` é regra funcional com box de pontuação. Não obriga foil e não substitui raridade. Uma impressão ex normal permanece possível no Estúdio. O catálogo de referência pode escolher acabamentos mais chamativos para certas impressões sem criar acoplamento de regras.

Arte completa pode expandir a imagem atrás de áreas específicas, com placas ou gradientes locais para preservar texto. Não transformar toda carta em full-art só porque seu dono ativou o tema.

### 6.4. Direção de ilustração

Criaturas com silhueta clara, cores vivas, anatomia estilizada e expressão legível; cenas de natureza, cotidiano, aventura ou ação elemental. A linha visual deve lembrar ilustrações de cards japoneses, não bestiário de horror medieval.

Aceitar, por coleção coerente:
- traço limpo e pintura digital suave;
- aquarela/guache e textura artística moderada;
- arte narrativa com ambiente detalhado mas hierarquia clara;
- render 3D estilizado e polido em cartas específicas.

A variedade é intencional, apoiada pela referência RP09. Não impor que toda carta seja chibi, toda arte seja cel shading ou toda criatura tenha a mesma pose frontal.

### 6.5. Personagens e capítulos

**Retratos (decisão do autor, 16/10/2026, conteúdo 3.1.0):** os rivais são treinadores da franquia — Líderes de Ginásio, Blue e Giovanni ([campanha §1.4](campanha.md#campanha-01)) — e o retrato de cada um, como o avatar do jogador, é o emote do treinador empacotado (`portrait:<arquivo>`, [interface §5.5](interface-16x9.md#interface-05)). Cada emote já é um emblema redondo com aro próprio e a marca da expressão: desenhar a imagem inteira, sem contorno, outline, sombra, recorte nem fundo — sem contorno, só o emote. Personagens autorais, quando houver, seguem o brief `npc-portrait` (§16.3): treinadores estilizados, roupas contemporâneas ou de aventura leve, rostos e gestos expressivos, retratos circulares ou recortes simples em painéis claros. Nada de operadores militares, armaduras de placas ou bustos hiper-realistas escuros como direção padrão.

As ilustrações de capítulo adotam as mesmas cores e simplificação das cartas. O diorama do C02 (`campaign-harbor`) é um porto ensolarado estilizado ou um pôr do sol suave, não uma cidade gótica noturna.

### 6.6. Respeito a conteúdo existente

Uma arte importada pelo usuário não é recolorida destrutivamente para forçar a paleta. A UI e o enquadramento continuam claros; oferecer aviso de leitura, recorte e camada de contraste. Uma alteração de arte publicada cria nova impressão, não sobrescreve bytes referenciados por replay.

<a id="visual-07"></a>
## ✨ 7. Acabamentos, flair e raridade

| Componente | Persistência | Aparência desejada |
|---|---|---|
| Normal | Impressão | Papel limpo, sombra e reflexo discreto. |
| Holográfico | Impressão | Reflexo na janela de arte ou máscara autorizada. |
| Foil | Impressão | Iridescência dependente de ângulo, não um filtro arco-íris opaco. |
| Cromado | Impressão autoral | Prata polida restrita; não identidade padrão de toda carta. |
| Flair | Preset/equipamento | Acento curto na entrada ou contexto permitido. |
| Raridade | Catálogo/impressão | Ícone e tratamento de coleção, sem dano automático. |
| Regra ex | Versão funcional | Sufixo/box e recompensa por Nocaute. |
| Ataque | Regras + apresentação | Efeito por família do golpe, não por raridade visual. |

Texto e HP impresso ficam fora da máscara principal de brilho. Um foil não pode apagar letras no ângulo frontal de referência. Preservar arte ao desativar efeitos.

O flair padrão é pequeno: estrelas, partículas claras, arco elemental breve ou pulsação da borda. Não manter incêndio permanente à volta de todas as cartas ex.

Cartas imersivas são experiência de coleção/inspeção. Não iniciar um vídeo longo a cada compra, evolução ou ataque. A cena local só usa assets instalados e controles de sair/pausar.

<a id="visual-08"></a>
## 🧶 8. Playmats e acessórios

### 8.1. Tapete neutro aprovado

A mesa em arena da §5.1 sem tingimento nem decalque: entorno claro em cima e azul embaixo, arena com a metade do adversário coral e a do jogador azul-clara, faixa central e disco claros, guias brancas, aro claro. Motivo central amplo e suave, sem runas ou marca autoral ornamental que domine o campo. Sem faixas nas bordas: o dono do turno acende a sua metade.

A superfície tem volume apenas suficiente para separar plano e aro. Não usar tecido fotográfico áspero visível à distância de jogo. Perfil `MATTE` é o padrão; `CLOTH` e `SYNTHETIC` continuam opções controladas.

### 8.2. Ilustrações e personalização

Manter as funções de importação, recorte 4:3, variantes, padrões, decalques, material, verso, moeda e flair. A aparência inicial de todos esses formulários é clara. O preset cosmético guarda só o flair padrão (`defaultEntryFlairId`); o flair de cada cópia é `deck_entries.entry_flair_id` da revisão do deck.

A personalização não recolore os indicadores funcionais. Alterar `accentHex` muda máscaras cosméticas aprovadas; a seleção legal continua ciano, perigo continua semântico e os tipos preservam seus símbolos.

Em presets prontos, padrões discretos, motivos botânicos, ondas suaves, formas geométricas claras e criaturas ilustradas substituem couro, metal envelhecido e selos dourados densos.

### 8.3. Alternância

`TURN_OWNER` permanece o padrão do projeto: o tapete inteiro acompanha o dono do turno. `PLAYER_FIXED` e `NEUTRAL` são alternativas de conforto. Não simular duas metades de artes independentes, pois a especificação usa uma superfície integral.

Crossfade simples de 280 ms (`PLAYMAT_TRANSITION`: dois samplers e mescla linear da cor); a metade da arena do dono do turno acende sem girar o mundo. Os tapetes tingem só o entorno da arena; arena, divisão e disco ficam (§5.1). Cartas, contadores, mãos e raycasts permanecem em posição. A transição não pode atrasar uma decisão obrigatória.

### 8.4. Catálogo de nove temas

Preservar IDs e economia. Nova direção:
| ID | Tratamento |
|---|---|
| `mat-neutral` | Azul/lavanda e geometria clara. |
| `mat-academy` | Branco, azul-céu e pequenos motivos de fichário/cartas. |
| `mat-c01-grove` | Verde folha, céu claro, flores e criaturas ilustradas. |
| `mat-c02-harbor` | Água turquesa, docas claras, bóias e céu azul. |
| `mat-c03-circuits` | Amarelo suave, azul, circuitos simples sem HUD militar. |
| `mat-c04-observatory` | Lavanda, céu pastel e estrelas ilustradas sem ambiente sombrio. |
| `mat-c05-foundry` | Coral suave, prata clara e ferramentas simpáticas. |
| `mat-c06-archive` | Marfim frio, azul claro, páginas e prismas coloridos. |
| `mat-circuit-complete` | Síntese luminosa dos seis capítulos, prêmio com acento amarelo. |

Esses temas são criações do projeto, não nomes de acessórios oficiais. A arte aprovada será cadastrada como nova versão do cosmético quando substituir uma versão publicada.

<a id="visual-09"></a>
## 🎞️ 9. Gramática de movimento

Movimento de interface **leve, curto, legível**. Objetos pequenos podem ter uma acomodação elástica mínima; menus não quicam como brinquedos a cada clique. Carta desliza, eleva, gira brevemente e assenta.

Fontes dos tempos:
- [interface §36](interface-16x9.md#interface-motion-timing): tabela humana, presets de interface e [mapa evento → preset](interface-16x9.md#interface-event-preset-map).
- [examples/animation-presets.json](examples/animation-presets.json): 38 presets de jogo e `uiPresets` (`UI_HOVER` 120 ms, `UI_DRAWER` 200 ms, `UI_DRAG_RETURN` 200 ms).
- [examples/motion-choreography.json](examples/motion-choreography.json): fonte única das fases e de seus easings.

Números são metas autorais, não cronometragem do Pocket. Toda sequência tem pose final, cancelamento de apresentação e barreira de decisão.

Easing usa somente quatro IDs do projeto, declarados em cada fase (`easing`) da coreografia:

| ID | Curva | Uso |
|---|---|---|
| `linear` | t | Fades, luz atravessando costura, giro contínuo da moeda e crossfade do playmat. |
| `easeOutCubic` | 1 − (1 − t)³ | Saída, elevação e deslizamento que desaceleram ao chegar. |
| `easeInOutCubic` | aceleração e desaceleração cúbicas | Trajetórias entre duas posições (corredor, mão ↔ campo, revelação). |
| `easeOutBack` | 1 + (c₁ + 1)(t − 1)³ + c₁(t − 1)², c₁ = 1,165 | Assentamento com pequeno excesso; pico máximo 1,05. Só em cartas, fichas e moeda, nunca em menus. |

Não importar curvas por strings executáveis ou `eval`; o JSON nomeia a curva e funções homologadas a interpretam.

A aplicação da ação termina no commit; a animação pode estar alguns eventos atrás. Nenhum callback de partícula grava pontos, sorteia cartas ou concede uma recompensa.

Normal, Rápida e Instantânea alteram apresentação. Movimento reduzido remove giros, zooms, tremor e trajetórias grandes; usa transição curta e mantém texto. Pausa sempre interrompe novos comandos da IA.

<a id="visual-10"></a>
## 🖐️ 10. Comprar, jogar e revelar

### 10.1. Comprar não é abrir um booster

Compra humana de 1100 ms (`DRAW_SELF`, fases `LIFT` → `TRAVEL` → `REVEAL_TO_OWNER` → `PREVIEW_CENTER` → `SETTLE`): a carta sai do topo do baralho da direita, vai ao centro da mesa, vira para o dono, fica grande por ~0,3 s e desce para a ponta direita da mão, como no vídeo de referência ([gameplay-pocket §5.2](gameplay-pocket.md#pocket-5), que prevalece na mesa). A frente fica visível somente à observação autorizada. Sem explosão de raridade nem interrupção longa: a prévia é a mesma para qualquer carta.

Compra adversária de 360 ms (`DRAW_OPPONENT`): verso uniforme de `NPC_DECK_TOP` até `NPC_HAND_ENTRY`, no leque compacto do NPC; contadores atualizados no marco visual correto. Sem frente, foil, som raro ou flair identificador.

Várias compras usam movimentos escalonados dentro do grupo, direto para a mão; não cinco cut-ins completos. A falta de espaço ou de cartas segue o resultado do motor; não animar uma carta inexistente e removê-la depois — o aviso do topo explica (“Sem cartas no deck: não é possível comprar.”).

### 10.2. Selecionar e arrastar

Hover ou foco eleva a carta da mão **no máximo 24 px** e aumenta sua escala **no máximo até 1,15** (`UI_HOVER`, 120 ms); a carta em foco é desenhada na cena de trânsito para não ser cortada pela altura da mão, e o inspector mostra a leitura detalhada. Seleção persiste por clique/toque. Ações possíveis recebem contorno `cyan`; impossíveis seguem inspecionáveis, com explicação.

Durante drag, a carta visual acompanha uma camada de transição. Soltar fora de alvo válido devolve à origem em 200 ms (`UI_DRAG_RETURN`) sem consumir ação. Não aplicar custo no início do gesto.

### 10.3. Colocar Básico

Após commit: saída da mão (ou do ponto da soltura) → giro em Y até a prévia grande no centro → assentamento no slot → contorno de confirmação e flair, se equipado (`PLAY_BASIC`, 1200 ms; [gameplay-pocket §9](gameplay-pocket.md#pocket-9)). O slot não se move e não se abre um portal que invade toda a mesa.

Carta especial usa 1400 ms no total em vez de 1200 ms, mas mantém mesma escala final. O ex não se torna uma criatura independente gigante.

### 10.4. Evoluir

Nova carta aproxima-se da origem compatível, sobrepõe a pilha, breve pulso claro e atualização de HP máximo. Energia, Ferramenta e dano permanecem representados conforme o motor. O glow não mostra cura fictícia.

A evolução não precisa de animação de transformação de um modelo de criatura. O efeito destaca a mudança da carta no topo.

### 10.5. Revelação autorizada

Preparação revela campos comprometidos; efeito público revela apenas cartas permitidas; uma carta que retorna à mão deixa o foco público no momento definido. A representação transitória não pode ficar presa revelando informação que não está mais autorizada.

Replay e retomada respeitam sua projeção. Não revelar todos os versos para “facilitar” reconstrução da cena.

### 10.6. Itens, Apoiadores e anexos

Item e Apoiador crescem até a prévia grande no centro, seguram e dissolvem na cor do subtipo — Item ciano, Apoiador dourado — com molduras que se expandem em camadas; a carta reaparece no descarte (`PLAY_ITEM`/`PLAY_SUPPORTER`, 1200 ms; [gameplay-pocket §9](gameplay-pocket.md#pocket-9)). Ferramenta se liga à entidade; Estádio vai ao indicador próprio e mostra substituição.

O Estúdio oferece preview dessas mesmas sequências, não animações diferentes que não aparecerão no jogo.

<a id="visual-11"></a>
## ⚔️ 11. Ataques, Energia, dano e Nocaute

### 11.1. Ataque padrão — 2600 ms sem moedas/decisões adicionais

```text
ATTENUATE           Atenuar campo com véu leve, bloquear comandos incompatíveis.
CARD_CUTIN          Carta atacante amplia/inclina; faixa com nome do golpe.
READ_ACCENT         Leitura curta e linhas de velocidade; sem espera oculta.
TRAVEL_AND_RETURN   Retorno ao campo e deslocamento/feixe elemental.
IMPACT_HP           Impacto no alvo, HP, dano e assentamento.
```

Início, duração e easing de cada fase estão somente em [motion-choreography.json](examples/motion-choreography.json).

O preset já inclui `ATTACK_FOCUS` e `DAMAGE_FEEDBACK`. Não somar essas durações novamente. Moedas, decisões, reações e Nocautes têm seus próprios grupos, na ordem real do domínio.

No modo Instantâneo, os números e o histórico continuam; não executar animações de ataque com tempo zero deixando objetos transparentes.

### 11.2. Cut-in

A carta permanece íntegra, com moldura e texto. Escala de destaque até aproximadamente 280×392 px em 1080p. Inclinação de tela 6–10°, rotação 3D limitada; nada fica de cabeça para baixo.

Faixa de ataque atravessa o terço inferior do destaque, com nome em branco sobre o tom escurecido do tipo (`attackStripColors`, seção 3.3): branco sobre a cor de apoio do tipo dá só 1,65–3,42:1, enquanto o tom da faixa garante pelo menos 4,5:1. O texto usa a fonte da face das cartas. Texto auxiliar com nome da criatura é menor. A faixa não é botão nem componente permanente do HUD.

Véu de atenuação de 20–30% só durante o destaque. Não converter o turno inteiro em paleta preta. O campo deve retornar à luminosidade base.

### 11.3. Efeitos por tipo

Fogo: arco/rajada laranja e partículas pequenas. Água: splash azul limpo. Planta: folhas/traços verdes. Elétrico: segmentos amarelos e cintilação curta, sem strobe de tela inteira. Psíquico: anéis lilás. Lutador: marca de impacto e poeira gráfica leve. Noturno: arco azul profundo localizado. Metálico: linhas prateadas. Dragão: fluxo claro dourado/azulado. Incolor: velocidade e impacto branco.

O catálogo pode ter variações de assinatura, porém sem mudar dano, adicionar um monstro 3D completo ou criar vários segundos extras por raridade.

### 11.4. Energia

Ficha circular, atual maior e próxima menor. Nos oito tipos que a Zona gera (Planta, Fogo, Água, Elétrico, Psíquico, Lutador, Noturno e Metal), a ficha é a bola de Energia recortada do atlas `.inspo/scene/battle/energys.png` (`npm run inspo:energy`, decisão do autor de 16/10/2026) — nas Energias ligadas, no orbe e na próxima Energia da Zona (esmaecida, com aro branco) e no voo da ligação; Incolor e Dragão mantêm o símbolo do tipo, e os custos de ataque continuam com os ícones. Ao ligar, arco curto até a base da carta, pulso e incorporação no contador. A animação não consome automaticamente outra Energia. Na mesa de batalha, a Zona é o prato de [gameplay-pocket §6.1](gameplay-pocket.md#pocket-6); a Energia gerada no início do turno aparece depois da compra, com flash no prato e o rótulo “Próxima Energia gerada”.

A ficha usa cor do tipo, não a cor do playmat. Energia descartada/movida tem origem e destino diferentes. Não chamar toda animação de ligação quando foi movimentação entre Pokémon.

### 11.5. Moeda

Fundo/foco azul limpo; moeda gira até a face já resolvida. Primeira moeda 1100 ms; seguintes 350 ms no agrupamento definido. Rotação termina exatamente na face correta; pular não produz novo resultado.

Modelos de moedas customizadas podem mudar arte e material, não o número de faces lógicas nem o RNG.

### 11.6. Dano e condições

Número junto ao alvo, leve reação da carta, HP atualizado uma vez. Prevenção total mostra escudo/texto e zero quando pertinente; não simular impacto destrutivo de dano que não ocorreu.

Cura tem sinal positivo e cor própria, com HP coerente. Veneno, Queimadura, Sono, Paralisia e Confusão possuem ícones estáveis e acento curto na aplicação/remoção. Não preencher o playmat de fumaça venenosa permanente.

### 11.7. Nocaute, pontos e resultado

Nocaute: atenuação/pulso da carta → recolhimento da pilha e anexos para seus destinos → pontos confirmados. O efeito não quebra a carta em cacos sugerindo destruição do inventário.

Pontuação em três discos amarelos, faixa azul/ciano quando houver ganho relevante. Aplicar todo grupo de Nocautes antes de anunciar vitória. Ganhar dois pontos não significa duas vitórias.

Resultado: transição clara, avatar, título, objetivos e prêmios em cards brancos. Sem sala escura, fogos permanentes ou medalhão de metal ocupando toda a tela.

<a id="visual-12"></a>
## 🎁 12. Pacotes e revelações de coleção

### 12.1. Palco

Fundo branco-azulado com gradiente, embalagem em pé, frente ilustrada colorida, costura superior e sombra suave. Pode haver várias capas de pacote em carrossel, sem simular que escolher um pacote “amassado” modifica a sorte.

Quando o pacote tem a frente oficial do booster empacotada (decisão do autor, 16/10/2026; [interface §8.5](interface-16x9.md#interface-08)), ela **é** a frente da embalagem, na proporção da imagem, e a tira que se rasga leva a faixa do logotipo; não desenhar moldura, nome ou gradiente gerado por cima. Os mesmos arquivos aparecem nas telas de pacotes, no Empório e no Início. Pacote tutorial e promocionais, sem arte oficial, mantêm a embalagem gerada no gradiente do tipo da carta de capa.

### 12.2. Corte

Linha luminosa percorre a costura; tira superior separa e sai num arco curto; claridade suave sai da abertura. Pedaços e raios usam formas simples/limpas. Não exigir física de tecido.

Gesto de arrasto, botão e teclado são equivalentes. A operação econômica é confirmada antes de revelar as cartas. Um gesto cancelado antes do commit não consome recurso; após commit, sair preserva o recibo.

### 12.3. Pilha e revelação

As cartas emergem e formam uma pilha de coleção. **Padrão: deslizar a carta da frente para revelar a próxima**, com um único giro de apresentação inicial quando necessário. Não exigir um flip dramático de 180° em cada avanço.

Pilha estável, frente bem legível, borda e foil respondem ao ângulo. Uma carta normal tem revelação simples; especial pode ter feixe iridescente e partículas adicionais curtas, sem enegrecer a tela.

“Próxima”, “Revelar todas” e gesto horizontal são alternativas. A preferência de velocidade não elimina tempo livre para ler. O nome e “Nova” surgem só depois da frente autorizada.

### 12.4. Imersiva e resumo

“Ver animação imersiva” é ação própria quando o asset existe. Não simular um vídeo não instalado. Ao sair, retornar à mesma carta.

Resumo claro com todas as cartas recebidas, quantidade e atalhos. Repetida continua sendo uma aquisição, não uma falha visual em vermelho. Falha de contexto vai ao resumo e preserva os mesmos resultados.

<a id="visual-13"></a>
## 🖥️ 13. Menus, campanha, decks e Estúdio

### 13.1. Shell

Barra superior clara, ícones simples, rótulos curtos. **Decisão do autor (16/10/2026):** a navegação segue os menus da EA/Madden — faixa de abas no topo e sub-abas, sem rail lateral; é adaptação desktop, não alegação de layout oficial do Pocket. A paleta continua a Pocket Light:

- **Faixa de abas:** banda em gradiente azul profundo (`primaryInk` → `primaryStrong`) sob o cabeçalho branco; abas em caixa alta e peso 900, em branco translúcido; a ativa é uma **pílula branca** com texto `primaryInk` e um sublinhado `cyan` curto. Selos de contagem em `cyan` e de pendência em `pointGold`. As teclas Q/E aparecem como pequenas teclas translúcidas nas pontas.
- **Sub-abas:** faixa `surface` com divisor `line`, texto `textSecondary` e a seção atual em `primaryInk` com sublinhado grosso `primaryStrong`.
- A ordem e as rotas seguem a [navegação por abas](interface-16x9.md#interface-navrail): Início, Jogar, Coleção, Loja e Criar; Saves, Ajuda e Ajustes como ícones do cabeçalho; Perfil e Aparência no menu do perfil. Não encher a faixa com todos os submenus ao mesmo tempo: eles ficam nas sub-abas da seção.

**Caixas de menu ([interface §5.6](interface-16x9.md#interface-05)):** os hubs são mosaicos de caixas arredondadas (raio ~22 px) com gradiente diagonal do tom, listras finas e um véu escuro embaixo para o texto branco ter contraste; título em caixa alta e peso 900, chamada de ação em pílula branca. Os tons vêm dos tokens: azul, azul profundo, ciano, coral, ouro, lavanda e as cores de tipo (§3.3); cada capítulo usa a cor do tipo do seu Ginásio (Prólogo ciano, Viridian azul profundo, final ouro). Hover e foco: aro branco de 4 px com brilho azul e leve subida; com movimento reduzido, só o aro. Caixa bloqueada: arte dessaturada e cadeado, sem esconder o motivo. Retratos seguem a §6.5 (inteiros, sem contorno); a arte de rival combina a carta-chave do deck dele com o retrato por cima.

### 13.2. Início

Mosaico de caixas sobre fundo abstrato azul-branco, não quarto de mago: a caixa grande CONTINUAR, com a arte do próximo rival, é a ação principal; pacotes, deck atual (deckbox), coleção e os modos de jogo são caixas menores. Troféus pequenos e opcionais não formam cenário pesado.

### 13.3. Campanha

Dioramas coloridos e simplificados sobre bases claras; personagens em ilustração de TCG; caminhos limpos. Manter 45 nós e os nomes reais das specs. Não usar capítulos inventados nas imagens rejeitadas.

Acima do mapa, os oito capítulos ficam numa faixa de caixas de mesma largura, cada uma na cor do seu Ginásio e com o retrato do anfitrião; o capítulo atual ganha aro ciano ([interface §20.1](interface-16x9.md#interface-20)).

Chefe se distingue por medalha, ícone e retrato, não por alterar a interface para inferno vermelho. Durante a batalha, ambiente 3D de capítulo fica reduzido à identidade do playmat e a motivos periféricos não obstrutivos.

### 13.4. Coleção e decks

Grade limpa, cartas inteiras, quantidades agrupadas, filtros em chips. Deckbox clara com cor de tipo e impressão de capa; sem couro ou runas.

No editor, coleção + lista + inspector. Painéis brancos/azul pálido, controles `+`/`−` grandes, status 20/20 derivado da lista real. Cópias máximas por nome respeitadas; não copiar tabelas conceituais que somam mais de 20.

### 13.5. Estúdio

Formulários claros e sem sobreposição à carta. Separar abas **Regras**, **Arte**, **Acabamento**, **Testes** e **Publicação**. Preview com mesma moldura e shader da batalha.

Toggle ex e seletor de acabamento permanecem independentes. Não incluir campo de Resistência ou botão “Gerar IA” remoto como nas imagens anteriores. Biblioteca/importação de arte é local.

Publicar não possui neon laranja. Validação/erros usam semântica padrão. Prévia de máscara pode ser em escala de cinza, mas o shell continua claro.

### 13.6. Oficina e saves

Oficina apresenta a mesa clara real com as mesmas oito posições. Configuração não exige mudar de tela a cada cor. Save/backup são painéis claros de dados locais, sem simular conta sincronizada.

<a id="visual-14"></a>
## 🧊 14. Tradução técnica para Three.js

### 14.1. Objetos e luz

`BoardRoot`: `LightBackdrop` claro, `TableBody` branco fosco, superfície (entorno da arena), arena (`ArenaOpponentHalf`/`ArenaPlayerHalf`, `ArenaStroke`, `ArenaRim`, `ArenaCenterBand`), `PlaymatSurface` com o decalque do tapete, disco e linha central, `FunctionalZoneGuides`, cartas (`CardVisual`) e fichas. `PlayerBand`/`OpponentBand` ficam ocultas: o turno acende a metade da arena. Ordem de desenho em [runtime §14.6](runtime-offline-threejs.md#runtime-playmats). Elementos decorativos não entram no raycast.

Nomes de objetos 3D seguem o glossário único da [interface §5.4](interface-16x9.md#interface-05): `CardVisual`, `BoardRoot`, `PackVisual`, `DeckBoxVisual`, `CoinVisual`, `CampaignNodeVisual` e `CardTransitScene`; cenas pelos IDs do catálogo do runtime (`battle`, `pack-opening`, `card-inspector`…).

Luz ambiente uniforme e key ampla. Sombras pequenas, azul-acinzentadas, sem preto profundo. A impressão usa caminho de cor estável, preferencialmente material não iluminado; espessura e efeitos usam materiais separados. Não recolorir a arte por uma luz laranja dominante.

### 14.2. Gestão de cor

Configurar texturas de cor como sRGB, máscaras e mapas de roughness/normal como dados; usar saída sRGB e conversão única. A referência técnica RT01 explica os espaços. Arte lavada ou escurecida deve ser corrigida na pipeline, não compensada por aumento arbitrário de luz.

Base recomendada para o perfil: `NoToneMapping`, `outputColorSpace = SRGBColorSpace`, arte com `toneMapped = false`. Se um compositor HDR for acrescentado, homologar sua saída sem mudar o aspecto dos tokens. Não aplicar LUT “cinematic”, gradação teal-and-orange ou vinheta preta.

### 14.3. Composição

Um renderer: mesa, mão ortográfica, carta em destaque/inspector e transição entre viewports (`CardTransitScene`). Limpar depth e scissor no lugar correto. HUD e texto em HTML acima do canvas, sem bloom ou distorção.

HP, seleção e decisões não podem ficar atrás do playmat. Não criar contexto WebGL por miniatura; compartilhar geometrias, materiais compatíveis e texturas.

### 14.4. Limites gráficos

Baixo mantém cartas 3D, o mesmo tom de azul e slots. Remove reflexo caro, bloom cosmético e partículas. Não usar cor preta como fallback de ambiente faltante. Falta de arte substitui por template claro e nome legível.

Nenhuma simulação de física é necessária para cartas sobre o campo. Keyframes e interpolação bastam; o motor de regras permanece independente.

<a id="visual-15"></a>
## 🗄️ 15. Dados visuais, versões e migração

Perfil global de apresentação: `pocket-light-v1`. Ele é configuração de aplicação/renderer, não carta funcional. `rulesetId = local-campaign-v2`, schema SQLite 1 e formato funcional de carta 2 permanecem.

Preferências guardam velocidade, conforto, layout e perfil visual. Novos presets/publicações referenciam explicitamente a versão visual. Partidas/replays existentes mantêm seus snapshots e assets imutáveis; não atualizar um `card_printings` publicado com um `UPDATE`.

A revisão de um playmat já publicado gera `definitionVersion` nova e assets com IDs/hash próprios. Os exemplos usam chaves lógicas `<playmatId>:v<definitionVersion>:<papel>` (por exemplo `mat-c02-harbor:v2:albedo` e `mat-c02-harbor:v2:thumb`), que o manifesto de conteúdo resolve para sha256; a chave não é hash nem caminho. IDs de entitlement e aquisição permanecem estáveis; não cobrar o mesmo cosmético novamente. Um deck com versão explícita antiga mantém essa referência até seleção confirmada de nova revisão.

Imagens importadas continuam intactas. O sistema não pode “clarear tudo no banco” e destruir a arte original. Novas artes e templates são novas impressões/versionamentos. Rascunhos podem migrar defaults mediante confirmação.

Fixtures técnicas antigas de SQL/1 pixel não são exemplos de aparência aprovada. Os testes de banco podem permanecer byte a byte, pois o tema não altera o modelo de transação.

<a id="visual-16"></a>
## 🎬 16. Briefings para produção de arte

Esta seção e [examples/art-briefs.json](examples/art-briefs.json) listam **os mesmos sete briefs**, na mesma ordem e com os mesmos IDs. São instruções de produção, não imagens já geradas. Alterar um brief exige atualizar os dois.

| # | ID | Tipo |
|---|---|---|
| 16.1 | `card-braseiro-classic` | `CARD_ART` |
| 16.2 | `card-harbor-illustration` | `CARD_ART` |
| 16.3 | `npc-portrait` | `NPC_PORTRAIT` |
| 16.4 | `harbor-chapter` | `CAMPAIGN_DIORAMA` |
| 16.5 | `playmat-harbor-v2` | `PLAYMAT_ART` |
| 16.6 | `battle-screen` | `SCREEN_MOCKUP` |
| 16.7 | `card-studio-screen` | `SCREEN_MOCKUP` |

### 16.1. Arte de carta — Braseiro ex (`card-braseiro-classic`)

Criatura elemental autoral de Fogo, silhueta amigável e poderosa, volumes estilizados, expressão clara e pose dinâmica. Ambiente de pedra clara com vegetação ou céu, fogo limpo em formas gráficas. Paleta quente no sujeito, contraste fresco no entorno. Nada de monstro de horror, lava fotográfica cobrindo a cena ou fundo preto.

Os valores de demonstração funcional são os do JSON: Estágio 1, 140 HP, `ruleBox` `EX`, Fraqueza Água +20, dois ataques definidos. Não desenhar “180”, Resistência ou mana de invocação porque apareceram numa imagem conceitual antiga.

### 16.2. Arte de carta — criatura de Água (`card-harbor-illustration`)

Criatura aquática expressiva em doca ou onda turquesa, cenário narrativo legível e luz suave. Paleta turquesa, azul-céu, creme e pequenos acentos coral. Nada de porto gótico noturno, astrolábio em primeiro plano ou gradação teal-orange de cinema.

### 16.3. Retrato de NPC (`npc-portrait`)

Curadores da campanha em busto ou meio corpo, expressão clara e gesto simples, adequados a recorte circular ou painel branco. Personagens de aventura contemporânea estilizados, saturação moderada e cores do capítulo nos detalhes. Nada de operador militar, couro negro com armas, realismo sombrio ou texto dentro da arte.

### 16.4. Diorama — Porto das Marés (`harbor-chapter`)

Diorama de porto claro e colorido, miniaturas de barcos e docas, água turquesa, ilustração japonesa estilizada. Seis nós corretamente rotulados C02-E01 a C02-E06, com áreas livres para rótulos. Chefes e rotas conforme campanha, não cópia dos nomes gerados anteriormente. O mapa não é fundo da batalha.

### 16.5. Playmat — Porto das Marés (`playmat-harbor-v2`)

Arte de `mat-c02-harbor` na `definitionVersion` 2: imagem contínua 4:3, ondas e símbolos periféricos, centro calmo sob Ativos e Banco, baixo contraste nos slots. Master de produção 4096×3072 px; alvo de runtime 2048×1536 px. Sem moldura dourada, couro escuro, divisão em dois tapetes ou texto de regra pintado.

### 16.6. Tela de batalha e ataque (`battle-screen`)

Captura 16:9: campo claro arredondado com a arena (metade do adversário coral, a do jogador azul-clara, faixa central e disco; §5.1), aro branco, a metade do dono do turno acesa, dois Ativos, três Bancos por lado, mão de cinco, pilhas na diagonal e três marcadores de pontos. UI clara, fonte simples, carta selecionada com contorno `cyan`. Sem cenário fotorrealista atrás.

Segundo quadro, mesma batalha no instante do cut-in: Braseiro ampliado/inclinado, faixa “Golpe de Brasa” no tom `attackStripColors.FIRE`, leve escurecimento temporário, linhas de velocidade claras. Não substituir a carta por criatura modelada. Terminado o golpe, voltar à mesa clara.

### 16.7. Estúdio (`card-studio-screen`)

Tela branca/azul pálido em três áreas. Formulário de ataque, toggle ex separado do seletor Normal/Foil, preview da carta clássico com o mesmo `CardVisual` da batalha e ações Validar/Testar/Publicar. Não mostrar recursos inexistentes como geração remota, login ou sincronização.

<a id="visual-17"></a>
## ✅ 17. Critérios de aceite visual

As verificações são requisitos de produto, ainda dependentes de implementação. Testar 1080p/720p, mouse/toque, DPR 1/2, qualidade baixa/padrão e movimento normal/reduzido.

| ID | Critério |
|---|---|
| VS-001 | Boot abre shell claro sem cenário escuro ou gradiente preto. |
| VS-002 | Tokens JSON e CSS correspondem em todos os valores de cor. |
| VS-003 | Texto principal e secundário passam os pares de contraste fixos definidos. |
| VS-004 | Botão azul claro usa texto escuro legível. |
| VS-005 | UI não usa laranja como cor global de ação. |
| VS-006 | Campo padrão é a arena da §5.1 — metade distante coral, próxima azul-clara, entorno claro em cima e azul embaixo — com aro claro. |
| VS-007 | Metades da arena (coral distante, azul-clara próxima) não mudam por cor de Energia; só o turno as acende. |
| VS-008 | Campo exibe exatamente um Ativo e três posições de Banco por lado. |
| VS-009 | Pontos exibem exatamente três posições, independentemente de HP. |
| VS-010 | Pilhas e contadores do fixture são compatíveis com baralho de 20. |
| VS-011 | Turno NPC não habilita ataque humano. |
| VS-012 | Câmera quase superior mantém frente legível e sem rotação de turno. |
| VS-013 | Oito posições cabem nos dois viewports homologados. |
| VS-014 | Inspector recolhido é o padrão de batalha. |
| VS-015 | Abrir inspector não encobre uma decisão obrigatória. |
| VS-016 | Campo não tem DOF ou desfoque sobre mão e slots. |
| VS-017 | Borda/cartas têm espessura discreta, não placas maciças. |
| VS-018 | Imagens não sofrem corte fora da composição cadastrada. |
| VS-019 | Template não possui custo universal de mana. |
| VS-020 | Template não exibe Resistência não suportada. |
| VS-021 | Ex, foil e raridade são exibidos como eixos distintos. |
| VS-022 | Arte-base utiliza ilustração estilizada clara, não estética dark fantasy. |
| VS-023 | Personagem/NPC segue o mesmo catálogo de direção artística. |
| VS-024 | Arte completa preserva contraste dos ataques. |
| VS-025 | Foil não apaga texto no ângulo frontal. |
| VS-026 | Desligar brilho não altera identidade ou regras da impressão. |
| VS-027 | Carta oculta não revela raridade por material, som ou trajetória. |
| VS-028 | Compra humana vai do deck à mão sem cut-in de ataque. |
| VS-029 | Compra NPC permanece verso do começo ao fim. |
| VS-030 | Compra em lote mantém contagem e não repete flair por carta oculta. |
| VS-031 | Drag inválido volta à posição sem consumir ação. |
| VS-032 | Entrada básica assenta no slot, sem invocar criatura independente. |
| VS-033 | Evolução preserva dano e anexos visuais. |
| VS-034 | Cut-in possui carta, nome do ataque, faixa e retorno ao campo. |
| VS-035 | Escurecimento do ataque é temporário, com luminosidade restaurada. |
| VS-036 | Ataque composto não duplica tempos de foco/impacto. |
| VS-037 | Fogo e outros tipos são localizados; não mudam o tema de menus. |
| VS-038 | Moeda termina na face já confirmada em todas as velocidades. |
| VS-039 | Dano/cura/condição atualizam HUD uma única vez. |
| VS-040 | Nocaute não sugere destruição permanente da carta possuída. |
| VS-041 | Grupo simultâneo termina antes da faixa de vitória. |
| VS-042 | Faixa de pontos usa azul/ciano e discos amarelos legíveis. |
| VS-043 | Playmat cobre a superfície inteira sem alterar hitboxes. |
| VS-044 | Troca de playmat não move cartas ou câmera. |
| VS-045 | Arte customizada não recolore marcadores funcionais. |
| VS-046 | Os nove temas seguem os IDs e desbloqueios existentes. |
| VS-047 | Pacote abre por costura/tira, com fundo claro e raios suaves. |
| VS-048 | Revelação usa deslizamento de pilha, sem flip compulsório por carta. |
| VS-049 | “Revelar todas” mostra o mesmo recibo e todas as cartas. |
| VS-050 | Imersiva é opcional e retorna à posição correta. |
| VS-051 | Mapa permanece estilizado; combate não herda uma sala cinematográfica. |
| VS-052 | Editor de decks deriva 20/20 da soma real e respeita cópias. |
| VS-053 | Estúdio usa o mesmo CardVisual, template e acabamento da batalha. |
| VS-054 | Controles ex e Normal/Foil funcionam independentemente. |
| VS-055 | Não há botão de geração remota de arte no fluxo offline. |
| VS-056 | Novas versões visuais não alteram impressões imutáveis nem RNG. |
| VS-057 | Preferência de conforto não muda snapshot funcional. |
| VS-058 | Qualidade baixa preserva paleta, cartas 3D e informação. |
| VS-059 | Retomada/perda de contexto restaura cena clara sem repetir ganhos. |
| VS-060 | Capturas de homologação registram build, viewport, DPR e estado. |

<a id="visual-18"></a>
## 🚧 18. Gates de implementação

**Gate visual 1:** campo neutro com oito slots, fichas e mão; uma captura em cada resolução. Sem arte final necessária, mas sem substituir Three.js por uma imagem única.

**Gate visual 2:** compra, entrada, evolução, ataque padrão e Nocaute nas três velocidades. Validar causalidade e sigilo antes de inserir partículas especiais.

**Gate visual 3:** pacote, folha de cards, inspector, deck e Estúdio usando o mesmo template. Uma carta normal e uma foil devem manter regras idênticas.

**Gate visual 4:** nove temas, campanha, backup/reabertura e versões cosméticas. Confirmar que assets antigos continuam referenciáveis.

**Gate de conclusão:** executar a matriz visual e os testes funcionais/SQL. Uma imagem conceitual aprovada não substitui nenhum desses gates.

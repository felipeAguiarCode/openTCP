# 🖥️ Interface 16:9 — campanha offline em Three.js

> **Versão:** 3.2.0 · **Revisão:** 14 de outubro de 2026  
> **Destino:** navegador local, horizontal, mouse/teclado/toque, campanha single-player.  
> **Substitui:** revisão 2.1 para os pontos alterados; mantém gameplay e apresentação existentes.
> **Complementos:** [gameplay.md](gameplay.md) · [campanha.md](campanha.md) · [runtime-offline-threejs.md](runtime-offline-threejs.md) · [efeitos-dsl.md](efeitos-dsl.md)  
> **Renderização principal:** Three.js com controles HTML/CSS; não é um 3D opcional.
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — campo claro, paleta e animações na linguagem do TCG Pocket; os conceitos escuros anteriores não são referência.

> **Revisão 3.0:** SQLite substitui a persistência anterior. Autoria de cartas usa o Estúdio local, com regras e impressões versionadas. Detalhes normativos em [persistencia-sqlite.md](persistencia-sqlite.md) e [editor-de-cartas.md](editor-de-cartas.md). O escopo offline, a campanha e as animações/playmats da revisão 2.1 permanecem.

> **Revisão 3.2:** segunda aba sem conexão ao banco, NavRail canônica com **Criar**, rotas S48–S50, S40 fora do build de produção, geometria completa da batalha em [battle-layout.json](examples/battle-layout.json), mapa evento → preset e easings, presets de interface, âncoras `HUMAN_*`/`NPC_*`, glossário 3D único e fonte OFL local na face das cartas.

> **Revisão 3.3 (conteúdo 3.0.0, 16/10/2026):** com ~2.000 impressões de todos os sets do Pocket, as listas grandes passam a ser desenhadas em blocos com “Mostrar mais (N)” (coleção, editor de deck, Empório) e ganham filtro de Expansão; S04 agrupa os pacotes por expansão e mostra o tamanho de cada um; S05 mostra as taxas oficiais por símbolo × posição com três casas decimais, pacote raro e 6ª carta; S06 marca “Pacote raro!” e “6ª carta”; “Como obter” traz a chance por pacote; a criação de perfil oferece os oito decks iniciais; na batalha, escolha de modo com rótulos e ataques de evoluções anteriores na ficha. Critérios UI-155…UI-166 (§40).

> **Revisão 3.3 (conteúdo 3.1.0, 16/10/2026):** avatar por retrato — o jogador escolhe no S02 e no S34 o retrato (emote) de um treinador da franquia, cada rival tem o seu, e o retrato é desenhado inteiro, sem contorno, nas placas e na tela “+1 ponto!”, na abertura VS, no cabeçalho, no briefing S16, no caderno S29/S30 e na Arena (§5.5); abertura **VS** no início de cada tentativa nova, antes da preparação (§22.1, `DUEL_INTRO`); bolas de Energia do atlas nas Energias ligadas e na Zona, em 3D e em 2D (§23.10). Critérios UI-167…UI-169 (§40).

> **Revisão 3.3 (menus em caixas, 16/10/2026):** o rail lateral sai; o shell passa a ter cabeçalho, **faixa de abas no topo** (Início · Jogar · Coleção · Loja · Criar, com Q/E como bumpers) e sub-abas da seção, no estilo dos menus da EA (§2.2, [navegação por abas](#interface-navrail)); Entrada, Início, Jogar, capítulos da Campanha, Desafios, Arena e Adversários viram mosaicos de caixas `MenuTile` (§5.6, §6.2, §7, §16, §17.1, §20, §30); a promoção depois do nocaute deixa o painel de decisão e passa a ser arrasto (ou clique) do Banco ao Ativo (§26.1, [gameplay-pocket §6.2](gameplay-pocket.md#pocket-6)); S04, S05, S33, Início e a frente do pacote 3D do S06 usam a arte oficial do booster quando empacotada (§8.5, §9.7). Critérios UI-170…UI-173 (§40).

> **Revisão 3.3 (mesa em arena, 16/10/2026):** a mesa de batalha ganha a arena do Pocket, igual em 3D e em 2D — círculo grande no centro de espelho que envolve os dois Bancos, metade do adversário coral e a do jogador azul-clara, aro branco com filete lilás, faixa clara no centro e disco menor atrás dos Ativos (1,0 × largura do Ativo); fora dela, claro em cima e azul embaixo. As faixas finas coral/ciano das bordas saem: o dono do turno acende a sua metade da arena. Tapetes cosméticos só tingem o entorno (§1.2, §23.2, §23.5, §23.8, §23.11, §23.16–§23.18; [gameplay-pocket §2](gameplay-pocket.md#pocket-2)). Critério UI-174 (§40).

---

## 🧭 Sumário

**Leitura visual obrigatória:** [direção Pocket](direcao-visual-pocket.md) · [referências identificadas](referencias-visuais.md).


- [📖 0. Experiência horizontal, local e tridimensional](#interface-00)
- [🎨 1. Direção visual obrigatória — Pocket Light](#interface-01)
- [📐 2. Grade, dimensões e comportamento responsivo](#interface-02)
- [🧭 3. Menus e rotas locais](#interface-03)
- [🧷 4. Navegação, pausa e preservação de contexto](#interface-04)
- [🧩 5. Componentes compartilhados](#interface-05)
- [🚪 6. Inicialização e perfis locais — S00 a S02](#interface-06)
- [🏠 7. Início — caixas e Continuar — S03](#interface-07)
- [📦 8. Pacotes locais e catálogo — S04 e S05](#interface-08)
- [✨ 9. Abertura e revelação — S06](#interface-09)
  - [9.9. Coreografia da abertura](#interface-revelacao-pacotes)
- [🗂️ 10. Coleção — S07](#interface-10)
- [🔎 11. Detalhe da carta — S08](#interface-11)
- [📚 12. Fichários e galeria pessoal — S09, S10 e S32](#interface-12)
- [🗃️ 13. Biblioteca de decks — S11](#interface-13)
- [🛠️ 14. Editor de decks — S12](#interface-14)
  - [14.21. Estúdio de Cartas — S43 a S47](#interface-card-studio)
- [🧪 15. Treino e teste de deck — S13 e S17](#interface-15)
- [⚔️ 16. Hub de batalhas solo — S14](#interface-16)
- [🎯 17. Briefing, desafios e objetivos — S15 e S16](#interface-17)
- [🏅 18. Objetivos, diário e conquistas — S25 a S27](#interface-18)
- [🌟 19. Descoberta: escolher uma carta — S28](#interface-19)
- [🗺️ 20. Mapa 3D, capítulos e Arena — S18 a S20](#interface-20)
- [📂 21. Preparação local de recursos — S21](#interface-21)
- [🎲 22. Preparação da partida — S22](#interface-22)
- [🃏 23. Campo de batalha 16:9 — S23](#interface-23)
  - [23.16. Playmats — comportamento padrão e seleção por turno](#interface-playmats)
  - [23.21. Oficina de aparência — S41 e S42](#interface-personalizacao)
- [🖐️ 24. Mão, seleção e manipulação de cartas](#interface-24)
  - [24.11. Vocabulário e estados da carta](#interface-animacoes-cartas)
- [⚡ 25. Ações de turno, Energia, ataque e Recuo](#interface-25)
  - [25.12. Gramática visual das lutas](#interface-animacoes-combate)
- [🧪 26. Efeitos, condições e escolhas especiais](#interface-26)
- [⏸️ 27. Pausa, suspensão e recuperação](#interface-27)
- [🏁 28. Resultado, objetivos e recompensas — S24](#interface-28)
- [📜 29. Histórico e replay — S38 e S39](#interface-29)
- [📔 30. Caderno de adversários — S29 e S30](#interface-30)
- [💾 31. Saves, backup e importação — S31](#interface-31)
- [🏪 32. Empório offline — S33](#interface-32)
- [👤 33. Perfil e registros locais — S34 e S35](#interface-33)
- [⚙️ 34. Configurações e ajuda local — S36 e S37](#interface-34)
- [⌨️ 35. Mouse, teclado, toque e acessibilidade](#interface-35)
- [🎞️ 36. Three.js, motion, áudio e desempenho](#interface-36)
  - [36.2. Catálogo canônico de durações](#interface-motion-timing)
  - [36.2.1. Mapa evento → preset](#interface-event-preset-map)
- [🏗️ 37. Estado de tela e apresentação local](#interface-37)
- [🚶 38. Jornadas completas offline](#interface-38)
- [🚨 39. Estados vazios, bloqueios e falhas locais](#interface-39)
- [✅ 40. Testes de interface e aceitação](#interface-40)
- [🧱 41. Entregas e gates de interface](#interface-41)
- [📚 42. Referências visuais e limites de fidelidade](#interface-42)
- [🧭 43. Diretriz final de apresentação](#interface-43)

---

<a id="interface-00"></a>

## 📖 0. Experiência horizontal, local e tridimensional

Esta versão substitui a interface v1 por um produto **single-player local**, centrado em uma campanha permanente. Não é uma tela de serviço online com botões desativados.

**Three.js é a tecnologia principal de apresentação espacial**, não uma melhoria opcional para depois. A experiência deve ter cartas com espessura, mesa tridimensional, pacotes com volume, mapa de campanha em diorama e prévias reais de materiais.

Textos, campos, menus, filtros, HUD, botões e acessibilidade continuam em HTML/CSS. “Usar 3D” não significa transformar toda a interface em texto rasterizado dentro de um canvas.

### 0.1. Fontes de verdade

| Documento | Autoridade |
|---|---|
| [gameplay.md](gameplay.md) | Regras do duelo. |
| [campanha.md](campanha.md) | Conteúdo, encontros e progressão. |
| [persistencia-sqlite.md](persistencia-sqlite.md) | Gravação, saves e backup. |
| [runtime-offline-threejs.md](runtime-offline-threejs.md) | Execução e renderização. |
| [editor-de-cartas.md](editor-de-cartas.md) | Autoria de cartas. |
| [direcao-visual-pocket.md](direcao-visual-pocket.md) | Aparência. |
| [efeitos-dsl.md](efeitos-dsl.md) | Linguagem de efeitos das cartas. |
| Este arquivo | Telas, navegação e interação. |

Em conflito, vale o documento dono do assunto; a divergência é corrigida nos dois lados, nunca resolvida silenciosamente na implementação.

Todos os layouts são propostas autorais para 16:9; não são a afirmação de que o aplicativo original possui esses menus ou essa campanha.

### 0.2. Ambientes

| Ambiente | Apresentação | Função |
|---|---|---|
| Mesa pessoal | Diorama leve com deck, fichário e troféus. | Coleção e preparação; o Início é um mosaico de caixas (§7). |
| Mapa da campanha | Regiões em miniatura, caminhos e nós. | Progressão e escolha de encontro. |
| Palco de cartas | Fundo controlado, iluminação e carta ampliada. | Inspeção e acabamento. |
| Palco de pacote | Pacote volumétrico e revelação. | Descoberta de coleção. |
| Mesa de batalha | Campo legível com perspectiva leve. | Duelo contra IA. |
| Menus utilitários | Painéis HTML sobre fundo discreto. | Saves, opções, ajuda e diagnóstico. |

### 0.3. Proibições

Sem login, presença online, sala, busca de oponente humano, classificação global, pagamento, banner de conexão ou contagem regressiva de pacote. Não manter “Online em breve”.

Não usar imagens externas, fontes remotas ou vídeo incorporado que exija internet. Um arquivo local ausente gera diagnóstico de instalação, não spinner de “conectando ao servidor”.

### 0.4. Continuidade

O botão mais importante da entrada é **Continuar**. Se existe duelo suspenso, retoma o duelo. Caso contrário, abre o nó recomendado da campanha.

A ausência de internet não produz aviso de erro: é uma situação normal. Os indicadores úteis são “Salvo neste dispositivo”, “Gravando” e “Falha ao salvar”.

---

<a id="interface-01"></a>

## 🎨 1. Direção visual obrigatória — Pocket Light

### 1.1. Alvo visual

Adotar [direcao-visual-pocket.md](direcao-visual-pocket.md) integralmente. Campo claro em arena — metade do adversário coral, a do jogador azul-clara, entorno claro e azul (§23.2) —, aro branco, seleção ciano, fichas de Energia, cards ilustrados e UI em superfícies brancas/azul muito pálido. A referência são as capturas oficiais RP01–RP09 em [referencias-visuais.md](referencias-visuais.md), não as imagens escuras produzidas anteriormente.

Não manter uma UI de fantasia medieval/cyberpunk e trocar apenas a cor dos botões. Remover madeira escura, metal envelhecido, molduras ornamentadas, salas noturnas, névoa, brasas permanentes, fontes épicas e botões laranja globais.

### 1.2. Paleta e aplicação

| Uso | Cor-base |
|---|---|
| Fundo | `#F4F8FC` |
| Painel | `#FFFFFF` |
| Superfície secundária | `#EAF4FA` |
| Texto | `#263A50` |
| Texto secundário | `#526780` |
| Ação principal | `#75C7FA`, texto `#153F65` |
| Foco | `#357DE4` |
| Seleção e foco da carta (`cyan`) | `#2DECE5` |
| Tapete próximo / distante (`boardNear` / `boardFar`: paleta padrão do tingimento de tapete) | `#86BCE7` / `#D8D5F4` |
| Arena: metade do adversário / do jogador (§23.2) | `#EE9095` → `#F2ABAC` / `#D3E0F8` → `#C3D8F6` |
| Entorno da arena: em cima / embaixo | `#E8F2FB` → `#DCE3F5` / `#CBDBF6` → `#45A9F6` |
| Aro | `#F4F8FF` |
| Cor humana / NPC (`playerBand` / `opponentBand`; sem faixa desenhada nas bordas da mesa) | `#22DCEA` / `#F2857D` |
| Pontos | `#F6CE3D` |

Os valores são aproximações visuais para implementação; não são tokens oficiais extraídos. A lista completa e os tokens de tipos estão no documento visual e em [visual-tokens.json](examples/visual-tokens.json).

Nesta revisão, o shell é claro. Não oferecer um tema escuro de aparência equivalente aos conceitos rejeitados como alternativa padrão. O modo de conforto reduz brilho/efeitos sem alterar a direção.

### 1.3. Forma, fonte e ícones

Botões em cápsula, 44–52 px de altura; painéis com raio 16–24 px, divisores leves e sombras azul-acinzentadas de baixa opacidade. Fonte sem serifa legível, corpo 16–18 px e metadados 14–16 px em 1080p. Reduzir espaçamento antes da fonte no compacto.

O shell HTML pode usar a pilha de fontes do sistema. A **face das cartas** usa uma fonte OFL empacotada como arquivo local do build (Nunito via `@fontsource`, token `typography.cardFace`), para que a textura gerada seja idêntica em qualquer sistema operacional. Nenhuma fonte é carregada da rede.

Ícones simples, avatar redondo (retrato de treinador desenhado inteiro, §5.5), três discos de pontos. Não criar mana universal, “resistência −30” ou tipos não previstos pelo gameplay porque apareceram nas imagens conceituais.

### 1.4. Cartas e arte

Cartas verticais 5:7, moldura clara/prateada, fundo de tipo, ilustração japonesa estilizada e variedade artística controlada. Cores vivas e silhueta clara; não bestiário dark fantasy. Ex é regra, foil é impressão, raridade é aquisição.

A arte completa pode ser expressiva, mas ataques e HP permanecem legíveis. O inspector mostra os dados em HTML. Não usar cabeçalho de carta como painel de metal espesso.

### 1.5. Materialidade

Cartas, pilhas, fichas, pacote e mesa são geometrias Three.js reais, com espessura discreta. Profundidade resulta de elevação, sombra e ângulo leve; não de um cenário fotorealista atrás.

Fundo de fallback também é claro. Asset ausente mostra template e nome, sem travar capítulo. Fontes, arte, materiais e sons usados no jogo são locais.

### 1.6. Alcance da revisão

Esta direção vale para Início, mapa, desafios, coleção, decks, oficina, batalha, resultado, saves e Estúdio de Cartas. Nenhuma tela funcional pode continuar com um segundo design system escuro.

---

<a id="interface-02"></a>

## 📐 2. Grade, dimensões e comportamento responsivo

### 2.1. Resoluções de referência

| Perfil | Viewport de teste | Tratamento |
|---|---|---|
| Principal | 1920 × 1080 | Layout amplo, três painéis quando útil. |
| Compacto HD | 1280 × 720 | Duas colunas e detalhes recolhíveis. |
| Laptop | 1366 × 768 | Mesmo comportamento compacto, com mais folga. |
| Intermediário | 1600 × 900 | Transição para três painéis conforme mínimos. |
| Alta densidade | 2560 × 1440 | Mais espaço, sem esticar fontes indiscriminadamente. |
| Ultrawide | 3440 × 1440 | Conteúdo principal limitado e margens funcionais. |
| Vertical | 1080 × 1920 | Menus responsivos; batalha em alternativa compacta ou aviso de orientação. |

16:9 é o alvo principal, não uma desculpa para deixar uma janela redimensionada inutilizável.

### 2.2. Shell normal em 1920 × 1080

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ MARCA  Créditos · Pacotes   ✓ Salvo  [Saves][Ajuda][Ajustes][Sino]  Perfil ▾ │ 64
├──────────────────────────────────────────────────────────────────────────────┤
│ Q  ( INÍCIO )   JOGAR   COLEÇÃO   LOJA   CRIAR                            E  │ 56
├──────────────────────────────────────────────────────────────────────────────┤
│ Visão geral   Campanha   Desafios   Arena   Treino   Histórico   Adversários │ 46
├──────────────────────────────────────────────────────────────────────────────┤
│ Título / ações locais                                                        │
│ ┌────────────────────────┬───────────┬───────────┐                           │
│ │                        │           │           │                           │
│ │   CAIXA GRANDE (hero)  ├───────────┼───────────┤   CONTEÚDO PRINCIPAL      │
│ │                        │           │           │   na largura toda:        │
│ ├────────────┬───────────┴───────────┼───────────┤   mosaico de caixas,      │
│ │            │       CAIXA LARGA     │           │   grade ou lista+detalhe  │
│ └────────────┴───────────────────────┴───────────┘                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Coordenadas de referência:

| Região | X | Y | Largura | Altura |
|---|---:|---:|---:|---:|
| Barra superior (cabeçalho) | 0 | 0 | 1920 | 64 |
| Faixa de abas | 0 | 64 | 1920 | 56 |
| Faixa de sub-abas | 0 | 120 | 1920 | 46 |
| Área principal | 24 | 190 | 1872 | 866 |

O Início e os utilitários não têm sub-abas: a área principal sobe 46 px. Não há rodapé técnico; nada pode empurrar conteúdo para fora da tela.

As abas e sub-abas seguem a [navegação por abas](#interface-navrail). Saves, Ajuda e Ajustes são ícones do cabeçalho, ao lado do sino de recibos e do menu do perfil.

**Responsivo:** até 1280 px de largura, o texto do status de gravação some (o ícone fica); até 1100 px, somem os rótulos dos recursos e as teclas Q/E da faixa; até 760 px (retrato), as abas principais viram uma barra fixa embaixo e as sub-abas rolam na horizontal. As telas de batalha (S21–S24, S39), a abertura de pacote (S06) e as de entrada (S00–S02, S48–S50) não têm shell.

### 2.3. Escala

Usar layout por áreas, mínimos e máximos, não um único `transform: scale()` em toda a aplicação.

Espaçamentos-base: 4, 8, 12, 16, 24, 32 e 48 px.

Em telas compactas, reduzir espaços antes de reduzir texto. Rótulos essenciais não devem cair abaixo de 14 px.

### 2.4. Rolagem

Menus, coleção e listas podem rolar. A barra superior e a ação primária local permanecem acessíveis.

A mesa de batalha não deve depender de rolagem vertical da página. Painéis de histórico e detalhes possuem rolagem interna.

Evitar duas barras de rolagem concorrentes para a mesma região. A rolagem da grade não deve mover a lista de deck fora de alcance.

### 2.5. Três painéis

Ativar quando a soma de larguras mínimas cabe de verdade. Abaixo de aproximadamente 1600 px de largura, recolher o detalhe para um painel sobreposto ou aba.

Não insistir em três colunas esmagadas que tornam nomes ilegíveis.

### 2.6. Área segura e navegador

Calcular com o viewport disponível, incluindo mudança de barras do navegador. Respeitar áreas seguras em dispositivos com recortes.

O botão “Tela cheia” pede permissão pelo gesto do usuário e mantém alternativa quando o navegador não permitir.

### 2.7. Canvas e áreas úteis

Usar um renderer compartilhado e viewports definidos pelos retângulos reais de layout. Ao recolher um painel, recalcular câmera, viewport, HUD projetado e área de raycast juntos.

Não esticar uma captura 3D de 1920 × 1080 para todos os tamanhos. O canvas acompanha o tamanho CSS; sua resolução interna usa o limite de pixel ratio do perfil de qualidade.

Em retrato estreito, manter opções, save e lista de campanha acessíveis; a batalha oferece modo 2D compacto de recuperação ou orientação horizontal. Isso não reduz o alvo principal de validação, que continua 16:9.


---

<a id="interface-03"></a>

## 🧭 3. Menus e rotas locais

### 3.1. Árvore de informação

```text
INÍCIO (mosaico de caixas, sem sub-abas)
├── Continuar campanha / retomar duelo / escolher prêmio
├── Próximo encontro e objetivos
├── Deck atual (testar, trocar)
├── Pacotes possuídos
├── Desafios, Arena, Coleção e Empório
└── Jogar

JOGAR
├── Visão geral — hub de caixas (S14)
├── Campanha — mapa 3D, capítulos, briefing, Descobertas, objetivos e diário
├── Desafios — puzzles, elites, domínio e tutorial
├── Arena — revanche de adversários vencidos
├── Treino — duelo livre, sem recompensa
├── Histórico — partidas encerradas e replays
└── Adversários — caderno e perfis dos rivais

COLEÇÃO
├── Cartas — variantes, como obter, favoritas e lista de desejos
├── Decks — meus decks, iniciais e de apoio, editor, auto-build,
│           importar/exportar lista, testar e aparência do deck
├── Fichários
└── Galeria pessoal

LOJA
├── Pacotes — possuídos, catálogo por expansão, probabilidades e abrir
├── Empório — pacotes, cartas dirigidas e cosméticos
└── Recibos

CRIAR
├── Estúdio — rascunhos, publicações, variantes e laboratório de carta
└── Importar pacote autoral

UTILITÁRIOS DO CABEÇALHO (ícones)
├── Saves e backups
├── Ajuda local
├── Ajustes (configurações)
└── Sino — recibos e notificações

MENU DO PERFIL
├── Perfil local
├── Aparência padrão
├── Recibos e notificações
├── Caderno de adversários
└── Trocar perfil
```

Mapa, lista de desafios e caderno de adversários apontam para a **mesma definição de nó**, evitando versões divergentes de um confronto.

<a id="interface-navrail"></a>

**Navegação por abas (estilo dos menus da EA)** — decisão do autor (16/10/2026), substitui a NavRail lateral. Lista única usada no wireframe da §2.2, nesta árvore e na [direção visual §13.1](direcao-visual-pocket.md#visual-13). Fonte no código: `NAV_GROUPS` e `NAV_UTILITIES` em `src/presentation/ui/components/shell.tsx`.

| Aba | Abre | Sub-aba → rotas que a ativam |
|---|---|---|
| INÍCIO | S03 `#/home` | — (sem sub-abas): S03 |
| JOGAR | S14 `#/battle` | Visão geral: S14 · Campanha: S19, S20, S16, S25, S26, S27, S28 · Desafios: S15 · Arena: S18 · Treino: S17 · Histórico: S38 · Adversários: S29, S30 |
| COLEÇÃO | S07 `#/collection` | Cartas: S07, S08 · Decks: S11, S12, S13, S42 · Receitas: S51, S52 · Fichários: S09, S10 · Galeria: S32 |
| LOJA | S04 `#/packs` | Pacotes: S04, S05 · Empório: S33 · Recibos: S35 |
| CRIAR | S43 `#/card-studio` | Estúdio: S43, S44, S45, S47 · Importar: S46 |
| Cabeçalho (ícones) | — | Saves S31 · Ajuda S37 · Ajustes S36 · sino → S35 |
| Menu do perfil | — | Perfil S34 · Aparência padrão S41 · Recibos S35 · Caderno de adversários S29 · Trocar perfil S01 |

- **Faixa de abas:** banda de gradiente azul profundo, abas em caixa alta e peso 900; a aba ativa é uma pílula branca com sublinhado ciano curto e `aria-current="page"`. Cada aba abre a primeira sub-aba do grupo. `data-testid`: `nav-home`, `nav-play`, `nav-collection`, `nav-shop`, `nav-create`.
- **Bumpers Q/E:** como LB/RB, Q vai à aba anterior e E à próxima, em ciclo. Ignorados com Ctrl/Alt/Meta, repetição de tecla, foco num campo de texto (§35.2, UI-059) ou modal aberto. As teclas “Q” e “E” aparecem nas pontas da faixa, só como dica (`aria-hidden`).
- **Sub-abas:** faixa clara com sublinhado grosso na seção atual (`data-testid="subnav-<rota>"`); some no Início e nos utilitários. Uma rota pertence a uma só sub-aba; nenhuma sub-aba aponta para rota inexistente.
- **Indicadores (§5.2):** LOJA e a sub-aba Pacotes mostram a contagem de pacotes possuídos; JOGAR mostra “!” com prêmio pendente ou “•” com duelo suspenso. Cada indicador tem rótulo acessível (“3 pacotes”, “pendência”, “duelo suspenso”).
- **Utilitários:** Saves, Ajuda e Ajustes ficam como ícones do cabeçalho (`data-testid="util-<rota>"`), sem aba ativa; Perfil e Aparência padrão vêm do menu do perfil. S40, que só existe no build de desenvolvimento, abre com o shell e sem aba ativa; nenhuma aba ou menu leva a ela.

O duelo (S23) e as demais telas de batalha não têm shell: o campo ocupa a largura útil e a saída passa pelo menu de pausa.

### 3.2. Rotas

Adotar roteamento por hash para o build servido localmente. Os exemplos não são rotas de API. A origem fixa de execução está no runtime.

| ID | Rota | Tela |
|---|---|---|
| S00 | `#/boot` | Verificação de pacote, dados e retomada. |
| S01 | `#/profiles` | Perfis locais e novo jogo. |
| S02 | `#/onboarding` | Nome, acessibilidade e deck de destaque. |
| S03 | `#/home` | Início em caixas e Continuar. |
| S04 | `#/packs` | Pacotes possuídos. |
| S05 | `#/packs/:packId` | Conteúdo e probabilidades. |
| S06 | `#/openings/:openingId` | Revelação de recibo existente. |
| S07 | `#/collection` | Coleção. |
| S08 | `#/cards/:printingId` | Inspector 3D e regras. |
| S09 | `#/collection/binders` | Fichários. |
| S10 | `#/collection/binders/:binderId/edit` | Editor de páginas. |
| S11 | `#/decks` | Biblioteca. |
| S12 | `#/decks/:deckId/edit` | Editor. |
| S13 | `#/decks/:deckId/test` | Preparar teste. |
| S14 | `#/battle` | Hub solo. |
| S15 | `#/challenges` | Lista de puzzles, elites e tutorial. |
| S16 | `#/campaign/nodes/:nodeId` | Briefing canônico do encontro. |
| S17 | `#/battle/training` | Treino. |
| S18 | `#/arena` | Revanche. |
| S19 | `#/campaign` | Mapa geral 3D. |
| S20 | `#/campaign/chapters/:chapterId` | Diorama de capítulo. |
| S21 | `#/loading/:attemptId` | Carregamento local da tentativa. |
| S22 | `#/matches/:matchId/setup` | Preparação. |
| S23 | `#/matches/:matchId` | Duelo. |
| S24 | `#/matches/:matchId/result` | Resultado persistido. |
| S25 | `#/objectives` | Objetivos e conquistas permanentes. |
| S26 | `#/journal` | Diário. |
| S27 | `#/journal/chapters/:chapterId` | Resumo de capítulo. |
| S28 | `#/discoveries/:nodeId` | Escolha de recompensa. |
| S29 | `#/opponents` | Caderno de adversários. |
| S30 | `#/opponents/:npcId` | Perfil do personagem de IA. |
| S31 | `#/saves` | Saves, exportação e importação. |
| S32 | `#/gallery` | Galeria local. |
| S33 | `#/emporium` | Loja com Créditos. |
| S34 | `#/profile` | Perfil do save atual. |
| S35 | `#/receipts` | Recibos e notificações locais. |
| S36 | `#/settings` | Configurações. |
| S37 | `#/help` | Ajuda incluída no pacote. |
| S38 | `#/battle/history` | Histórico local. |
| S39 | `#/replays/:replayId` | Reprodução. |
| S40 | `#/lab` | Laboratório sem recompensas; excluído do build de produção, só existe em build de desenvolvimento. |
| S41 | `#/appearance` | Biblioteca de acessórios e aparência padrão do perfil. |
| S42 | `#/decks/:deckId/appearance` | Oficina de playmat e loadout visual do deck. |
| S43 | `#/card-studio` | Biblioteca do Estúdio. |
| S44 | `#/card-studio/projects/:projectId` | Editor funcional e visual de cartas. |
| S45 | `#/card-studio/projects/:projectId/tests` | Laboratório da carta. |
| S46 | `#/card-studio/import` | Importação e diff de pacote. |
| S47 | `#/card-studio/releases/:definitionId/:version` | Versão publicada e impressões. |
| S48 | `#/start` | Tela de entrada: Continuar, Novo jogo, Perfis e saves, Configurações e Créditos do projeto. |
| S49 | `#/credits` | Créditos do projeto, licenças e origem dos assets locais. |
| S50 | `#/diagnostics` | Diagnóstico e recuperação, acessível sem carregar a arena nem a cena de batalha. |
| S51 | `#/decks/recipes` | Receitas de deck: listas prontas do meta, por tipo e da comunidade (§13.8). |
| S52 | `#/decks/recipes/:recipeId` | Receita aberta: lista, estratégia, cartas que faltam e Montar deck (§13.8). |

São 53 rotas (S00–S52). S48–S52 foram acrescentadas sem renumerar as anteriores. S40 é removida do build de produção por flag de build: a rota não é registrada, o menu não a mostra e um link direto cai em S03 com aviso; ela só existe no build de desenvolvimento.

### 3.3. Estado de navegação

Filtros, aba, nó selecionado, posição de rolagem e `returnContext` podem ser restaurados. Mãos ocultas, RNG e save completo não vão para a URL.

No mapa, a câmera é preferência visual, não progresso. Apagar sua posição não pode relocar o jogador para outro capítulo desbloqueado.

### 3.4. Portas de entrada

“Desafios” abre uma lista prática. “Campanha” abre o mapa. “Continuar” escolhe o último nó principal elegível ou o duelo suspenso. Nenhum deles cria automaticamente uma nova tentativa sem confirmação.

---

<a id="interface-04"></a>

## 🧷 4. Navegação, pausa e preservação de contexto

### 4.1. Voltar

Voltar retorna à origem real, com seleção, filtro e rolagem preservados.

```text
Mapa C02 → encontro C02-E06 → escolher deck → editar
→ salvar e voltar → briefing C02-E06
```

### 4.2. Escape

Fecha primeiro a camada reversível superior. Durante o duelo, abre o menu de pausa. Se houver decisão obrigatória, o menu pode abrir sem cancelar a decisão.

Em nenhum contexto Escape descarta cartas, gasta créditos ou desiste silenciosamente.

### 4.3. Rascunhos

Rascunho automático de deck e versão confirmada são diferentes. Sair com alterações oferece salvar, manter rascunho para depois ou descartar apenas alterações do editor.

Desfazer é permitido no editor. Depois de uma ação de combate comprometida e informação revelada, não existe desfazer normal.

### 4.4. Trocar perfil

Pausar e salvar a tentativa antes de trocar. Se a escrita falhar, explicar que a mudança não está segura. Não apagar a coleção do perfil anterior.

### 4.5. Uma tentativa ativa

Enquanto um duelo está suspenso, oferecer retomar ou abandonar antes de criar outro. Visitar o Empório ou editar outro deck é permitido, mas não altera o snapshot do duelo suspenso.

### 4.6. Modais e prioridade de entrada

Um modal principal por vez. Bloquear raycast da cena por trás de modais e formulários. O foco retorna ao controle de origem ao fechar.

Confirmar explicitamente exclusão de perfil, substituição de save, abandono, compra e escolha irreversível de Descoberta.

---

<a id="interface-05"></a>

## 🧩 5. Componentes compartilhados

| Componente | Conteúdo e comportamento |
|---|---|
| `AppHeader` | Marca, recursos (Créditos, Pacotes), status de gravação, ícones Saves/Ajuda/Ajustes, sino de recibos e menu do perfil. |
| `TopTabs` | Faixa das cinco abas (Início, Jogar, Coleção, Loja, Criar): aba ativa em pílula branca, indicadores discretos e bumpers Q/E ([navegação por abas](#interface-navrail)). |
| `SubTabs` | Sub-abas do grupo da rota atual, com sublinhado grosso na seção atual; ausente no Início e nos utilitários. |
| `MenuTile` | Caixa de menu no estilo da EA: tom, arte, título, subtítulo, dados, chamada de ação e selo; a caixa inteira é um botão (§5.6). |
| `PackArt` | Frente oficial do booster quando empacotada; sem ela, o pacote gerado no gradiente do tipo da carta de capa (§8.5). |
| `Breadcrumb` | Caminho curto e retorno. |
| `PageHeader` | Título, descrição curta, ação principal e secundárias. |
| `CardTile` | Miniatura, nome, quantidade, raridade e estados. |
| `CardInspector` | Carta ampliada e informações estruturadas. |
| `DeckTile` | Capa, nome, tipos, quantidade e validade. |
| `ResourceChip` | Ícone, saldo e explicação da unidade. |
| `MissionRow` | Objetivo, progresso, prêmio e resgate. |
| `ChallengeTile` | Oponente, dificuldade, objetivos e conclusão. |
| `RewardChip` | Recurso/carta, quantidade e origem. |
| `FilterBar` | Busca, filtros aplicados e limpeza. |
| `Tabs` | Navegação local, sem ações destrutivas. |
| `Drawer` | Detalhe contextual sem trocar toda a rota. |
| `ConfirmDialog` | Consequência, custo, confirmação e cancelamento. |
| `Toast` | Feedback não bloqueante, sem informação crítica exclusiva. |
| `EmptyState` | Explica ausência de conteúdo e oferece ação útil. |
| `SaveStatus` | Gravando, salvo neste dispositivo ou falha de escrita. |
| `CampaignNode` | Nó visual e botão semântico correspondente. |
| `SceneViewport` | Área de uma cena no renderer compartilhado. |
| `LocalAssetStatus` | Integridade do pacote e qualidade/fallback visual. |
| `PortraitImage` | Retrato do jogador ou do rival pela chave `portrait:<arquivo>`, inteiro e sem contorno (§5.5); silhueta para rival ainda não encontrado. |
| `PortraitPicker` | Seletor de avatar do S02 e do S34: retratos agrupados por treinador (§5.5). |

### 5.1. Estados de um controle

Todo controle deve possuir normal, hover, foco, pressionado, desabilitado e carregando quando aplicável.

Desabilitado deve informar a razão por texto acessível. Não depender de tooltip impossível de abrir em um botão realmente removido do foco.

### 5.2. Indicadores

“Novo” significa conteúdo ainda não visto; “Resgatar” significa recompensa disponível; ponto de exclamação significa pendência. Não usar o mesmo ponto vermelho para todas essas situações.

### 5.3. Skeleton e vazio

Skeleton mantém o espaço do conteúdo enquanto carrega. Estado vazio aparece somente depois de uma resposta válida sem itens.

Erro de leitura do save não pode ser apresentado como “Você não tem cartas”.

### 5.4. Contrapartes tridimensionais

Glossário único dos objetos de apresentação 3D, usado também pelo [runtime](runtime-offline-threejs.md#runtime-12) e pela [direção visual](direcao-visual-pocket.md#visual-14):

| Nome canônico | Papel |
|---|---|
| `CardVisual` | Carta com corpo, frente, verso, acabamento e marcador de seleção. |
| `BoardRoot` | Raiz da mesa de batalha: fundo, corpo, faixas, playmat, guias, cartas, fichas e registro de âncoras. |
| `PackVisual` | Pacote volumétrico da abertura e da vitrine. |
| `DeckBoxVisual` | Deckbox de biblioteca, prévia e Início. |
| `CoinVisual` | Moeda de resolução e de prévia cosmética. |
| `CampaignNodeVisual` | Pedestal/nó do mapa e do capítulo. |
| `CardTransitScene` | Cena ortográfica de trânsito entre mão, mesa e destaque. |

Nenhum outro nome designa esses objetos; não criar sinônimos por documento. Cenas são identificadas pelos IDs do catálogo do runtime §12.4 (`home`, `campaign-map`, `campaign-chapter`, `battle`, `hand`, `card-inspector`, `pack-opening`, `card-editor`, `deck-preview`, `discovery`, `gallery`, `emporium-preview` e os acrescentados lá), não por nomes de classe.

Esses objetos são componentes de apresentação, não stores de inventário.

Não criar um renderer por componente. A listagem de coleção usa miniaturas HTML; seleção e prévias usam o renderer compartilhado. Interação por teclado chega aos mesmos IDs dos objetos 3D.

### 5.5. Retratos (avatares)

**Decisão do autor (16/10/2026, conteúdo 3.1.0):** o avatar do jogador e o de cada rival é o retrato (emote) de um treinador da franquia — 204 PNGs de 128×128 de 55 treinadores em `src/presentation/assets/portraits/`, a própria origem, sem importador (nome normalizado: minúsculo, sem `_Masters`, `_`/`.`/espaço viram `-`; `Lt._Surge_Emote_1_Masters.png` → `lt-surge-emote-1.png`). A chave é `portrait:<arquivo>`; o resolvedor `src/presentation/assets/portraits.ts` agrupa os retratos por treinador, com o nome em PT-BR (`lt-surge` → “Tenente Surge”) e a variante de roupa.

- **Desenho:** cada PNG já é um emblema redondo, com aro próprio e a marca do emote. A interface desenha a imagem inteira (`<img>`, `object-fit: contain`) e **não acrescenta** contorno, outline, sombra, raio, recorte nem fundo — sem contorno, só o emote. Cabelo e acessórios podem sair do disco.
- **Jogador:** a escolha fica na configuração `avatar` como `portrait:<arquivo>`. Perfil novo começa em `portrait:marnie-academy-emote-1` (`DEFAULT_PLAYER_PORTRAIT`); valor antigo (os avatares por tipo, como `WATER`), ausente ou chave sem arquivo no pacote resolvem para o mesmo padrão (`playerPortraitKey`), sem gravar migração.
- **Rivais:** `Npc.portraitAssetKey`, obrigatório no conteúdo ([campanha §1.4](campanha.md#campanha-01)). Sem encontro — no Treino e no duelo autoral —, o adversário é Cheren, professor da Escola de Treinadores (NPC `lia`), com o deck e a IA escolhidos: só o nome e o retrato vêm dele. Só um NPC sem arquivo de retrato cairia na inicial do nome.
- **Onde aparece:** placas da mesa dos dois lados e tela “+1 ponto!” ([gameplay-pocket §10.5](gameplay-pocket.md#pocket-10)), abertura VS (§22.1), menu de perfil do cabeçalho, briefing S16 (§17.2), caderno S29 — rival ainda não encontrado como silhueta — e página S30 (§30), cartões da Arena (§20.7).
- **Seletor** (`PortraitPicker`, S02 e S34): todos os retratos agrupados por treinador num `radiogroup`; o escolhido aparece maior e os demais com opacidade reduzida; seleção e foco ganham só um traço curto sob o retrato, nunca contorno nele; cada opção tem rótulo acessível com treinador, roupa e expressão.

### 5.6. Caixas de menu (`MenuTile`)

**Decisão do autor (16/10/2026):** os hubs são mosaicos de caixas, como os menus da EA/Madden. Componente `MenuTile` (`src/presentation/ui/components/menu-tile.tsx`, estilos em `styles/menus.css`, só tokens Pocket Light).

- **Grade (`TileGrid`):** 4 colunas, preenchimento denso e linhas que dividem a altura disponível, com mínimo legível. Tamanhos: `hero` (2×2), `wide` (2×1), `tall` (1×2) e `sq` (1×1). Até 1000 px de largura, 2 colunas; até 600 px, 1 coluna.
- **Conteúdo:** fundo em gradiente do tom; arte à direita (retrato, carta, deckbox 3D, leque de cartas, pacotes ou ícone grande); embaixo, à esquerda, kicker opcional, **título em caixa alta e peso 900**, subtítulo, dados (barra de progresso, objetivos) e a chamada de ação numa pílula branca (“Começar o prólogo ›”). Selo opcional no canto (contagem, “NOVO”).
- **Tons:** `blue`, `ink` (azul profundo), `cyan`, `coral`, `gold`, `lavender` e os dez tipos, todos derivados dos tokens Pocket. Capítulos usam `CHAPTER_TONE`: P00 ciano, C01 Planta, C02 Água, C03 Elétrico, C04 Psíquico, C05 Lutador, C06 azul profundo e F00 ouro.
- **Um só botão:** um botão invisível cobre a caixa inteira; o nome acessível junta kicker, título, subtítulo e chamada de ação. Ações secundárias (ex.: Testar/Trocar no deck atual) ficam por cima dele, como botões próprios.
- **Hover e foco:** aro branco de 4 px com brilho azul, leve subida (`translateY(-4px) scale(1.015)`) e a arte cresce um pouco. Com movimento reduzido, só o aro.
- **Bloqueada:** arte dessaturada e cadeado; continua focável, anuncia “Indisponível: <motivo>” e não navega (§5.1).
- **Arte de rival (`RivalArt`):** nas caixas grandes, a carta-chave do rival — capa do deck do encontro mais adiantado dele, perfil Padrão — nítida e levemente girada, com o retrato (emote, §5.5) por cima, à esquerda. Sem carta, só o retrato, maior.
- **Altura curta:** em telas com até 820 px de altura, a caixa grande enxuga espaços e esconde a lista de objetivos para não cortar o topo. Nenhum hub tem rolagem horizontal em 1920 × 1080 nem em 1280 × 720 (UI-171).


---

<a id="interface-06"></a>

## 🚪 6. Inicialização e perfis locais — S00 a S02

### 6.1. Boot

Mostrar marca local, status de etapa e ações de recuperação. Etapas reais: ler manifesto, abrir armazenamento, verificar compatibilidade, recuperar perfil e montar cena inicial.

Não usar tempo artificial de login. Se um modelo decorativo demorar, apresentar o menu sem ele. Se faltar catálogo obrigatório, bloquear começo de tentativa com diagnóstico de pacote.

Concluído o boot, S00 abre a tela de entrada S48. Capacidade obrigatória ausente (Worker, WASM, OPFS, Web Locks ou isolamento exigido pelo VFS) abre S50 e bloqueia a execução persistente, sem fallback. Se o banco já está aberto em outra aba, S00 mostra a tela de [segunda aba](#interface-second-tab) sem abrir conexão.

### 6.2. Tela de entrada — S48

```text
┌──────────────────────────┬───────────────────────────────┬───────────────┐
│                          │ CONTINUAR                     │ NOVO JOGO     │
│   CARD CAMPAIGN          │ retrato do jogador            ├───────────────┤
│   Save: Perfil 1 · C02   │ Perfil · Capítulo             │ PERFIS E      │
│                          │ [ JOGAR › ]                   │ SAVES         │
│   Diagnóstico            ├───────────────┬───────────────┼───────────────┘
│                          │ CONFIGURAÇÕES │ CRÉDITOS      │
└──────────────────────────┴───────────────┴───────────────┘
```

Sem provedor de autenticação. Nome de perfil é local e não precisa ser único na internet. Propor três perfis na interface inicial, com limite configurável; coleção não é compartilhada entre eles.

S48 (`#/start`) não tem shell nem carrega a arena: à esquerda, o título grande “CARD CAMPAIGN”, a linha de save (“Save: Perfil 1 · Capítulo 2 · salvo neste dispositivo”) e um link discreto “Diagnóstico”, que abre S50; à direita, um mosaico de caixas `MenuTile` (§5.6) em 3 colunas. Caixas e destinos:

- **CONTINUAR** (hero, `start-continue`, foco inicial): retrato do jogador, nome do perfil e capítulo atual; vira **Retomar duelo** com duelo suspenso. Leva ao duelo suspenso ou ao Início (S03), onde Continuar aponta o nó recomendado (§0.4); com perfis mas nenhum aberto, a S01. Sem nenhum perfil no dispositivo, fica bloqueada e anuncia “Nenhum perfil ainda — comece um novo jogo.”.
- **NOVO JOGO** (`start-new`) → S02; **PERFIS E SAVES** → S01 (de lá, S31); **CONFIGURAÇÕES** → S36; **CRÉDITOS** → S49.

### 6.3. Novo jogo

Escolher nome de exibição, avatar, tamanho de texto e preferência de movimento. O avatar é escolhido no seletor de retratos (§5.5), já com o padrão marcado, e a legenda diz “Um treinador da franquia; dá para trocar depois no Perfil.” Selecionar um dos oito decks iniciais como destaque; todos os oito ficam disponíveis, sem punição pela escolha inicial. Há um deck por tipo de Energia gerável, na ordem `onboarding.starterDeckIds`: Chama Constante, Maré Serena, Jardim Vivo, Faísca Veloz, Eco Psíquico, Punho Firme, Sombra Astuta e Aço Paciente ([campanha §3](campanha.md#campanha-03)). A legenda diz “Todos os decks iniciais ficam disponíveis; a escolha só define o favorito.”

Mostrar “Seus dados ficam neste navegador. Faça uma cópia em Saves e backups”. Não prometer recuperação remota.

### 6.4. Tutorial

Oferecer iniciar prólogo ou ler regras antes. Os tutoriais são encontros identificados, com estados preparados quando necessário. “Pular explicação” fecha dicas; não falsifica vitórias nem concede novamente recompensas.

### 6.5. Retomada

Prioridade: tentativa suspensa → recompensa/abertura já confirmada não vista → próximo nó principal → rascunho do editor. Perguntar antes de abandonar qualquer tentativa.

### 6.6. Falhas

Sem WebGL2: oferecer apresentação 2D de recuperação. Save incompatível: exportar e selecionar outro perfil, sem reset automático. Dados indisponíveis: diagnóstico (S50), não “faça login”.

### 6.7. Créditos do projeto — S49

Página HTML local com autoria do projeto, aviso de obra autoral não oficial, licenças das bibliotecas e da fonte OFL empacotada (conteúdo de `LICENSES/`) e origem/licença dos assets registrados no manifesto de conteúdo. Abre a partir de S48 e da Ajuda (S37). Não depende de rede; endereços citados são texto, sem carregamento automático.

---

<a id="interface-07"></a>

## 🏠 7. Início — caixas e Continuar — S03

### 7.1. Visão 16:9

Fundo branco-azulado e um mosaico de caixas `MenuTile` (§5.6) na largura toda, 4 colunas × 3 linhas em 1920 × 1080, sem rolagem. O foco funcional é a caixa CONTINUAR. Não existe sala medieval, porto noturno ou mesa de madeira como fundo permanente.

```text
┌─────────────────────────────────────────┬────────────────────┬────────────────────┐
│ C02 — GINÁSIO DE SOOTOPOLIS (kicker)    │ JOGAR              │ PACOTES          2 │
│ NOME DO NÓ         [carta-chave]        │ Campanha, Desafios │ leque de boosters  │
│ Wallace · Líder    [+ retrato]          │ Arena e Treino     │ 2 para abrir       │
│ ★ objetivo 1  ★ objetivo 2              ├────────────────────┴────────────────────┤
│ ▓▓▓▓▓░░░░ 12 de 45 encontros            │ DECK ATUAL   [deckbox 3D]               │
│ [ CONTINUAR › ]                         │ Chama Constante · 20/20 [Testar][Trocar]│
├────────────────────┬────────────────────┼────────────────────┬────────────────────┤
│ DESAFIOS           │ ARENA              │ COLEÇÃO       NOVO │ EMPÓRIO            │
│ 3 disponíveis      │ 2 rivais           │ 180 de 1210 cartas │ 420 Créditos       │
└────────────────────┴────────────────────┴────────────────────┴────────────────────┘
```

Caixas (`data-testid` entre parênteses):

- **CONTINUAR** (hero, `home-continue`): tom do capítulo (`CHAPTER_TONE`), arte do rival do próximo nó (`RivalArt`), capítulo como kicker, título do nó, “<rival> · <título do rival>”, até dois objetivos do nó (somem em telas com até 820 px de altura), barra “N de 45 encontros” e a chamada de ação: **Começar o prólogo** (perfil novo), **Continuar**, **Retomar duelo** (duelo suspenso; título “Duelo suspenso”), **Escolher prêmio** (recompensa pendente) ou **Ir para a Arena** (campanha concluída). Recebe o foco ao entrar, sem rolar a página.
- **JOGAR** (`home-play`) → S14.
- **PACOTES** (`home-packs`) → S04: leque com até três frentes oficiais de booster (§8.5), dos possuídos quando houver; selo com a contagem.
- **DECK ATUAL** (wide, `home-deck`) → editor do deck: deckbox 3D, nome e “20/20 cartas · válido”; botões secundários **Testar** (S13) e **Trocar** (S11).
- **DESAFIOS** (`home-challenges`), **ARENA** (`home-arena`, retrato do último rival liberado), **COLEÇÃO** (`home-collection`: leque de três cartas possuídas, “N de 1210 cartas · N novas” e selo NOVO; com novas, abre a coleção no filtro de novas) e **EMPÓRIO** (`home-emporium`, Créditos disponíveis).

A vitrine 3D (`Showcase`), “Novas cartas” e “Saves” saíram do Início: Saves está no cabeçalho e as novidades, no selo da COLEÇÃO.

### 7.2. Hierarquia

Continuar é a caixa maior e a primeira no foco; pacote secundário. Em duelo suspenso, “Retomar duelo” substitui Continuar. Contagens são dados locais; não mostrar temporizador diário, amigos ou conexão.

### 7.3. Objetos e navegação

Cada caixa é um único botão HTML (§5.6); a deckbox 3D e as artes são decorativas (`aria-hidden`). A arte não pode encobrir o título nem a chamada de ação.

### 7.4. Estados

Perfil novo orienta o prólogo. Final concluído sugere Arena e domínio. Sem pacotes, mostrar caminhos permanentes de aquisição sem impedir jogar. Falha de SQLite não pode aparecer como coleção vazia ou “salvo”.

---

<a id="interface-08"></a>

## 📦 8. Pacotes locais e catálogo — S04 e S05

### 8.1. Organização

Expansões/capítulos à esquerda, pacote 3D no centro e informações à direita. Mostrar possuídos, cartas possíveis, probabilidades e acesso ao Empório.

```text
Capítulos / conjuntos | Palco de pacote 3D | Possui 3 pacotes
                                           5 cartas por abertura
                                           [Abrir 1]
                                           [Probabilidades]
                                           [Como obter]
```

**Conteúdo 3.0.0 (S04):** o painel “Possuídos” mostra cada pacote com saldo — arte, nome, tamanho, “Abrir 1” e “Probabilidades”. **Menus em caixas (16/10/2026):** possuídos e catálogo são caixas de largura igual (mínimo 200 px), com a arte do pacote (§8.5) no topo, o nome com altura mínima de duas linhas e as ações alinhadas embaixo, para que caixas vizinhas não fiquem tortas; hover e foco usam o aro branco das caixas de menu (§5.6). Empório e Recibos deixam de ser botões do cabeçalho de S04 e passam a ser as sub-abas da LOJA ([navegação por abas](#interface-navrail)). Abaixo, o catálogo de pacotes aleatórios agrupado por expansão, na ordem dos sets do conteúdo (o grupo é o set da carta de capa): o primeiro painel se chama “Catálogo de pacotes — Genetic Apex”, os seguintes levam só o nome do set (Mythical Island, Space-Time Smackdown…, Promo-A, Promo-B). Cada pacote do catálogo abre S05 e mostra “100 Créditos no Empório” ou o cadeado com “Após <nó>”.

O tamanho vem do produto: “5 cartas por abertura”, “4 cartas por abertura” (Deluxe Pack ex) ou “5 cartas por abertura (+1 em 8,330% dos pacotes)” (Wisdom of Sea and Sky e Secluded Springs, com 6ª carta); pacote fixo: “Conteúdo fixo · 5 cartas”. O subtítulo de S05 repete esse texto, seguido de “probabilidades próprias deste pacote”; o cabeçalho de S05 traz a arte do pacote (§8.5) antes do título.

### 8.2. Bloqueados

Pacote de capítulo futuro mostra condição de desbloqueio, não data de lançamento. A biblioteca de conteúdo já está instalada; a restrição é de progresso. No conteúdo 3.0.0 só os pacotes Charizard e Mewtwo do Genetic Apex têm trava; os 14 pacotes dos sets seguintes estão à venda desde o início ([campanha §16.1](campanha.md#campanha-16)).

### 8.3. Custo

Abrir consome pacote possuído. Comprar pacote é uma operação separada no Empório e consome Créditos. Não converter automaticamente moedas em pacote ao clicar “Abrir”.

### 8.4. Probabilidades

Painel HTML com pesos por slot, garantias próprias e elegibilidade. Identificar produto de tutorial com cartas fixas. As posições podem ter distribuições diferentes. S05 tem dois painéis: “Cartas possíveis” e “Probabilidades por posição”; o formato depende do modelo do pacote ([campanha §16.2](campanha.md#campanha-16)).

- **Pacote do Genetic Apex (modelo do projeto):** tabela posição × categoria (Comum, Incomum, Rara, Ultra) em percentual inteiro; cada carta possível traz as cópias esperadas por pacote com uma ou duas casas.
- **Pacote por símbolo (sets seguintes):** tabela símbolo × posições. Posições com a mesma tabela formam uma coluna — “1ª–3ª | 4ª | 5ª”; no Deluxe Pack ex, “1ª | 2ª | 3ª | 4ª”; nos promocionais, “1ª–5ª” — e a coluna “6ª” aparece quando há 6ª carta. Os valores têm **três casas decimais** no formato pt-BR (“2,572%”); “—” onde o símbolo não sai. Abaixo da tabela: “Pacote raro: 0,050% dos pacotes — todas as cartas ☆ ou superior, X% cada (N cartas).”, “6ª carta: 8,330% dos pacotes normais trazem uma carta a mais, só de Pokémon bebê (◊◊◊ 29,033% cada · ☆ 12,900% cada).” e a nota de que, dentro de cada raridade, a carta é sorteada com chance igual e o percentual de cada carta é a quantidade esperada por pacote.
- **Cartas possíveis** de um pacote por símbolo ficam agrupadas por símbolo, do mais raro ao mais comum, com o símbolo (rótulo acessível por extenso, como “1 estrela brilhante”) e a contagem do grupo; cada carta mostra a chance por pacote com três casas.

As taxas dos sets seguintes são as oficiais do Pokémon TCG Pocket e podem ser rotuladas assim; a dos pacotes Promo-A e Promo-B (uniforme) é do projeto e não deve ser apresentada como oficial.

### 8.5. Visual

Pacote com faces frente/verso/lateral, dobras simples e material com brilho leve. Rotação limitada, com botão “Frente”. Não exigir simulação física de rasgo.

**Arte oficial dos pacotes (decisão do autor, 16/10/2026):** a frente do pacote é a imagem oficial do booster quando ela está empacotada. Fontes: as frentes fornecidas pelo autor (origem em `src/presentation/assets/source/packs/`) e, para os três pacotes do Genetic Apex, as imagens da página do set no Serebii (`https://www.serebii.net/tcgpocket/geneticapex/<pikachu|charizard|mewtwo>.jpg`, baixadas uma vez para `source/packs/serebii/`); o Bulbagarden recusa acesso automatizado. `npm run assets:packs` (`tools/asset-import/pack-art.py`, com `--check`) recorta as margens transparentes — nos JPG, o fundo branco ligado às bordas vira transparente —, limita a 640 px de altura e grava WebP q88 com alfa em `src/presentation/assets/packs/<productId>.webp`.

- **Com arte (15 pacotes de expansão):** `pack-a1-pikachu`, `pack-a1-charizard`, `pack-a1-mewtwo`, `pack-a1a-mew`, `pack-a2-dialga`, `pack-a2-palkia`, `pack-a2a-arceus`, `pack-a3-solgaleo`, `pack-a3-lunala`, `pack-a3a`, `pack-a3b`, `pack-a4-lugia`, `pack-a4-ho-oh`, `pack-a4a` e `pack-a4b`.
- **Sem arte oficial:** o pacote tutorial e os promocionais Promo-A e Promo-B continuam com o pacote gerado (gradiente do tipo da carta de capa, costura e nome).
- **Resolvedor e componente:** `packArtUrl(productId)` em `src/presentation/assets/pack-art.ts` (null sem arte) e `PackArt` em `components/pack-art.tsx`, nos tamanhos `mini`, `sm`, `md` e `lg`, com o saldo “×N” quando possuído. A imagem é decorativa (`aria-hidden`); o nome do pacote continua em texto ao lado.
- **Onde aparece:** S04 (possuídos e catálogo), cabeçalho de S05, miniaturas e painel de detalhe do Empório S33 (§32.1), caixa PACOTES do Início (§7.1) e frente do pacote 3D da abertura S06 (§9.7).
- Origem e restrições de uso das imagens ficam no registro de assets do projeto; são material de terceiros para uso local, como as artes das cartas.

### 8.6. Estados

Possuído, sem saldo de pacote, bloqueado por capítulo, operação em andamento, recibo confirmado ou arquivo local ausente. “Servidor em manutenção” não existe neste produto.

---

<a id="interface-09"></a>

## ✨ 9. Abertura e revelação — S06

### 9.1. Palco

Sem shell (sem cabeçalho nem abas). Manter apenas retorno seguro, áudio, reduzir movimento e pular animação.

O pacote fica no centro. Fundo suave, sem texto importante atrás. O gesto de rasgar pode ser mouse, toque ou botão “Abrir”; não exigir precisão motora.

### 9.2. Sequência

```text
Resultado comprometido → rasgar → cartas em pilha
→ revelar individualmente → resumo horizontal
```

O domínio local já calculou e confirmou o resultado em SQLite antes de revelar qualquer carta.

### 9.3. Cartas

Na revelação, a carta atual ocupa aproximadamente 320 × 448 px em 1080p. Há espaço lateral para nome, categoria, “Nova na coleção” e indicador de quantidade.

Uma carta especial pode ganhar reflexo e som próprios, mas o usuário pode pular sem perder informação.

O lado da carta mostra “N de M”, nome, subtítulo e símbolo de raridade (✵/✵✵ inclusive). A 6ª carta é sempre a última do recibo e o contador ganha “· 6ª carta”. Num pacote raro, a barra superior mostra o selo **“Pacote raro!”** ao lado de “<pacote> · cartas adicionadas à coleção”. O número de cartas vem do recibo: quatro no Deluxe Pack ex, cinco no padrão, seis quando saiu a 6ª carta.

### 9.4. Controles

Próxima carta, revelar todas, repetir animação imersiva quando disponível e concluir. Usar setas/Enter apenas quando a ação estiver claramente em foco.

Não usar qualquer clique global para avançar se houver botões que o jogador pode estar tentando ler.

### 9.5. Resumo

Mostrar todas as cartas recebidas, quantidades, novidades e acesso a detalhes.

Ações: “Ver coleção”, “Abrir outro” quando disponível e “Concluir”. Nenhuma ação faz novo sorteio sem custo confirmado.

### 9.6. Recuperação

Atualizar a página abre o mesmo recibo. Falha de vídeo oferece a grade de resultados imediatamente.

A mensagem correta é “Suas cartas foram adicionadas; a animação não pôde ser exibida”, quando a transação já tiver sido confirmada.

### 9.7. Cena obrigatória

Usar a cena `pack-opening` em Three.js: `PackVisual` volumétrico, costura animada, pilha com as N cartas do recibo (cinco no pacote padrão, quatro no Deluxe Pack ex, seis com a 6ª carta) e iluminação de estúdio. A sequência termina no resultado persistido.

Com arte oficial (§8.5), a frente do `PackVisual` **é** a imagem do booster: o pacote toma a proporção da imagem (mesma largura do pacote gerado e mais alto; acima de 2,4 unidades de altura, estreita para caber); a tira superior que se rasga leva a faixa do logotipo (os 14,5% de cima da imagem) e o corpo, o resto, sem moldura gerada por cima. A imagem é carregada antes de montar o pacote; sem arte ou com falha ao carregar, o pacote gerado continua. Sem WebGL, o fallback HTML mostra a mesma imagem.

Cada pacote real abre no cenário do capítulo de mesma temática (`PACK_THEME`, `src/presentation/three/stages/themes.ts`): Pikachu e Promo-B na usina (C03); Charizard, Solgaleo e Ho-Oh na fundição (C05); Mewtwo, Mew e Lunala no observatório (C04); Palkia, Lugia e Secluded Springs no porto (C02); Dialga e Extradimensional Crisis no arquivo (C06); Arceus e Deluxe Pack ex na final (F00); Eevee Grove no bosque (C01); Promo-A na academia (P00). Produto sem tema próprio usa a academia. O tema é só cenário: não muda sorteio nem ordem das cartas.

O botão “Revelar todas” cancela tweens visuais e materializa todas as cartas corretas do recibo. Não cancela a transação, não executa os efeitos de crédito novamente e não exige receber um evento remoto.

### 9.8. Save

Exibir erro de escrita antes de revelar prêmios como adquiridos. Uma vez confirmado, a mensagem é “Cartas adicionadas à coleção”, mesmo que a apresentação precise cair para 2D.



<a id="interface-revelacao-pacotes"></a>

### 9.9. Coreografia da abertura

Usar fundo branco/azul suave, embalagem vertical ilustrada, costura e tira superior. A tira se separa com uma linha luminosa limpa e raios claros multicoloridos, conforme referência RP07. Não usar portal preto ou fumaça de fogo em todos os pacotes.

| Etapa | Apresentação | Conclusão |
|---|---|---|
| Exposição | Pacote volumétrico em fundo claro; rotação limitada. | Gesto ou botão. |
| Corte | Linha pela costura, tira superior em arco curto. | 700 ms ou Pular. |
| Extração | Pilha emerge e assume posição central; invólucro recolhe. | 520 ms. |
| Primeira carta | Orientação frontal estável; brilho controlado. | Leitura livre. |
| Próximas | Carta da frente desliza, expondo a seguinte. | Avançar/gesto. |
| Especial | Reflexo e partículas dependentes da impressão. | 850 ms de coreografia, sem espera forçada. |
| Resumo | Todas as cartas recebidas e suas quantidades. | Ação do jogador. |

O domínio já salvou o resultado. Rasgar, rotacionar e escolher o momento do clique não alteram sorteio. Não é necessária simulação física da embalagem.

### 9.10. Revelar uma carta

Carta atual aproximadamente 320×448 px no palco 1080p; as próximas estão na pilha atrás, sem vazar suas frentes. A carta inicial pode girar uma vez para apresentar a frente. O padrão para avançar é **deslizar a carta frontal**, não repetir um giro de 180° em cada carta.

Frente → nome/estado “Nova” → leitura livre → gesto/botão → saída lateral e próxima carta. A especial recebe reflexo suave sem alterar escala final nem produzir tela escura.

“Revelar todas” conclui as poses e abre o mesmo recibo. Entrada durante uma transição é consumida uma única vez; duplo clique não deve saltar duas cartas. Falta de arte mantém nome e template.

### 9.11. Normal, holo, foil, cromada e imersiva

Normal tem brilho leve de papel. Holo utiliza máscara na arte. Foil responde ao ângulo. Cromada usa reflexos no acabamento metálico autoral, não uma superfície que apaga a impressão. Uma rara pode ter um aro ou som mais expressivo.

Carta imersiva pode oferecer “Entrar na ilustração” como ação separada. A cena correspondente é um asset local e não precisa reproduzir em toda abertura. Ao sair, voltar à mesma carta e posição da revelação.

Na batalha, não executar automaticamente essa cena imersiva ao comprar, jogar ou atacar. O ritmo de coleção e o ritmo de combate são diferentes.

### 9.12. Sons e ritmo

Usar sons separados de toque, corte, papel, revelação e acento especial. Música pode baixar ligeiramente durante um acento, mas não deve ser reiniciada por cada carta.

Não disparar um som especial baseado em informações ainda ocultas na mão do NPC. Na abertura própria, uma antecipação de brilho antes da frente é apenas teatral e se refere ao resultado já registrado.

### 9.13. Retomada da revelação e acessibilidade

Persistir `openingId` e, opcionalmente, o último índice apresentado. O recibo é obrigatório; o índice é conveniência. Ao voltar, oferecer continuar a apresentação ou ver o resumo, sem novo sorteio.

Movimento reduzido substitui giro e saída ampla por fades curtos. Leitor de tela anuncia a carta atual quando revelada; “Revelar todas” anuncia o resumo. Não percorrer antecipadamente o nome de todas as cartas por labels de botões escondidos.

Falha em vídeo/efeito/áudio oferece o mesmo resultado em grade. Não mostrar cobrança nova para reparar uma animação.

---

<a id="interface-10"></a>

## 🗂️ 10. Coleção — S07

### 10.1. Visão

Grade de cartas ocupa a maior área. Uma barra superior oferece busca e filtros. À direita, um detalhe fixável permite inspecionar sem perder o ponto da coleção.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Coleção         [Buscar carta...]       Ordenar      Filtros         │
│ Todas | Obtidas | Não obtidas | Favoritas | Desejos                   │
├───────────────────────────────────────────────┬─────────────────────┤
│ [carta] [carta] [carta] [carta] [carta]        │ CARTA SELECIONADA   │
│ [carta] [carta] [carta] [carta] [carta]        │ Arte ampliada       │
│ [carta] [carta] [carta] [carta] [carta]        │ Possuídas / variantes│
│                                               │ [Ver detalhes]      │
│                                               │ [Adicionar ao deck] │
└───────────────────────────────────────────────┴─────────────────────┘
```

### 10.2. Miniatura

Mostrar imagem inteira, nome, quantidade, raridade e indicador de novidade. Cópias são agrupadas para não preencher a grade com dez imagens idênticas.

Ao expandir um grupo, mostrar suas impressões e acabamentos. O agrupamento não pode ocultar diferenças de expansão relevantes para desafios.

### 10.3. Filtros

Nome, tipo, categoria, estágio, expansão, raridade, regra ex/Mega, efeito funcional, quantidade, posse e favoritos.

Filtros selecionados viram chips removíveis. “Limpar filtros” restaura o conjunto completo, não apaga busca inadvertidamente sem indicar.

**Expansão escolhida (conteúdo 3.0.0):** a grade continua agrupada por carta de jogo, mas a miniatura e o detalhe mostram a impressão daquele set — a possuída, se houver; senão a primeira do set —, e raridade, número da coleção e ordenação consideram só as impressões daquele set. Uma carta só reimpressa em outro set não aparece; a ☆ de outro set não faz uma ◊ passar no filtro de raridade. O filtro de raridade usa os símbolos ◊…♛, inclusive ✵/✵✵, e PROMO.

### 10.4. Ordenação

Nome, número da coleção, expansão, aquisição recente, raridade e quantidade. Ordem é estável; novas cartas não devem pular constantemente durante inspeção. Raridade segue a ordem ◊ < ◊◊ < ◊◊◊ < ◊◊◊◊ < ☆ < ☆☆ < ☆☆☆ < ✵ < ✵✵ < ♛ (mais rara primeiro ao ordenar).

### 10.5. Ações

Clique seleciona; duplo clique pode abrir detalhe como atalho opcional. O botão explícito “Detalhes” continua disponível para toque e teclado.

Adicionar ao deck abre seletor de deck, valida a quantidade e não navega embora sem necessidade.

### 10.6. Não obtidas

Mostrar estado de catálogo sem sugerir posse. A ação principal passa a ser “Como obter” ou “Adicionar à lista de desejos”.

Não fornecer um botão “Usar” habilitado em partida normal para carta não possuída.

### 10.7. Estados

Coleção vazia, filtro sem resultado, erro de leitura local, carregamento parcial e miniatura ausente. Mostrar diferença entre “não possui” e “não foi possível carregar”.

### 10.8. Coleção 3D sem desperdício

A grade permanece HTML, com imagens locais em resolução pequena, desenhada em **blocos de 120 cartas**: “Mostrar mais (N)”, com N cartas restantes, acrescenta o próximo bloco, e mudar um filtro volta ao primeiro bloco sem perder a carta selecionada. Virtualização PODE substituir os blocos, desde que a rolagem continue estável. Ao selecionar, uma carta real ocupa o inspector Three.js na mesma tela. Opcionalmente usar uma prateleira 3D para favoritos, sem substituir a busca rápida.

“Como obter” lista nó garantido, pacote elegível e oferta do Empório com seus pré-requisitos. Não oferece link para serviço remoto como caminho obrigatório. Cada pacote elegível aparece como “Pode sair em <pacote> · X,XXX% por pacote” — cópias esperadas por pacote, com três casas decimais, nos dois modelos de pacote — e leva às probabilidades (S05).


---

<a id="interface-11"></a>

## 🔎 11. Detalhe da carta — S08

### 11.1. Composição

À esquerda, a carta grande; à direita, nome, tipo, categoria, estágio, regras e ações. Abaixo, uma faixa de variantes e a cadeia evolutiva.

A proporção sugerida é 40% visual e 60% informação. Não repetir o texto impresso apenas como imagem ilegível.

### 11.2. Abas

“Carta”, “Variantes”, “Como obter” e “Uso nos decks”.

“Carta” mostra regras, HP, ataques, Habilidades, Energia, Recuo, Fraqueza e pontos de Nocaute. “Variantes” mostra impressões agrupadas pela mesma definição funcional.

### 11.3. Interação visual

Inclinação limitada ao mover o ponteiro; arrasto para rotacionar apenas dentro do palco. Um botão retorna à posição frontal.

Em redução de movimento, manter a malha 3D frontal sem movimento automático; o modo 2D acessível é uma alternativa explícita. Em cartas imersivas, há controle separado de reproduzir, pausar, áudio e sair.

### 11.4. Ações

Favoritar, lista de desejos, adicionar ao deck, exibir no perfil, selecionar acabamento e consultar aquisição.

Uma ação indisponível explica a causa: carta não possuída, limite de cópias, modo restrito ou recurso não implementado.

### 11.5. Comparação

Permitir comparar duas definições lado a lado no desktop. A comparação não deve confundir arte alternativa com uma carta de regras diferentes.

O seletor “Comparar com” lista uma impressão por carta de jogo, em dois grupos: primeiro “Outras versões de <nome>” — as definições com a mesma `deckLimitKey` e regras diferentes, como os vários Pikachu ex ([campanha §20.6](campanha.md#campanha-20)) —, depois “Outras cartas”, por nome. Cada opção mostra nome, set e número (“Pikachu ex (A4B 132)”).

Destacar diferenças de HP, custo, dano, Habilidade e pontos; não declarar automaticamente qual carta é “melhor”.

### 11.6. Inspector Three.js

A carta tem frente, verso e lateral. Limitar rotação por arrasto no palco, sem orbitar o restante da tela. “Ver verso” e “Centralizar” são botões explícitos.

O acabamento holográfico acompanha a direção da vista. O cromado usa reflexão de ambiente incluído localmente. Uma máscara preserva nome, HP e textos. No painel direito, a mesma informação permanece como texto selecionável e acessível.

A transição para uma variante troca impressão/material, nunca HP ou ataques quando a definição funcional é a mesma. Informar diferenças funcionais quando a variante não é apenas visual.


---

<a id="interface-12"></a>

## 📚 12. Fichários e galeria pessoal — S09, S10 e S32

### 12.1. Biblioteca

Capas e expositores locais com nome e quantidade de páginas. Ações: criar, editar, duplicar, renomear, excluir e exportar imagem quando implementado.

Sem publicar, curtidas, amigos ou controles de privacidade de serviço inexistente.

### 12.2. Editor

Coleção à esquerda, página 3 × 3 no centro e opções à direita. Posição é alterada por arrasto ou por selecionar carta e espaço.

O fichário pode ter páginas com espessura e virada em Three.js. Usar somente a página ativa e vizinhas visuais, em vez de carregar todos os materiais de todas as páginas.

### 12.3. Galeria

Prateleira 3D com um número limitado de cartas e troféus. O usuário escolhe layout, fundo e carta de destaque. Iluminação não deve tornar o texto impossível de ler.

### 12.4. Salvamento

Salvar registra referências a impressões do perfil. Excluir fichário não remove cartas. Exportar composição é uma cópia visual, não um arquivo que concede posse em outro jogo.

### 12.5. Fallback

A galeria também oferece grade HTML. Perda de GPU não impede editar posições ou salvar o fichário.

---

<a id="interface-13"></a>

## 🗃️ 13. Biblioteca de decks — S11

### 13.1. Visão

**[DP] 15/10/2026 (inspiração `referencias/decks/`, Pokémon TCG Pocket):** a tela “Escolha um baralho” é uma grade de cartões de deck. Cada cartão tem faixa superior diagonal na cor da Energia principal, o número do deck em destaque, a **caixa de deck 3D** com a **capa escolhida** na frente (§13.6), duas cartas em destaque encostadas na frente da caixa e, embaixo, o nome e a contagem 20/20 com o estado (rascunho, favorito, em uso). O cabeçalho tem **Receitas** (S51), e a biblioteca vazia oferece “Ver receitas” ao lado de “Criar deck”. Selecionar marca o cartão com borda escura e selo de confirmação e gira a caixa; clique duplo abre a ficha.

As ações do deck selecionado ficam numa barra flutuante de **botões só de ícone** (Jogar, Editar, Duplicar, Aparência, Favoritar, Exportar, Excluir), com o nome como dica e rótulo acessível.

### 13.2. Abas

Meus decks, rascunhos e modelos/apoio.

A aba “Modelos e apoio” lista os decks de conteúdo `STARTER` e `SUPPORT`: os oito iniciais (selo “Deck inicial”), os apoios de capítulo, os oito modelos dos sets novos e as variações de campanha (selo “Deck de apoio”), na ordem do pacote de conteúdo ([campanha §3.6](campanha.md#campanha-03)). O Treino (S17) oferece os mesmos decks como adversário local, junto com os decks de NPC de nós já liberados.

Não misturar deck de apoio com coleção possuída. Exibir disponibilidade e restrições do cenário; não há expiração por tempo nem contador de aluguel.

### 13.3. Ações

Criar do zero, criar por modelo, auto-build, editar, duplicar, renomear, favoritar, escolher cosméticos e excluir.

Exportar/importar uma lista JSON local é requisito. Validar versão, IDs, quantidades e Energias. Importação não concede cartas; ausências ficam marcadas e a lista pode ser salva como rascunho.

### 13.4. Estado do deck

| Estado | Apresentação |
|---|---|
| Válido | 20/20, ícone de confirmação e ação de jogar. |
| Incompleto | Contagem real e atalho de continuar edição. |
| Falta inventário | Quantidade faltante e ação de revisar cartas. |
| Restrito pelo modo | Motivo específico do formato. |
| Carta não suportada | Aviso explícito; não iniciar partida aproximada. |
| Deck de apoio | Uso autorizado no cenário, sem adicionar cartas ao inventário. |

### 13.5. Exclusão

Mostrar nome e confirmar. Excluir o deck não remove cartas da coleção. O texto deve deixar isso claro.

### 13.6. Prévias tridimensionais

A caixa de deck 3D (CSS 3D, sem WebGL) aparece na biblioteca, na ficha, nas receitas e nos resumos de deck (Início, seleções).

**Caixa retangular do Pocket (decisão do autor, 16/10/2026; `components/deck-box.tsx`):** a caixa é um retângulo em pé, não um cubo — frente de 0,84 × 1,1 da largura de referência (~3:4) e profundidade de 0,42, vista de leve por cima e pela direita.
- Na frente, a **carta de capa inteira** numa janela, um pouco abaixo do centro, com borda branca e sombra.
- A **tampa** na cor da Energia principal ocupa a metade de cima da frente (46 %), com um filete escuro na divisa; a **base** embaixo é clara (branco-azulado).
- A lateral repete a divisão e leva o **emblema redondo do tipo** na divisa; o topo da tampa fecha em cima na cor do tipo.
- Critério UI-179 (§40). A capa é a carta escolhida pelo jogador (`settings.deckCovers`) ou, sem escolha, a de maior estágio com regra especial primeiro. Os cartões da biblioteca continuam leves. Girar a caixa apenas no palco; ordenar os decks não altera a ordem de compra em uma partida.

O deck da tentativa suspensa é identificado como “Em uso neste duelo”; editar cria nova versão, sem tocar no snapshot em andamento.


---

### 13.8. Receitas de deck — S51 e S52

**Decisão do autor (16/10/2026):** listas prontas para montar um deck com facilidade ([campanha §3.7](campanha.md#campanha-03)), na sub-aba **Receitas** de COLEÇÃO e no botão Receitas do S11.

**S51 — prateleira** (`screens/recipes.tsx`):
- Cartões no padrão do S11 (`components/deck-card.tsx`): faixa na cor da Energia, **selo da categoria** no lugar do número, caixa de deck com a capa, duas cartas em destaque, nome, linha “Categoria · era · dificuldade” e a barra de quantas das 20 cartas a coleção já cobre (“Pronta para montar” em verde quando cobre todas).
- Filtros: abas Todas · Meta · Por tipo · Comunidade (com contagem), tipo de Energia (um por vez), busca por nome da receita ou de carta e “Só as que posso montar”. O subtítulo diz quantas a coleção já monta. O estado dos filtros fica na visão (`S51`).
- Tocar num cartão abre S52.

**S52 — receita aberta:**
- Cabeçalho com nome, categoria, set da era e dificuldade; **Exportar lista** (JSON `card-campaign-deck-list`, §13.3) e **Montar deck** (com todas as cartas) ou **Montar rascunho** (faltando alguma).
- Destaque na cor da Energia: caixa grande, selos (categoria, era, dificuldade, Energia), estratégia, contagem de Pokémon, Treinadores e ex, e a barra de cobertura (“8 de 20 cartas na coleção · faltam 12”).
- Lista com as 20 cartas: as cobertas pela coleção normais (qualquer impressão da mesma carta conta e é a mostrada); as que faltam em cinza, com o selo **Falta**. Tocar numa carta abre a ficha S08.
- Painel “Faltam N carta(s)” com cada carta e as cópias que faltam, levando à S08 (onde conseguir: pacotes, Empório, prêmios); sem faltas, “Tudo pronto”.
- **Montar** cria um deck novo e abre o editor S12 com o rascunho: nome e Energia da receita, as cópias da coleção primeiro e as que faltam com a impressão da receita (`application/recipes.ts`). Faltando cartas, um aviso explica que o deck fica como rascunho; a confirmação da versão continua exigindo a posse (§14). Montar nunca concede cartas.
- Critério UI-178 (§40).

<a id="interface-14"></a>

## 🛠️ 14. Editor de decks — S12

### 14.1. Objetivo

O jogador deve ver simultaneamente **o que pode adicionar**, **o que já está no deck** e **por que aquela escolha funciona ou falha**.

**[DP] 15/10/2026 (inspiração `referencias/decks/`):** o editor vira uma **ficha do deck** minimalista, com ações em **ícones** em vez de botões escritos:

- topo com faixa diagonal na cor da Energia, nome numa pílula editável (lápis), indicador de gravação e favoritar;
- caixa 3D com ícone “Trocar capa” (escolha entre as cartas do deck);
- três painéis: **Energia** (8 tipos, os escolhidos acesos), **Acessórios** (verso, moeda e tapete → Oficina) e **Cartas em destaque**;
- barra fixa com a contagem 20/20, resumo Pokémon/Treinadores e ícones Desfazer, Auto-build, Testar e Editar cartas (mostra ou oculta a coleção);
- erros, objetivos do desafio e avisos (recolhidos) logo abaixo;
- as **20 vagas** em cartas (uma por cópia, vagas vazias tracejadas); clicar numa carta remove uma cópia;
- à direita, a coleção (busca, filtro por tipo em ícones, mostrar não possuídas); clicar adiciona, com o motivo da recusa em aviso quando não cabe;
- Cancelar (voltar, o rascunho fica salvo) e Salvar versão como botões redondos flutuando na base da ficha.

O layout de três colunas abaixo fica como referência histórica.

Não usar uma interface em que cada adição abre e fecha uma tela inteira.

### 14.2. Layout amplo

No editor, a navegação global vira um trilho compacto de 72 px. O espaço liberado serve às três colunas.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Decks    Nome editável       18/20       Rascunho salvo       [Salvar]    │
├────────────────────────────────┬───────────────────┬───────────────────────┤
│ COLEÇÃO DISPONÍVEL              │ LISTA DO DECK     │ INSPEÇÃO / ANÁLISE    │
│ Busca + filtros                │ Pokémon           │ Carta ampliada        │
│ [carta] [carta] [carta]         │ 2× Criatura A  −+ │ Regras / cadeia       │
│ [carta] [carta] [carta]         │ 1× Criatura B  −+ │                       │
│ [carta] [carta] [carta]         │ Treinadores       │ Energia do deck       │
│                                │ 2× Item A      −+ │ Avisos                │
│                                │                   │ Distribuição          │
├────────────────────────────────┴───────────────────┴───────────────────────┤
│ Energias: [Fogo ✓] [Água] ...   Erros: 1   [Auto-build] [Testar] [Salvar]   │
└────────────────────────────────────────────────────────────────────────────┘
```

Geometria de referência em 1920 × 1080:

| Região | X | Y | Largura | Altura |
|---|---:|---:|---:|---:|
| Cabeçalho local | 96 | 104 | 1800 | 64 |
| Coleção | 96 | 192 | 936 | 752 |
| Lista do deck | 1056 | 192 | 408 | 752 |
| Inspeção/análise | 1488 | 192 | 408 | 752 |
| Ações inferiores | 96 | 968 | 1800 | 64 |

### 14.3. Layout compacto

Em 1280 × 720, manter coleção e lista. O detalhe abre em drawer de aproximadamente 360 px, fechável sem perder seleção.

Exemplo: área principal com 1184 px, coleção de 824 px, intervalo de 16 px e deck de 344 px. A altura de cada região adapta-se ao viewport.

A análise ganha uma aba ou botão. Não reduzir três painéis a textos ilegíveis.

### 14.4. Coleção de origem

Exibir por padrão cartas possuídas e utilizáveis no formato. Um toggle permite mostrar não possuídas para planejamento, com estado diferente.

Miniatura informa quantidade disponível, quantidade já usada e limite por nome.

Com ~2.000 impressões no conteúdo 3.0.0: a barra da coleção tem busca, “Mostrar não possuídas”, o seletor de Expansão (“Todas as expansões” ou um set) e os filtros por tipo/Treinador. A lista é filtrada e ordenada só quando a coleção ou os filtros mudam e é desenhada em **blocos de 60**, com “Mostrar mais (N)”; mudar um filtro volta ao primeiro bloco. O limite de duas cópias por nome vale entre versões de sets diferentes.

### 14.5. Adicionar

Botão `+` ou arrasto para lista. Antes de aceitar, validar espaço, limite, inventário e legalidade.

Se a carta não couber, manter a seleção e explicar o motivo. Não “resolver” removendo outra carta sem confirmação.

Nesta versão, um deck completo bloqueia a vigésima primeira carta; pode oferecer “Substituir uma carta” como fluxo explícito.

### 14.6. Remover

Botão `−` reduz uma cópia. Remover a última retira a linha. Disponibilizar desfazer local antes de salvar ou iniciar partida.

Tecla Delete não deve excluir uma carta da coleção; no editor ela só altera a lista, quando a linha estiver em foco.

### 14.7. Quantidade e impressão

Agrupar por definição/nome para leitura, mas permitir expandir e selecionar a impressão de cada cópia.

Duas artes alternativas continuam contando no mesmo limite. A escolha de impressão deve mostrar expansão e raridade para objetivos que consultam esses atributos.

### 14.8. Organização da lista

Agrupamento padrão: Pokémon, Itens, Apoiadores, Ferramentas, Estádios. Evoluções podem ser visualizadas em árvore.

A ordenação visual não altera a ordem aleatória futura do baralho. Não transmitir a ideia de que pôr uma carta no topo da lista garante comprá-la primeiro.

### 14.9. Energia

Área sempre acessível com tipos configurados. Mostrar diferença entre sugerido automaticamente e fixado pelo jogador.

Ao adicionar um Pokémon com outro custo, sugerir mudança; não modificar seleção manual sem consentimento.

O indicador de risco diz “Este ataque depende de outra fonte de Energia”, e não “Carta impossível de usar”, quando houver efeitos que podem habilitá-lo.

### 14.10. Análise

Mostrar contagem por categoria, Básicos, evoluções, distribuição de custos de ataque e valores de pontos expostos.

Evitar chamar o gráfico de “curva de mana” sem explicar: Energia aqui não funciona como uma carta de recurso comprada do deck.

Indicadores são descritivos. Não atribuir “97% de força” sem um método real de cálculo.

### 14.11. Validação

Painel dividido em:

```text
ERROS — impedem jogar.
AVISOS — sugerem risco estratégico.
OBJETIVOS — indicam compatibilidade com um desafio escolhido.
```

Um aviso nunca usa a mesma aparência de erro bloqueante.

### 14.12. Auto-build

Selecionar foco, tipos ou carta central. Gerar uma proposta comparável com a lista atual.

Mostrar cartas adicionadas, removidas e ausências. Botões “Aplicar proposta” e “Cancelar”. Não sobrescrever instantaneamente o deck.

### 14.13. Nome e cosméticos

Nome editável no cabeçalho, capa escolhida entre opções permitidas, sleeves, tapete e moeda em painel separado.

Cosméticos não mudam a lista nem o cálculo de dano.

### 14.14. Salvar e testar

Salvar confirma uma versão. Testar valida e cria snapshot. Se houver mudanças, oferecer “Salvar e testar” ou “Testar este rascunho” somente se o modo suporta isso.

Salvar rascunho incompleto é permitido; iniciar duelo normal não.

### 14.15. Fluxo vindo de desafio

```text
Detalhe do desafio → selecionar deck → corrigir incompatibilidades
→ salvar → retornar ao mesmo desafio com deck selecionado
```

Manter os objetivos do desafio visíveis durante a edição opcionalmente.

### 14.16. Critérios de aceite do editor

O jogador deve concluir um deck válido sem abandonar a tela. Deve entender por que uma carta não entra. Ao recarregar, recupera o rascunho. Ao salvar, não perde variantes. Ao voltar, retorna ao contexto original.

### 14.17. Inspector tridimensional e mesa de montagem

A coluna de inspeção usa uma carta Three.js real, com controle de verso, zoom e acabamento. A lista continua HTML com `−/+` precisos. Uma animação curta pode deslocar uma cópia visual até o deck box ao adicionar; a lista e a validação não esperam o fim da animação.

Não renderizar cada miniatura da coleção com um canvas próprio. O renderer compartilhado atende somente o inspector e a caixa selecionada, com viewports definidos.

### 14.18. Relação com a campanha

Ao entrar a partir de um nó, manter um chip “Preparando: C02-E06” e a lista de restrições. O link “Como obter” abre fontes permanentes locais. O botão de deck de apoio oferece uma alternativa completa, não uma espera por aquisição aleatória.

### 14.19. Save e importação

Rascunho é salvo em SQLite, com revisão. “Salvar versão” confirma uma lista. Importar mostra um diff antes de aplicar; opções inválidas não sobrescrevem o deck atual.

Falha de gravação aparece junto do botão Salvar e preserva as mudanças em memória para exportação. Não marcar a versão como salva com base apenas em um toast.



### 14.20. Aparência sem abandonar o deck

O comando **Aparência** abre S42 com `returnContext` para este deck. Separar as abas Playmat, Verso, Moeda e Flair de entrada. Uma alteração cosmética não modifica as vinte cartas, as Energias ou a legalidade.

A oficina e a precedência de presets estão em [Personalização dos playmats](#interface-personalizacao). Mostrar uma miniatura da mesa aplicada na biblioteca de decks, não somente o verso. Na volta, preservar busca, rolagem e seleção do editor.

O botão “Aplicar ao deck” confirma a revisão visual; “Usar padrão do perfil” remove apenas o override. Excluir o deck não exclui o preset compartilhado nem os acessórios possuídos.

Flair de entrada por cópia é dado do deck, não do preset: cada linha guarda `deck_entries.entry_flair_id` na revisão do deck, e o preset só oferece o padrão `defaultEntryFlairId` para entradas sem escolha própria. Duplicar o deck copia as entradas com seus flairs; não existe mapa paralelo por `deckEntryId`.

---


<a id="interface-card-studio"></a>

### 14.21. Estúdio de Cartas — S43 a S47

O editor de decks seleciona cartas; o **Estúdio** cria definições e impressões. A especificação integral está em [editor-de-cartas.md](editor-de-cartas.md): campos, ataques, Habilidades, ex, artes, foil, templates, laboratório e publicação.

Layout 16:9: árvore de estrutura à esquerda, formulário ao centro e prévia Three.js à direita. O painel de estrutura organiza Identidade, Evolução, Ataques, Habilidades, Arte, Acabamento e Publicação. Controles HTML não são rasterizados no canvas.

A biblioteca diferencia rascunho salvo, release publicada e variante visual. Catálogo base abre em leitura e oferece “Editar como cópia”. Mudar arte/foil preserva regra; ativar ex muda a definição funcional.

Fluxo vindo de deck: selecionar carta → criar variante/projeto → testar/publicar → voltar ao deck de origem → revisar substituição → confirmar. Não adicionar automaticamente carta recém-criada à campanha padrão.

O perfil CUSTOM tem indicador visível. Publicar e conceder cópias são ações distintas ou um comando combinado explícito. SQLite confirma a revisão antes do rótulo “Salvo”.

Preview e Undo não concedem inventário. Importação/exportação de carta é diferente de importação de progresso.

---

<a id="interface-15"></a>

## 🧪 15. Treino e teste de deck — S13 e S17

### 15.1. Preparação

Deck próprio à esquerda, adversário local ao centro, dificuldade e regras à direita. Informar “Treino: sem recompensas e sem avanço de campanha”.

O jogador escolhe um arquétipo de teste dentre os instalados. Sem busca remota e sem fila.

### 15.2. Uso

Validar o deck, criar snapshot e iniciar a mesma mesa Three.js usada na campanha. Não criar outro motor simplificado para treino.

### 15.3. Assistência

Dicas explicam ações legais. Revelar as duas mãos, forçar moedas, alterar HP ou gerar cartas são ferramentas de Laboratório, claramente isoladas da progressão.

### 15.4. Pausa e saída

Treino pode pausar e salvar. Se existir uma tentativa de campanha suspensa, é necessário encerrá-la explicitamente antes de iniciar treino, pois há somente um slot de duelo por perfil.

### 15.5. Retorno

Voltar do resultado ao editor mantém deck e lista. Não conceder Créditos por vitória em treino.

---

<a id="interface-16"></a>

## ⚔️ 16. Hub de batalhas solo — S14

### 16.1. Composição

Sub-aba “Visão geral” da aba JOGAR: título “Jogar”, a linha “Todos os duelos são contra a IA local, neste dispositivo.” e um mosaico de caixas `MenuTile` (§5.6) sem rolagem.

```text
┌─────────────────────────────────┬────────────────┬────────────────┐
│ C02 — GINÁSIO DE SOOTOPOLIS     │ DESAFIOS       │ ARENA          │
│ CAMPANHA        [carta-chave]   │ 3 disponíveis  │ 2 rivais       │
│ Wallace · Líder [+ retrato]     ├────────────────┼────────────────┤
│ ▓▓▓▓░░ 12 de 45 encontros       │ TREINO         │ HISTÓRICO      │
│ [ ABRIR O MAPA › ]              │ sem recompensa │ e replays      │
├─────────────────────────────────┼────────────────┼────────────────┤
│ ADVERSÁRIOS — caderno (retratos)│ OBJETIVOS      │ DIÁRIO         │
└─────────────────────────────────┴────────────────┴────────────────┘
```

- **CAMPANHA** (hero, `hub-campaign`): tom e capítulo recomendado, o anfitrião do capítulo (chefe ou final; no Prólogo, quem dá as aulas) em `RivalArt`, progresso “N de 45 encontros” e “Abrir o mapa” (S19). Com duelo suspenso, a caixa vira **RETOMAR DUELO** (`hub-resume`, tom coral, “Contra <rival> · <nó>”) e leva ao duelo.
- **DESAFIOS** (S15, quantos disponíveis), **ARENA** (S18, rivais para revanche), **TREINO** (S17, “Com <deck favorito>, sem recompensa”), **HISTÓRICO** (S38), **ADVERSÁRIOS** (wide, S29: “N de M treinadores conhecidos” e os últimos retratos), **OBJETIVOS** (S25) e **DIÁRIO** (S26).

### 16.2. Deck

Escolher deck não inicia partida. Listar incompatíveis com motivo. Uma tentativa suspensa transforma a ação principal em Retomar.

### 16.3. Sem falsa espera

Nunca mostrar “Procurando adversário”. O oponente é conhecido pelo encontro; somente carregar recursos e preparar a IA local.

### 16.4. Navegação

Todas as entradas levam às rotas canônicas da seção 3. Não manter rotas de sala privada ou ranqueada da v1.

---

<a id="interface-17"></a>

## 🎯 17. Briefing, desafios e objetivos — S15 e S16

### 17.1. Lista de desafios

Uma alternativa prática ao mapa: abas Tutorial, Puzzles, Elites e Domínio. Filtros por capítulo, conclusão e dificuldade. Cada item mostra nó, adversário, medalha/objetivos e condição de acesso.

**Caixas de encontro (16/10/2026):** S15, a Arena (S18, §20.7) e o caderno S29 (§30.1) usam a mesma grade de caixas `MenuTile` (§5.6) de largura igual (mínimo 300 px): tom do capítulo, retrato do rival (§5.5), id do nó ou capítulo como kicker, título, adversário e dados curtos (limite de turnos, objetivos), selo de estado e a chamada de ação — “Briefing” em S15 (abre S16), “Desafiar” na Arena. Bloqueada, a caixa anuncia o motivo (“Conclua os pré-requisitos no mapa.”) e não navega.

### 17.2. Briefing canônico do nó

Esquerda: retrato do rival (§5.5), nome, título e identidade do deck. Centro: miniatura 3D da arena e história curta. Direita: objetivos, regras especiais, recompensas e deck selecionado.

```text
┌─────────────────┬─────────────────────────────┬────────────────────────┐
│ NPC / IA        │ C02-E06 · LÍDER DO GINÁSIO   │ OBJETIVOS              │
│ Estilo do deck  │                             │ ✓ / ○ / ○              │
│ Carta-chave 3D  │ Miniatura tridimensional    │ RECOMPENSAS            │
│ Dica desbloq.   │ da mesa de batalha          │ Única / repetível      │
├─────────────────┴─────────────────────────────┼────────────────────────┤
│ História e regra especial anunciada          │ Deck 20/20 · [Editar]  │
│ [Voltar ao mapa]                             │ [Iniciar encontro]     │
└──────────────────────────────────────────────┴────────────────────────┘
```

Não exigir um modelo de personagem para cada NPC. Um retrato em plano dentro do palco 3D é aceitável, identificado como ilustração, enquanto a arena e as cartas têm geometria real.

O seletor de deck do briefing lista os decks confirmados do jogador e, depois, “Apoio: <nome>” para cada deck de apoio do nó — os recomendados primeiro e a variação do capítulo por último ([campanha §3.6](campanha.md#campanha-03)). Com apoio escolhido, o painel diz “Usando deck de apoio: <nome>. Vitórias contam normalmente.”

### 17.3. Objetivos

Cada objetivo mostra texto preciso, necessidade de vitória, contador correto e recompensa. O principal abre o caminho; os opcionais servem ao domínio.

Deck incompatível com objetivo opcional recebe aviso, sem bloquear “Iniciar”. Restrições obrigatórias precisam indicar a correção ou o deck de apoio.

### 17.4. Dificuldade

História, Padrão e Especialista são selecionadas antes da tentativa. Mostrar quais diferenças de comportamento/lista estão ativas. Não atribuir uma dificuldade à GPU ou à qualidade gráfica.

### 17.5. Conteúdo preparado

Tutorial e Puzzle mostram o selo “Cenário preparado”. Explicar mão/estado inicial fixos, limite próprio e permissões. Isso não é apresentado como trapaça do oponente.

### 17.6. Repetição

Separar “Repetir encontro” de “Retomar tentativa”. A primeira cria outro ID e nova abertura quando o modo é normal; a segunda preserva tudo.

Primeiras recompensas já obtidas aparecem com confirmação permanente. Exibir somente o que ainda pode ser ganho.

### 17.7. Contexto

Editar o deck e voltar mantém o mesmo nó, dificuldade e objetivos. O mapa retorna à câmera/nó previamente selecionados.

---

<a id="interface-18"></a>

## 🏅 18. Objetivos, diário e conquistas — S25 a S27

### 18.1. Objetivos permanentes

Abas: Campanha, Domínio de encontros, Coleção e Conquistas. Não há diárias, login streak, prazo de resgate ou tarefa expirada.

Cada linha tem condição, progresso, recompensa e atalho à atividade. Se já concedida, mostrar “Recebida”. Não apresentar um segundo botão de resgate para a mesma operação.

### 18.2. Diário

Conteúdo curto de história já desbloqueada, resumo de capítulo, NPCs conhecidos e cartas-chave. Textos e imagens ficam no pacote local.

Nós futuros aparecem com informação reduzida quando a narrativa exige, mas sua elegibilidade técnica não depende de baixar conteúdo.

### 18.3. Progresso

Mostrar “3/6 nós concluídos”, “Chefe vencido” e objetivos completos. Não chamar porcentagem de coleção de porcentagem da campanha.

### 18.4. Arte

Um troféu ou medalha 3D selecionado pode girar suavemente ao lado da lista. Nada importante depende dessa animação. Em movimento reduzido, ele fica imóvel.

### 18.5. Notificações

Notificações são registros locais de conquistas, cartas e nós desbloqueados. Não existem mensagens de servidor, convites ou promoções temporárias.

---

<a id="interface-19"></a>

## 🌟 19. Descoberta: escolher uma carta — S28

### 19.1. Tela

Três cartas 3D reveladas em pedestais. Nome, tipo e resumo HTML abaixo. Cabeçalho: “Escolha 1 recompensa”. Prévia detalhada não confirma.

### 19.2. Confirmação

Selecionar uma carta destaca seu pedestal e abre resumo: impressão, quantidade 1 e consequência. Botões “Voltar às opções” e “Receber esta carta”.

### 19.3. Commit

Depois da confirmação, a transação local concede a carta e conclui o nó. Só então a carta selecionada faz a animação de aquisição.

### 19.4. Retorno

Ao recarregar antes da confirmação, mostrar as mesmas três opções. Depois dela, mostrar a escolha registrada. As alternativas permanecem consultáveis com caminho ao Empório, não novamente resgatáveis.

Sem cartas ocultas, jogadores de origem, agradecimento social ou custo recuperado por tempo.

---

<a id="interface-20"></a>

## 🗺️ 20. Mapa 3D, capítulos e Arena — S18 a S20

### 20.1. Mapa geral

O centro da tela é um conjunto de pequenas regiões em diorama. Prólogo e seis capítulos conduzem à arena final. Caminhos distinguem rota principal e nós opcionais.

Acima do mapa, uma **faixa de capítulos** em oito caixas `MenuTile` (§5.6) de largura igual (`chapter-<id>`): tom do capítulo (`CHAPTER_TONE`), retrato do anfitrião (chefe ou final; no Prólogo, quem dá as aulas), kicker “Prólogo”/“Capítulo N”/“Final”, título curto (sem o prefixo que o kicker já diz), “N/6 nós” (“· chefe vencido” quando for o caso) e selo de cadeado se bloqueado; a caixa abre S20. O capítulo do nó selecionado ganha aro ciano. Até 1500 px de largura, a faixa quebra em duas linhas de quatro. Abaixo, mapa e detalhe lado a lado: o nó selecionado mostra nome, progresso, próximo requisito e ação numa coluna de 320–400 px à direita; até 1280 px, o detalhe desce para baixo do mapa. O mapa não exige controlar um avatar em mundo aberto.

### 20.2. Câmera

Usar câmera ortográfica para o mapa, com inclinação estável, pan limitado e zoom com limites. Um botão “Centralizar progresso” retorna ao nó recomendado. Não orbitar livremente ao ponto de colocar o mapa de cabeça para baixo.

Pan por arrasto em área vazia; selecionar por clique. Diferenciar os dois por limiar de movimento. Roda só faz zoom quando o palco tem foco/intenção; listas mantêm sua rolagem.

### 20.3. Nós

| Estado | Aparência e ação |
|---|---|
| Bloqueado | Baixa saturação, cadeado e requisito consultável. |
| Disponível | Marcador com contorno e ação de abrir briefing. |
| Em andamento | Símbolo de pausa; Retomar. |
| Concluído | Medalha sólida e acesso à revanche. |
| Dominado | Adorno adicional, sem confundir com raridade de carta. |

Nós de batalha, elite, puzzle, Descoberta e chefe possuem ícones/formas distintos. Não usar somente cores.

### 20.4. Capítulo

Ao entrar, aproximar a câmera do diorama correspondente e listar seus seis nós. No capítulo, a rota principal é E01 → E03 → E06; E02, E04 e E05 são opcionais. O grafo real vem de `campanha.md`.

Seleção abre detalhe lateral. Duplo clique não inicia batalha sem briefing. Enter ativa o mesmo controle acessível.

### 20.5. Acessibilidade

“Ver como lista” mostra os mesmos nós e estados. Botões semânticos associados aos nós existem na camada HTML, com ordem de foco por progressão, não por posição arbitrária da malha.

### 20.6. Biomas

Prólogo em academia; capítulos com floresta, porto, usina, observatório, fundição e arquivo elevado. São direções artísticas autorais. Reutilizar peças modulares e variar luz/textura antes de exigir um mundo de alta complexidade.

O bioma não muda regras sozinho. Um modificador de encontro precisa aparecer no briefing e existir no estado.

### 20.7. Arena

S18 reúne NPCs já vencidos, cada um numa caixa de encontro (§17.1) com o retrato do rival (§5.5): nome do rival como título, “<nó> · <capítulo>” como kicker, “Vitória: N Créditos” e a chamada “Desafiar”. Deck e dificuldade ficam na barra de filtros acima da grade; sem deck confirmado ou com dificuldade que o rival não oferece, a caixa fica bloqueada com o motivo. Mostrar recompensa repetível e iniciar confronto local. “Sequência de vitórias” pode ser uma estatística pessoal, não ranking global.

A Arena não libera medalhas de chefe que o jogador ainda não ganhou no nó de campanha.

### 20.8. Direção ilustrada da campanha

Mapa e capítulos usam miniaturas Three.js coloridas em bases brancas/azul pálido, com luz difusa e paisagens estilizadas. Porto com água turquesa, bosque vivo, observatório lavanda e arquivo marfim. Não usar cidade gótica escura, bronze, velas ou astrolábios como identidade.

Essa direção acompanha [direcao-visual-pocket.md](direcao-visual-pocket.md#visual-13), mantendo todos os nós e nomes de `campanha.md`. A batalha não herda o diorama como cenário de fundo; usa o campo digital claro.

---

<a id="interface-21"></a>

## 📂 21. Preparação local de recursos — S21

### 21.1. O que acontece

Carregar arquivos locais do encontro, criar snapshot de deck, persistir tentativa e preparar cena. Exibir “Preparando a mesa” ou o nome da etapa real.

Não mostrar matchmaking, ping, região ou “adversário encontrado”. O nome do NPC já é conhecido.

### 21.2. Estados

```text
VALIDATING_ENTRY
→ LOADING_LOCAL_ASSETS
→ COMMITTING_ATTEMPT
→ BUILDING_SCENE
→ READY
```

Erro de asset decorativo usa substituto. Erro de catálogo ou gravação bloqueia o início com mensagem adequada.

### 21.3. Cancelar

Antes de criar a tentativa, pode voltar sem consequência. Depois do commit, voltar suspende a tentativa existente; não a apaga nem gera outra mão.

### 21.4. Progresso

Percentual só é mostrado quando medido por unidades/bytes conhecidos. Caso contrário, usar nome da etapa e indicador indeterminado.

### 21.5. Primeira visita offline

Um capítulo nunca visitado deve carregar porque seus arquivos fazem parte da instalação. Não depender do cache de uma visita anterior.

---

<a id="interface-22"></a>

## 🎲 22. Preparação da partida — S22

### 22.1. Transição — abertura VS

Mostrar confronto entre perfis, indicação do modo e regra de vitória. A apresentação de quem começa deve usar o resultado autoritativo, não a física da moeda.

**Decisão do autor (16/10/2026):** cada tentativa recém-iniciada — pelo briefing S16, pela Arena, pelo Treino ou por “Reiniciar encontro” — abre com a tela **VS** no estilo do Pocket, antes da preparação; retomar um duelo suspenso nunca a repete ([gameplay-pocket §3](gameplay-pocket.md#pocket-3)). É uma camada HTML (`DuelIntro`, `src/presentation/ui/battle/duel-intro.tsx`, `data-testid="duel-intro"`), a mesma na mesa 3D e na 2D:

1. duas faixas inclinadas fecham a tela por lados opostos — a vermelha do rival em cima, entrando pela esquerda, e a azul do jogador embaixo, pela direita;
2. os retratos (§5.5) descem pesados (de ~2,4× para 1, com achatamento e repique) e a tela treme brevemente no impacto;
3. entram “VS.”, os dois nomes e a pílula com a saudação do rival — a primeira fala do `dialogue.intro` do nó ou, sem ela, “Prazer em conhecer você!”;
4. tudo sai com fade e a camada é desmontada.

Duração `DUEL_INTRO`, 2600 ms (§36.2). Com movimento reduzido, sem queda nem tremor: a pose final aparece com fade curto e fica 1200 ms (`DUEL_INTRO_REDUCED_MS`). Enquanto a abertura está na tela, a entrada da mesa fica bloqueada e a IA espera o fim. A abertura não é evento de domínio nem barreira da fila de apresentação, e não muda nada no estado da tentativa.

**Cara ou coroa de quem começa** (decisão do autor, 16/10/2026): logo depois da VS, ainda na fase de preparação, a camada `CoinToss` (`src/presentation/ui/battle/coin-toss.tsx`, `data-testid="coin-toss"`) joga a **moeda equipada no deck do jogador** — cara, ele começa; coroa, o rival ([gameplay-pocket §3](gameplay-pocket.md#pocket-3)). A moeda aparece e é lançada sozinha, sem botão nem toque para lançar ou fechar.
- A face é o resultado autoritativo (`BattleView.firstPlayer`), também em fixture com primeiro jogador fixo.
- “Cara ou coroa?” e a regra em pílula; a moeda (§23.22) sobe, gira em X e cai na face em 1400 ms; “Cara!”/“Coroa!” e “Você começa.”/“<rival> começa.” entram com o véu na cor de quem começa; fade de saída aos 2900 ms. Com movimento reduzido, a face parada e o resultado por 1600 ms.
- Mesmas regras da VS: só em tentativa recém-iniciada, a IA espera, nada muda no estado. Critério UI-176.

### 22.2. Campo de preparação

O próprio lado tem uma posição Ativa vazia, três posições de Banco e cinco cartas na mão. O lado adversário aparece como aguardando, sem revelar a escolha ainda não confirmada.

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Preparação                                 Você joga primeiro         │
│ Adversário: escolhendo o campo                                       │
├───────────────────────────────────────────────────────────────────────┤
│                         [ ATIVO OBRIGATÓRIO ]                         │
│                                                                       │
│                    [ BANCO ] [ BANCO ] [ BANCO ]                      │
│                                                                       │
│              [carta] [carta] [carta] [carta] [carta]                  │
│ Escolha um Básico como Ativo.                    [Confirmar campo]     │
└───────────────────────────────────────────────────────────────────────┘
```

### 22.3. Seleção

Básicos elegíveis recebem contorno e rótulo. Evoluções e Treinadores permanecem inspecionáveis, mas não podem ser arrastados para o Ativo.

Clique na carta e depois no slot é alternativa completa ao arrasto.

### 22.4. Confirmar

Habilitar após existir um Ativo válido. Banco é opcional. Antes da confirmação, o jogador pode reorganizar suas escolhas.

Depois de confirmado e salvo, bloquear revisão da preparação naquela tentativa. Não revelar a seleção adversária antes do compromisso dos dois lados.

### 22.5. Explicação de abertura

Para quem começa, mostrar um aviso curto: “Você começa. Neste primeiro turno, não recebe a Energia normal da Zona.”

Não dizer simplesmente “Você não pode atacar”, pois um ataque sem custo pode ser legal conforme `gameplay.md`.

### 22.6. Falha e retomada

Restaurar a escolha confirmada. Não oferecer uma nova mão inicial por falha de interface.

### 22.7. Cena Three.js

Reutilizar a mesa de batalha e as cartas reais. Slots vazios são geometrias discretas com área interativa; cartas elegíveis recebem outline ou um aro leve. Nomes e instruções ficam em HTML.

A IA escolhe seu campo com dados autorizados. “NPC preparando” descreve processamento local; não simula uma pessoa conectada. Sem limite de segundos para o humano.



### 22.8. Introdução da mesa e compromisso de revelação

Em tentativa nova: abertura VS (§22.1), que cobre a tela enquanto a mesa se monta → construir cenário e superfície neutra → mostrar NPC e deck próprio → apresentar moeda de primeiro jogador → distribuir mãos → receber escolha de Ativo/Banco → confirmar preparação → revelar os campos públicos → apresentar primeiro turno e seu playmat.

Na preparação, o humano vê suas próprias escolhas. As escolhas do NPC ficam ocultas até o compromisso dos dois lados. O evento público de preparação autoriza a virada das cartas adversárias; a UI não adivinha a escolha da IA a partir de meshes pré-criados.

Revelar os Ativos com prioridade e os Bancos em pequeno escalonamento. Exibir HP e anexos após a carta correspondente assentar. Não acionar dano, sorteio ou prêmio porque a carta tocou o tapete.

A introdução curta é pulável; nenhuma mão é refeita. Um duelo retomado pula diretamente para o estado autorizado mais recente.

---

<a id="interface-23"></a>

## 🃏 23. Campo de batalha 16:9 — S23

### 23.1. Direção: a carta continua sendo o personagem

A experiência deve lembrar uma mesa digital de Pokémon TCG Pocket: superfície arredondada, Ativos frente a frente no eixo central, três posições de Banco em cada lado, pilhas laterais, Energias como fichas e mão própria em primeiro plano. A profundidade aparece na espessura da carta, no levantar da seleção, nas sombras e nas animações; não em uma câmera de RPG ou em monstros substituindo as cartas.

O material visual oficial mostra a mesa em perspectiva leve, HP fora da arte, Energias junto às cartas e um destaque ampliado da carta com faixa do ataque. Também apresenta playmats, versos, moedas e efeitos de cartas. Essa é a referência visual adotada. [V01] [V02] [V03] [V04]

**Limite de fidelidade:** 16:9, campanha, editor avançado de tapetes, coordenadas, milissegundos, shaders e regras de câmera abaixo são contratos próprios. Não são medições do código do Pocket. Reproduzir sua linguagem de apresentação não significa prometer equivalência pixel a pixel nem entregar seus assets.

Não usar animação de invocação de uma criatura 3D em cada jogada. Uma carta rara recebe melhor acabamento e um acento de entrada, mas permanece uma carta de tamanho normal no campo.

### 23.2. O que o jogador vê ao entrar

A câmera estabiliza sobre um campo digital claro arredondado, com aro branco e a arena no centro; não há sala, paisagem fotográfica ou objetos de cenário ao redor da luta. A metade próxima da arena identifica o humano; a distante identifica o NPC. O tapete ocupa a superfície útil inteira. Os oito espaços aparecem discretamente por cima da arte, seguidos pelas pilhas e pelas Energias. A mão entra pelo rodapé. As identidades e os pontos ficam em etiquetas HTML estáveis.

**Arena (decisão do autor, 16/10/2026; [gameplay-pocket §2](gameplay-pocket.md#pocket-2)):** igual na mesa 3D e na 2D, com geometria e cores em `three/battle/arena.ts`.

- Círculo grande no centro de espelho, com raio = distância do centro ao canto de Banco mais distante × 1,04 (`ARENA.radiusPad`), de modo que os dois Bancos ficam dentro: ≈ 427 px em 1080p (§23.5) e ≈ 307 px em 720p (§23.14). Na 3D, o círculo de tela é projetado no plano da mesa e aparece redondo.
- Dentro do círculo, a metade do adversário em coral (`#EE9095` → `#F2ABAC` em direção à linha central) e a do jogador azul-clara (`#D3E0F8` → `#C3D8F6`). Aro branco de 16 px e filete externo lilás de 3 px (`#D3D0EE`).
- Faixa clara (`#ECEFF6`, 85 %) de 56 px de altura sobre a linha central, de borda a borda da mesa; a linha central branca fina continua.
- Disco central atrás dos Ativos com raio = 1,0 × largura do Ativo, em `#ECEFF6`, com disco interno lilás-azulado (`#D6DFFC`) a 0,66 do raio e aro branco.
- Fora da arena, claro em cima (`#E8F2FB` → `#DCE3F5`) e azul embaixo (`#CBDBF6` → `#45A9F6`).
- O dono do turno acende a sua metade: coral mais forte no turno do adversário (`#E8767D` → `#EE9499`) e azul mais forte no seu (`#C4DAFA` → `#A7CBF8`). As faixas finas coral/ciano das bordas de cima e de baixo não aparecem mais.
- Slots, pilhas, pratos de Energia, cartas e HUD não mudam; pilhas e pratos ficam sobre o aro ou junto dele, como no Pocket. Toda a arena é decoração, fora do picking.

O olhar deve percorrer: **Ativos → HP/Energias → mão → ação disponível**. O cenário e a ilustração do playmat são pano de fundo. Não obrigar o jogador a acompanhar objetos decorativos para compreender quem está jogando.

A introdução só ocorre em uma tentativa nova. Retomar um duelo restaura a mesa pronta, sem repetir a moeda de abertura ou esconder novamente cartas já públicas.

### 23.3. Duas organizações, uma única partida

| Preset | Organização | Uso |
|---|---|---|
| `FOCUS_TABLE` — padrão | Mesa ampla, painéis flutuantes compactos, inspector e histórico recolhidos. | Aproximação visual do Pocket em formato horizontal. |
| `TACTICAL_PANELS` | Opcional nos ajustes: inspector à esquerda, mesa central, histórico/ações à direita. | Leitura detalhada, aprendizado e depuração. |

Os presets usam a mesma cena, entidades e comandos. Mudar o layout não reinicia batalha, não remonta a mão logicamente e não muda alvos. O padrão não parece um dashboard de três colunas permanentemente abertas.

Em `FOCUS_TABLE` não há painéis laterais fixos: a mesa vai de borda a borda e as placas dos jogadores ficam em cantos opostos, afastadas das bordas — a sua embaixo à esquerda (foto à esquerda), a do adversário em cima à direita (foto à direita) —, cada uma com foto em círculo, nome e o contador de três pontos grandes. As ações do Pokémon (ataques do Ativo, Recuo, Habilidades) aparecem na ficha que abre ao tocar nele ([gameplay-pocket.md §7.4](gameplay-pocket.md)); Finalizar turno, Menu/Pausa e Histórico são botões flutuantes. Jogar uma carta é arrastá-la da mão até o campo (§24.17). O inspector e o guia de cenário abrem na margem esquerda sem cobrir os Ativos.

### 23.4. Wireframe do preset padrão

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│                             ▯▯▯▯▯ mão NPC                ( ●●○  NPC · Turno 7 (foto) ) │
│                   [deck] [descarte]   [Banco] [Banco] [Banco]                       │
│                   Energia NPC ◉○            [ATIVO NPC]          [Estádio]          │
│ Guia /            ─────────────── linha central ───────────────  (Finalizar turno)  │
│ inspector                   [SEU ATIVO]       Sua Energia ◉○     (Ataque  ⚡ 20)    │
│                                               [descarte][deck]    (Recuar · custo)  │
│ (Histórico)                         [Banco] [Banco] [Banco]                         │
│ (Menu)          ╱[carta][carta][carta][carta][carta]╲  MÃO GRANDE EM LEQUE          │
│ ((foto) Você · Seu turno ●○○ )                                                      │
└────────────────────────────────────────────────────────────────────────────────────┘
```

O desenho indica relações, não autoriza inverter as pilhas descritas no runtime. Deck e descarte humanos usam a lateral direita, em posições separadas; deck e descarte do NPC usam a lateral esquerda espelhada. O Estádio fica à direita do corredor central, sem cortar o corredor dos ataques. A mão sai pela borda inferior da mesa; a carta em foco sobe inteira. Arrastar uma carta da mão até um alvo realçado a joga. As coordenadas exatas estão na §23.5.

### 23.5. Áreas de tela em 1920 × 1080

Valores em pixels CSS, centralizados no eixo X=960. Fonte de dados: [battle-layout.json](examples/battle-layout.json), perfil `desktop1080`; a última coluna é a chave de `regions`.

| Região | X | Y | Largura | Altura | Chave JSON |
|---|---:|---:|---:|---:|---|
| Faixa do adversário (borda da mesa) | 24 | 6 | 1872 | 40 | `hud` |
| Sua faixa (borda da mesa) | 24 | 1036 | 1872 | 40 | `humanBar` |
| Sua placa: foto, nome e pontos | 32 | 984 | 356 | 72 | `humanPlate` |
| Placa do adversário: pontos, nome e foto | 1532 | 24 | 356 | 72 | `npcPlate` |
| Viewport Three.js do campo | 24 | 80 | 1872 | 788 | `board` |
| Região protegida das oito cartas | 448 | 108 | 1024 | 730 | `protectedCards` |
| Inspector recolhível à esquerda | 24 | 112 | 320 | 720 | `inspector` |
| Ações (reserva do preset tático) | 1104 | 476 | 420 | 360 | `actions` |
| Dica do alvo pendente e Jogar | 1490 | 493 | 300 | 352 | `actionButtons` |
| Viewport da mão | 400 | 860 | 1120 | 220 | `hand` |
| Destaque transitório | 640 | 172 | 640 | 648 | `attackCutin` |
| Deck humano | 1360 | 624 | 80 | 112 | `humanDeck` |
| Descarte humano | 1240 | 624 | 80 | 112 | `humanDiscard` |
| Deck do NPC | 480 | 178 | 80 | 112 | `npcDeck` |
| Descarte do NPC | 600 | 178 | 80 | 112 | `npcDiscard` |
| Energia humana, pronta + próxima | 1216 | 528 | 128 | 72 | `humanEnergy` |
| Energia do NPC, pronta + próxima | 576 | 314 | 128 | 72 | `npcEnergy` |
| Contador de pontos humano, na sua placa | 240 | 1000 | 140 | 40 | `humanPoints` |
| Contador de pontos do NPC, na placa dele | 1540 | 40 | 140 | 40 | `npcPoints` |
| Estádio | 1240 | 397 | 80 | 112 | `stadium` |
| Faixa de turno | 680 | 436 | 560 | 42 | `turnBanner` |
| Botão flutuante Finalizar turno | 1524 | 433 | 232 | 48 | `endTurn` |
| Botão flutuante Histórico | 40 | 812 | 64 | 64 | `history` |
| Botão flutuante Menu/Pausa | 40 | 892 | 64 | 64 | `menu` |
| Mão do NPC, leque de versos | 840 | 0 | 240 | 64 | `npcHand` |

A superfície visual da mesa vai do meio da faixa do adversário ao meio da sua faixa, por trás das placas e da mão; o viewport do campo, a câmera e as sementes não mudam. As duas faixas são regiões de layout: a mesa não desenha mais as faixas finas coral/ciano nas bordas, e o turno acende a metade da arena (§23.2). A arena tem raio ≈ 427 px em torno de (960, 457) e a faixa central, 56 px de altura. O palco transitório só bloqueia o campo durante cut-in/inspeção; não oculta escolhas obrigatórias. `FOCUS_TABLE` não ocupa as margens com painéis permanentes: as ações do turno são botões flutuantes empilhados logo abaixo de Finalizar turno (`actionButtons`, `overlays.actions`) — um por ataque do Ativo (custo, nome e dano; indisponível mostra o motivo), Recuar, Habilidades ativáveis e Fóssil —, à vista durante o seu turno e sem caixa de escolha. A carta da mão selecionada por clique mostra ali “Jogar” (Treinador sem alvo) ou o motivo do bloqueio, e Cancelar. Escolhas obrigatórias usam um painel flutuante central.

Centros de referência dos grupos: Banco NPC Y=170; Ativo NPC Y=340; Ativo humano Y=574; Banco humano Y=756. Banco em X=788/960/1132. O Estádio fica em X=1280/Y=453, fora do corredor entre os Ativos.

Pilhas, Energia e Estádio ficam **dentro** da região protegida, fora dos oito retângulos de slot (centro ± tamanho/2); pilhas e pratos de Energia ficam sobre o aro da arena ou junto dele. As regiões do NPC espelham as humanas em torno de (960, 457): x′ = 1920 − x − largura; y′ = 914 − y − altura. Os contadores de pontos ficam nas placas dos jogadores — três marcadores grandes; os conquistados acendem em dourado com o número. A foto ocupa o círculo da ponta externa da placa: o retrato escolhido pelo jogador e o do rival, inteiros e sem contorno (§5.5); sem arquivo de retrato, a inicial na cor do capítulo. A mão do NPC é um leque compacto de versos (44×61,6 px) com contador no topo central. A faixa de turno ocupa o corredor de 49 px entre os Ativos e some depois de `TURN_BANNER`; o histórico abre como drawer `[1536, 112, 360, 392]` a partir do botão flutuante.

Âncoras semânticas canônicas (`anchors.regionAnchors` do layout): `HUMAN_ACTIVE`, `HUMAN_BENCH_0..2`, `HUMAN_DECK_TOP`, `HUMAN_DISCARD`, `HUMAN_ENERGY_READY`, `HUMAN_ENERGY_NEXT`, `HUMAN_HAND`, `HUMAN_POINTS`, `HUMAN_END_TURN`, os equivalentes `NPC_*`, `NPC_HAND_ENTRY` e `STADIUM`. Não existem âncoras `PLAYER_*`.

Presets de layout (`layoutPresets`): `FOCUS_TABLE` é o padrão e usa a tabela acima sem alterações. `TACTICAL_PANELS`, só em 1080p e opcional nos ajustes, fixa o inspector em X=24/Y=112/W=360/H=720 e junta histórico e ações num painel X=1536/Y=112/W=360/H=936, substituindo as regiões de ações e de histórico; slots, região protegida, mão e zonas do campo não mudam. Em 720p só existe `FOCUS_TABLE`.

Regra de mão (`handPolicy`): até 10 cartas grandes (176×246,4 px) em leque sempre sobreposto — passo de 62 % da largura, inclinação até 10° nas pontas e arco suave; a base sai 48 px pela borda inferior, atrás da barra do jogador (`bottomBleedPx`). A carta em foco ou selecionada sobe 104 px (escala ≤ 1,06) e aparece inteira, desenhada em `CardTransitScene` acima do campo.

As dimensões são metas de projeção; a câmera e o adaptador espacial fazem o encaixe. Não copiar pixels para posições de mundo.

### 23.6. Escala projetada e orientação

| Elemento | Alvo em 1080p | Alvo em 720p |
|---|---|---|
| Ativo | 132×184,8 px | 100×140 px |
| Banco | 88×123,2 px | 58×81,2 px |
| Mão em repouso | 176×246,4 px (base 48 px abaixo da borda) | 129,2×180,88 px (base 34 px abaixo da borda) |
| Mão em foco | Escala ≤ 1,06 e elevação 104 px, carta inteira | Escala ≤ 1,06 e elevação 76 px, carta inteira |
| Deck, descarte e Estádio | 80×112 px | 60×84 px |
| Ficha de Energia pronta / próxima | Ø 64 / 40 px | Ø 44 / 28 px |
| Carta em cut-in | Até 280×392 px | Até 200×280 px |
| HP externo | 28–36 px | 22–28 px |

Proporção 5:7 preservada; aproximar para pixels físicos no raster sem deformação. A carta em hover ou foco sobe até aparecer inteira acima da barra do jogador e cresce no máximo até 1,06; pode cobrir temporariamente o Banco próprio e é desenhada em `CardTransitScene` (`handPolicy` do layout). Texto completo está no inspector.

Cartas públicas do NPC ficam orientadas para o observador local. O verso da mão adversária é uniforme, sem material exclusivo de raridade. As oito posições existem mesmo vazias; não desenhar duas posições extras como nas imagens rejeitadas.

### 23.7. Câmera e profundidade

Câmera fixa quase superior, inclinada aproximadamente 12° a partir da vertical e FOV inicial de 28°. Os valores são defaults autorais, sujeitos ao enquadramento do runtime. Posição inicial, alvo e sementes de mundo de cada carta são definidos por perfil em [battle-layout.json](examples/battle-layout.json) (`profiles[].camera`, `profiles[].worldSeeds`); `fitBounds` continua obrigatório. Em 720p o aro próximo pode ser cortado em cerca de 14 px — margem cosmética; cartas e controles nunca.

A borda branca e a sombra suave comunicam uma mesa digital com espessura pequena. Não mostrar chão, horizonte, cenário de porto, braços do jogador ou madeira.

Não girar 180° na troca de turno. Mão e inspector usam subcenas no mesmo renderer. O cut-in pode inclinar/ampliar uma representação da carta sem mover a câmera principal nem os alvos lógicos.

### 23.8. Mesa, cenário e playmat são objetos diferentes

| Objeto | Responsabilidade |
|---|---|
| Cenário de arena | Fundo abstrato claro e motivos leves do capítulo; dioramas ficam no mapa, não atrás da luta. |
| Estrutura da mesa | Corpo arredondado, borda, sombra e a arena (§23.2) — metades, aro, faixa central e disco —, cuja metade do dono do turno acende. |
| Playmat | Ilustração/material cosmético aplicado à superfície compartilhada; na mesa padrão, só tinge o entorno da arena e acrescenta o seu decalque (§23.18). |
| Guias de zona | Contornos de Ativo, Banco, deck, descarte e locais de interação. |
| Estádio de batalha | Carta/efeito de regras, independente dos quatro anteriores. |

Uma mesa com tema de fogo não aplica Queimadura. Um playmat de água não muda Fraqueza. Um Estádio pode mudar uma regra porque sua definição diz isso, não porque o fundo tem uma ilustração específica.

### 23.9. HUD da criatura

Cada Pokémon apresenta HP restante/máximo, pequena barra de HP, Energias, Ferramenta e condições. HP fica no canto superior direito projetado; Energia junto à base; condições ao lado do HP sem ocupar o mesmo espaço do nome.

Até quatro Energias podem ser apresentadas por fichas individuais — a bola do tipo (§23.10) —; acima disso, agrupar por tipo com quantidades e expansão no inspector. A quantidade vem do estado, não do número de meshes que o orçamento gráfico permitiu desenhar.

Dano de um ataque aparece junto ao alvo. Cura usa outro rótulo; nunca fazer o mesmo número vermelho significar também cura. Em Nocaute, mostrar zero e estado explícito; não exibir HP negativo.

A redução da barra corresponde ao valor real. Fraqueza, prevenção, redução e dano adicional podem ser inspecionados por componentes. O texto numérico permanece estável por tempo de leitura mesmo quando partículas já terminaram.

### 23.10. Zonas laterais e recursos

Deck: pilha baixa com verso uniforme e contador público. Clicar abre informações permitidas, nunca a ordem oculta. Descarte: carta superior, contador e lista pública inspecionável.

Energia: ficha atual maior, previsão menor e rótulos equivalentes em HTML. A ficha atual só pode ser arrastada quando a ligação correspondente é legal. Ao usá-la, o estado visual de consumo não antecipa uma Energia que a regra ainda não entregou.

A próxima Energia não recebe a aparência de “disponível agora”. Não desenhar seis cartas de Prêmio ou um sexto espaço de Banco herdado de outro TCG.

**Bolas de Energia (decisão do autor, 16/10/2026):** Planta, Fogo, Água, Elétrico, Psíquico, Lutador, Noturno e Metal usam a bola do tipo recortada do atlas `src/presentation/assets/source/energy/energys.png` por `npm run assets:energy` (`src/presentation/assets/energy/<tipo>.webp`, 128×128 com transparência) nas Energias ligadas aos Pokémon, no orbe pronto da Zona, na próxima Energia — a mesma bola um pouco esmaecida, com aro branco — e no voo da ligação. Na mesa 3D são texturas de canvas (`three/card/energy-orbs.ts`), com o desenho procedural enquanto as imagens carregam e a mesa redesenhada quando chegam; na 2D, `<img>` (`Board2D`). Incolor e Dragão, que a Zona não gera, mantêm o ícone de tipo, e os custos de ataque continuam com os ícones.

### 23.11. Informação de turno e de resolução

A faixa “Seu turno” ou “Turno de [NPC]” aparece brevemente e depois vira rótulo discreto. A metade da arena do dono do turno, próxima ou distante, acende e reforça a identificação (§23.2); cor não é o único sinal.

Durante uma escolha do NPC no turno humano, continua sendo o turno humano. O texto secundário informa “NPC escolhendo”. Essa escolha não alterna o playmat, não gira a câmera e não aciona uma nova compra.

Durante resolução, mostrar “Resolvendo ataque” ou o nome da operação somente quando útil. Não mostrar a pontuação final antes de apresentar o grupo de Nocautes correspondente.

### 23.12. Seleção e alvos

Selecionado: contorno sólido e elevação pequena. Alvo legal: aro com ícone de confirmação e pulsação discreta. Alvo selecionado para dano: marcador direcional e nome. Alvo ilegal: não recebe destaque de legalidade, mas continua inspecionável quando público.

Cartas não jogáveis não desaparecem nem viram texturas ilegíveis. A seleção explica “Ainda não pode evoluir”, “Banco cheio” ou o motivo real. O motor é quem decide.

Decoração, brilho, aro do playmat e partículas não interceptam clique. Durante uma animação que oculta a posição correta, os comandos mutáveis ficam bloqueados até reconciliação ou avanço visual; Pausa e Pular continuam disponíveis.

### 23.13. Mão, inspector e histórico

Mão usa subcena ortográfica no renderer compartilhado. Ao focar uma carta, sua representação sobe e o inspector pode abrir; o layout das demais se ajusta suavemente, sem mudar a ordem lógica.

Inspector não é uma nova carta na partida. Histórico tem apenas informações autorizadas e descreve efeitos confirmados. Uma carta temporariamente revelada não deixa uma miniatura rastreável na mão oculta depois de embaralhada.

Histórico abre e fecha sem pausar automaticamente a partida se não esconder decisões; a opção “Pausar ao consultar regras” pode fazê-lo no solo. O menu Pausa sempre suspende a aplicação de ações da IA.

### 23.14. Layout 1280 × 720 e redimensionamento

Regiões principais: HUD X=16/Y=4/W=1248/H=30. Campo X=152/Y=60/W=976/H=508. Região protegida X=312/Y=76/W=648/H=486. Ações X=708/Y=300/W=320/H=260. Mão X=260/Y=556/W=752/H=164, centrada no eixo X=636 dos slots. Sem coluna lateral, o campo fica centralizado na janela.

Tabela completa em pixels CSS do perfil `compact720` de [battle-layout.json](examples/battle-layout.json); a última coluna é a chave de `regions`.

| Região | X | Y | Largura | Altura | Chave JSON |
|---|---:|---:|---:|---:|---|
| Faixa do adversário (borda da mesa) | 16 | 4 | 1248 | 30 | `hud` |
| Sua faixa (borda da mesa) | 16 | 688 | 1248 | 28 | `humanBar` |
| Sua placa: foto, nome e pontos | 16 | 656 | 240 | 48 | `humanPlate` |
| Placa do adversário: pontos, nome e foto | 1024 | 16 | 240 | 48 | `npcPlate` |
| Viewport Three.js do campo | 152 | 60 | 976 | 508 | `board` |
| Região protegida das oito cartas | 312 | 76 | 648 | 486 | `protectedCards` |
| Inspector em drawer sobreposto | 16 | 60 | 304 | 644 | `inspector` |
| Ações (reserva do preset tático) | 708 | 300 | 320 | 260 | `actions` |
| Dica do alvo pendente e Jogar | 974 | 349 | 220 | 200 | `actionButtons` |
| Viewport da mão | 260 | 556 | 752 | 164 | `hand` |
| Destaque transitório | 406 | 88 | 460 | 460 | `attackCutin` |
| Deck humano | 894 | 440 | 60 | 84 | `humanDeck` |
| Descarte humano | 826 | 440 | 60 | 84 | `humanDiscard` |
| Deck do NPC | 318 | 122 | 60 | 84 | `npcDeck` |
| Descarte do NPC | 386 | 122 | 60 | 84 | `npcDiscard` |
| Energia humana, pronta + próxima | 836 | 376 | 96 | 52 | `humanEnergy` |
| Energia do NPC, pronta + próxima | 340 | 218 | 96 | 52 | `npcEnergy` |
| Contador de pontos humano, na sua placa | 150 | 666 | 100 | 28 | `humanPoints` |
| Contador de pontos do NPC, na placa dele | 1030 | 26 | 100 | 28 | `npcPoints` |
| Estádio | 854 | 281 | 60 | 84 | `stadium` |
| Faixa de turno | 436 | 40 | 400 | 40 | `turnBanner` |
| Botão flutuante Finalizar turno | 1000 | 305 | 168 | 36 | `endTurn` |
| Botão flutuante Histórico | 24 | 548 | 44 | 44 | `history` |
| Botão flutuante Menu/Pausa | 24 | 598 | 44 | 44 | `menu` |
| Mão do NPC, leque de versos | 576 | 0 | 120 | 44 | `npcHand` |

Centros: Banco NPC X=492/636/780, Y=124; Ativo NPC X=636/Y=246; Ativo humano X=636/Y=400; Banco humano Y=520. Não modificar número de slots. A mão fica centrada em X=636, o mesmo eixo dos slots.

As regiões do NPC espelham as humanas em torno de (636, 323): x′ = 1272 − x − largura; y′ = 646 − y − altura. A arena tem raio ≈ 307 px em torno desse centro (§23.2). Entre os Ativos sobram 14 px; a faixa de turno aparece no topo do campo, por pouco tempo. A mão do NPC é um leque compacto de versos (28×39,2 px) com contador no topo central. O histórico abre como drawer `[1008, 60, 256, 300]` a partir do botão flutuante.

Inspector é drawer à esquerda (overlay, `overlays.inspector`) ou modal de leitura com foco controlado. Durante a sobreposição, picking atrás fica bloqueado; uma escolha obrigatória fecha/reorganiza o drawer. “Preservar o tamanho de texto” vale para painéis e rótulos HTML do shell; os rótulos projetados de HP seguem a tabela da §23.6 (22–28 px em 720p). A proporção da carta é sempre preservada.

Outros tamanhos de janela derivam destes dois perfis (`scalingRules`):

| Viewport | Regra |
|---|---|
| Altura ≥ 900 px | Geometria de `desktop1080` × min(largura/1920, altura/1080); 1600×900 usa 0,833 e 2560×1440 usa 1,333. |
| Altura 720–899 px | Geometria de `compact720` × min(largura/1280, altura/720); 1366×768 usa 1,067. |
| Altura < 720 px | `compact720` escalado; abaixo de 0,75 a batalha usa o modo 2D compacto. |
| Mais largo que 16:9 | Conteúdo limitado a 16/9 × altura e centralizado; a largura excedente vira margem funcional (3440×1440 → 2560 px de conteúdo e 440 px por lado). |
| Mais estreito que 16:9, horizontal | Escala limitada pela largura; a altura excedente vira margem vertical centralizada. |
| Retrato (largura < altura) | Menus HTML responsivos; batalha em modo 2D compacto, sem campo Three.js. |

A escala vale para as metas projetadas da batalha; não é um `transform: scale()` da aplicação e não reduz rótulos essenciais abaixo de 14 px (§2.3). Resize atualiza viewports, câmera, HUD e raycast juntos.

### 23.15. Estado inicial, retomado e terminal

Inicial: espaços vazios e mão inicial, com instrução contextual. Em andamento: mesa definida pelo estado confirmado. Retomado: reconstrução direta do checkpoint, respeitando escolhas. Terminal: campo final preservado atrás do resumo.

O duelo não aplica time-out por estar offline. O relógio opcional é estatístico. Falha de GPU leva a pausa e recuperação; não é derrota.

<a id="interface-playmats"></a>

### 23.16. Playmats — comportamento padrão e seleção por turno

O projeto adota `TURN_OWNER`: **um único playmat inteiro visível de cada vez**, escolhido do loadout do participante dono do turno. Não são dois retângulos colados, um em cada metade. Essa composição preserva a leitura de uma arte contínua cobrindo o campo, presente nas imagens oficiais. A política de alternância e sua transição abaixo são decisões explícitas deste projeto, não tempos oficiais medidos. [V03]

Ao receber `TURN_STARTED`, resolver o tapete do dono do turno e iniciar a transição visual. Efeitos de fim de turno e checkup ainda usam a superfície anterior até a abertura real do próximo turno. Uma Habilidade do adversário disparada no turno humano não troca o tapete.

Opções de conforto, declaradas como extensões locais:
- `TURN_OWNER`: tapete completo do dono do turno; padrão.
- `PLAYER_FIXED`: manter o tapete do humano durante toda a tentativa.
- `NEUTRAL`: usar uma superfície neutra de alto contraste.

Não há modo de duas metades nesta versão. Alterar essa política em Acessibilidade muda somente a apresentação, não o turno nem o loadout do NPC.

Se ambos usam a mesma definição, variante e parâmetros, não reproduzir uma troca perceptível a cada turno. A faixa de turno e a metade acesa da arena continuam suficientes.

### 23.17. Transição do tapete

Perfil padrão (`PLAYMAT_TRANSITION`): **crossfade simples de 280 ms** em velocidade Normal — dois samplers no mesmo material e mescla linear da cor da arte antiga para a nova — sob as cartas; não mover, inclinar ou virar as oito posições. Não há máscara de revelação nem segunda mesa.

A metade da arena do dono do turno acompanha a mudança (§23.2), sem acender o tabuleiro inteiro em branco. O desenho novo termina orientado ao observador local. Letras da ilustração não devem ser espelhadas.

Movimento reduzido: o mesmo crossfade, limitado a 150 ms e sem brilho. Em modo Instantâneo, trocar diretamente e anunciar turno por texto. Se o asset novo estiver indisponível, manter o tapete neutro e informar a ausência no diagnóstico, sem interromper o duelo.

Não carregar a arte pela primeira vez só depois de começar a transição. Preparar os dois tapetes do snapshot no carregamento local da tentativa.

### 23.18. Camadas de um tapete

```text
Estrutura da mesa
→ base opaca do playmat
→ ilustração e cor de fundo
→ padrões/decalques cosméticos validados
→ relevo de iluminação opcional, sem deslocar geometria
→ camada de contraste das zonas
→ guias funcionais / realce de seleção
→ cartas, anexos e efeitos de regras
→ HUD HTML
```

**Na mesa em arena (16/10/2026, §23.2):** a superfície opaca (entorno da arena) recebe o tingimento do tapete cosmético (`playmatTint`, k = 0,32; o tapete neutro não tinge); por cima vêm a imagem local do tapete, se houver, as metades da arena, o filete lilás e o aro, a faixa central, o decalque periférico do tapete e, por fim, o disco central, a linha central e as guias dos slots. O tapete nunca apaga a arena, a divisão nem o disco. Com imagem local, as metades da arena viram uma película de 38 % sobre ela, em 3D e em 2D. Ordem de desenho da 3D em [runtime §14.6](runtime-offline-threejs.md#runtime-playmats).

A ilustração pode ser rica nas laterais. Atrás dos Ativos, Banco, contadores e Energia, deve haver áreas visualmente tranquilas ou uma camada automática de contraste.

Guia funcional nunca é gravada apenas na imagem importada: se o usuário trocar a arte, Ativo e Banco continuam corretos. Não permitir que um decalque cubra nome/HP do HUD.

### 23.19. Formato, enquadramento e áreas seguras

A tela é 16:9; **o arquivo de arte do tapete não precisa ser 16:9**. Template autoral padrão: arte 4:3, preferencialmente 2048 × 1536 px no runtime e 4096 × 3072 px na produção. Aplicar à superfície 12,8 × 9,6 unidades, com cantos arredondados e máscara de borda.

A arte deve possuir ponto focal e retângulo de recorte. Usar recorte proporcional, jamais esticar personagens. O editor mostra a área exata que será descartada pelo contorno da mesa.

Camadas de leitura e posições não são customizáveis estruturalmente. Sua máscara é calculada a partir das zonas fixas do runtime, com margem ao redor de cada carta. Os dados do preset não podem substituir coordenadas de Ativo, Banco, deck ou Energia.

### 23.20. Dimensões materiais, sem física desnecessária

A superfície pode parecer tecido, borracha fosca ou material sintético. Usar irregularidade fina e sombra na borda. Não simular um tecido mole que enruga e joga cartas para fora do lugar.

Materiais metálicos ficam preferencialmente no aro e em pequenos detalhes. Tapete espelhado, vidro transparente integral ou reflexos que competem com HP não são presets válidos do modo padrão.

O tapete pode reagir a um impacto com uma onda de luz baixa. A malha não se deforma sob os slots. A reação não fica persistente como marca de dano de uma entidade.

<a id="interface-personalizacao"></a>

### 23.21. Oficina de aparência — S41 e S42

Entradas: **Decks → selecionar deck → Aparência**; **Perfil → Aparência padrão**; **Empório → prévia do cosmético**. Não criar um editor inteiro dentro de cada uma dessas entradas.

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ← Deck / Perfil       Aparência de “Nome do deck”        Alterações não salvas   │
├──────────────────┬──────────────────────────────────────────────┬────────────────┤
│ Playmat          │                                              │ PROPRIEDADES   │
│ Verso / sleeve   │          MESA THREE.JS EM PRÉVIA               │ Variante       │
│ Moeda            │     Ativos, Bancos, Energias e mão de teste    │ Cor / material │
│ Efeito de entrada│                                              │ Contraste      │
│ Favoritos        │                                              │ Intensidade    │
│ Importados       ├──────────────────────────────────────────────┤                │
│                  │ Meu turno | Turno NPC | Comprar | Atacar      │ [Restaurar]    │
├──────────────────┴──────────────────────────────────────────────┴────────────────┤
│ [Cancelar]  [Salvar como preset]   [Usar como padrão]   [Aplicar a este deck]     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Em 1080p: biblioteca de 320 px, palco central flexível com mínimo de 800 px e propriedades de 320 px, separados por 24 px. Em 720p: biblioteca e palco; propriedades em drawer. O palco usa o mesmo `BoardRoot` da batalha, com estado fictício isolado.

A barra de prévia dispara apenas demonstrações visuais. Não abre pacote real, não avança turno de uma tentativa e não usa RNG de batalha ou de economia.

### 23.22. O que pode ser personalizado

| Opção | Possibilidades | Limites |
|---|---|---|
| Playmat-base | Presets desbloqueados, favoritos, neutro e importados. | Exibir origem e condição de desbloqueio. |
| Variante | Paleta e ilustração alternativas cadastradas. | Não inventar posse de variantes bloqueadas. |
| Arte | Recorte, foco e deslocamento dentro do template. | Escala proporcional; sem esconder guias. |
| Cores secundárias | Aro, costura e máscaras de acento. | Não recolorir automaticamente cores de Energia. |
| Material | Tecido, fosco e sintético. | Perfis limitados; sem shader arbitrário. |
| Padrão | Geométrico, ondas, linhas, textura neutra. | Opacidade até 0,25 atrás de zonas. |
| Decalques | Até 8 selos locais, nome curto ou emblema. | Somente regiões cosméticas, sem instruções falsas de jogo. |
| Borda | Simples, dupla, costura ou faixa luminosa discreta. | Geometria e área útil invariáveis. |
| Efeito ambiente | Desligado, leve ou padrão. | Nunca partículas contínuas sobre texto. |
| Reação ao ataque | Desligada ou onda curta na superfície. | Sem alteração física ou de regras. |
| Verso / sleeve | Um verso por deck, aplicado às 20 cartas; os 78 sleeves do Pokémon TCG Pocket com a imagem do verso. | Uniforme nas cartas ocultas; não identifica uma carta específica. |
| Moeda | Modelo/face de coleção e material; as 84 moedas do Pokémon TCG Pocket com a imagem da cara (a coroa é derivada dela em prata). | Mesmo resultado e mesmas probabilidades; lançada em todo efeito com moeda de quem a equipou e no cara ou coroa de abertura. |
| Entrada das cartas | Battle flair padrão do preset (`defaultEntryFlairId`) ou por entrada do deck (`deck_entries.entry_flair_id`). | Não muda ataque, dano, tipo ou raridade. |

**Moedas do Pocket na oficina (decisão do autor, 16/10/2026):** a aba **Moeda** de S41/S42 mostra as moedas em grade de três colunas (a face fala mais que o nome) e, no topo do palco, a prévia da moeda escolhida: a face grande, cara e coroa lado a lado e **Lançar a moeda**, que alterna as faces com o giro do lançamento (sem RNG de batalha; parada com movimento reduzido). A moeda do deck é a que ele lança no cara ou coroa de abertura (§22.1) e em todo efeito com moeda dos seus Pokémon (§25.17). Componente `CoinDisc` (`components/coin.tsx`), também usado no Empório e na mesa 2D.

**Sleeves do Pocket na aparência do deck (decisão do autor, 17/10/2026):** o sleeve é o verso de todas as cartas do deck — no baralho, na mão vista pelo rival, nos Básicos virados da preparação e em todo giro de carta, na mesa 3D (`acquireSleeveTexture` com a imagem; `three/card/sleeve-art.ts` carrega os dois decks ao montar a mesa e refaz os versos quando chega) e na 2D (variáveis `--back-human`/`--back-npc` aplicadas pelo `data-anchor` de cada lado). Sem sleeve com imagem, o verso padrão.
- Na ficha do deck (S12), **Acessórios** abre S42 já na aba **Verso** (`?tab=SLEEVE`).
- A aba Verso mostra os versos em grade de três colunas, com a imagem; no topo do palco, a prévia com uma carta de exemplo virada para o verso e **Ver a frente**/**Ver o verso**, que gira a carta (sem giro com movimento reduzido). A mão de exemplo da mesa também usa o verso escolhido.
- **Aplicar a este deck** vale a partir da próxima tentativa, como os outros acessórios. Critério UI-180.

Trocar playmat, verso, moeda e flair é inspirado nas categorias de acessórios da referência. O editor de camadas, importação de imagem, presets globais e limites numéricos são recursos próprios da versão offline. O suporte oficial distingue flair cosmético e de batalha e indica seleção no editor de decks. [V01] [V05]

### 23.23. Acabamento, flair e efeito de ataque não são a mesma seleção

**Acabamento** pertence à impressão da carta: normal, holo, foil ou cromado autoral. **Flair** é um acento cosmético de apresentação equipado. **Efeito de ataque** deriva do ataque e de sua identidade de conteúdo. **Playmat** é a superfície do duelo.

Selecionar “Estrelas” como flair não transforma um ataque de Fogo em ataque de outro tipo. Selecionar um playmat raro não deixa todas as cartas foil. Uma carta de arte alternativa mantém as regras de sua definição.

No editor do deck, expandir as duas cópias permite equipar flair distinto por entrada; a escolha é gravada em `deck_entries.entry_flair_id` da revisão do deck, nunca no preset. Em cartas ocultas, não mostrar esse flair, uma borda exclusiva ou uma textura diferente que denuncie a identidade antes da revelação.

A posse de flair no projeto é um desbloqueio cosmético reutilizável; não consome cartas nem exige Shinedust. Essa economia é própria da campanha.

### 23.24. Presets e precedência

Salvar `CosmeticPreset` com nome, tapete, variante, parâmetros permitidos, verso, moeda e flair padrão (`defaultEntryFlairId`). O preset não guarda flair por cópia: esse dado é a coluna `deck_entries.entry_flair_id` do deck. Aplicar ao deck grava uma referência/revisão confirmada; um rascunho não altera a próxima batalha até ser aplicado.

Precedência no início de tentativa:
1. Aparência explicitamente aplicada ao deck.
2. Aparência padrão do perfil, se o deck usa herança.
3. Preset neutro incluído no build.

O NPC usa um loadout visual do conteúdo do encontro. A arena do capítulo define cenário, não toma a propriedade do tapete do humano. Acessibilidade pode substituir ambos visualmente por neutro.

Na criação da tentativa, congelar as duas aparências em `MatchPresentationSnapshot`. Mudar o deck ou o preset durante uma suspensão vale para a **próxima** tentativa; a atual mantém seu snapshot. Preferências de conforto como volume, velocidade, movimento reduzido e modo neutro aplicam imediatamente.

### 23.25. Fluxo de seleção e gravação

Selecionar item → carregar prévia local → experimentar → confirmar destino → validar posse/parâmetros → gravar preset/deck → mostrar “Aparência salva”.

“Aplicar a este deck” não muda todos os decks. “Usar como padrão” afeta somente os que herdam o padrão nas próximas tentativas. Antes de sobrescrever um preset compartilhado, mostrar os decks afetados.

Cancelar restaura a aparência confirmada. Auto-save pode guardar rascunho separadamente. Falha ao gravar não marca o novo preset como aplicado; o palco pode continuar mostrando a prévia, claramente rotulada como não salva.

Excluir preset referenciado pede confirmação e propõe reassociar decks. Tentativas e replays mantêm seu snapshot e as referências de assets necessárias.

### 23.26. Importar uma imagem local

Recurso autoral avançado, separado dos presets prontos. Aceitar PNG, JPEG e WebP **estáticos**, no máximo 10 MiB por arquivo, dimensão máxima de 4096 px em cada eixo e até 16.777.216 pixels decodificados. Não aceitar SVG, HTML, vídeo, GIF, URL externa ou arquivo executável.

Fluxo: escolher arquivo → validar cabeçalho e dimensões → normalizar orientação → recortar 4:3 → prévia de leitura → confirmar → salvar imagem normalizada e preset local. Transparência é composta sobre uma base opaca escolhida.

Oferecer “Mostrar zonas seguras”, teste de contraste sobre artes claras/escuras e teste com mão cheia; o shell continua claro. Evitar aceitar um desenho como carta jogável por estar impresso no tapete: ele permanece decoração e não recebe hitbox de carta.

Normalizar a imagem remove metadados não necessários e produz uma cópia local. Não modificar o arquivo original escolhido. Explicar que a imagem precisa ser incluída em um backup completo para aparecer em outro dispositivo. Os contratos de validação e portabilidade estão no runtime.

### 23.27. Prévia que realmente testa a batalha

A prévia deve ter os oito slots, HP distintos, quatro tipos de Energia, Ferramenta, duas condições, mão de dez cartas, descarte e duas aparências contrastantes.

Demonstrações: troca de turno/tapete, comprar para mão humana, compra do NPC sem revelar, entrada comum, entrada especial, evolução, ataque, Nocaute e modo de movimento reduzido.

Um preset só é “aprovado visualmente” após testes em 1920 × 1080 e 1280 × 720 com os dois layouts. Não aprovar apenas olhando uma mesa vazia bonita.

### 23.28. Desbloqueio e catálogo inicial

Neutro e Academia são gratuitos. Os seis tapetes de capítulo são disponibilizados no Empório ao vencer o chefe correspondente, por 500 Créditos cada, preservando a economia da campanha. O tapete do final é uma recompensa cosmética única.

Os NPCs podem exibir cosméticos ainda não possuídos pelo humano. A tela “Como obter” mostra capítulo, encontro e custo permanente, nunca uma data de expiração.

Um preview de cosmético bloqueado não permite equipá-lo. A falta de um tapete premium não muda qualquer possibilidade de vitória.

### 23.29. Acessibilidade e falhas

Disponibilizar “Ocultar arte do tapete”, “Reduzir brilho”, “Sem partículas de fundo”, “Sem tremor”, “Fixar meu tapete” e “Manter guias de zona”.

As guias estruturais podem ser sutis no repouso, mas não podem desaparecer no estado de seleção obrigatória. HP, contagens e escolhas continuam em HTML sobre superfícies de contraste estável.

Imagem ausente: neutro e indicação no editor. Modelo da borda ausente: geometria padrão. Cosmético incompatível com a versão: preservar ID no save, aplicar substituto e não apagar posse. Nunca bloquear um capítulo por falha cosmética.

### 23.30. Critério de fidelidade desta seção

A mesa deve ser reconhecível como um duelo de cartas digitais da mesma família visual do Pocket: duas fileiras de Banco, Ativos centrais, arte inteira de tapete, cartas como protagonistas, entradas breves, ataques com destaque de carta e recursos laterais.

Não satisfaz o requisito uma UI escura apenas recolorida, nem uma imagem de fundo atrás de retângulos HTML sem mesa/cartas Three.js. Também não satisfaz transformar cada ação em um trailer de vários segundos que impede ler o campo.

A comparação é por composição e sequência de estados. Igualdade exata de assets ou curvas do aplicativo original não foi homologada nesta documentação.

---

<a id="interface-24"></a>

## 🖐️ 24. Mão, seleção e manipulação de cartas

### 24.1. Mão própria

Mostrar quantidade e todas as cartas por miniaturas ou leque controlado. Ao focar uma carta, elevá-la sem esconder botões de turno.

Para dez cartas, ajustar espaçamento antes de reduzir demais sua área de interação.

### 24.2. Inspeção

Hover numa carta **da mão** abre uma prévia grande não bloqueante, **centrada na tela** entre o topo da mesa e a mão (decisão do autor, 15/10/2026). Hover numa carta **da mesa** (dos dois lados) não abre prévia: a própria carta sobe em direção à tela, cresce, inclina de frente e flutua de leve até o ponteiro sair; na mesa 2D, ela sobe e cresce por CSS. Clique seleciona de forma persistente; no seu Pokémon, abre a ficha de ações. Toque abre uma prévia com ações explícitas.

Nunca depender exclusivamente de hover para ler regras.

### 24.3. Jogar da mão

Arrastar a carta até o campo é o gesto principal: durante o arrasto, os alvos legais ganham aro (espaço vazio do Banco para Básico, o Pokémon de que evolui, os seus Pokémon para Ferramenta). Item, Apoiador e Estádio mostram a **zona verde translúcida** da região `trainerZone`, no centro da mesa, que acende sob a carta ([gameplay-pocket §6](gameplay-pocket.md#pocket-6)). Selecionar a carta por clique ou teclado realça os mesmos alvos — tocar num deles joga — e, para Treinador sem alvo, revela o botão flutuante “Jogar”; carta bloqueada mostra o motivo. Na mão, a evolução jogável tem contorno amarelo; as outras jogáveis, ciano.

O motor informa zonas ou alvos legais. Soltar em local inválido devolve a carta à mão sem alterar estado e mostra motivo; o Treinador solto fora da zona verde só volta à mão, sem aviso.

### 24.4. Básico

Destacar slots vazios do Banco. Se Banco cheio, a carta continua inspecionável e a ação explica a capacidade.

### 24.5. Evolução

Destacar somente origens compatíveis e elegíveis neste turno. Mostrar o resultado previsto de HP e o dano preservado.

Uma animação coloca a nova carta sobre a pilha; a interface não remove indevidamente Energia ou Ferramenta.

### 24.6. Item e Apoiador

Antes de confirmar, mostrar seletor quando houver escolha. Diferenciar uso simples de uso com custo de descarte.

Para Apoiador, marcar o uso do turno após aceite do comando. Não permitir um segundo clique enquanto a primeira operação está em trânsito.

### 24.7. Ferramenta

Destacar Pokémon elegíveis sem Ferramenta quando essa é a regra. Não oferecer troca livre de anexos como arrasto cosmético.

### 24.8. Estádio

Destacar a região compartilhada e mostrar o que será substituído. Se nome igual ao atual, informar a restrição.

### 24.9. Cartas temporariamente reveladas

Mostrar identidade apenas a quem pode conhecê-la. Quando a regra encerra a revelação, retirar do estado visual corrente; o histórico segue a política autorizada.

Não manter cartas fora da visão autorizada da IA depois de encerrada uma revelação. O save completo continua local; a projeção apresentada e a observação do bot são filtradas.

### 24.10. Picking, elevação e gesto

Raycast somente nas malhas interativas do viewport correto. A carta mais próxima visualmente recebe o foco; material decorativo não intercepta. Durante drag, capturar ponteiro, elevar a representação e mostrar slots legais; soltar envia a intenção ao motor.

Click-through é proibido: um clique no modal de ataque não deve também tocar a carta sob ele. `pointercancel`, mudança de orientação ou perda de foco cancelam apenas o gesto não comprometido.

Elevação da carta é feedback visual. Não alterar sua posição lógica na mão antes de a jogada ser aceita e salva.



<a id="interface-animacoes-cartas"></a>

### 24.11. Vocabulário e estados da carta

“Sacar”, “puxar” e “comprar do baralho” representam `DRAW`: mover uma carta do deck para a mão. Isso é diferente de **revelar** uma identidade, **jogar** uma carta no campo, **buscar** uma carta por efeito e **receber** uma carta na coleção.

```text
HIDDEN_IN_DECK
→ DRAW_TRANSIT
→ HAND_IDLE
→ HAND_FOCUSED
→ DRAG_PREVIEW
→ COMMIT_PENDING
→ PLAY_TRANSIT
→ FIELD_IDLE
```

Estados complementares: `REVEAL_FOCUS`, `EVOLUTION_TRANSIT`, `ATTACK_FOCUS`, `RETURN_TRANSIT`, `DISCARD_TRANSIT` e `REMOVED`.

São estados de apresentação, não novas zonas de regras. Uma carta pode já estar na mão do motor e ainda estar voando visualmente para ela. Durante esse intervalo, a UI não aceita uma jogada sobre uma posição visual antiga.

Cada animação abaixo usa os tempos centrais da [seção 36](#interface-motion-timing). As fases internas, quando existem, vêm somente de [motion-choreography.json](examples/motion-choreography.json); esta seção descreve o que cada fase mostra, sem repetir percentuais ou milissegundos de fase.

### 24.12. Distribuir as cinco cartas iniciais

A pilha existe antes de distribuir. Para o humano, cinco cartas saem em sequência com espaçamento curto; passam do verso à frente e assentam na mão. O atraso escalonado pode sobrepor trajetórias, mas a ordem final é determinística.

O NPC recebe cinco versos, sem brilho específico de raridade. Não deduzir a carta do NPC pela duração, som, número de partículas, verso individual ou cor de uma borda.

Ao final, abrir instrução de seleção do Básico. A mão está pronta antes de habilitar confirmação de campo. Em retomada, reconstruir as cinco cartas e as escolhas atuais diretamente; não distribuir de novo.

### 24.13. Comprar uma carta no turno humano

**Origem:** âncora `HUMAN_DECK_TOP`. **Destino:** `HUMAN_HAND`, na posição de inserção após as cartas existentes. **Duração-base:** `DRAW_SELF`.

Fases, na ordem e com os tempos de `DRAW_SELF` em [motion-choreography.json](examples/motion-choreography.json) (fonte única):

| Fase | Movimento | Informação |
|---|---|---|
| `LIFT` | Carta separa-se da pilha e sobe levemente. | Verso uniforme. O contador segue o evento visual. |
| `TRAVEL` | A carta vai ao centro da mesa crescendo, ainda de verso. | Apenas a carta comprada, sem mostrar a próxima. |
| `REVEAL_TO_OWNER` | Rotação no centro revela a frente ao observador autorizado. | “Comprou 1 carta”, sem chamar cada compra de prêmio raro. |
| `PREVIEW_CENTER` | Prévia grande no centro por ~0,3 s ([gameplay-pocket §5.2](gameplay-pocket.md#pocket-5)). | Sem anúncio de raridade. |
| `SETTLE` | A carta desce até a ponta direita da mão e encaixa; demais cartas abrem espaço. | Ações são reavaliadas após reconciliar a apresentação. |

O efeito é um movimento de papel rígido com espessura, sombra e inclinação breve, não um giro completo gratuito. Uma carta foil revela seu acabamento de forma discreta, sem interromper cada compra com uma cena imersiva.

A identidade não deve piscar espelhada durante o flip. A arte está na face frontal e o sleeve na posterior; mostrar a borda quando estiver de perfil.

### 24.14. Compra do adversário

**Origem:** `NPC_DECK_TOP`. **Destino:** `NPC_HAND_ENTRY`, no leque compacto de versos. A carta permanece de costas durante toda a trajetória, inclusive em pausa, inspector, replay com visão humana e movimento reduzido.

O contador público de mão cresce, o do baralho diminui, e a nova posição visual recebe um identificador opaco da projeção. Não associar efeitos de entrada, foil ou nome da definição oculta à representação pública.

Não aplicar um “flip de carta genérico” na compra de ambos os lados. O contrato de visibilidade é parte do evento apresentado.

### 24.15. Comprar várias cartas e não conseguir comprar

Para compra de N cartas, escalonar saídas e agrupar som/indicador: `DRAW_BATCH` cobre de 2 a 5 cartas; acima de 5, lotes sequenciais de até 5 (ver [mapa evento → preset](#interface-event-preset-map)). Mostrar cada frente humana brevemente em tamanho de mão, sem N modais consecutivos. A velocidade Rápida reduz o atraso; Instantânea recompõe a mão de uma vez.

Se a regra só comprou duas de três por capacidade, animar duas. Se comprou zero por baralho vazio ou mão cheia, não gerar uma carta fictícia que voa e desaparece. Mostrar o motivo apenas quando necessário, conforme a política de gameplay.

Busca no baralho não usa uma animação que implique conhecer a posição da carta buscada. Após seleção autorizada, apresentar a carta conforme a visibilidade do efeito e embaralhar visualmente apenas se houve evento de embaralhamento.

### 24.16. Repouso e foco na mão

Em repouso, leque pequeno e regular, com inclinação máxima aproximada de ±8°. Não balançar cada carta sem parar. Em dez cartas, as cartas se sobrepõem para caber na largura da mão, preservando uma faixa clicável por carta, e “Expandir mão” fica disponível.

Hover ou foco eleva **no máximo 24 px** e aumenta a escala **no máximo até 1,15**, em `UI_HOVER`; a carta focada é desenhada em `CardTransitScene` e pode ultrapassar a altura do viewport da mão sem corte. Uma inspeção detalhada usa o palco próprio em vez de crescer indefinidamente. A carta focada fica por cima visualmente, mas não passa a ser a última carta do estado lógico.

Usar um intervalo breve antes do tooltip, para não trocar rapidamente o inspector ao atravessar a mão. Navegação por teclado produz o mesmo estado de foco. Seleção persistente tem contorno e nome; hover não confirma jogada.

### 24.17. Arrastar da mão para o campo

Ao iniciar drag, capturar o ponteiro, criar uma representação transitória e manter um espaço reservado na mão. Elevar a carta acima do tapete, sem colisão física com outras cartas. Destinos legais ganham aro; inválidos não.

Ao passar perto de um destino, exibir encaixe visual suave, mas não mover a entidade lógica. Soltar envia comando com IDs. Enquanto persiste, a carta pode ficar suspensa sobre o alvo, com indicação breve de confirmação; não exibir entrada definitiva antes do commit.

Rejeição: soltar no campo fora dos alvos realçados nega — a carta treme no ponto da soltura com aro vermelho (~280 ms), volta à mão em curva curta de 200 ms (`UI_DRAG_RETURN`) e o motivo aparece entre os Ativos (“Coloque no seu Banco”, “Solte sobre o Pokémon que vai evoluir”, “Banco cheio”…). Soltar de volta na mão cancela sem aviso. Cancelamento antes do commit não consome carta. `pointercancel` ou perda de foco após o commit não desfaz a ação; reconstruir a partir do resultado confirmado.

A carta em trânsito precisa atravessar a borda entre viewport da mão e viewport da mesa sem desaparecer. O runtime especifica o palco de trânsito compartilhado.

### 24.18. Colocar um Básico

Da mão humana: a frente já é conhecida; não virá-la artificialmente para esconder e revelar de novo. Ela viaja até o Banco escolhido, corrige inclinação e assenta com sombra de contato, aro curto e som leve.

Da mão do NPC: sai um verso; a identidade se torna frontal quando a jogada pública é apresentada. Mostrar nome legível por meio do inspector contextual ou faixa curta, não obrigar um modal.

Ao final, HP e anexos aparecem ancorados à entidade. A mão fecha o espaço e o slot perde a aparência de vazio. O flair equipado começa **no contato com o campo**, não no início do arrasto, para não disparar durante tentativas canceladas.

### 24.19. Aparição comum, especial e flair

| Perfil | Aparição | Limites |
|---|---|---|
| Comum | Contato, sombra, aro baixo e 6–12 partículas discretas. | Sem corte de câmera. |
| Especial | Curta sustentação, reflexo da moldura e aro um pouco mais forte. | Mesmo tamanho final, até 250 ms adicionais. |
| Battle flair equipado | Padrão escolhido: estrelas, anéis, folhas, faíscas, ondas ou hexágonos. | Contido à vizinhança da carta e ao orçamento gráfico. |
| Movimento reduzido | Assentar + contorno/fade curto. | Sem espiral, aproximação ou tremor. |

Esses são presets autorais de apresentação. Não afirmar que “todo ex do Pocket gira duas vezes” ou que determinado tempo é oficial.

Duas camadas no máximo: entrada-base e um flair. Acabamento de superfície não conta como emitter adicional. Flair de evolução ou promoção pode reutilizar uma variante curta; não reproduzir tudo de novo ao fazer hover, redimensionar ou restaurar a cena.

### 24.20. Evoluir

Selecionar a evolução mostra origem válida, HP máximo futuro e dano preservado. Depois do commit, a carta nova aproxima-se de cima, alinha bordas e cobre a anterior. Um contorno acompanha a silhueta e um reflexo sobe pela arte.

A carta antiga permanece na pilha, representada por borda/espessura ou marcador de quantidade. Não enviá-la ao descarte para simular “transformação”. Energia e Ferramenta acompanham a entidade; rótulos são reposicionados sem desaparecer permanentemente.

A apresentação pode usar um destaque curto para uma evolução especial, mas não executa uma cura inexistente. Mostrar “Evoluiu” e atualizar HP remanescente a partir do dano preservado, nunca preencher toda a barra e depois subtrair novamente por estética.

### 24.21. Itens e Apoiadores

A carta sai da mão e entra em uma área de resolução temporária, acima ou ao lado do centro do campo. Nome e texto curto do efeito ficam legíveis. Seleções obrigatórias usam o modal semântico; a animação espera no ponto seguro.

Item: aparição compacta, efeito específico e trajeto até o descarte. Apoiador: destaque um pouco maior com faixa de nome e marcador “Apoiador usado”. Não desenhar o Treinador como um Pokémon permanente no Banco.

Na jogada do NPC, revelar somente a carta efetivamente usada e alvos públicos. Se o efeito consulta o baralho adversário secretamente, mostrar “Buscando carta”, não uma galeria com todas as opções.

### 24.22. Ferramentas e Estádios

Ferramenta: da área de resolução até um encaixe ao lado/aba do Pokémon. Ao concluir, um ícone ou miniatura indica a ligação. Não esconder metade da arte da criatura sob uma carta do mesmo tamanho.

Estádio: destaque central breve, indicação do anterior substituído e atualização do emblema compartilhado. O Estádio anterior segue para o descarte correto. **Jogar Estádio não substitui o playmat cosmético**.

Um efeito visual ambiental associado ao Estádio pode colorir levemente a faixa central, nunca falsificar os parâmetros do tapete ou transformar seu cenário em requisito de regra.

### 24.23. Revelações públicas e privadas

Toda revelação declara observador, entidades, finalidade, duração de acesso e destino final. Mostrar a frente apenas na projeção autorizada e pelo período permitido.

Para revelar carta da mão adversária por efeito: sair visualmente do leque até a área de revelação, virar, apresentar, depois recolher de acordo com o evento. Ao voltar a uma zona oculta com reordenação/embaralhamento, não manter uma marca que permita segui-la.

Histórico pode registrar uma informação legitimamente revelada; isso não autoriza rastrear sua posição atual depois de uma operação que a tornou desconhecida. Em Replay, separar “Visão da partida” de um eventual modo analítico explicitamente habilitado após o fim.

### 24.24. Embaralhar, devolver e descartar

Embaralhar: movimentar pequenos grupos visuais de versos, sem expor a ordem final ou usar uma simulação física para reordenar o domínio. A duração é limitada, mesmo para baralho cheio.

Devolver à mão: retirar da posição, eliminar efeitos removidos pelas regras, mover para o proprietário e esconder/revelar conforme observador. Pilhas evolutivas respeitam os destinos individuais definidos no evento; não criar um único sprite que omite cartas inferiores.

Descartar: trajeto curto ao descarte correto e atualização de seu topo. Distinguir descarte de Nocaute pela ausência de prêmio/pontos e pela ausência do anúncio de derrota da criatura.

Retorno de várias cartas pode agrupar movimento, mas a lista de resultados deve explicar excedentes, destinos e quantidades. Não deixar uma carta “presa no ar” quando o motor a enviou ao descarte por limite da mão.

### 24.25. Suspensão, falha e consistência

Toda coreografia tem pose inicial, pose final, recursos temporários e regra de finalização. Em Pular, ir à pose final sem executar outra ação de domínio. Em Pausa, suspender o relógio de apresentação e a aplicação da IA.

Após crash/context loss, não é obrigatório retomar o movimento no mesmo milissegundo. É obrigatório reconstruir **o mesmo estado confirmado**, preservar decisões e não revelar informações extras.

Um efeito que falha em carregar não impede a carta de entrar no campo. Usar base neutra e continuar com nome, alvo e resultado reais.

---

<a id="interface-25"></a>

## ⚡ 25. Ações de turno, Energia, ataque e Recuo

### 25.1. Painel de ação

O painel direito muda conforme seleção, mas sua posição é estável.

Sem carta selecionada, mostra Energia disponível, resumo de permissões e “Finalizar turno”.

Com Ativo selecionado, mostra ataques, Habilidade quando aplicável e Recuo.

### 25.2. Energia

Mostrar slot atual e previsão seguinte com rótulos. Energia atual pode ser selecionada e ligada por clique em alvo.

Se a ligação manual já foi usada, mostrar “Energia manual utilizada neste turno”. Efeitos de cartas que ligam Energia continuam aparecendo por suas próprias ações.

Não confundir “sem Energia pronta” com “nenhum ataque pode ser realizado”.

### 25.3. Ataques

Lista com nome, custo, dano-base ou fórmula e estado: disponível ou bloqueado com motivo.

Quando possível sem informação oculta, mostrar uma previsão de dano com componentes. Quando houver moeda, exibir faixa ou possibilidades, não um valor definitivo inventado.

Ataques de evoluções anteriores que uma regra concedida libera (Ferramenta ou Habilidade que permite usar os ataques das cartas de baixo da pilha, como Luz da Memória) entram na ficha de ações depois dos ataques do topo, com o nome da carta dona em “· <carta>” (“Soco Saca-Rolhas · Timburr”). A linha usa a ação legal com `sourceCardId` da carta de baixo; sem a regra concedida, a linha não aparece.

### 25.4. Declaração

```text
Selecionar ataque → escolher alvos/custos quando necessário
→ revisar consequência → confirmar → aguardar aceite
→ apresentar resolução → fim de turno
```

Ataque simples sem escolhas pode usar confirmação compacta. A preferência “confirmar ataques” deve ser respeitada, mantendo proteções para ações complexas.

### 25.5. Moedas

Apresentar quantas moedas fazem parte da resolução e o resultado registrado. Animação pode ser acelerada ou pulada.

Não permitir repetir moeda por clicar novamente.

### 25.6. Recuo

Abrir seletor de Energia a descartar e de novo Ativo. Mostrar custo efetivo e quantidade paga.

Se o custo for zero, ainda indicar que o Recuo normal do turno será usado.

Sono, Paralisia ou outras proibições aparecem como motivo. Trocas por carta usam outro fluxo e não herdam o custo automaticamente.

### 25.7. Habilidades

Ativáveis aparecem com ação. Contínuas mostram estado e alcance, sem botão de “usar” fictício. Disparadas aparecem no histórico quando resolvidas.

Uma Habilidade que encerra o turno recebe aviso explícito na confirmação.

### 25.8. Finalizar

“Finalizar turno” deve ser distinto de “Atacar”. Um aviso opcional pode lembrar Energia pronta ou ação básica disponível, mas não obrigar o jogador a usar tudo.

A preferência de aviso pode ser desativada. Nunca bloquear uma passagem legal porque a interface acha a decisão ruim.

### 25.9. Decisões do adversário

Quando um efeito exige escolha do outro jogador, mostrar “IA escolhendo”. O jogador atual não pode ocupar essa decisão.

O próprio jogador pode inspecionar informações públicas enquanto espera, sem executar ações incompatíveis.

### 25.10. Energia e ataque no 3D

A Energia disponível pode ser uma ficha 3D na lateral da mesa, com botão equivalente no HUD. O alvo legal é identificado por ID; animação move a ficha até o anexo correto.

Previsões de dano usam apenas informação conhecida e indicam aleatoriedade. Raycast, distância entre cartas e uma moeda renderizada não entram na fórmula de dano.

### 25.11. Velocidade de apresentação

Oferecer Normal, Rápida e Instantânea para resolução visual. As três preservam decisões obrigatórias, ordem dos eventos e resultados. Instantânea não significa que o bot joga durante uma pausa.



<a id="interface-animacoes-combate"></a>

### 25.12. Gramática visual das lutas

Toda resolução ofensiva deve responder visualmente a cinco perguntas: **quem agiu, qual ataque foi usado, qual foi o alvo, o que mudou e quem joga depois**.

```text
Ataque confirmado e salvo
→ destaque da carta / nome do ataque
→ moedas ou escolhas pertinentes
→ preparação visual
→ trajetória ou efeito no alvo
→ impacto / prevenção / dano
→ efeitos posteriores
→ Nocautes e pontos
→ promoção obrigatória, se existir
→ fim de turno e checkup
```

A ordem é adaptada aos eventos verdadeiros. Não mover uma moeda de Confusão para depois do dano só porque combina melhor com a animação.

A apresentação padrão usa a carta como fonte do ataque, conforme o destaque ampliado mostrado no material oficial. [V04] Não exige um modelo tridimensional da criatura.

### 25.13. Destaque do ataque

A representação visual da carta Ativa sobe para um palco de destaque, inclina-se aproximadamente 6–10° e recebe uma faixa com **nome do ataque** e, em segundo plano, nome da carta. Escurecer discretamente o fundo, mantendo pontos e opção de pausa legíveis.

O slot de origem mantém uma silhueta/reserva e os anexos, evitando a impressão de que a criatura deixou o campo. A cópia de apresentação não recebe hitbox de entidade adicional.

Uma passagem curta de luz destaca arte ou moldura, sem lavar o texto. Em cartas especiais pode haver brilho mais rico, mas o tempo máximo é controlado. Na volta, a carta assenta na mesma entidade e posição.

No modo Rápido, usar uma faixa compacta ao lado da origem. Em Instantâneo, nome e log substituem a cut-in; nenhuma escolha obrigatória é automaticamente respondida.

### 25.14. Preparação, trajetória e impacto

Preparação: pequena retração da carta/aro e acúmulo de luz; trajetória: um traço, arco ou conjunto curto de partículas ligando fonte e alvo; impacto: pulso localizado e número de dano.

Não mover permanentemente o Ativo até o outro lado da mesa. Um avanço visual curto retorna ao mesmo transform-base. Ataques que afetam o Banco apontam para o Banco real, não para o Ativo por hábito de animação.

O efeito não calcula acerto por colisão. Mesmo que uma partícula não alcance o alvo devido a baixa qualidade, dano e resultados permanecem os do evento.

### 25.15. Identidades de efeito por família

| Família visual | Preparação | Trajeto / impacto | O que evitar |
|---|---|---|---|
| Incolor / físico | Compressão curta do aro. | Onda branca suave, risco e pulso. | Soco de um modelo humano ou explosão de tela inteira. |
| Planta | Pequenas folhas e curva verde. | Folhas/traços que terminam junto ao alvo. | Cobrir os três Bancos com vegetação permanente. |
| Fogo | Brasas curtas junto à fonte. | Arco quente, chama estilizada e dissipação rápida. | Tremor constante, tela toda vermelha. |
| Água | Anel líquido baixo. | Faixa translúcida e gotículas. | Refração que torna o texto ilegível. |
| Elétrico | Faíscas segmentadas. | Dois ou três ramos controlados e pulso. | Estrobo ou relâmpago branco em tela cheia. |
| Psíquico | Anéis concêntricos. | Espiral breve, impacto circular. | Distorção sobre HUD, câmera giratória. |
| Lutador | Traços de força. | Onda de choque e poucos fragmentos decorativos. | Deformar o tapete e deslocar as zonas. |
| Noturno | Contorno escuro com borda clara. | Rastro curto e dispersão. | Apagar a carta/alvo em fundo preto sem contraste. |
| Metálico | Reflexo concentrado. | Riscos metálicos e centelha pequena. | Tornar o alvo todo espelhado. |
| Dragão / composto | Motivo próprio cadastrado no ataque. | Combinação restrita de até duas famílias. | Inferir custo, fraqueza ou regra pela cor do VFX. |

O catálogo pode associar um ataque a um `effectProfileId` diferente de seu tipo, desde que não comunique uma condição inexistente. “Mais dano” aumenta moderadamente densidade e intensidade; não aumenta obrigatoriamente a duração em proporção ao número.

### 25.16. Dano, prevenção e cura

Impacto e número devem coincidir. HP semântico é atualizado pelo evento apresentado; durante animação da barra, o valor numérico já comunica o resultado correto e não passa por números fictícios como se fossem vários ataques.

Se houve 0 de dano por proteção, mostrar **Protegido** ou a causa, com resposta de escudo. Não produzir tremor violento e um número de dano positivo que depois some.

Cura: luz ascendente curta e `+N HP` com o valor efetivamente curado. Cura de condição usa nome/ícone da condição removida, não o mesmo `+N`. Um aumento de HP máximo por Ferramenta possui rótulo próprio.

Dano de Veneno, Queimadura, Habilidade ou reação usa sua categoria no log. Não disparar faixa de “Ataque” para cada uma dessas causas.

### 25.17. Moedas dentro de uma resolução

Exibir uma moeda tridimensional com face final já determinada pelo motor. Lançamento com arco, rotação e assentamento; a câmera da mesa continua estável. Texto “Cara” ou “Coroa” e contador das moedas resolvidas ficam em HTML.

A moeda é a equipada no deck de **quem lança** (`COIN_RESOLVED.player`): a do jogador nos efeitos dele, a do rival nos do rival; o lançamento de quem começa, sem jogador, usa a do jogador. A mesa 3D mantém uma `CoinVisual` por lado, com as imagens da cara e da coroa quando a moeda tem arte (carregadas ao montar a mesa; até chegarem, o desenho da paleta). Na 2D, `CoinResult` gira a mesma moeda antes do texto. O véu toma a cor de quem lança. Critério UI-177.

Para N moedas, mostrar a primeira com destaque e as seguintes em sequência mais curta. Um painel resume todos os resultados, inclusive quando a apresentação é agrupada. “Até sair coroa” não ganha um limite de regra imposto pelo tempo de animação.

Falha de Confusão: mostrar a causa, devolver foco ao campo e encerrar conforme os eventos. Não tocar a animação de impacto normal se o ataque não aconteceu.

### 25.18. Ligação, movimentação e descarte de Energia

Ligação normal: ficha pronta eleva-se, percorre curva curta e se integra aos anexos. O slot da Zona muda conforme o evento confirmado. Ligação por efeito pode produzir várias fichas, agrupadas por origem e tipo.

Mover Energia: a ficha sai do Pokémon de origem e vai ao destino; não parece ter sido gerada de graça pela Zona. Descartar Energia: ela segue para uma área visual de descarte de recursos ou dissipa com contador, sem virar carta no baralho.

Quando houver escolha de quais Energias pagar, o seletor mostra anexos concretos e fornecimento efetivo. Efeito visual de duplicação de fornecimento não desenha novos anexos falsos.

### 25.19. Recuo, troca forçada e promoção

Recuo normal: apresentar pagamento quando houver, elevar Ativo e substituto e movê-los por trajetórias laterais complementares para evitar cruzamento confuso. Ao terminar, cada um assenta em sua posição nova com os mesmos anexos.

Troca por efeito: a mesma linguagem de movimento pode ser usada, mas sem som/contador de pagamento quando a regra não cobrou. Rótulo indica a carta ou efeito responsável.

Promoção após Nocaute: esperar a escolha quando obrigatória; então mover apenas o escolhido do Banco ao Ativo. Não selecionar automaticamente o primeiro Pokémon para economizar animação. A escolha do jogador é por arrasto ou toque, sem painel (§26.1, [gameplay-pocket §6.2](gameplay-pocket.md#pocket-6)): na mesa 3D, depois de uma soltura no Ativo, o movimento de promoção parte do ponto em que a carta foi solta, não do Banco; se nada for apresentado em 2,5 s, a carta volta ao Banco.

Flair de promoção é uma variante curta. Mover um Pokémon não deve reexibir uma cutscene imersiva ou restaurar contadores de Habilidade.

### 25.20. Habilidades e efeitos contínuos

Habilidade ativada/disparada: destaque breve na fonte, nome e caminho de efeito se houver alvo. Habilidade contínua: ícone discreto e alcance inspecionável; não repetir uma animação completa em cada frame de recalculo.

Uma Habilidade do Banco deve partir daquela entidade. Se a fonte sai do campo mas o efeito já foi criado validamente, o evento preserva a última posição relevante ou usa um ícone no histórico. Não inventar uma fonte ainda viva.

Para Habilidade que encerra turno, a confirmação informa isso e a apresentação não reabilita os ataques ao final.

### 25.21. Condições especiais no campo

Veneno: ícone persistente e acento roxo breve na aplicação; no checkup, dano identificado. Queimadura: ícone de chama e partículas rápidas ao aplicar/verificar. Sono: símbolo de sono estável, sem animação que mova a carta. Paralisia: marcador legível e prazo por turno. Confusão: símbolo de estado e verificação visível ao atacar.

Não aplicar todos os VFX simultaneamente sem hierarquia. Condições coexistentes ficam em uma linha compacta de ícones; o inspector lista os efeitos completos.

Ao remover condição, fazer o ícone desaparecer com indicação curta. Animação de cura de condição não restaura dano acumulado.

**Selos com os ícones do Pocket (decisão do autor, 17/10/2026):** toda carta em campo afetada por uma Condição ou por um efeito temporário mostra o ícone dele, como no Pokémon TCG Pocket (origem em `src/presentation/assets/source/effects`, ícones em `src/presentation/assets/effects`).
- **Onde:** coluna de selos na borda direita da carta, a partir de 30 % da altura — Condições primeiro (Adormecido, Paralisado, Confuso, Envenenado, Queimado), depois um selo por tipo de efeito. Mesa 3D (overlay HTML sobre a carta) e 2D, pelo mesmo componente (`ui/battle/effect-marks.tsx`).
- **Tipos de efeito** (`domain/battle/effect-badges.ts`, `EntityView.effects`): **bloqueio** (não pode atacar, recuar, evoluir, usar ou receber; Habilidades sem efeito); **carta azul** (o jogador não pode jogar Itens ou Apoiadores nem ligar Energia — um selo, no Ativo dele); **escudo** (dano, efeitos ou Condições prevenidos); **▲** e **▼** (modificador a favor ou contra quem o recebe: dano, dano recebido, PS, Recuo, custos); **estrelas** laranja e azul (os demais efeitos, a favor ou contra). Só efeitos temporários (ataques, Treinadores, Habilidades com duração); Ferramentas, Estádio e Habilidades contínuas ficam na própria carta.
- **Ao aplicar:** o ícone estoura grande no centro da carta (escala 0,2 → 1,2 → 1), com um anel e um brilho na cor do efeito, segura e voa para a coluna (~1 s); efeitos que chegam juntos estouram um de cada vez (360 ms de intervalo). Na mesa 3D, o selo entra no passo do `EFFECT_STARTED` e sai no `EFFECT_EXPIRED`; carta coberta ou virada guarda o estouro até voltar à vista. Retomar um duelo não repete estouros.
- **Ao sair:** o selo encolhe e some no lugar (380 ms).
- Cada selo tem o texto em PT-BR (“Não pode atacar”, “−20 de dano nos ataques”, “Envenenado”) como nome acessível e dica; o nome da carta em campo lista os efeitos. Com movimento reduzido, os selos só aparecem e somem.
- Critério UI-181.

### 25.22. Multialvo, reações e simultaneidade

Atacar três alvos: mostrar a origem uma vez e usar trajetórias/impactos paralelos quando o grupo de regras for simultâneo. Os números de cada alvo possuem âncoras próprias. Não somar tudo em um número sobre o Ativo.

Se existem efeitos sequenciais, preservar essa ordem visual. Se há dano reativo no atacante, identificar a fonte da reação; não fazer parecer que o ataque adversário aconteceu fora de turno.

Antes de exibir vitória, terminar o grupo simultâneo e avaliar o resultado terminal confirmado. O anúncio não pode mudar de “Vitória” para “Empate” porque a UI ignorou um Nocaute simultâneo.

### 25.23. Nocaute e concessão de pontos

A carta atingida recebe um pulso curto, perde a elevação de destaque e segue com sua pilha ao descarte correto. Energia/Ferramenta têm seus destinos próprios. Usar fragmentos de luz, não uma explosão que transforma as cartas em objetos perdidos do inventário.

Exibir “Nocaute” e depois os pontos realmente concedidos: uma, duas ou três fichas, conforme evento. O contador preenche até a condição de vitória; não deduzir recompensa pela intensidade do efeito ou pela raridade gráfica.

Não dar pontos por simples descarte ou retorno ao deck. Um cosmético de Nocaute não cria um `POINTS_GRANTED`.

### 25.24. Final da luta

Depois de apresentar todos os efeitos terminais, diminuir a atividade do fundo, preservar a mesa final e abrir Vitória, Derrota ou Empate. Vitória pode acender a borda próxima; derrota usa uma transição sóbria, sem destruir o deck.

A tela mostra objetivos e recibo real. Uma carta-prêmio ou playmat desbloqueado aparece em pedestal/miniatura, mas seu movimento até o inventário não executa crédito adicional.

O botão “Pular apresentação” leva ao resumo daquele resultado. Reiniciar é outro comando e não pode ser disparado pelo mesmo clique que pulou a animação.

---

<a id="interface-26"></a>

## 🧪 26. Efeitos, condições e escolhas especiais

### 26.1. Seletor universal

Uma seleção mostra título, motivo, quantidade exigida, opções elegíveis, contador e confirmar/cancelar quando permitido.

Exemplo:

```text
Escolha 2 Energias para descartar.
Selecionadas: 1/2.
```

Não habilitar confirmação antes da cardinalidade correta.

**Exceção — promoção depois do nocaute (decisão do autor, 16/10/2026):** a decisão `PROMOTE` do jogador com 2 ou mais Pokémon no Banco **não usa este seletor nem o painel de decisão**. A mesa mostra só uma mensagem simples no centro, entre os dois Ativos — “Escolha o próximo Pokémon Ativo” / “Arraste um Pokémon do Banco até o Ativo” (`data-testid="promote-prompt"`, sem capturar o ponteiro) —, os Pokémon elegíveis do Banco **flutuam** e o espaço vazio do Ativo pulsa como alvo; o jogador arrasta um deles até o Ativo, ou toca nele e depois no Ativo. A resposta é o mesmo `RESOLVE_DECISION` com o `entityId` escolhido. Com 1 Pokémon no Banco, a promoção continua automática. Fluxo completo em [gameplay-pocket §6.2](gameplay-pocket.md#pocket-6); as demais decisões continuam neste seletor.

Escolha de modo (`SELECT_MODE`, como a Bolsa de Eevee: “escolha 1”) mostra o texto de cada opção, vindo de `labels` da decisão na visão do jogador, em vez de um identificador como `MODE:0`. Os rótulos seguem a mesma regra de visibilidade das opções: somem quando as opções são ocultas para quem observa.

### 26.2. Cancelamento

Antes de comprometer uma ação reversível, cancelar retorna à seleção anterior. Depois de pagar custo ou revelar informação, só permitir cancelamento se a regra autorizar.

O botão não deve desaparecer silenciosamente; mostrar “Esta escolha precisa ser concluída”.

### 26.3. Busca no baralho

Abrir grade filtrada de opções. Mostrar somente cartas e informações autorizadas. O usuário não ganha a ordem completa do baralho por abrir o seletor.

Se nenhuma opção existir, seguir a regra de falha parcial sem deixar a interface presa.

### 26.4. Dano

Exibir número próximo ao alvo, atualização de HP e registro textual. Dano simultâneo pode animar junto, mas a ordem lógica vem do motor.

Redução, Fraqueza e prevenção podem ser detalhadas no inspector.

### 26.5. Condições

Ícones persistem enquanto o estado existir. Aplicação e remoção têm animações breves.

Para Paralisia, mostrar duração em termos de turno. Para Veneno e Queimadura, indicar dano de checkup. Para Confusão, indicar verificação ao atacar.

### 26.6. Nocaute

Destacar a saída da criatura, remover pilha e anexos para destinos corretos, atualizar pontos e, se a partida continuar, solicitar novo Ativo.

Não mostrar primeiro “Você venceu” para depois processar um dano a si que muda o resultado.

### 26.7. Evolução e HP

A interface pode mostrar `70 → 110 HP máximos`, mantendo o dano existente. Não animar uma cura completa inexistente.

### 26.8. Efeitos globais

Um indicador próximo ao Estádio lista modificadores relevantes. Ao inspecionar ataque ou Recuo, mostrar como esses modificadores alteraram o custo ou dano.

Não exigir que o jogador memorize uma carta global fora da tela.

### 26.9. HUD projetado

HP, condição e dano são rótulos HTML ancorados por projeção da malha; sua fonte mantém tamanho de tela. No renderer, o local do alvo vem do ID da entidade, não de selecionar “o segundo mesh da cena”.

Se a malha ainda não carregou, mostrar placeholder e rótulo na posição de layout esperada. A ação continua identificável e legível.


---

<a id="interface-27"></a>

## ⏸️ 27. Pausa, suspensão e recuperação

### 27.1. Menu de pausa

Opções: Continuar, Regras, Histórico, Áudio, Acessibilidade, Qualidade, Salvar e sair, Reiniciar encontro e Abandonar tentativa.

“A partida está pausada” só aparece quando simulação e aplicação de decisões da IA estão efetivamente suspensas. Resolver antes uma unidade já em commit, sem interromper transação ao meio.

### 27.2. Sair

Salvar e sair preserva campo, mão, decisões, RNG e versão da tentativa. Retornar depois não exige terminar a animação anterior.

Se a escrita falhar, manter a sessão em memória e oferecer nova tentativa, exportação de emergência marcada como não confirmada e retorno ao estado pausado. Novas ações irreversíveis continuam bloqueadas até resolver a falha ou confirmar um caminho de recuperação. Não mostrar “Salvo” falsamente.

### 27.3. Reiniciar

Explicar: “A tentativa atual será encerrada sem recompensa. Você iniciará outra partida.” Em encontros normais, outra mão pode ser gerada; em puzzles o estado preparado permanece o mesmo.

### 27.4. Abandonar

Registra a tentativa sem vitória, não remove coleção e não cobra entrada. Voltar ao mapa mantém objetivos anteriormente conquistados.

### 27.5. Aba oculta

Ao receber estado de página oculta, parar entrada, solicitar checkpoint, suspender IA e efeitos não essenciais. Ao retornar, mostrar Continuar; não retomar uma ação irreversível com o mesmo clique que trouxe foco.

### 27.6. Contexto WebGL perdido

Pausar interação da cena, preservar o domínio e tentar reconstruir. Oferecer “Continuar em 2D” e “Salvar e sair” se a restauração não funcionar. Não converter falha de GPU em derrota.

### 27.7. Sem rede

Não exibir erro quando o computador está offline. Não existe tentativa de reconexão com prazo.

---

<a id="interface-28"></a>

## 🏁 28. Resultado, objetivos e recompensas — S24

### 28.1. Apresentação

Mesa 3D em estado final ao fundo, sem manipulação de cartas. À frente, resumo HTML de vitória/derrota/empate, NPC, dificuldade, turno final e deck.

Três áreas: resumo, objetivos e recompensas. O progresso exibido é do capítulo, não de classificação competitiva.

### 28.2. Concessão

A transação final já registrou resultado, objetivos, Créditos, cartas e desbloqueios. O painel lista “Recebido agora”, “Recebido anteriormente” e “Não cumprido”.

Não mostrar um botão Resgatar para algo já creditado. “Continuar” apenas navega. A animação de uma carta prêmio no pedestal não concede outra cópia.

### 28.3. Próximas ações

Vitória: próximo nó elegível, voltar ao mapa, rever partida, editar deck. Derrota: tentar novamente, ajustar deck, deck de apoio ou voltar. Empate: motivo exato e nova tentativa.

### 28.4. Recompensa com escolha pendente

O resultado pode liberar uma Descoberta. Mostrar “Escolha disponível no mapa”; não fingir que a carta ainda não escolhida já entrou no inventário.

### 28.5. Gravação falha

Enquanto a transação final não concluiu, não mostrar prêmio como definitivo. Oferecer recuperação sem exigir outra vitória. O checkpoint terminal em preparação deve ser tratado conforme o runtime.

### 28.6. Atualização do mapa

Ao voltar, uma animação curta revela o novo caminho e o chefe vencido recebe medalha. Em movimento reduzido, mudar o estado diretamente com texto de confirmação.

---

<a id="interface-29"></a>

## 📜 29. Histórico e replay — S38 e S39

### 29.1. Histórico

Lista com data, modo, adversário permitido, resultado, deck e duração. Filtros por modo, período e resultado.

Abrir uma partida mostra resumo, objetivos e replay quando disponível.

### 29.2. Replay

Mesa semelhante à batalha, mas claramente identificada como reprodução. Controles: reproduzir, pausar, avançar evento, retroceder a checkpoint, velocidade e ir a turno.

Não exibir botões de jogar carta ou conceder recompensa.

### 29.3. Informação oculta

Aplicar a política de visibilidade do replay. Durante uma tentativa ativa, replay completo não pode revelar mão ou compras futuras. Depois de uma partida encerrada contra IA, oferecer visão do jogador ou visão completa explicitamente identificada.

### 29.4. Compatibilidade

Se a versão do motor necessária não estiver disponível, explicar que a reprodução visual não pode ser executada. O resumo textual pode continuar acessível.

Não reproduzir com regras novas que mudam o resultado.

### 29.5. Reprodução sem dependências externas

Reusar `BoardRoot` e eventos registrados; nunca executar novamente concessões de campanha/economia. O replay referencia versões locais compatíveis. Em conteúdo faltante, preservar resumo textual e informar o pacote necessário, sem baixá-lo automaticamente.

O usuário pode apagar replays antigos para liberar espaço, sem apagar medalhas, recibos resumidos ou coleção.


---

<a id="interface-30"></a>

## 📔 30. Caderno de adversários — S29 e S30

### 30.1. Função

Lista de NPCs encontrados, identidade visual, estilo de deck, capítulos, recordes e dicas reveladas. Não é uma rede social. Cada rival aparece com o seu retrato (§5.5); o ainda não encontrado, como silhueta escura do retrato, com “???” e “Ainda não encontrado”.

S29 é a sub-aba “Adversários” de JOGAR e usa a grade de caixas de encontro (§17.1): uma caixa por rival, no tom do capítulo dele (cinza metálico se ainda não encontrado), com nome e título; a caixa abre S30.

### 30.2. Detalhe

Retrato do rival (§5.5) à esquerda, com a origem; biografia curta e estratégia à direita; cartas-chave em inspector. Mostrar “Personagem controlado por IA”.

### 30.3. Ações

Ver encontro original, desafiar na Arena quando já vencido, consultar cartas conhecidas e revisar dicas. Nenhum botão de convidar, adicionar amigo ou trocar.

### 30.4. Informações reveladas

O diário pode mostrar arquétipo e cartas-chave, sem prometer a ordem de compra futura. Listas completas podem ser liberadas depois da primeira vitória para estudo. Não permitir que esse painel controle a observação recebida pelo bot.

---

<a id="interface-31"></a>

## 💾 31. Saves, backup e importação — S31

### 31.1. Visão

Perfis à esquerda, detalhes do selecionado ao centro e ações à direita. Mostrar nome, capítulo, nós concluídos, cartas possuídas, última gravação, versão e existência de duelo suspenso.

Datas são informativas, não validadoras de progresso.

### 31.2. Ações

Retomar perfil, renomear, exportar backup, importar como novo perfil, restaurar backup compatível e arquivar perfil com confirmação.

### 31.3. Exportar


Oferecer **Exportar perfil** (`.campaign-profile.zip`, formato 4) e **Backup completo SQLite** (`.sqlite3`). O primeiro inclui um perfil e dependências; o segundo contém todos os perfis e BLOBs importados. Mostrar claramente o alcance antes de exportar.

Assets distribuídos apenas por referência continuam exigindo o pacote local compatível. A ação permanece disponível com GPU indisponível. Um pacote `.cardpack.zip` não é backup de progresso.

### 31.4. Importar

Selecionar arquivo pelo sistema, validar em staging, mostrar resumo, alcance e diferenças de versão. Não aplicar dados antes de concluir validação. Importar como novo perfil é o padrão.

Substituir o perfil atual exige confirmação que cita o nome e recomenda exportar antes. Não mesclar carteiras, coleções ou tentativas.

### 31.5. Estados

Save válido, formato inválido, versão futura, conteúdo ausente, checksum divergente, limite de tamanho, falta de espaço e jogo aberto em outra aba.

Checksum detecta corrupção acidental; não é selo de anti-cheat.

<a id="interface-second-tab"></a>

**Segunda aba.** Quem não obtém o Web Lock exclusivo do banco mostra “O jogo está aberto em outra aba” e **não abre conexão alguma** com o SQLite — nem somente leitura — nem cria worker de armazenamento. Ações: **Usar nesta aba** e **Fechar**. Usar nesta aba pede transferência cooperativa: a aba antiga suspende a tentativa numa fronteira atômica, conclui a escrita em curso, fecha conexão e worker e libera o lock; só então a nova aba abre o banco e reconstrói as projeções. Se a aba antiga não responde, a nova continua aguardando o lock, sem forçar abertura. Sem Web Locks disponíveis, a execução persistente fica bloqueada com diagnóstico (S50); não há fallback em `localStorage` ou IndexedDB.

### 31.6. Diagnóstico

Mostrar origem local usada, versão do jogo, quota estimada quando disponível e status da persistência solicitada. Explicar que mudar navegador ou origem pode mostrar outro conjunto de dados.

Aviso permanente consultável: limpar dados do site ou usar navegação privada pode comprometer a retenção. Nenhuma dessas telas deve pedir senha de nuvem.

Arquivar preserva bytes e histórico. A opção separada “Apagar todos os dados locais” explica que remove toda a instalação persistida, oferece exportar backup e só executa após fechar as conexões. Não confundir arquivamento com exclusão física.

---

<a id="interface-32"></a>

## 🏪 32. Empório offline — S33

### 32.1. Layout

Abas Pacotes, Cartas dirigidas e Cosméticos. Créditos no cabeçalho. Grade HTML e prévia Three.js do item selecionado. Os itens ficam em colunas de largura igual (mínimo 300 px), sem caixa órfã esticada; na aba Pacotes, cada item mostra a miniatura do pacote e o painel de detalhe mostra a arte grande (`PackArt`, §8.5). Recibos é a sub-aba vizinha da LOJA, não um botão do cabeçalho de S33.

A lista é desenhada em **blocos de 60 itens** (há ~1.850 cartas dirigidas no conteúdo 3.0.0): “Mostrar mais (N)”, com N itens restantes, acrescenta o próximo bloco; trocar de aba ou de filtro volta ao primeiro. Na aba Pacotes, os pacotes ficam agrupados por expansão, com um título antes do primeiro pacote de cada set (set da carta de capa).

### 32.2. Disponibilidade

Desbloqueio por capítulo, sem ofertas que expiram ou dependem de calendário. Preço e quantidade explícitos. Recursos necessários vêm de encontros; não existe botão de comprar Créditos com dinheiro. No conteúdo 3.0.0, só pacotes e cartas dirigidas do Genetic Apex têm trava de campanha; os dos outros sets estão à venda desde o início ([campanha §15.2](campanha.md#campanha-15)).

### 32.3. Cartas dirigidas

Busca por nome e filtros de Expansão (“Todas as expansões” ou um set), raridade (◊…♛, inclusive ✵/✵✵; PROMO não é vendida), tipo/Treinador e “Só disponíveis”, que oculta itens bloqueados e já adquiridos. A barra conta os filtros aplicados e tem “Limpar filtros”; Expansão e “Só disponíveis” valem também na aba Pacotes. Cada item mostra a face pequena, o nome, o preço e o subtítulo “<SET> <número> · <símbolo> · você tem N” (por exemplo, “A3 042 · ☆ · você tem 1”); bloqueado mostra “Após <nó>”. Selecionar mostra a impressão exata e quantidades já possuídas. Compra concede a quantidade descrita sem destruir outra carta.

### 32.4. Cosméticos

Prévia local de sleeve, moeda, deck box ou tapete na mesa 3D. “Experimentar visual” é reversível. “Comprar por X Créditos” confirma o gasto.

### 32.5. Recibos

Cada compra tem operação única. Interrupção após commit leva ao mesmo recibo. Cancelar a prévia não muda saldo.

### 32.6. Identidade

Rotular como “Empório — use Créditos obtidos na campanha”. Não chamar de loja demonstrativa: ela é funcional no universo do jogo, apenas não utiliza dinheiro real.

---

<a id="interface-33"></a>

## 👤 33. Perfil e registros locais — S34 e S35

### 33.1. Perfil

Nome, avatar, deck de destaque, medalhas, objetivos, coleção e estatísticas do save. O painel Identidade traz o seletor de retratos (§5.5); escolher grava `avatar` na hora, com o aviso “Avatar salvo.”, e o novo retrato passa a valer no cabeçalho e na mesa. É só apresentação: não entra no estado nem no hash das partidas. Não existe nome público, autenticação ou exclusão de conta remota.

### 33.2. Medalhas

Exibir troféu 3D selecionado e texto da conquista. Metas não concedem atributos em combate. Uma medalha é desbloqueada por primeira vitória do chefe.

### 33.3. Registros

S35 lista cartas recebidas, operações do Empório, pacotes e desbloqueios, com identificador do recibo. Marcar como lido não altera recompensas.

### 33.4. Métricas

Separar Campanha, Arena e Treino. Exibir números calculados a partir de registros disponíveis, sem inventar taxa de vitória de partidas descartadas.

### 33.5. Retenção

Apagar notificações visuais não apaga o registro mínimo de operações usado para prevenir crédito duplicado. Nenhum aviso possui prazo de resgate de serviço.

---

<a id="interface-34"></a>

## ⚙️ 34. Configurações e ajuda local — S36 e S37

| Aba | Conteúdo |
|---|---|
| Geral | Idioma instalado, confirmações, avanço de diálogo e navegação. |
| Vídeo | Baixo/Médio/Alto, limite de pixel ratio, sombras, foil, efeitos e tela cheia. |
| Câmera | Mesa em foco ou painéis táticos, recentralizar, intensidade de inclinação em inspeção. |
| Mesa e animações | Playmat por turno / próprio fixo / neutro, velocidade Normal/Rápida/Instantânea, confirmações de ataque e prévia de entrada. |
| Áudio | Música, batalha, interface e pacotes. |
| Acessibilidade | Movimento reduzido, texto, contraste, alternativa 2D e leitor de tela. |
| Controles | Clique/arrasto, atalhos e restauração. |
| Dados locais | Saves, exportação/importação, quota, limpar somente recursos regeneráveis. |
| Conteúdo | Versões instaladas, integridade e diagnóstico de arquivos. |
| Ajuda | Regras, Energia, condições, deck e campanha, tudo incluído localmente. |

### 34.1. Aplicação

Preferências de conforto e leitura aplicam sem reiniciar o duelo: qualidade, áudio, movimento reduzido, layout de batalha e modo de exibição do playmat. Alterar essas preferências não muda RNG, relógios lógicos ou dificuldade.

Equipar outro playmat, sleeve, moeda ou flair muda o preset para **a próxima tentativa**. A tentativa atual preserva seu snapshot cosmético; o jogador pode sobrepor a ele o modo Neutro ou fixo por conforto. Não confundir preferência de acessibilidade com editar retroativamente um loadout.

### 34.2. Limpeza

“Limpar cache visual” não apaga SQLite, coleção ou campanha. “Arquivar perfil” é outra ação, com confirmação.

### 34.3. Áudio

Após gesto inicial, habilitar sons conforme preferência. Silêncio inicial não bloqueia jogo. Áudios e músicas são arquivos locais e pausam com a sessão.

### 34.4. Ajuda contextual

Painel no editor explica erros. Painel no duelo explica condições e modificadores. Ajuda de campanha explica desbloqueios e recompensas.

### 34.5. Diagnóstico exportável

Gerar texto/JSON local com versões, erro e ID da tentativa. O jogador decide compartilhar o arquivo; não enviar telemetria automaticamente.

### 34.6. Diagnóstico e recuperação — S50

`#/diagnostics` abre a partir de S48, de Ajustes → Conteúdo e automaticamente quando o boot encontra capacidade ausente. Funciona sem carregar a arena, a cena de batalha ou o catálogo de jogo; quando o problema é o próprio banco, não depende de abri-lo.

Mostra cada verificação de boot com estado e explicação: origem e `crossOriginIsolated`, Worker, WASM, OPFS, Web Locks, WebGL2, manifesto e integridade do pacote, abertura e versão do banco, quota e persistência solicitada, e `renderer.info` quando há contexto gráfico. Ações: exportar o relatório (§34.5), exportar backup quando o banco abriu, tentar novamente, continuar em apresentação 2D quando só o WebGL falhou e limpar cache visual. Nenhuma ação apaga saves; apagar dados continua em S31 com confirmação própria.

---

<a id="interface-35"></a>

## ⌨️ 35. Mouse, teclado, toque e acessibilidade

### 35.1. Princípio

Toda ação executável por arrasto deve ter alternativa por seleção e confirmação. Toda informação de hover deve ter alternativa por foco ou clique.

### 35.2. Atalhos propostos

| Contexto | Atalho | Ação |
|---|---|---|
| Geral | `Tab` / `Shift+Tab` | Navegar controles. |
| Geral | `Enter` / `Espaço` | Ativar controle em foco. |
| Geral | `Esc` | Fechar camada reversível ou abrir menu da partida. |
| Listas e grades | Setas | Mover seleção quando a grade estiver focada. |
| Busca local | `/` | Focar busca, fora de campos de texto. |
| Menus com shell | `Q` / `E` | Aba anterior / próxima, como os bumpers LB/RB ([navegação por abas](#interface-navrail)); fora de campos de texto e modais. A batalha não tem shell, então o `E` dela não conflita. |
| Editor | `Ctrl/Cmd+S` | Salvar a versão, interceptando apenas neste contexto. |
| Editor | `Ctrl/Cmd+Z` | Desfazer alteração local não comprometida em partida. |
| Batalha | `H` | Abrir histórico, fora de entradas textuais. |
| Batalha | `I` | Inspecionar seleção. |
| Batalha | `E` | Selecionar Energia disponível, sem ligar automaticamente. |
| Batalha | `A` | Abrir lista de ataques, sem executar automaticamente. |
| Batalha | `R` | Abrir Recuo, sem pagar automaticamente. |
| Batalha | `Shift+Enter` | Abrir confirmação de finalizar turno. |

Não sobrescrever atalhos do navegador desnecessariamente. Permitir desativar ou remapear atalhos de letras.

### 35.3. Foco

Foco visível em todos os controles. Modais restringem foco temporariamente e devolvem ao ponto de origem.

Mudança de turno não deve roubar foco de um texto de regra em leitura, exceto quando uma decisão urgente e obrigatória requer comunicação.

### 35.4. Leitor de tela

Cartas e ações devem ter descrições estruturadas: nome, HP, condição, custo e disponibilidade.

Canvas ou 3D não substitui uma árvore acessível. Usar camada semântica com controles equivalentes.

### 35.5. Alvos de toque

Alvo mínimo proposto de 44 × 44 px para ações principais. Uma carta pequena pode ter área interativa maior sem sobrepor outra ação.

### 35.6. Contraste e cor

Meta de contraste textual de pelo menos 4,5:1 para corpo. Condições e estados incluem texto/ícone, não apenas cor.

Não declarar conformidade integral com uma norma apenas por adotar esse número; realizar testes de acessibilidade do produto.

### 35.7. Redução de movimento

Desativar paralaxe, tremor, flashes fortes e trajetórias amplas. Manter feedback por realce estático, texto e animações curtas opcionais.

### 35.8. Câmera e mapa

Setas percorrem nós na ordem de navegação. Enter abre briefing. Botão Centralizar é acessível. Um nó fora do enquadramento é trazido à área visível ao receber foco.

### 35.9. Redução de movimento não é ausência de 3D

Desativar orbitagem automática, tremor, parallax, flashes e inclinação involuntária. Manter cenas estáticas com informação legível. A opção de apresentação 2D é separada e explicitamente selecionável.

### 35.10. Save e ações assistidas

Todas as operações de exportar, importar e retomar funcionam sem arrasto ou picking 3D. Uma animação nunca é o único lugar onde o prêmio ou erro é anunciado.


---

<a id="interface-36"></a>

## 🎞️ 36. Three.js, motion, áudio e desempenho

### 36.1. Matriz de apresentação

| Área | Cena 3D | Camada HTML |
|---|---|---|
| Início | Nenhuma cena WebGL própria: deckbox em CSS 3D e artes nas caixas (§7). | Caixas, Continuar e navegação. |
| Campanha | Dioramas e pedestais. | Nós, objetivos e lista equivalente. |
| Coleção / deck | Inspector e acessórios compartilhados. | Grade, filtros, lista e validação. |
| Oficina de aparência | Mesa real com tapetes, versos, moedas e flair em preview. | Biblioteca, controles e gravação. |
| Pacotes | Embalagem, pilha, frente/verso e reflexos. | Confirmação, informações e resumo. |
| Batalha | Mesa, oito slots, cartas, pilhas, Energias, moeda e VFX. | HUD, ações, decisões, histórico e pausa. |
| Resultado | Mesa final e itens recebidos. | Recibo e progresso. |

Um único renderer compartilha essas cenas. A cena completa de batalha não fica rodando escondida atrás de todos os menus.

<a id="interface-motion-timing"></a>

### 36.2. Catálogo canônico de durações

Os tempos abaixo são **defaults autorais de implementação**, não medições do Pocket nem benchmarks. São usados tanto pela UI quanto pelos exemplos JSON em `examples/animation-presets.json`. Alterar um tempo exige atualizar ambas as representações.

| ID | Animação | Normal |
|---|---|---:|
| `BOARD_INTRO` | Entrada da mesa | 900 ms |
| `INITIAL_DEAL` | Distribuição inicial agrupada | 1100 ms |
| `SETUP_REVEAL` | Revelação pública do campo | 650 ms |
| `TURN_BANNER` | Faixa de novo turno | 1000 ms |
| `PLAYMAT_TRANSITION` | Troca de superfície | 600 ms |
| `DRAW_SELF` | Compra única humana | 1100 ms |
| `DRAW_OPPONENT` | Compra única do NPC, sempre verso | 360 ms |
| `DRAW_BATCH` | Compra agrupada, até 5 cartas | 900 ms |
| `PLAY_BASIC` | Entrada comum | 1200 ms |
| `PLAY_SPECIAL` | Entrada especial / flair | 1400 ms |
| `EVOLVE` | Evolução | 780 ms |
| `PLAY_ITEM` | Destaque de Item, sem espera de decisão | 1200 ms |
| `PLAY_SUPPORTER` | Destaque de Apoiador | 1200 ms |
| `ATTACH_TOOL` | Ligação de Ferramenta | 500 ms |
| `PLAY_STADIUM` | Substituição de Estádio | 700 ms |
| `ATTACH_ENERGY` | Movimento de Energia | 420 ms |
| `ABILITY_FOCUS` | Habilidade, sem espera de decisão | 650 ms |
| `RETREAT` | Recuo após seleção e pagamento | 650 ms |
| `SWITCH` | Troca por efeito | 580 ms |
| `PROMOTE` | Promoção após escolha | 520 ms |
| `ATTACK_FOCUS` | Destaque opcional da carta | 700 ms |
| `ATTACK_STANDARD` | Ataque completo, inclui destaque/impacto | 2600 ms |
| `ATTACK_SPECIAL` | Ataque especial completo | 3000 ms |
| `DAMAGE_FEEDBACK` | Número, pulso e barra de HP | 380 ms |
| `HEAL_FEEDBACK` | Cura | 450 ms |
| `STATUS_FEEDBACK` | Aplicar/remover condição | 450 ms |
| `COIN_FIRST` | Primeira moeda | 2400 ms |
| `COIN_NEXT` | Moedas subsequentes | 350 ms |
| `KNOCKOUT` | Saída da pilha Nocauteada | 1500 ms |
| `POINTS` | Apresentação de pontos | 2600 ms |
| `DISCARD` | Descarte sem Nocaute | 420 ms |
| `RETURN_TO_HAND` | Retorno à mão | 520 ms |
| `SHUFFLE` | Embaralhamento visual | 480 ms |
| `PACK_TEAR` | Corte da embalagem | 700 ms |
| `PACK_EXTRACT` | Saída da pilha | 520 ms |
| `PACK_REVEAL` | Revelação de carta normal | 600 ms |
| `PACK_REVEAL_SPECIAL` | Revelação especial | 850 ms |
| `RESULT_TRANSITION` | Entrada do resumo da luta | 850 ms |

**Presets de interface** — `uiPresets` de `examples/animation-presets.json`, fora da contagem dos 38 presets de jogo e sem formar barreira de batalha:

| ID de interface | Uso | Normal |
|---|---|---:|
| `UI_HOVER` | Hover e foco de controles e cartas | 120 ms |
| `UI_DRAWER` | Abrir ou fechar drawer | 200 ms |
| `UI_DRAG_RETURN` | Retorno de arrasto cancelado ou inválido à origem | 200 ms |
| `DUEL_INTRO` | Abertura VS do duelo: faixas do rival e do jogador, retratos com impacto, “VS.” e saudação (§22.1) | 2600 ms |

Esperas de leitura escolhidas pelo jogador, seletores e pausas **não** entram na duração de coreografia.

`ATTACK_STANDARD` e `ATTACK_SPECIAL` são durações compostas: já incluem destaque e feedback do impacto. Não somar `ATTACK_FOCUS` e `DAMAGE_FEEDBACK` novamente ao usar esses presets. Moedas, decisões, efeitos adicionais e Nocautes podem ocorrer em grupos separados.

`DRAW_BATCH` agrupa até cinco movimentos; grupos maiores seguem a mesma regra sem esconder contagem. Pack pode ter quantidade diferente de cinco por produto; o template adapta a pilha.

<a id="interface-event-preset-map"></a>

#### 36.2.1. Mapa evento → preset

Cada evento confirmado do [vocabulário do runtime](runtime-offline-threejs.md#runtime-animation-director) gera passos (`PresentationStep`) com estes presets. Eventos do mesmo grupo de resolução formam **um** passo quando a tabela os junta; nada é somado duas vezes. Só presets do catálogo acima são usados.

| Evento confirmado | Preset | Regra de escolha |
|---|---|---|
| (abertura de tentativa nova) | `BOARD_INTRO` | Antes de `CARDS_DEALT`; não é evento de domínio e não se repete na retomada. |
| (tentativa recém-iniciada: S16, Arena, Treino ou “Reiniciar encontro”) | `DUEL_INTRO` (preset de interface) | Abertura VS em HTML (§22.1), uma vez por tentativa, por cima da mesa; não é evento de domínio, não entra na fila de passos e nunca aparece na retomada. Com movimento reduzido, 1200 ms só com fade. |
| `TURN_STARTED` | `TURN_BANNER` + `PLAYMAT_TRANSITION` | Faixa sempre; transição em paralelo só quando o playmat resolvido muda. |
| `CARDS_DEALT` | `INITIAL_DEAL` | Mãos iniciais dos dois lados; frentes só para o dono. |
| `CARD_DRAWN` | `DRAW_SELF` / `DRAW_OPPONENT` / `DRAW_BATCH` | Uma carta: `DRAW_SELF` (humano) ou `DRAW_OPPONENT` (NPC, sempre verso). Duas ou mais no mesmo grupo: `DRAW_BATCH` em lotes sequenciais de até 5. |
| `CARD_REVEALED` | `SETUP_REVEAL` | Na preparação, todas as cartas do campo num grupo paralelo; fora dela, o mesmo giro só nas cartas reveladas. O tempo de leitura é do jogador. |
| `CARD_HIDDEN` | `RETURN_TO_HAND` ou nenhum | Carta exposta na área de revelação volta à zona oculta com `RETURN_TO_HAND`, já com descriptor opaco; sem representação exposta, só reconciliação. |
| `DECK_SHUFFLED` | `SHUFFLE` | Versos neutros; ordem já resolvida. |
| `POKEMON_ENTERED` | `PLAY_BASIC` / `PLAY_SPECIAL` | `PLAY_SPECIAL` quando a identidade é pública e a impressão tem `finish` ≠ `NORMAL` ou `ruleBox` ≠ `NONE`; caso contrário `PLAY_BASIC`. Flair equipado roda na fase final do preset escolhido. Entrada oculta da preparação usa `PLAY_BASIC` com verso e sem flair. |
| `POKEMON_EVOLVED` | `EVOLVE` | Dano e anexos preservados. |
| `TRAINER_PLAYED` | `PLAY_ITEM` / `PLAY_SUPPORTER` / `ATTACH_TOOL` / `PLAY_STADIUM` | Por subtipo: Item (inclui Fóssil) → `PLAY_ITEM`; Apoiador → `PLAY_SUPPORTER`; Ferramenta → `ATTACH_TOOL`; Estádio → `PLAY_STADIUM`. |
| `TOOL_ATTACHED` | `ATTACH_TOOL` | Mesmo passo do `TRAINER_PLAYED` de Ferramenta do grupo. |
| `STADIUM_REPLACED` | `PLAY_STADIUM` | Mesmo passo do `TRAINER_PLAYED` de Estádio do grupo; não toca o playmat. |
| `ENERGY_ATTACHED` / `ENERGY_MOVED` / `ENERGY_DISCARDED` | `ATTACH_ENERGY` | Mesma trajetória com origem e destino do evento: Zona → Pokémon, Pokémon → Pokémon, Pokémon → descarte. |
| `ATTACK_DECLARED` + `DAMAGE_APPLIED` do ataque | `ATTACK_STANDARD` / `ATTACK_SPECIAL` | `ATTACK_SPECIAL` quando o atacante tem `ruleBox` ≠ `NONE` ou o ataque tem 2 ou mais blocos de efeito; senão `ATTACK_STANDARD`. O impacto do alvo principal está incluído; alvos adicionais do mesmo grupo usam `DAMAGE_FEEDBACK` em paralelo. |
| `ATTACK_DECLARED` sem dano do ataque | `ATTACK_FOCUS` | Falha por Confusão ou ataque só de efeito; os efeitos seguem com seus próprios presets. |
| `ABILITY_TRIGGERED` / `ABILITY_ACTIVATED` | `ABILITY_FOCUS` | Acento na fonte real. |
| `COIN_RESOLVED` | `COIN_FIRST`, depois `COIN_NEXT` | Primeira moeda da resolução com `COIN_FIRST`; cada seguinte com `COIN_NEXT`. |
| `DAMAGE_APPLIED` fora de ataque | `DAMAGE_FEEDBACK` | Checkup, Habilidade, reação ou efeito; categoria no log. |
| `HEAL_APPLIED` | `HEAL_FEEDBACK` | Valor efetivamente curado. |
| `CONDITION_APPLIED` / `CONDITION_REMOVED` | `STATUS_FEEDBACK` | Ícone e acento curto. |
| `POKEMON_MOVED` | `RETREAT` / `SWITCH` / `PROMOTE` | Por `reason`: `RETREAT`, `SWITCH` ou `PROMOTE`. |
| `CARD_DISCARDED` | `DISCARD` | Sem pontos. |
| `CARD_RETURNED` | `RETURN_TO_HAND` | Para o baralho, mesma trajetória até `*_DECK_TOP`, seguida de `SHUFFLE` se houver `DECK_SHUFFLED`. |
| `POKEMON_KNOCKED_OUT` | `KNOCKOUT` | Grupo completo antes dos pontos. |
| `POINTS_GRANTED` | `POINTS` | Depois de todos os Nocautes do grupo. |
| `MATCH_ENDED` | `RESULT_TRANSITION` | Depois da resolução terminal completa. |
| `PACK_OPENING_COMMITTED` | `PACK_TEAR` → `PACK_EXTRACT` → `PACK_REVEAL` / `PACK_REVEAL_SPECIAL` | Uma revelação por carta do recibo; especial quando `rarity` é `RARE`, `ULTRA` ou `PROMO`, ou `finish` ≠ `NORMAL`. |
| `COSMETIC_UNLOCKED` | nenhum próprio | Aparece como cartão no resumo de `RESULT_TRANSITION` (ou na tela que o concedeu), sem segunda concessão. |

**Easings.** Cada fase de [motion-choreography.json](examples/motion-choreography.json) declara `easing` com um dos quatro IDs fixos — `linear`, `easeOutCubic`, `easeInOutCubic` e `easeOutBack` (pico ≤ 1,05) —, definidos na [gramática de movimento](direcao-visual-pocket.md#visual-09). Presets sem coreografia detalhada usam `easeOutCubic` em movimentos e `linear` em fades.

### 36.3. Velocidade, movimento reduzido e skip

| Preferência | Resultado |
|---|---|
| Normal | Durações da tabela. |
| Rápida | Multiplicador 0,55, com piso de 80 ms para transições visuais necessárias. |
| Instantânea | Poses finais imediatas; resultados textuais permanecem disponíveis. |
| Movimento reduzido | Remove giros, tremor, espirais e zoom; usa crossfade de até 150 ms, sem aumentar a duração original. |
| Pular sequência | Conclui até o próximo ponto de escolha obrigatória ou estado estável. |

Textos de resultados não precisam desaparecer no mesmo instante em que o movimento termina. As preferências são ortogonais: Baixo não significa Instantâneo; Rápida não significa desligar leitura; reduzir movimento não impede 3D.

Não acelerar o motor com o mesmo multiplicador do vídeo. Todas as velocidades produzem o mesmo hash de regras e a mesma recompensa.

### 36.4. Hierarquia de efeitos

Prioridade: decisão obrigatória → resultado/dano → ação em curso → indicação de turno → flair → ambiente. Em excesso, remover ambiente e partículas cosméticas antes de simplificar indicadores funcionais.

Uma fonte pode ter acabamento e um flair transitório, não cinco emissores simultâneos. Impactos de multialvo compartilham orçamento. Brilho não atravessa a camada de texto; não usar flashes rápidos de tela cheia.

A opção “Apresentação de vitrine” pode ampliar uma entrada em prévias, mas não vira padrão de todas as batalhas da campanha.

### 36.5. Áudio

Grupos: música, ambiente, interface, cartas, Energia, ataques, moedas e revelações. Controles podem ser agrupados na UI, mas o mixer deve conseguir limitar sobreposição.

Cada cue tem uma chave de reprodução por evento. Restaurar/pular não reproduz novamente sons de ataques já apresentados. Em grupo de compra, reduzir volume por carta e limitar vozes, evitando uma rajada sonora.

Resultado essencial também existe em texto. Sem áudio permitido pelo navegador ou sem arquivo, a batalha continua. Todos os arquivos são locais; não usar geração remota de voz ou som.

### 36.6. Performance e legibilidade

Normal maps e shaders são detalhes, não requisitos de legibilidade. Baixo mantém geometria e cores essenciais, mas remove bloom, reflexos caros e partículas periféricas.

Trocar playmat deve mesclar no máximo duas superfícies/artes ativas. Não manter todas as dezenas de artes na GPU nem reconstruir o contexto a cada turno. Orçamentos completos constam no runtime.

### 36.7. Critérios de acabamento

Sem clipping nas transições mão/mesa; sem textura frontal aparecendo no verso; sem texto espelhado; sem shimmer de planos coplanares; sem cartas duplicadas após skip; sem flare ao restaurar contexto; sem HUD apresentando estado futuro antes do grupo visual correspondente.

A especificação de aparência é detalhada; a homologação visual ainda exige executar a futura aplicação em resoluções, dispositivos e preferências diferentes.

### 36.8. Perfil visual compartilhado

`pocket-light-v1` é obrigatório em todos os modos e telas. O [documento visual](direcao-visual-pocket.md) complementa a tabela de durações com fases de compra, ataque, pontos e revelação. Fogo pode produzir laranja no ataque; isso não autoriza voltar a botões laranja ou fundo preto.

As especificações de milissegundos são metas do projeto, não valores medidos no aplicativo oficial. Os registros RP01–RP09 distinguem observações de adaptações desktop.

---

<a id="interface-37"></a>

## 🏗️ 37. Estado de tela e apresentação local

### 37.1. Camadas

| Dado | Responsável |
|---|---|
| Rota, seleção, modal, filtro | UI. |
| Rascunho/versão do deck | Perfil e persistência local. |
| Nó liberado, objetivos | Campanha. |
| Mão, custo, dano, pontos | Motor. |
| Créditos e cartas | Economia/inventário local. |
| Geometria, material e tween | Three.js. |
| Estado confirmado e recibos | SQLite. |

### 37.2. Comando

```text
Gesto → intenção com ID → validar → resolver
→ salvar → confirmar revisão → projetar estado
→ representar eventos → liberar próxima interação
```

Não usar otimismo para abrir pacote ou conceder prêmio. Rascunhos podem ser otimistas em memória, desde que o indicador de gravação continue correto.

### 37.3. View models

A UI humana recebe visão permitida da partida. A IA recebe outra observação. A existência de um save completo no mesmo dispositivo não justifica entregar todas as informações ao algoritmo de decisão.

`BattleView` contém `matchId`, `stateVersion`, fase, cartas visíveis, contagens ocultas, ações legais, decisão pendente e eventos para apresentação. Não precisa conter malhas ou objetos Three.js.

### 37.4. Renderizador compartilhado

O roteador informa cenas ativas e retângulos de viewport. Painéis HTML possuem prioridade de entrada. Desmontar uma rota libera recursos exclusivos, mantendo cache compartilhado com referências.

### 37.5. Contexto de retorno

```json
{
  "route": "#/campaign/nodes/C02-E06",
  "selectedDeckId": "deck-002",
  "difficulty": "STANDARD",
  "intent": "EDIT_DECK_AND_RETURN",
  "mapSelection": "C02-E06",
  "scrollOffset": 240
}
```

### 37.6. Recursos disponíveis

Não usar flags para “desligar Three.js por enquanto” e declarar a experiência completa. Flags válidas controlam qualidade, replay disponível, laboratório ou conteúdo opcional instalado.

### 37.7. Diagnóstico

Amostras de dados são identificadas como exemplos. O NPC é assumidamente IA; não usar nome e presença inventados para fingir multiplayer.

---

<a id="interface-38"></a>

## 🚶 38. Jornadas completas offline

### 38.1. Primeira sessão

Pacote instalado → abrir localmente → novo perfil → escolher deck de destaque → prólogo → primeira recompensa → mapa.

### 38.2. Preparar um chefe

Mapa → briefing do chefe → objetivo opcional → editor com contexto → salvar → voltar → iniciar → preparação → duelo → resultado → medalha.

### 38.3. Abrir e usar uma carta

Pacotes possuídos → confirmar abertura → commit local → animação Three.js → resumo → inspector → adicionar ao deck → salvar.

### 38.4. Pausar e retomar

Duelo → pausa → salvar e sair → fechar navegador → abrir na mesma origem → Continuar → mesmo campo/mão/decisão.

### 38.5. Receber uma Descoberta

Nó liberado → três cartas reveladas → inspecionar → escolher → confirmar → crédito local → mapa concluído.

### 38.6. Sem sorte suficiente

Perder encontro → dica contextual → deck de apoio ou aquisição dirigida → nova tentativa. Nenhum bloqueio exige esperar 12 horas ou obter uma rara aleatória.

### 38.7. Exportar e recuperar

Saves → exportar → selecionar outro perfil/dispositivo com conteúdo instalado → importar validado → retomar. Coleções não são somadas.

### 38.8. Falha visual

Contexto WebGL perdido → partida suspensa → restaurar ou 2D → continuar do estado confirmado. Mesmo resultado independentemente da apresentação.

### 38.9. Pós-jogo

Vencer final → preservar coleção e história → Arena, domínio de nós e desafios Especialista. Não apagar o progresso ao terminar a campanha.

---

<a id="interface-39"></a>

## 🚨 39. Estados vazios, bloqueios e falhas locais

| Contexto | Estado | Ação |
|---|---|---|
| Boot | Perfil inexistente | Novo jogo ou importar save. |
| Boot | Arquivo obrigatório ausente | Diagnóstico (S50) e reinstalação do pacote, sem criar perfil vazio. |
| Boot | Sem Web Locks, OPFS, Worker ou isolamento exigido | Bloquear execução persistente e abrir S50; sem fallback. |
| Save | Quota insuficiente | Aviso, exportar e liberar apenas recursos seguros. |
| Save | Jogo aberto em outra aba | Tela “O jogo está aberto em outra aba”, sem conexão alguma ao banco; oferecer transferência cooperativa ([segunda aba](#interface-second-tab)). |
| Save | Versão incompatível | Preservar arquivo; não resetar. |
| Campanha | Nó bloqueado | Exibir requisito exato e acesso a ele. |
| Campanha | Tentativa suspensa | Retomar ou abandonar antes de outra. |
| Objetivo | Restrição opcional não atendida | Aviso sem bloqueio de entrada. |
| Deck | Incompleto | Contagem e correção. |
| Coleção | Filtro vazio | Limpar filtros. |
| Pacote | Nenhum possuído | Explicar recompensas/Empório, sem relógio. |
| Abertura | Recibo já confirmado | Mostrar mesmas cartas. |
| Descoberta | Escolha já feita | Mostrar carta recebida, sem nova seleção. |
| Empório | Créditos insuficientes | Preço, saldo e caminho para jogar. |
| Duelo | Comando de revisão antiga | Reconciliar com estado local. |
| Duelo | Decisão obrigatória | Informar quantidade e impedir cancelamento ilegal. |
| IA | Job antigo | Descartar resultado, manter estado. |
| GPU | Contexto perdido | Pausar, restaurar ou continuar em 2D. |
| Asset | Ilustração decorativa ausente | Placeholder legível. |
| Resultado | Commit falhou | Não anunciar concessão definitiva; recuperar. |
| Offline | Internet indisponível | Nenhum erro: comportamento normal. |

Não apresentar “problema de conexão” para falha de arquivo local. Mensagens descrevem impacto e uma saída concreta.

---

<a id="interface-40"></a>

## ✅ 40. Testes de interface e aceitação

| ID | Verificação | Critério |
|---|---|---|
| UI-001 | 1920 × 1080 | Todos os elementos essenciais dentro da área segura. |
| UI-002 | 1280 × 720 | Sem rolagem horizontal da página. |
| UI-003 | 1366 × 768 | Menus e ações legíveis no perfil compacto. |
| UI-004 | Ultrawide | Campo não se espalha além de leitura confortável. |
| UI-005 | Redimensionamento | Estado e seleção preservados. |
| UI-006 | Navegação principal | Uma área ativa inequívoca. |
| UI-007 | Voltar do detalhe | Restaura filtro e rolagem. |
| UI-008 | Editar a partir de desafio | Retorna ao mesmo confronto. |
| UI-009 | Rascunho | Recarregar recupera mudanças. |
| UI-010 | Exclusão de deck | Não remove cartas da coleção. |
| UI-011 | Coleção vazia | Não se confunde com erro de leitura do save. |
| UI-012 | Arte ausente | Nome e ação continuam disponíveis. |
| UI-013 | Carta não possuída | Não pode ser usada indevidamente. |
| UI-014 | Terceira cópia | Motivo do bloqueio visível. |
| UI-015 | Vigésima primeira carta | Não remove outra silenciosamente. |
| UI-016 | Variantes | Limite por nome preservado. |
| UI-017 | Impressão de expansão | Objetivo considera edição exata. |
| UI-018 | Energia manual do deck | Não muda sem consentimento. |
| UI-019 | Auto-build | Exibe proposta antes de substituir. |
| UI-020 | Salvar | Indica rascunho versus versão confirmada. |
| UI-021 | Testar deck inválido | Mostra erros e não inicia. |
| UI-022 | Objetivo opcional incompatível | Não bloqueia batalha válida. |
| UI-023 | Primeiro jogador | Aviso correto sobre Energia, sem proibição absoluta de ataque. |
| UI-024 | Preparação | Confirma apenas com Ativo legal. |
| UI-025 | Preparação privada | Não revela escolha adversária cedo. |
| UI-026 | Mão com dez cartas | Todas acessíveis e inspecionáveis. |
| UI-027 | Arrasto inválido | Retorna carta sem alterar estado. |
| UI-028 | Alternativa ao arrasto | Mesma ação possível por cliques. |
| UI-029 | Condições | Texto e ícones além de cor. |
| UI-030 | Recuo | Mostra custo e Energias escolhidas. |
| UI-031 | Troca por efeito | Não exibe custo de Recuo indevido. |
| UI-032 | Habilidade contínua | Não possui botão falso de ativação. |
| UI-033 | Habilidade que termina turno | Confirmação informa consequência. |
| UI-034 | Ataque com moeda | Não mostra dano definitivo antes do resultado. |
| UI-035 | Ataque e finalizar | Controles claramente distintos. |
| UI-036 | Nocaute simultâneo | Sem banner prematuro de vitória. |
| UI-037 | Decisão do adversário | Aguardando claramente indicado. |
| UI-038 | Seletor obrigatório | Cardinalidade correta e sem escape ilegal. |
| UI-039 | Busca no deck | Não revela ordem proibida. |
| UI-040 | Menu da partida | Pausa real de motor e IA. |
| UI-041 | Retomada local | Restaura estado, RNG e decisão atuais. |
| UI-042 | Clique duplicado | Um comando e uma animação lógica. |
| UI-043 | Pacote interrompido | Mesmas cartas no resultado recuperado. |
| UI-044 | Pular animação | Não altera prêmios. |
| UI-045 | Compra com Créditos | Consentimento explícito, sem pagamento real. |
| UI-046 | Probabilidades | Consultáveis antes do gasto. |
| UI-047 | Resultado | Distingue crédito e resgate. |
| UI-048 | Resgatar todas | Não duplica recompensas. |
| UI-049 | Descoberta confirmada | Uma carta recebida, sem novo sorteio. |
| UI-050 | Importar lista de deck | Mostra faltantes, sem conceder inventário. |
| UI-051 | Relógio do sistema alterado | Nenhum capítulo ou pacote expira. |
| UI-052 | Teclado | Fluxo principal completo sem mouse. |
| UI-053 | Foco em modal | Restrito e restaurado corretamente. |
| UI-054 | Toque | Sem dependência de hover. |
| UI-055 | Leitor de tela | Nome, custo e condição disponíveis semanticamente. |
| UI-056 | Movimento reduzido | Sem perda de informação. |
| UI-057 | WebGL indisponível | Fallback funcional. |
| UI-058 | Áudio desativado | Todo feedback essencial é visual. |
| UI-059 | Campo de texto | Atalhos de letras não disparam ações. |
| UI-060 | Tela cheia negada | Aplicação continua utilizável. |
| UI-061 | Histórico | Filtros não alteram dados da partida. |
| UI-062 | Replay | Não concede novas recompensas. |
| UI-063 | Catálogo divergente | Replay não usa regras incorretas silenciosamente. |
| UI-064 | Feature desativada | Menu não finge funcionamento. |
| UI-065 | Dados de demonstração | Identificados como fictícios. |
| UI-066 | Perfil local | Nenhum envio externo de dados. |
| UI-067 | Aba oculta | Duelo suspenso, sem contagem regressiva. |
| UI-068 | Grade grande | Rolagem estável, com virtualização ou blocos com “Mostrar mais”. |
| UI-069 | Ações destrutivas | Confirmação contextual clara. |
| UI-070 | Partida ativa no boot | Retomada priorizada. |
| UI-071 | Shell durante batalha | Navegação comercial ausente: sem cabeçalho, abas nem sub-abas. |
| UI-072 | Informações ocultas | Não expostas no HUD normal nem na observação da IA; save completo continua local. |

### 40.1. Roteiro mínimo de teste manual

Criar perfil; abrir pacote; inspecionar carta; montar deck; corrigir erro; iniciar desafio; jogar até resultado; ver prêmio já confirmado; voltar ao editor; simular fechamento e retomada; testar teclado e modo compacto.

Capturar as telas principais em 1920 × 1080 e 1280 × 720, além de estados vazios e de erro. Não aprovar somente o happy path.

### 40.2. Campanha e Three.js

| ID | Verificação | Critério |
|---|---|---|
| UI-073 | Início | Continuar é a ação primária. |
| UI-074 | Menus | Não existem rotas sociais/online/premium da v1. |
| UI-075 | Mapa e lista | Mesmos nós, estados e desbloqueios. |
| UI-076 | Picking com sidebar aberta | Seleciona objeto sob o ponteiro no viewport correto. |
| UI-077 | Drag começa no mapa | Diferencia pan de clique. |
| UI-078 | Modal sobre a mesa | Sem click-through. |
| UI-079 | Inspector e palco | Um contexto WebGL compartilhado. |
| UI-080 | Carta girada | Frente, verso e texto não espelhados. |
| UI-081 | Holográfico/cromado | Textos e HP legíveis. |
| UI-082 | Perfil Baixo | Continua com geometria de cartas 3D. |
| UI-083 | Dez cartas na mão em 720p | Todas selecionáveis por mouse e teclado. |
| UI-084 | Final da campanha | Pós-jogo sem perda de coleção. |
| UI-085 | Exportar/importar save | Fluxo completo offline. |
| UI-086 | Novo capítulo nunca visitado | Não solicita asset remoto. |
| UI-087 | Sem internet | Nenhum banner de falha de rede. |
| UI-088 | Falha de gravação | Nunca mostra “Salvo” antecipadamente. |
| UI-089 | Pacote pulado | Todas as cartas do recibo, um crédito. |
| UI-090 | História | Desbloqueia caminho principal sem exigir Especialista. |
| UI-091 | Controles de câmera | Não alteram regras nem RNG. |
| UI-092 | Trocar rota repetidamente | Recursos exclusivos liberados sem quebrar compartilhados. |
| UI-093 | Editor vindo de nó | Mantém capítulo, dificuldade e objetivo. |
| UI-094 | Limpar recursos visuais | Não apaga saves. |
| UI-095 | Atualizar página durante prêmio | Mostra recibo existente, sem repetir concessão. |
| UI-096 | Perda de contexto no chefe | Retoma o mesmo duelo, sem derrota técnica. |



### 🧪 Critérios adicionais da revisão 2.1

| ID | Verificação | Critério |
|---|---|---|
| UI-097 | Mesa em foco | FOCUS_TABLE inicia com inspector/histórico recolhidos e Ativos integralmente visíveis. |
| UI-098 | Painéis táticos | Alternar layout preserva estado, seleção e IDs dos alvos, sem redeal. |
| UI-099 | Oito slots | Bancos e Ativos continuam presentes em 1080p e 720p, inclusive vazios. |
| UI-100 | Pilhas laterais | Deck/descarte humanos à direita e do NPC à esquerda; contadores/controles distintos. |
| UI-101 | Playmat inteiro | Uma única superfície, sem dividir a arte em dois tapetes simultâneos. |
| UI-102 | Alternância por turno | TURN_STARTED muda somente arte/material; cartas, HUD e câmera permanecem estáveis. |
| UI-103 | Decisão do adversário | Responder no turno alheio não troca o playmat nem a faixa de turno. |
| UI-104 | Conforto | PLAYER_FIXED e NEUTRAL entram imediatamente sem alterar lógica ou inventário. |
| UI-105 | Estádio | Animação do Estádio não simula mudança cosmética da mesa. |
| UI-106 | Oficina S41/S42 | Entradas por perfil/deck e retorno ao contexto preservam rascunho e rolagem. |
| UI-107 | Presets | Aplicar, herdar, duplicar e cancelar têm resultados distintos e mensagens claras. |
| UI-108 | Equipar durante suspensão | Mensagem informa que o novo preset vale para próxima tentativa. |
| UI-109 | Produto bloqueado | Permite experimentar, explica desbloqueio/preço e não permite equipar sem posse. |
| UI-110 | Material e leitura | Todas as variantes preservam nome, HP, Energia, alvo e condição sob a mesma iluminação. |
| UI-111 | Imagem customizada | Crop 4:3, prévia de safe zones e restauração não distorcem a arte. |
| UI-112 | Rejeição de arquivo | Formato/tamanho inválidos geram mensagem antes de alterar o preset salvo. |
| UI-113 | Falha de imagem | Playmat neutro e indicação recuperável substituem asset ausente, sem bloquear campanha. |
| UI-114 | Seleção de carta | Hover não consome ação nem dispara novamente flair de entrada. |
| UI-115 | Compra própria | Carta sai do deck, revela-se ao humano e reencaixa na mão mantendo sua identidade. |
| UI-116 | Compra do NPC | Nenhum frame, áudio ou brilho de aquisição revela a carta oculta. |
| UI-117 | Compra múltipla | Contagem e movimentos refletem apenas cartas realmente compradas. |
| UI-118 | Mão com dez | Todas as cartas acessíveis por clique/teclado; leque não cobre ações essenciais. |
| UI-119 | Arrasto sem commit | Cancelar gesto ou alvo inválido retorna à mão sem flair ou consumo. |
| UI-120 | Entrada de carta | Flair ocorre depois do aceite e uma vez por evento, mesmo com mensagem repetida. |
| UI-121 | Evolução | Nova carta assenta sobre pilha, com dano e anexos corretos e sem cura visual falsa. |
| UI-122 | Revelação temporária | A identidade aparece apenas durante a autorização; não pode ser rastreada após shuffle. |
| UI-123 | Destaque de ataque | Carta e nome aparecem no cut-in sem permitir interação com uma cópia fictícia. |
| UI-124 | Impacto | Origem/alvo/tipo corretos; zero, redução, cura e Nocaute não usam feedback contraditório. |
| UI-125 | Moedas | Animação termina na face persistida, sem oferecer reroll pela UI. |
| UI-126 | Nocautes simultâneos | Saídas/pontos são apresentados como grupo antes de banner terminal. |
| UI-127 | Velocidade | Normal/Rápida/Instantânea terminam na mesma projeção e não fecham decisão pendente. |
| UI-128 | Movimento reduzido | Sem tremor, zoom brusco ou flashes; toda informação permanece consultável. |
| UI-129 | Pausa no impacto | Pausa congela apresentação; retomar não duplica dano, som de prêmio ou ação da IA. |
| UI-130 | Revelação de pacote | Rasgo/extração/revelação/summary usam o mesmo recibo, inclusive ao recarregar. |
| UI-131 | Fixture da oficina | Prévia cheia e ataque de teste não alteram a partida suspensa nem recompensas. |
| UI-132 | Navegação acessível | Oficina e seleção de flair funcionam sem arrasto e preservam foco ao fechar. |

São critérios planejados de implementação, não resultados de execução de uma aplicação neste pacote.

### 🧪 Critérios adicionais do conteúdo 3.0.0

Os critérios UI-133…UI-154 estão em [gameplay-pocket.md](gameplay-pocket.md); a numeração continua aqui.

| ID | Verificação | Critério |
|---|---|---|
| UI-155 | Pacotes por expansão | S04 agrupa o catálogo por expansão e mostra o tamanho de cada pacote (“4 cartas por abertura”, “5 cartas por abertura (+1 em 8,330% dos pacotes)”). |
| UI-156 | Taxas por símbolo | S05 de pacote dos sets novos mostra símbolo × posições (com “6ª” quando houver) em três casas no formato pt-BR, as linhas do pacote raro e da 6ª carta e as cartas agrupadas por símbolo. |
| UI-157 | Deluxe, raro e 6ª carta | Deluxe revela quatro cartas; pacote raro mostra “Pacote raro!”; a 6ª carta é a última e leva “6ª carta”; tudo vem do mesmo recibo. |
| UI-158 | Listas em blocos | Empório e editor de deck (60) e coleção (120) desenham em blocos com “Mostrar mais (N)”; mudar um filtro volta ao primeiro bloco. |
| UI-159 | Expansão na coleção | Com Expansão escolhida, a grade mostra a impressão daquele set e raridade, número e ordenação só consideram esse set. |
| UI-160 | Filtros do Empório | Expansão, raridade e “Só disponíveis”; subtítulo “<SET> <número> · <símbolo> · você tem N”; pacotes agrupados por expansão. |
| UI-161 | Comparar versões | “Comparar com” lista primeiro as outras versões do mesmo nome e depois as demais cartas. |
| UI-162 | Como obter | Cada pacote elegível mostra a chance por pacote com três casas decimais. |
| UI-163 | Escolha de modo | Decisão `SELECT_MODE` mostra o texto de cada opção a quem decide. |
| UI-164 | Ataque de evolução anterior | Ataque liberado da carta de baixo aparece na ficha com “· <carta>” e usa a ação com `sourceCardId`. |
| UI-165 | Oito iniciais | A criação de perfil oferece os oito decks iniciais; todos são concedidos e a escolha só define o favorito. |
| UI-166 | Tema do pacote | Cada pacote real abre no cenário 3D do capítulo de mesma temática; o tema não altera o resultado. |

### 🧪 Critérios adicionais do conteúdo 3.1.0

| ID | Verificação | Critério |
|---|---|---|
| UI-167 | Abertura VS | Tentativa recém-iniciada abre, antes da preparação, com faixa vermelha do rival por cima e azul do jogador por baixo, os dois retratos, “VS.”, os nomes e a saudação do rival; some sozinha em `DUEL_INTRO` (2600 ms; 1200 ms só com fade em movimento reduzido); entrada bloqueada e IA parada enquanto aparece; retomar um duelo suspenso não a repete; igual em 3D e em 2D. |
| UI-168 | Avatar por retrato | S02 e S34 escolhem o avatar entre os retratos agrupados por treinador e gravam `portrait:<arquivo>`; todo rival tem retrato; placas, “+1 ponto!”, abertura VS, cabeçalho, S16, S29/S30 e Arena desenham o retrato inteiro, sem contorno, sombra nem fundo; valor antigo, ausente ou sem arquivo resolve para o retrato padrão. |
| UI-169 | Bolas de Energia | Energias ligadas, orbe pronto da Zona, próxima Energia (esmaecida, com aro branco) e voo da ligação usam a bola do tipo nos oito tipos geráveis, em 3D e em 2D; Incolor e Dragão e os custos de ataque continuam com o ícone de tipo. |

### 🧪 Critérios adicionais dos menus em caixas (16/10/2026)

| ID | Verificação | Critério |
|---|---|---|
| UI-170 | Abas no topo | Sem rail lateral; cabeçalho com Saves, Ajuda e Ajustes como ícones e menu do perfil; cinco abas (Início, Jogar, Coleção, Loja, Criar) com a ativa inequívoca; toda rota com shell ativa a sua aba e a sua sub-aba ou é utilitário, sem aba ativa; sub-abas só apontam para rotas existentes, sem repetição; Q/E vão à aba anterior/próxima, fora de campos de texto e modais; até 760 px de largura, as abas viram barra embaixo. |
| UI-171 | Hubs em caixas | Entrada (S48), Início (S03), Jogar (S14), capítulos da Campanha (S19), Desafios (S15), Arena (S18) e Adversários (S29) em caixas `MenuTile`: a caixa inteira é um botão com nome acessível, hover/foco com aro branco e brilho azul (só o aro em movimento reduzido), bloqueada anuncia o motivo e não navega; CONTINUAR do Início recebe o foco sem rolar; nenhuma tela com shell tem rolagem horizontal em 1920 × 1080 e 1280 × 720. |
| UI-172 | Promoção por arrasto | Nocaute do Ativo do jogador com 2+ Pokémon no Banco: sem painel de decisão nem Finalizar turno; mensagem simples no centro, entre os Ativos; elegíveis do Banco flutuando (sem balanço em movimento reduzido) e Ativo vazio pulsando; arrastar um até o Ativo promove esse Pokémon, soltar fora devolve ao Banco; sem arrasto, tocar no Pokémon (de novo desfaz) e depois no Ativo; em 3D e em 2D. |
| UI-173 | Arte oficial dos pacotes | Os 15 pacotes de expansão mostram a frente oficial do booster em S04, S05, S33, na caixa PACOTES do Início e na frente do pacote 3D do S06 (tira superior com a faixa do logotipo), também no fallback sem WebGL; pacote tutorial, Promo-A e Promo-B seguem com a arte gerada. |
| UI-174 | Mesa em arena no estilo do Pocket | Círculo grande no centro de espelho que envolve os dois Bancos, com a metade do adversário em coral e a do jogador azul-clara, aro branco com filete lilás, faixa clara no centro e disco atrás dos Ativos (raio = 1,0 × largura do Ativo); fora da arena, claro em cima e azul embaixo; sem as faixas finas coral/ciano nas bordas, o dono do turno acende a sua metade; tapete cosmético só tinge o entorno; igual em 3D e em 2D. |
| UI-175 | Preparação virada para baixo | Na preparação, o Básico colocado fica de verso para cima no slot, sem PS, em 3D e em 2D; ao tocar em Iniciar duelo as cartas não voltam à mão e, na revelação, todas as do campo (as suas e as do adversário) desviram juntas; com movimento reduzido, a 2D mostra a frente sem giro. |
| UI-176 | Cara ou coroa de abertura | Toda tentativa recém-iniciada (não a retomada) mostra, depois da VS e sem nenhum toque do jogador, a moeda equipada no deck dele girando sozinha e caindo na face do resultado do motor: cara, “Você começa.”; coroa, “<rival> começa.”, com o véu na cor de quem começa; a IA espera; com movimento reduzido, a face parada com o resultado; o aviso da preparação repete quem começa. |
| UI-177 | Moeda do deck em todo lançamento | Todo lançamento por ataque, efeito ou condição usa a moeda equipada no deck de quem lança (a do rival nos efeitos dele), com a imagem da cara e da coroa nas moedas do Pocket, em 3D e em 2D; o véu do resultado toma a cor de quem lança; a aba Moeda da oficina troca a moeda do deck e mostra cara, coroa e um lançamento de prévia. |
| UI-178 | Receitas de deck | Sub-aba Receitas (S51) com 55 receitas em cartões: abas Todas/Meta/Por tipo/Comunidade com contagem, filtro por tipo de Energia, busca por receita ou carta e “Só as que posso montar”; cada cartão mostra selo da categoria, caixa com a capa, destaques e a barra de cobertura da coleção; S52 mostra estratégia, as 20 cartas com as que faltam marcadas (levando à S08) e Montar, que abre o editor com o rascunho da lista sem conceder cartas; sem rolagem horizontal em 1920 × 1080 e 1280 × 720. |
| UI-179 | Caixa de deck retangular | A caixa de deck (S11, S12, S51, S52, Início) é um retângulo em pé como a do Pocket: carta de capa inteira numa janela da frente, tampa na cor da Energia na metade de cima, base clara, emblema do tipo na lateral; as duas cartas em destaque encostam na frente da caixa nos cartões. |
| UI-180 | Sleeves do Pocket no verso | Acessórios (S12) abre a aparência do deck na aba Verso, com os 78 sleeves do Pocket em grade e a prévia que vira a carta; aplicado ao deck, o sleeve é o verso das cartas dele na mesa 3D e na 2D (baralho, Básicos virados, mão vista pelo rival, giros), e o rival usa o dele; sem sleeve com imagem, o verso padrão. |
| UI-181 | Ícones de efeito nas cartas | Toda carta em campo com Condição ou efeito temporário mostra o ícone do Pocket na coluna da borda direita (Condições primeiro, um selo por tipo de efeito, com texto acessível); ao aplicar, o ícone estoura grande no centro da carta com anel e brilho na cor do efeito e voa para a coluna, um efeito de cada vez; ao sair, encolhe e some; restrição de jogar cartas aparece só no Ativo; 3D e 2D; com movimento reduzido, sem estouro. |

---

<a id="interface-41"></a>

## 🧱 41. Entregas e gates de interface

### 41.1. Primeira fatia vertical

Início local, perfil, carta Three.js, editor básico, um tutorial, mesa 3D, resultado e save. O jogador deve terminar uma atividade real e retomá-la após fechar.

### 41.2. Capítulo completo

Mapa diorama, seis nós com briefing, NPCs, puzzle, Descoberta, chefe, recompensas e próximo capítulo. Sem botões ilustrativos no caminho principal.

### 41.3. Campanha completa

45 nós planejados, coleção, pacotes, Empório, Arena, objetivos, saves e ajuda. Números são metas de entrega; precisam de conteúdo e testes.

### 41.4. Qualidade

Capturar e revisar 1920 × 1080 e 1280 × 720. Verificar teclado, texto ampliado, movimento reduzido, qualidade Baixa, falha de GPU, save e instalação offline limpa.

### 41.5. Não aceitar como pronto

Cena 3D sem gameplay, menus de captura estática, CSS transform apresentado como Three.js, pacotes sorteados por animação, campanha que só funciona com rede, ou todos os 45 nós apontando para o mesmo confronto sem identidade/conteúdo.

Não existe uma fase conectada planejada nesta versão.


### 41.6. Gate específico de apresentação 2.1

A fatia vertical deve incluir mesa neutra e Academia, aplicação de preset ao deck, troca de playmat por turno, compra própria/adversária, entrada de Básico, evolução, destaque de ataque, Energia, moeda, dano, Nocaute e abertura de pacote recuperável.

A campanha completa acrescenta os seis temas de capítulo e o tema final. Importação de imagem, decalques e backup portátil entram após a estabilidade da oficina básica; continuam especificados no escopo final, não devem bloquear a primeira batalha.

Verificar a mesma sequência nos modos Normal, Rápido, Instantâneo e Movimento reduzido. Ela deve terminar com o mesmo estado de jogo. Nenhum vídeo de demonstração substitui esses testes.

---


### 41.7. Gate do SQLite e Estúdio 3.0

Criar Pokémon com um ataque, importar arte, salvar no SQLite, publicar normal/foil, testar em perfil CUSTOM e retomar após fechar o navegador. Confirmar que regra ex afeta pontos, mas acabamento não altera dano.

Validar isolamento de perfis, conflito de revisão, falta de quota, segunda aba sem conexão e com transferência cooperativa, exportação/importação e erro de GPU sem perda do formulário. O cumprimento visual não substitui esses testes.

---

<a id="interface-42"></a>

## 📚 42. Referências visuais e limites de fidelidade

As referências abaixo foram consultadas nesta revisão. O material oficial apresenta a linguagem visual e os acessórios do Pocket. As capturas do site podem representar versões em desenvolvimento; não constituem uma auditoria frame a frame de todos os clientes ou expansões.

**Observado na referência:** cartas físicas digitais como protagonistas, mesa arredondada, Ativos centrais, Banco, Energias e HP externos à arte, playmat de campo inteiro, acessórios e destaque ampliado de ataque.

**Especificado para este projeto:** adaptação 16:9, oficina avançada, importação local de imagem, opções de conforto, dimensões, tempos, curvas, materiais, catálogo de campanha e contratos de persistência. Esses recursos não são apresentados como funcionalidades oficiais idênticas.

O modo `TURN_OWNER` é o contrato escolhido para nossa alternância de playmats. A imagem estática de referência documenta o campo inteiro, mas não mede a transição nem sua duração. Não deduzir uma temporização oficial a partir dela.

### [V01] Pokémon TCG Pocket — apresentação oficial das batalhas e acessórios

```text
https://www.pokemontcgpocket.com/ja/howtoplay/battle/
```

### [V02] Captura oficial da mesa, cartas, Energias e HUD

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img12.png
```

### [V03] Captura oficial de playmat aplicado ao campo completo

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img17.png
```

### [V04] Captura oficial do destaque de carta e faixa de ataque

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img13.png
```

### [V05] Pokémon Support — uso de cosmetic flair e battle flair

```text
https://app-ptcgp.pokemon-support.com/hc/en-us/articles/39078417091865-The-flair-I-obtained-is-missing-I-don-t-know-how-to-use-it
```

### [V06] Captura oficial de efeito de carta

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img19.png
```

A distinção oficial entre tipos de flair orienta a separação de acabamento/entrada; nossa economia não exige Shinedust ou consumo de cópias. As regras de referência preservadas estão documentadas em [gameplay.md](gameplay.md).

Fontes das APIs de materiais, animação, picking e funcionamento offline estão em [runtime-offline-threejs.md](runtime-offline-threejs.md#runtime-28). Os links são documentação para desenvolvimento, não dependências do jogo. Nenhuma imagem oficial, música, fonte proprietária ou modelo de produção acompanha este pacote de specs.

---

<a id="interface-43"></a>

## 🧭 43. Diretriz final de apresentação

> Construir uma experiência de cartas em 16:9 com campanha no centro, Three.js nos objetos e ambientes, e HTML nos controles e textos. Toda ação deve ter contexto, consequência e alternativa acessível. Nenhuma dependência online integra o caminho de uso. O jogo pode ser pausado, salvo, fechado e retomado sem perder o estado confirmado.

Este documento especifica apresentação e comportamento; não contém um protótipo implementado, artes ou modelos prontos. Ler com os documentos de gameplay, campanha e runtime.

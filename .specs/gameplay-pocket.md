# 🎬 Gameplay — adaptação da referência Pokémon TCG Pocket

> **Versão da spec:** 3.2.0 (revisão 3.3.0 em preparação)
> **Data:** 15 de outubro de 2026
> **Origem:** pedido do autor (`referencias/gameplay/prompt.txt`) — observar o vídeo de uma partida real e adaptar a gameplay para ficar o mais fiel possível em comportamento, botões, visões, animações e ordem das coisas.
> **Complementa:** [interface-16x9.md](interface-16x9.md) (telas e mesa), [runtime-offline-threejs.md](runtime-offline-threejs.md) (animação e câmera) e [direcao-visual-pocket.md](direcao-visual-pocket.md) (aparência). Onde esta spec diverge delas, ela prevalece para a mesa de batalha.
> **Observações completas:** [referencias/gameplay-pocket-observacoes.md](referencias/gameplay-pocket-observacoes.md).

---

<a id="pocket-0"></a>

## 🎥 0. Fonte, método e limites

- **Vídeo:** gravação de referência do autor, não versionada (142 MB) — 755,5 s, 576×1280 em retrato, 52 fps. Partida ranqueada real do Pokémon TCG Pocket, do lobby ao resultado. O jogador de baixo começa e perde por 1×3 no turno 20.
- **Método:** 756 quadros a 1 fps, 312 trocas de cena e ~75 sequências densas (0,1–0,2 s) nos momentos de animação. Posições medidas em % do quadro; tempos em segundos do vídeo. O que é inferência está marcado no relatório.
- **Limites:** o vídeo é um celular em retrato; a mesa daqui é 16:9 em paisagem. Posições viram **regiões equivalentes**, não cópias de coordenadas. Tempos e cores são aproximações para implementação, não medições internas do jogo.

---

<a id="pocket-1"></a>

## 🧭 1. Princípios da adaptação

1. **Mesma ordem e mesmo ritmo.** A sequência de eventos de uma partida e de um turno segue o vídeo (§4–§5). As durações da §9 substituem as dos presets quando divergem.
2. **Retrato → paisagem.** Oponente em cima, jogador embaixo e a divisória entre os dois Ativos continuam. O espaço lateral extra recebe pilhas, Zona de Energia, placas, botões e o tutorial, sem empurrar as oito cartas.
3. **Local e single-player.** Não há busca de oponente, ranque, relógio de xadrez, limite de tempo por turno, pedido de amizade nem "Obrigado!". O chip "Time limit" do vídeo não é reproduzido.
4. **Decisões explícitas do autor prevalecem** quando conflitam com o vídeo:
   - jogar arrastando da mão e recusa com motivo e retorno (15/10/2026);
   - ataques, Habilidades e Recuar na **ficha do Pokémon tocado**, como no vídeo (15/10/2026, substitui os botões de ataque sempre à vista); Finalizar turno continua flutuante;
   - placas com foto e três pontos, afastadas das bordas; a foto é o retrato do treinador — o escolhido pelo jogador e o do rival — desenhado inteiro, sem contorno (16/10/2026; [interface §5.5](interface-16x9.md#interface-05));
   - hover: carta da mesa sobe e flutua no lugar; carta da mão abre a prévia centrada (15/10/2026);
   - promoção depois do nocaute por arrasto do Banco até o Ativo, sem painel de decisão (16/10/2026, §6.2);
   - ícones no lugar de botões escritos no editor de deck.

   Como no vídeo, tocar no seu Pokémon abre a ficha de ações (§7.4), com o **visual das linhas de ataque do Pocket** (§10.1).
5. **Acessibilidade.** Toda ação por arrasto tem equivalente por clique e teclado. Com movimento reduzido, deslizamentos viram fades curtos. Textos em PT-BR.

---

<a id="pocket-2"></a>

## 🗺️ 2. Layout da mesa em 16:9

| Elemento (vídeo, % do quadro) | Aqui (regiões de [battle-layout.json](examples/battle-layout.json)) | Estado |
|---|---|---|
| Ativo do oponente (x 36–64, y 29–45) e do jogador (x 35–65, y 47,5–66), quase se tocando na divisória | `NPC_ACTIVE` / `HUMAN_ACTIVE` no centro; divisória em y ≈ 457 (1080p) | Já existe |
| Bancos de 3 slots; o do oponente menor | Slots `*_BENCH_0..2` | Já existe (mesmo tamanho dos dois lados) |
| Campo em **arena**: círculo grande que envolve os dois Bancos, metade do oponente coral e a do jogador azul-clara, aro branco, faixa clara no centro e disco atrás dos Ativos | Decoração da mesa (`three/battle/arena.ts`), sem região própria | Implementado (abaixo) |
| Mão do jogador embaixo, sobreposta ~45 %, cortada pela placa | Região `hand` | Já existe |
| Mão do oponente: leque de versos de cabeça para baixo no topo | `npcHand` | Já existe |
| Placas: 3 pontos + nome + foto, coladas às bordas, oponente em cima à direita e jogador embaixo à esquerda | `npcPlate` / `humanPlate` | Já existe (decisão do autor); foto = retrato do treinador |
| **End Turn**: pílula branca de contorno ciano à direita do Ativo, na altura da divisória | `endTurn` | Já existe |
| Menu ≡ no canto inferior esquerdo, sempre visível | `menu` | Muda: abre **popover** (§7.2) |
| **Avisos** (toasts): pílula branca no topo, sobre o Banco do oponente | **Nova região `toast`** | Fase 1 |
| Preparação: **Reset** à esquerda e **Start Battle** à direita, na altura da divisória | **Nova região `setupReset`**; Iniciar duelo usa `endTurn` | Fase 1 |
| Tutorial | **Nova região `guide`**, presa à borda direita sob a placa do adversário | Fase 1 |
| Zona de Energia como "prato" (orbe da atual + ícone da próxima) | `humanEnergy` / `npcEnergy` | Implementado (§6.1), com as bolas de Energia do atlas |
| Tela **VS** antes da moeda: faixa coral do oponente em cima, azul do jogador embaixo, avatares, "VS." e frases | Camada HTML sobre a mesa, sem região própria | Implementado (§3) |
| Zona verde de soltura do Treinador (x 3–97, y 29–73) | **Nova região `trainerZone`**, sobre o centro da mesa | Fase 3 (§6) |
| Botões de efeito ativo ✦/▲ nas laterais | — | Fora do escopo desta revisão |

Geometria das regiões novas (x, y, largura, altura):

| Região | 1080p | 720p |
|---|---|---|
| `toast` | 520, 40, 880, 60 | 336, 30, 608, 44 |
| `setupReset` | 440, 433, 232, 48 | 136, 305, 168, 36 |
| `guide` | 1560, 108, 360, 300 | 1044, 72, 236, 220 |
| `trainerZone` | 448, 250, 1024, 450 | 312, 165, 648, 300 |

**Mesa em arena (decisão do autor, 16/10/2026; captura de uma batalha do Pocket):** a mesa 3D e a 2D desenham a mesma arena, com geometria e cores em `three/battle/arena.ts` (`ARENA`, `ARENA_COLORS`):

- **Arena:** círculo grande centrado no centro de espelho, entre os dois Ativos. Raio = distância do centro ao canto mais distante dos espaços de Banco × 1,04 (`ARENA.radiusPad`), para os dois Bancos caberem dentro: ≈ 427 px em `desktop1080` e ≈ 307 px em `compact720`. É um círculo de tela: na mesa 3D, ele é projetado de volta no plano da mesa e aparece redondo.
- **Metades:** a do adversário (distante) em coral, `#EE9095` → `#F2ABAC` em direção à linha central; a do jogador (próxima) azul-clara, `#D3E0F8` → `#C3D8F6`. Aro branco de 16 px (`ARENA.rimPx`) com filete externo lilás de 3 px (`#D3D0EE`).
- **Faixa central:** faixa clara (`#ECEFF6`, 85 %) de 56 px de altura (`ARENA.bandPx`) sobre a linha central, de borda a borda da mesa; a linha central branca fina continua.
- **Disco central** atrás dos Ativos: raio = 1,0 × largura do Ativo (`ARENA.discK`; antes 1,35), em `#ECEFF6`, com disco interno lilás-azulado (`#D6DFFC`) a 0,66 do raio (`ARENA.innerK`) e o aro branco.
- **Entorno** (fora da arena): claro em cima (`#E8F2FB` → `#DCE3F5` na linha central) e azul embaixo (`#CBDBF6` → `#45A9F6`). Pilhas e pratos de Energia ficam sobre o aro ou junto dele, como no Pocket; slots, pilhas, pratos, cartas e HUD não mudam de lugar.
- **Dono do turno:** as faixas finas coral/ciano das bordas de cima e de baixo não aparecem mais. A metade da arena de quem joga acende: no turno do adversário, o coral fica mais forte (`#E8767D` → `#EE9499`); no seu, a metade próxima fica mais azul (`#C4DAFA` → `#A7CBF8`). A suavização é a mesma das faixas.
- **Tapetes:** o tapete cosmético só tinge o entorno e acrescenta o seu decalque periférico; arena, divisão e disco continuam. Com imagem local de tapete, as metades da arena viram uma película de 38 % sobre a imagem, em 3D e em 2D.

Camadas na mesa 3D e decoração fora do picking: [runtime §14.6](runtime-offline-threejs.md#runtime-playmats). Critério UI-174 em [interface §40](interface-16x9.md#interface-40).

---

<a id="pocket-3"></a>

## 🪙 3. Antes do primeiro turno

Ordem do vídeo, adaptada:

1. **Abertura VS** (decisão do autor, 16/10/2026; preset de interface `DUEL_INTRO`, 2600 ms): só numa tentativa recém-iniciada — briefing, Arena, Treino ou “Reiniciar encontro” —, **nunca ao retomar** um duelo suspenso. Duas faixas inclinadas fecham a tela por lados opostos — a vermelha do rival em cima, entrando pela esquerda, e a azul do jogador embaixo, pela direita —; os retratos caem pesados, com achatamento e um tremor curto da tela no impacto; entram "VS.", os dois nomes e a pílula com a saudação do rival (primeira fala da introdução do nó; sem ela, "Prazer em conhecer você!"). Cobre a mesa enquanto ela entra; a entrada fica bloqueada e **a IA espera** a abertura sair. Com movimento reduzido, só a pose final com fade (1200 ms). Detalhes em [interface §22.1](interface-16x9.md#interface-22).
2. **Entrada da mesa** (`BOARD_INTRO`).
3. **Cara ou coroa de quem começa** (decisão do autor, 16/10/2026): toda tentativa recém-iniciada joga a moeda logo depois da abertura VS — **cara, o jogador começa; coroa, o rival**. A moeda aparece e é lançada **sozinha**: o jogador não toca em nada, nem para lançar nem para fechar.
   - A moeda é a **equipada no deck do jogador** (aba Moeda da oficina, [interface §23.22](interface-16x9.md#interface-23)); sem escolha, a Poké Bola do preset padrão.
   - A face vem do resultado autoritativo do motor (`firstPlayer`), nunca da física: em fixture com primeiro jogador fixo, a moeda cai na face que corresponde a ele.
   - Overlay HTML `CoinToss` (`ui/battle/coin-toss.tsx`, `data-testid="coin-toss"`), igual em 3D e 2D: “Cara ou coroa?” e a regra (“Cara: você começa · Coroa: <rival> começa”); a moeda sobe, gira em X e cai na face (1400 ms); entram “Cara!”/“Coroa!” e “Você começa.”/“<rival> começa.”, com o véu na cor de quem começa; sai com fade aos 2900 ms.
   - Com movimento reduzido, a face sorteada aparece parada, já com o resultado, por 1600 ms.
   - Retomar um duelo nunca repete a moeda; a IA espera ela sair. Critério UI-176 ([interface §40](interface-16x9.md#interface-40)).
   - O aviso da preparação repete o resultado na pílula **"Você começa"** ou **"O adversário começa"**.
4. **Distribuição:** 5 cartas para cada lado, em arco, ~0,1 s entre cartas (`INITIAL_DEAL`).
5. **Preparação na própria mesa** (§4), jogável só depois que a abertura VS sai.
6. **Revelação do campo** (`SETUP_REVEAL`): as cartas viradas dos dois lados — as suas, colocadas viradas na preparação (§4), e as do adversário — desviram juntas.
7. **"Pronto? Já!"** e o banner do primeiro turno (§5.1).

---

<a id="pocket-4"></a>

## 🃏 4. Preparação na mesa (Fase 1)

**Decisão do autor (15/10/2026):** a escolha das cartas iniciais acontece **na mesa principal**, não numa tela à parte.

- A mesa (3D ou 2D) mostra a mão inicial embaixo e os slots vazios. Não há painel nem cópia da mão.
- **Aviso no topo** (região `toast`):
  - sem Ativo: "Coloque um Pokémon Básico no Ativo.";
  - com Ativo: "Coloque até 3 Pokémon Básicos no Banco e toque em Iniciar duelo.";
  - sempre, com a pílula azul "Você começa" ou "O adversário começa".
- **Colocar:**
  - Arrastar um Básico da mão até um slot realçado. Sem Ativo, só o Ativo fica realçado; depois, os slots livres do Banco.
  - Clique e teclado também servem: tocar no Básico coloca-o no próximo slot livre, o Ativo primeiro.
  - Cartas que não são Básicos ficam sem realce.
  - Soltar fora de um slot válido nega com o motivo (ex.: "Coloque primeiro um Básico no Ativo") e a carta volta à mão.
- **Tirar:** tocar numa carta já colocada devolve-a à mão. Se era o Ativo, o primeiro Banco não sobe sozinho; o jogador escolhe de novo.
- **Viradas para baixo** (decisão do autor, 16/10/2026): o Básico colocado fica com o verso para cima no slot, sem PS, como no Pocket.
  - Ao tocar em **Iniciar duelo**, a disposição continua na mesa, ainda virada, até a revelação (§3, item 6): as cartas não voltam à mão por nenhum instante.
  - Na revelação, as cartas reais tomam o lugar das provisórias, também viradas, e todas as do campo desviram juntas: na mesa 3D pelo giro `SETUP_REVEAL`; na 2D por um giro em Y de ~0,7 s (o do adversário aparece já virado e gira junto).
  - Com movimento reduzido, a 2D mostra a frente direto, sem giro.
  - Critério UI-175 ([interface §40](interface-16x9.md#interface-40)).
- A disposição fica só na tela até a confirmação: nada vai ao motor nem à gravação antes de **Iniciar duelo**.
- **Botões**, na altura da divisória:
  - **Recomeçar** (região `setupReset`, ícone ↺): devolve tudo à mão.
  - **Iniciar duelo** (região `endTurn`, pílula de contorno ciano): só fica ativo com Ativo escolhido e envia a seleção `[Ativo, ...Banco]`.
- Enquanto o adversário prepara, ou durante a revelação, o aviso mostra "Aguardando o adversário…" em vermelho.
- A placa, o menu ≡, o histórico e o tutorial seguem disponíveis. Os ataques e o Finalizar turno ficam ocultos.

---

<a id="pocket-5"></a>

## 🔁 5. Ordem do turno

### 5.1. Banner de turno e tapete (Fase 1)

**Decisão do autor (15/10/2026):** a faixa de turno e as demais mensagens de destaque ("Pronto? Já!", "+1 ponto!", resultado da moeda, Vitória/Derrota) aparecem **centradas na tela**, não na divisória, e com animação fluida. Os avisos de instrução continuam no topo (§7.1).

- **Seu turno:** faixa horizontal ciano→azul de largura total, no **centro vertical da tela**. Ela **abre a partir da esquerda** (~0,28 s, com desaceleração longa e começando achatada) e tem as bordas esmaecidas. O texto branco grande entra logo depois e desliza devagar durante a leitura; um brilho atravessa a faixa.
- **Turno do adversário:** faixa coral→vermelha que **abre pela direita**.
- Logo abaixo da faixa pende uma pílula ardósia **"Turno atual: N"**, com N maior, sem deslocar a faixa do centro.
- Permanência ~0,5 s e saída ~0,24 s para o lado oposto, acelerando, ≈ **1,0 s** no total (`TURN_BANNER`), numa única linha do tempo.
- **Troca de tapete** durante o banner: mosaico de **hexágonos** que se acendem em ordem aleatória sobre a mesa (~0,6 s) e revelam o tapete de quem joga (preferência `TURN_OWNER`). As cartas não se movem.
- **Na mesa** (decisão do autor, 16/10/2026): a metade da arena de quem joga acende e fica assim durante o turno — coral mais forte no turno do adversário, azul mais forte no seu (§2). As faixas finas coral/ciano das bordas da mesa não aparecem mais.
- Antes do turno 1, **"Pronto? Já!"**: texto branco itálico inclinado, centrado na tela, com pop elástico e traços laranja e azul cruzando em sentidos opostos (~0,9 s).
- **Movimento reduzido:** sem deslizamento, brilho nem mosaico; só fade (~0,6 s).

### 5.2. Dentro do turno do jogador

1. Banner e troca de tapete (§5.1).
2. **Compra:** a carta sai do deck de verso, vai ao centro crescendo, vira para você, fica grande (~0,3 s) e desce para a ponta direita da mão (`DRAW_SELF`, 1100 ms). A carta buscada por efeito faz o mesmo. Compras em lote (2+) vão direto à mão. Com o deck vazio, o aviso do topo diz "Sem cartas no deck: não é possível comprar." depois da faixa; com a mão cheia, "Mão cheia: não é possível comprar.". (Fase 3)
3. **Energia gerada:** só depois da compra, um flash branco com estrela acende o prato, o orbe da Energia atual aparece e o rótulo "Próxima Energia gerada" fica logo abaixo dele (~1,5 s). O prato do adversário também acende, sem rótulo. Quem começa não gera no turno 1. (Fase 3)
4. **Ações livres**, em qualquer ordem: Básico, evolução, Item, Apoiador, Ferramenta, Estádio, 1 Energia, Habilidades, Recuo.
5. **Atacar encerra o turno sozinho.** Sem ataque, o turno termina com **Finalizar turno**, que some deslizando para a direita ao ser tocado.

### 5.3. Turno do adversário

- Banner coral, compra (verso do deck dele para o leque) e Energia no prato dele.
- Enquanto a IA pensa, o aviso "Aguardando o adversário…" aparece em vermelho.
- Se o jogador age enquanto a IA ainda planeja (ex.: confirma a preparação antes dela), o plano antigo é descartado e a IA **replaneja com o estado novo**; o duelo não para na vez do adversário ([runtime §11.4](runtime-offline-threejs.md#runtime-11)).
- Cartas jogadas por ele: verso desce do leque, vira em Y, prévia grande (~0,6 s) e resolução — a mesma revelação e a mesma dissolução das suas (§9). (Fase 3)

---

<a id="pocket-6"></a>

## ✋ 6. Interação por arrasto e realces

- **Alvos válidos:** borda ciano grossa e brilhante em slots e cartas.
- **Alvo sob o ponteiro:** véu verde translúcido com borda verde (Energia e Ferramenta).
- **Pode agir:**
  - Ativo com borda ciano pulsante quando pode atacar;
  - cartas jogáveis da mão com contorno ciano;
  - evolução jogável com contorno **amarelo** no lugar do ciano, na mesa 3D e na 2D (Fase 3).
- **Treinador** (Item, Apoiador, Estádio): ao arrastar, uma **zona verde translúcida** de borda clara cobre o centro da mesa (região `trainerZone`), por baixo da carta, e acende quando a carta está sobre ela. Soltar dentro joga; soltar fora devolve a carta à mão **sem aviso** (a recusa com motivo continua para Pokémon e Ferramenta). Na mesa 2D, a mesma zona em DOM. Clique e “Jogar” continuam valendo. (Fase 3)
- **Ferramenta:** sem zona verde; os seus Pokémon válidos ficam em ciano, como no vídeo.
- **Energia:** o orbe da Zona é arrastado até o Pokémon, com rastro na cor do tipo; todos os alvos ficam em ciano e o alvo sob o ponteiro em verde. Tocar no orbe e depois no Pokémon continua valendo. Implementado (§6.1).
- **Promoção:** depois do nocaute do seu Ativo, os Pokémon do Banco que podem subir flutuam e um deles é arrastado até o Ativo vazio, que pulsa como alvo. Tocar no Pokémon e depois no Ativo continua valendo. Implementado (§6.2).

### 6.1. Prato e arrasto da Energia

**Decisão do autor (15/10/2026; referências `referencias/batalha/energy-empty.png` e `energy-fullfiled.png`):**

- **Prato:** disco branco-lilás com aro claro e bisel suave, sempre visível nos dois lados.
  - **Cheio:** orbe brilhante do tipo com **halo ciano pulsando**.
  - **Próxima Energia:** a mesma bola do tipo, esmaecida e com aro branco, na borda de baixo do prato, à direita no seu e à esquerda no do adversário.
  - **Bolas de Energia (decisão do autor, 16/10/2026):** o orbe, a próxima Energia, as Energias ligadas aos Pokémon e o voo da ligação usam a bola do tipo recortada do atlas `src/presentation/assets/source/energy/energys.png` (`npm run assets:energy`), nos oito tipos que a Zona gera, em 3D e em 2D. Incolor e Dragão mantêm o ícone de tipo; os custos de ataque não mudam. Detalhes em [interface §23.10](interface-16x9.md#interface-23).
- **Arrasto livre:** no seu turno, o orbe pode ser pego e levado a qualquer ponto. Ele segue o ponteiro com um rastro na cor do tipo, e o prato fica vazio enquanto isso.
  - Os alvos possíveis ficam em ciano e o aviso do topo pede o Pokémon.
  - Finalizar turno e a dica de ações somem durante o arrasto.
- **Sobre um alvo:** o Pokémon sob o orbe **cresce de leve** (sobe um pouco, com contorno verde na mesa 2D).
- **Soltar num alvo:** liga a Energia. O orbe **voa do ponto da soltura até a fileira de Energias da carta**, encolhendo, e ao chegar um anel e partículas do tipo marcam a ligação enquanto a carta pulsa (`ATTACH_ENERGY`).
- **Soltar fora:** o orbe volta ao prato (`UI_DRAG_RETURN`) e nada é ligado.
- **Toque simples:** continua selecionando a Energia; depois, tocar no Pokémon liga.
- **Mesa 2D:** as mesmas regras, em DOM.
- **Ação inválida:** aviso vermelho (ex.: "Energia insuficiente") sem fechar o que estava aberto.

### 6.2. Promoção depois do nocaute

**Decisão do autor (16/10/2026):** quando o seu Ativo é nocauteado e há 2 ou mais Pokémon no Banco (decisão `PROMOTE`), **não há painel de decisão**. Com 1 Pokémon no Banco, a promoção continua automática. As outras decisões seguem no seletor universal ([interface §26.1](interface-16x9.md#interface-26)).

- **Mensagem:** pílula simples no centro da mesa, entre os dois Ativos (região `attackCutin`), que não captura o ponteiro (`data-testid="promote-prompt"`, `role="status"`):
  - "Escolha o próximo Pokémon Ativo";
  - embaixo, "Arraste um Pokémon do Banco até o Ativo" ou, depois de escolher por toque, "Toque no espaço do Ativo para confirmar".
- **Banco flutuando:** os Pokémon que podem subir ficam erguidos e balançando devagar; o escolhido sobe mais. O espaço vazio do Ativo pulsa como alvo. Com movimento reduzido, só erguidos, sem balanço.
- **Arrastar:** pressionar um deles e levá-lo até o Ativo.
  - **Soltar no Ativo:** envia `RESOLVE_DECISION` com o `entityId` daquele Pokémon.
  - **Soltar fora:** a carta volta ao Banco (`UI_DRAG_RETURN`) e nada é enviado.
  - **Mesa 3D:** a própria carta se move, com as Energias e a Ferramenta ligadas; o alvo é o retângulo projetado do `HUMAN_ACTIVE`, com folga. Realce `floating` do palco e evento `onEntityDrop`. Depois da soltura, a animação de promoção parte do ponto onde a carta foi solta; se nada for apresentado em 2,5 s, a carta volta ao Banco.
  - **Mesa 2D:** uma cópia da carta segue o ponteiro e a original fica esmaecida (`ui/battle/entity-drag.tsx`); os slots que flutuam usam o mesmo balanço do hover.
- **Sem arrasto (clique e teclado):** tocar num Pokémon que flutua o escolhe (tocar de novo desfaz); depois, tocar no espaço do Ativo confirma.
- **Enquanto isso:** Finalizar turno e a ficha de ações ficam ocultos; o menu ≡, o histórico e a pausa continuam.
- A lógica de escolha (opções, realces, toque e soltura) é pura e compartilhada pelas duas mesas: `src/presentation/ui/battle/promotion.ts`.

---

<a id="pocket-7"></a>

## 🔘 7. Botões, menu e avisos

### 7.1. Avisos (Fase 1)

- **Formato:** pílula branca ~90 % opaca, sombra suave e texto centralizado na região `toast`. Entram e saem com fade de ~0,15 s.
- **Cores:** instruções em texto escuro; recusas e espera em texto vermelho.
- **Textos:**

| Situação | Texto |
|---|---|
| Preparação sem Ativo | Coloque um Pokémon Básico no Ativo. |
| Preparação com Ativo | Coloque até 3 Pokémon Básicos no Banco e toque em Iniciar duelo. |
| Espera da IA | Aguardando o adversário… |
| Promoção obrigatória | Não usa o topo: “Escolha o próximo Pokémon Ativo” aparece no centro, entre os Ativos (§6.2). |
| Recuo | Escolha um Pokémon para trocar. |
| Ataque sem Energia | Energia insuficiente |
| Desconto de Recuo | O custo de Recuo diminuiu em 1. |
| Compra pulada, deck vazio | Sem cartas no deck: não é possível comprar. |
| Compra pulada, mão cheia | Mão cheia: não é possível comprar. |

- A recusa de arrasto continua no centro (`drop-deny`), porque é resposta direta ao gesto.

### 7.2. Menu ≡ (Fase 1)

- Tocar no ≡ abre uma **folha branca que desliza da esquerda** (≤ 0,12 s, ease-out), ancorada acima do botão. Itens:
  - **Histórico**;
  - **Pausa e ajustes** (abre a pausa com velocidade, movimento reduzido e 2D);
  - **Salvar e sair**;
  - **Desistir**, em pílula de contorno e texto vermelhos, com confirmação.
- Fecha na hora ao tocar fora, em Esc ou ao escolher.
- Esc fora do menu continua abrindo a pausa.

### 7.3. Finalizar turno

Segue a região `endTurn`. Some com a mão expandida, durante o arrasto, com escolha pendente ou durante a animação, e volta depois de cada ação. A ficha de ações (§7.4) também não abre enquanto uma ação é apresentada.

### 7.4. Ficha de ações

**Decisão do autor (15/10/2026; referência `referencias/batalha/attack.png`):** ataques, Habilidades e Recuar **não ficam à vista o tempo todo**. Tocar num Pokémon seu abre a ficha dele:

- **Carta ampliada** no centro da mesa (região `attackCutin`, ~48 % da largura dela), subindo com leve elástico, e o **PS atual** num selo branco no canto superior direito, com a barra de PS.
- **Sobre a metade de baixo da carta**, as linhas de ação (§10.1), mais largas que a carta:
  - ataques, só no Ativo;
  - Habilidades ativáveis, em dourado com a etiqueta "Habilidade" e o texto;
  - "Descartar" para Fóssil.
- **Recuar**, só no Ativo: pílula branca embaixo, à direita, com o custo em ícones.
- **Fora do seu turno ou durante uma jogada**, as linhas aparecem bloqueadas, e tocar nelas mostra o motivo no aviso do topo, que fica acima da ficha.
- **Fecha** ao tocar fora (véu leve sobre a mesa), com Esc, ao usar uma ação ou quando uma escolha de alvo começa (Recuar → escolher o Banco).
- **Pode agir:** o Ativo com ataque ou Recuo disponível e os Pokémon com Habilidade ativável ou Fóssil ganham o contorno ciano (§6).
- **Teclado:** A abre a ficha do Ativo, e o primeiro ataque utilizável recebe o foco.

A região `actionButtons` fica só com a dica do alvo pendente (Energia, Recuo) com Cancelar e o "Jogar" de uma carta da mão selecionada.

---

<a id="pocket-8"></a>

## 📌 8. Tutorial preso à direita (Fase 1)

**Decisão do autor (15/10/2026):** o guia dos tutoriais e puzzles fica **preso à borda direita**, não solto sobre a mesa.

- **Posição:** painel na região `guide`, colado à borda direita, entre a placa do adversário e o Finalizar turno. Cantos arredondados só do lado esquerdo e altura fixa da região; o texto quebra dentro dela e rola se precisar.
- **Conteúdo:** etiqueta "Tutorial" ou "Puzzle", título, dica atual, Anterior / n de N / Próxima e "Solução comentada" recolhida.
- **Recolher:** "Pular explicação" reduz o painel a uma aba presa à borda, que reabre o guia.
- **Sem conflitos:** não cobre a prévia ampliada (esquerda), os botões de ação, o Finalizar turno nem a mão. Vale para 1080p e 720p.

---

<a id="pocket-9"></a>

## ⏱️ 9. Tempos-alvo das animações

| Momento | Vídeo | Preset antes | Preset agora | Fase |
|---|---|---|---:|---|
| Banner de turno | ~1,0 s | `TURN_BANNER` 400 ms | 1000 ms | 1 |
| Troca de tapete (hexágonos) | ~0,6 s | `PLAYMAT_TRANSITION` 280 ms | 600 ms | 1 |
| Compra própria com prévia no centro | ~1,1 s | `DRAW_SELF` 540 ms | 1100 ms | 3 |
| Revelação de Básico | ~2,0 s | `PLAY_BASIC` 520 ms | 1200 ms (`PLAY_SPECIAL` 1400 ms), prévia curta | 3 |
| Item/Apoiador: prévia + dissolução | ~1,2 s | `PLAY_ITEM` 620 / `PLAY_SUPPORTER` 900 ms | 1200 ms | 3 |
| Cut-in de ataque + impacto + PS | ~2,6–3,1 s | `ATTACK_STANDARD` 1400 ms | 2600 ms (`ATTACK_SPECIAL` 3000 ms) | 2 |
| Nocaute (orbe ciano) | ~0,5 s + ~1 s parado | `KNOCKOUT` 760 ms | 1500 ms | 2 |
| "+1 ponto!" | ~3,0 s | `POINTS` 420 ms | 2600 ms | 2 |
| Abertura VS | ~2,1 s | — | 2600 ms (`DUEL_INTRO`, preset de interface) | — |
| Moeda de efeito | ~4,0 s | `COIN_FIRST` 1100 ms | 2400 ms | 2 |

Os presets e as fases das coreografias ficam em `examples/animation-presets.json` e `examples/motion-choreography.json` (a soma das fases é igual à duração do preset). As velocidades Rápida e Instantânea continuam escalando ou pulando esses tempos (interface §26).

---

<a id="pocket-10"></a>

## ⚔️ 10. Ataque, dano, nocaute e pontos (Fase 2)

### 10.1. Linhas de ataque

As linhas de ataque da ficha (§7.4) usam o visual do painel do Pocket, cada uma com:

- custo em ícones à esquerda, nome em negrito e dano à direita, com ▲ laranja quando o dano está modificado;
- **utilizável:** fundo lilás com borda brilhante;
- **sem Energia:** cinza e sem brilho; tocar mostra o aviso vermelho "Energia insuficiente" e nada é enviado;
- a pílula **Recuar** embaixo, com o custo em ícones e contorno ciano quando possível.

**Implementado (Fase 2):** linha arredondada clara na cor do tipo do Ativo, com o texto do ataque em até 2 linhas embaixo (só em 1080p). Pronta, tem borda branca e brilho amarelo; bloqueada, fica cinza, e o toque mostra o motivo no aviso do topo em vermelho ("Energia insuficiente", "Nenhum Pokémon no Banco"…) sem enviar nada. O ▲ de dano modificado fica para depois, porque pede uma prévia de dano que o painel ainda não calcula.

### 10.2. Cut-in

- **Faixa diagonal** (~-10°) de largura total na cor do tipo do atacante, entrando pela lateral em ~0,1 s.
- O **nome do ataque** em branco, grande e com contorno; o nome do Pokémon menor, na listra.
- Linhas de velocidade, fundo escurecido com leve push-in (~1,1×) e a **carta atacante crescendo** até o centro.
- ≈ 1,4 s até o impacto.

**Implementado (Fase 2):** em 1080p, a faixa ocupa toda a largura da mesa (~8,6° de inclinação), com o nome do ataque centralizado em 96 px e o nome do Pokémon à direita. O véu escurece a mesa a 40 %, e as linhas de velocidade e a carta atacante vão ao centro. Em 720p, a faixa compacta já existente continua. Fases do `ATTACK_STANDARD`: atenuar 150, cut-in 500, leitura 700, ida e volta 300, impacto e PS 950 ms.

**Faixa fluida (decisão do autor, 15/10/2026):** a faixa do ataque usa a mesma linguagem das outras faixas, em camadas. O fundo, com pontas esmaecidas, abre do lado de quem ataca em ~0,33 s, com desaceleração longa e começando achatado. O texto, que não estica, entra logo depois e desliza devagar durante a leitura. Um brilho atravessa a faixa (~0,5 s), e tudo fecha para o lado oposto acelerando (~0,26 s) quando a carta volta ao slot.

### 10.3. Impacto e PS

- A carta avança até o alvo, com flash branco e explosão na cor do tipo.
- **Número de dano grande** sobre a carta (~0,8 s) e tag "▲ Dano" quando passa do base.
- O **PS fica vermelho** e conta para baixo em degraus de ~0,1 s.

**Implementado (Fase 2):** o número de dano aparece sem sinal de menos, em branco com contorno escuro e pop, no centro da carta (~0,95 s); a cura aparece em verde. O PS conta de 10 em 10 a cada 100 ms, vermelho ao cair e verde ao subir; com movimento reduzido, o valor é trocado de uma vez. A etiqueta "▲ Dano" fica para depois, junto com o ▲ das linhas de ataque.

### 10.4. Nocaute

PS em 0 por ~0,6 s, a carta dissolve num **orbe ciano** (~0,5 s) e reaparece no descarte do dono.

**Implementado (Fase 2):** orbe e anel ciano sobre o slot da carta, 550 ms depois do nocaute e por 700 ms. As fases do `KNOCKOUT` são marcar 600, remover 500 e assentar 400 ms.

Se o Ativo nocauteado era o seu e há 2 ou mais Pokémon no Banco, segue a promoção por arrasto (§6.2); com 1, ele sobe sozinho.

### 10.5. "+1 ponto!"

- Mesa desfocada com véu claro, e faixa larga azul (jogador) ou coral (adversário) entrando pela lateral.
- Avatar grande (o retrato do treinador) e três medalhões; o conquistado vira dourado.
- Texto "+1 ponto!" com pop. ≈ 2,6 s.

**Implementado (Fase 2):** de cima para baixo, o texto "+N ponto(s)!", o avatar grande (o mesmo retrato da placa, inteiro e sem contorno), a faixa com o nome e os três medalhões. O medalhão recém-conquistado pisca. A tela aparece pelo cue `POINTS` na mesa 3D ou por `POINTS_GRANTED` na 2D, por 2,5 s (0,9 s com movimento reduzido).

### 10.6. Moeda de efeito

- Véu na cor de quem joga e o texto do efeito no topo.
- A moeda gira e desce, e o resultado **"Cara!"** ou **"Coroa!"** é digitado letra a letra (~2,4 s).

**Implementado (Fase 2):** véu azul (você) ou coral (adversário), com o resultado digitado em 60 ms por letra e, quando há várias moedas, a sequência numa pílula ("Coroa · Cara"). O texto do efeito no topo fica para depois. Fases do `COIN_FIRST`: lançar 400, girar 1000, cair 500 e resultado 500 ms.

**Moeda de quem lança** (decisão do autor, 16/10/2026): todo lançamento — ataque, efeito, Habilidade, Treinador, Confusão, Sono, Queimadura, prevenção de dano — usa a **moeda equipada no deck do lado que lança** (`COIN_RESOLVED.player`): os seus Pokémon lançam a sua moeda; os do rival, a dele (preset do NPC). Como na abertura, o lançamento é automático, sem toque.
- Na mesa 3D, uma `CoinVisual` por lado, com a cara e a coroa da imagem da moeda (discos com as faces e borda em metal tingido pela cor média da face).
- Na 2D, a mesma moeda gira ~0,5 s (`CoinDisc`) antes do texto digitado.
- O véu toma a cor de quem lança, não de quem joga o turno.
- Critério UI-177 ([interface §40](interface-16x9.md#interface-40)).

### 10.6.1. Ícones de efeito nas cartas

Decisão do autor (17/10/2026): sempre que uma carta em campo é afetada por um efeito de Pokémon — Condição Especial ou efeito temporário de ataque, Treinador ou Habilidade —, ela ganha o ícone daquele efeito, com animação, como no Pocket: o ícone estoura grande sobre a carta, com brilho na cor do efeito, e assenta na coluna de selos da borda direita; quando o efeito acaba, encolhe e some. Detalhes, tipos de ícone e critério UI-181 em [interface §25.21](interface-16x9.md#interface-25).

### 10.7. Fim

Véu escuro com a pílula **"Vitória"** (azul) ou **"Derrota"** (laranja→vermelho) por ~2 s, e depois a tela de resultado já existente.

**Implementado (Fase 2):** a pílula (e "Empate" em cinza) só aparece depois de a tela "+1 ponto!" sair e fica 2,6 s (0,7 s com movimento reduzido) antes do S24.

---

<a id="pocket-11"></a>

## 🚫 11. Fora do escopo

Lobby ranqueado, busca de oponente, perfil online e pílulas de ranque na tela VS (a abertura VS local está na §3), relógios por jogador e limite por turno, emblemas, pedido de amizade, "Obrigado!", estatística de ranque e o botão "olho". Os botões de efeito ativo ✦/▲ ficam para uma revisão futura (o vídeo não mostra o toque neles), assim como o ▲ de dano modificado nas linhas de ataque e no impacto.

---

<a id="pocket-12"></a>

## 🛠️ 12. Fases de implementação

| Fase | Conteúdo | Seções | Situação |
|---|---|---|---|
| 1 | Preparação na mesa, tutorial preso à direita, avisos no topo, banner de turno com "Turno atual: N" e hexágonos, "Pronto? Já!", menu ≡ em folha | §4, §5.1, §7, §8 | Implementada |
| 2 | Linhas de ataque no visual do Pocket, cut-in, impacto e contagem de PS, nocaute em orbe, "+1 ponto!", moeda, Vitória/Derrota | §9, §10 | Implementada |
| 3 | Arrasto da Energia (orbe), zona verde de Treinador, contorno amarelo de evolução, prévia de compra e de carta jogada, dissolução por cor, prato da Zona de Energia, Energia gerada e aviso de deck vazio | §5.2, §6, §9 | Implementada |

Cada fase atualiza esta tabela, os tempos da §9 e os critérios da §13.

---

<a id="pocket-13"></a>

## ✅ 13. Critérios de aceite

| ID | Critério | Verificação |
|---|---|---|
| UI-133 | Preparação na mesa | Sem painel à parte; Básico da mão ao Ativo/Banco por arrasto ou clique, só os slots válidos realçados, tocar devolve à mão, Recomeçar e Iniciar duelo na divisória e aviso no topo. |
| UI-134 | Tutorial preso à direita | Painel na região `guide`, colado à borda direita, sem cobrir prévia, botões de ação, Finalizar turno nem mão, em 1080p e 720p. |
| UI-135 | Avisos no topo | Instruções em pílula branca na região `toast`; espera e recusa em vermelho; somem sozinhas. |
| UI-136 | Banner de turno | Faixa centrada na tela, ciano abrindo pela esquerda no seu turno e coral pela direita no do adversário, com "Turno atual: N" abaixo e mosaico de hexágonos; com movimento reduzido, só fade. |
| UI-137 | Menu ≡ em folha | Folha a partir da esquerda com Histórico, Pausa e ajustes, Salvar e sair e Desistir (vermelho); fecha ao tocar fora ou em Esc. |
| UI-138 | Linhas de ataque | Na ficha: custo, nome, dano e texto do ataque; pronta com borda brilhante, bloqueada em cinza; tocar na bloqueada mostra o motivo no aviso do topo e nada é enviado; Recuar em pílula com o custo em ícones. |
| UI-139 | Ações durante a animação | A ficha de ações não abre e Finalizar turno some enquanto uma ação é apresentada; voltam depois. |
| UI-140 | Cut-in de ataque | Faixa larga e inclinada na cor do tipo com o nome do ataque e do Pokémon, que abre do lado de quem ataca, tem o texto deslizando e um brilho atravessando e fecha para o lado oposto; véu, linhas de velocidade e carta atacante ao centro; `ATTACK_STANDARD` de 2600 ms. |
| UI-141 | Dano e PS | Número de dano grande, branco com contorno, no centro da carta; PS vermelho contando de 10 em 10; cura em verde; com movimento reduzido, troca direta. |
| UI-142 | Nocaute em orbe | Orbe e anel ciano no slot da carta nocauteada; `KNOCKOUT` de 1500 ms. |
| UI-143 | "+1 ponto!" | Mesa desfocada, texto "+N ponto(s)!", avatar, faixa azul (você) ou coral (adversário) com nome e três medalhões, o conquistado em dourado; ≈ 2,5 s. |
| UI-144 | Moeda de efeito | Véu na cor de quem joga e "Cara!"/"Coroa!" digitado letra a letra; sequência em pílula quando há várias moedas. |
| UI-145 | Pílula de fim | "Vitória", "Derrota" ou "Empate" sobre véu escuro, depois da tela de ponto e antes do S24. |
| UI-146 | Ficha de ações | Ataques, Habilidades e Recuar não ficam à vista; tocar num Pokémon seu abre a carta ampliada com o PS atual e as ações sobre ela; tocar fora ou Esc fecha. |
| UI-147 | Hover na mesa e na mão | Carta da mesa (dos dois lados) sobe, cresce e flutua sem prévia à parte e volta ao sair; carta da mão abre a prévia grande no centro da tela, que some enquanto a carta é arrastada, em 3D e em 2D. |
| UI-148 | Prato da Zona de Energia | Disco branco-lilás nos dois lados; com Energia pronta, orbe do tipo com halo ciano pulsando; próxima Energia esmaecida na borda de baixo (direita no seu, esquerda no adversário), em 3D e em 2D. |
| UI-149 | Arrasto livre da Energia | O orbe segue o ponteiro com rastro; o Pokémon realçado sob ele cresce de leve; soltar nele liga com o voo do orbe até a carta; soltar fora volta ao prato sem ligar; tocar e depois tocar no Pokémon continua valendo. |
| UI-150 | Zona verde do Treinador | Ao arrastar Item, Apoiador ou Estádio, a zona verde translúcida da região `trainerZone` aparece por baixo da carta e acende sob ela; soltar dentro joga; soltar fora devolve à mão sem aviso; em 3D e em 2D. |
| UI-151 | Evolução em amarelo | A carta da mão que pode evoluir um Pokémon agora tem contorno amarelo; as outras jogáveis seguem em ciano; em 3D e em 2D. |
| UI-152 | Prévia de compra e de carta jogada | A compra única própria passa grande pelo centro e termina na ponta direita da mão (`DRAW_SELF` 1100 ms); o Básico jogado gira em Y, fica grande no centro e encolhe até o slot, com o PS só depois (`PLAY_BASIC` 1200 ms); a carta do adversário vira do verso; a mesa 2D mostra a prévia em HTML. |
| UI-153 | Dissolução do Treinador | Item e Apoiador crescem no centro, seguram e dissolvem em placa branca e molduras na cor do subtipo (Item ciano, Apoiador dourado), e a carta reaparece no descarte; 1200 ms; na 2D, a mesma sequência em CSS. |
| UI-154 | Energia gerada e compra pulada | Depois da compra, flash no prato e o rótulo “Próxima Energia gerada”; sem cartas no deck, o aviso do topo diz “Sem cartas no deck: não é possível comprar.”. |

A abertura VS, os retratos nas placas e as bolas de Energia têm os critérios UI-167…UI-169, a promoção por arrasto, o UI-172, a mesa em arena, o UI-174, a preparação virada, o UI-175, e o cara ou coroa de abertura e a moeda do deck, o UI-176 e o UI-177, em [interface §40](interface-16x9.md#interface-40).

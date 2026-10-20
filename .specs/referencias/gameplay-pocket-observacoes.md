# 🎞️ Observações do vídeo de gameplay (Pokémon TCG Pocket)

> Base factual da spec [gameplay-pocket.md](../gameplay-pocket.md). Quadros, notas por trecho e sheets ficaram fora do repositório (imagens de terceiros); aqui são citados só pelo nome.

Fonte: a gravação de referência do autor, não versionada (142 MB). Pedido original: `gameplay/prompt.txt` (nesta pasta).

Convenções:
- Posições em **% do quadro** 576×1280 (retrato): x da esquerda para a direita, y de cima para baixo. "x 35–65, y 47–66" é um retângulo.
- Timestamps em segundos do vídeo (vírgula decimal). Frames `tSSSS_D.png` = 1 por segundo; `bSSSS_CC.png` = bursts densos (0,1–0,2 s); `sc_*` = trocas de cena.
- "(inferência)" marca o que não está visível diretamente e foi deduzido.
- Jogador de baixo (dono da gravação): **Zanobi**. Oponente (topo): **techycha**. Zanobi começa e **perde** por 1 × 3 pontos no turno 20.

Notas detalhadas por trecho (com mais timestamps e caminhos de burst): notas por trecho (fora do repositório) (seg1_0000-0100.md, seg2_0100-0250.md, seg3_0250-0420.md, seg4_0420-0590.md, seg5_0590-0755.md). Sheets (1 fps `d1_*`, bursts `burst_*`): sheets (fora do repositório).

---

## 1. Ficha técnica

| Item | Valor |
|---|---|
| Duração | 755,5 s (12 min 35 s) |
| Resolução | 576 × 1280 (retrato, ≈ 9:20 — tela de celular) |
| FPS | 52 (39.287 quadros), H.264 |
| Conteúdo | Lobby → matchmaking → intro → VS → cara/coroa → setup → 20 turnos → derrota → telas de resultado → volta ao lobby |
| Análise | 756 frames a 1 fps, 312 frames de troca de cena (limiar de diferença 12), ~75 bursts densos, sinal de movimento por frame (`motion.csv`) |

---

## 2. Índice de linha do tempo

### 2.1 Antes da partida
| t (s) | Evento |
|---|---|
| 0,0–1,3 | Lobby "Ranked Match / Season B3": rank "Poké Ball Rank 1 / 120 pts", deck "09 Mind", botão **Battle!** |
| 1,35–1,6 | Toque em Battle! (escurece), UI some em fade |
| 1,7–6,2 | "Searching for opponent..." + globo animado + **Cancel** |
| 6,0–7,6 | Cancel desabilita; "Opponent found!" + ícone de aperto de mãos |
| 8,0–10,2 | Faixa diagonal azul + cartão de perfil do oponente (avatar, Lv. 23, nome, frase, 3 emblemas) |
| 10,4–17,8 | Tela branca de carregamento com spinner pontilhado (canto inf. dir.) |
| 17,9–18,5 | Intro do tabuleiro: mesa circular girada ~-25°, desgira + zoom-in |
| 18,9–21,0 | Tela **VS** (faixa coral = techycha em cima, azul = Zanobi embaixo) |
| 21,1–22,7 | **Cara ou coroa** (moeda gira no centro do tabuleiro) |
| 22,8–23,6 | Fundo ciano + moeda grande + pílula **"Going first"** |
| 24,0–25,8 | Zoom-out para o enquadramento de jogo, decks deslizam das bordas, 5 cartas distribuídas para cada lado |
| 25,9–32,4 | Setup do jogador: Basic no Ativo (revelação), "Start Battle" |
| 33–48,4 | "Waiting for opponent to set up..." |
| 48,6–51,4 | Oponente coloca 2 cartas viradas e as revela (Bronzor ativo, Varoom banco) |
| 51,6–53,3 | Placas dos jogadores entram + "Ready? Go!" |

### 2.2 Turnos (ímpares = Zanobi, pares = techycha; confirmado pelos banners "Current turn: N")
| Turno | Início–fim (s) | Destaques |
|---|---|---|
| 1 Zanobi | 53,9–87,1 | Sem energia (quem começa não gera). Compra Potion; Poké Ball → Mew ex ao banco; Giant Cape no Mew ex (+20 HP); Pokédex (painel "Deck"); **End Turn** em 86,6 |
| 2 techycha | 87,1–111,4 | Compra, energia Metal (89,5), Professor's Research (95–97,7), Pawniard ao banco (103), energia anexada (104–105); ataque Bronzor "Speed Dive" 20 em Jynx 80→60 (108,1–110,5) |
| 3 Zanobi | 111,4–135,15 | Compra (113,2), energia gerada (114,9), Professor's Research (114,6–117,6) → Morelull + outro Professor's Research; Morelull ao banco (121); energia no Jynx (123,7–126,6); Potion no Jynx (cura "20" verde, 60→80, 126,7–131); abre o painel e fecha sem atacar (133); **End Turn** ~134,6 |
| 4 techycha | 135,15–170,25 | Professor's Research (140,6–143,0), Varoom→Revavroom (153,4–154,5), Pawniard→Bisharp (~158); Zanobi inspeciona as cartas do oponente (162–166); Speed Dive 20 em Jynx 80→60 (167,0–169,5) |
| 5 Zanobi | 170,25–239,8 | Compra Shiinotic; Morelull→Shiinotic (173,6–175,8); habilidade Illuminate (176,2–181,2); Professor's Research (182–185,5); arrasto longo de energia até o Mew ex (189,4–202); "Not enough Energy" (208–211); X Speed (212,5–217,6); "Retreat Cost is 1 less"; recuo Jynx→Mew ex (220–224,8); Potion no Jynx do banco (225,5–231); "Not enough Energy" no Genome Hacking (232,8–234,5); ataque Psyshot 20, Bronzor 60→40 (235,3–238,3) |
| 6 techycha | 239,8–262,5 | Banner com "Current turn: 6"; habilidade Metal Transport (251,6), Revavroom vira ativo; Outta-Control Dash 60 no Mew ex (259–261,6) |
| 7 Zanobi | 262,5–333,1 | Preview automático do ativo inimigo; compra; Illuminate; Copycat; Mythical Slab; estádio **Bounded Field** (316–322); recuo Mew ex→Sigilyph; ataque Spike Draw 10 (329,4–331,8) |
| 8 techycha | 333,1–350,9 | Outta-Control Dash 60 no Sigilyph (347,5–349,9) |
| 9 Zanobi | 350,9–385,6 | Deck vazio ("No cards left in deck"), energia, tentativa de Cyrus cancelada (câmera vai ao lado do oponente), Spike Draw 10 |
| 10 techycha | 385,6–426,7 | Poké Ball; Outta-Control Dash mata Sigilyph (KO 410,8); **+1 point techycha** (412,7–415,9); Zanobi promove Jynx (416–426,3) |
| 11 Zanobi | 426,7–470,7 | Energia, Drowzee ao banco, Cyrus (troca Bronzor ao ativo), Psychic 50 → **KO Bronzor** (461,6) → **+1 point Zanobi** (463,6–466,7) |
| 12 techycha | 470,7–520,4 | Meowth ao banco, Lucky Ice Pop (cura 20 + **cara ou coroa "Tails!"** 503,2–507,2), Outta-Control Dash 60 em Jynx |
| 13 Zanobi | 520,4–536,8 | Drowzee→Hypno, energia no Mew ex, Psychic 70 no Revavroom |
| 14 techycha | 536,8–~588 | Poké Ball, Meowth→Galarian Perrserker, Mega Mawile ex ao banco, Metal Transport (Bisharp ativo), Night Slash 60 → **KO Jynx** (574,6) → **+1 point techycha (2)** (576,8–579,9); Zanobi promove Mew ex |
| 15 Zanobi | ~588–616,8 | Banner "Your turn" escondido pelo preview automático; energia (arrasto de ~13 s), Genome Hacking copiando Metal Claw 70 (Perrserker 100→30) |
| 16 techycha | 616,8–651,4 | Zanobi abre o menu ≡ (Concede/Settings/Battle Log) e fecha; Giant Cape no Mega Mawile ex; Metal Transport; Mawile ao ativo; Heat-Up Crunch 60 no Mew ex |
| 17 Zanobi | 651,4–676,3 | Energia no Hypno; tenta Genome Hacking e desiste; recuo Mew ex→Hypno; End Turn |
| 18 techycha | 676,3–695,9 | Heat-Up Crunch **90** com tag "▲ Damage" no Hypno (100→10) |
| 19 Zanobi | 695,9–703,8 | Energia no Hypno, End Turn |
| 20 techycha | 703,8–722,0 | Heat-Up Crunch 120 → **KO Hypno** (716,5) → **3º ponto techycha** (718,5–722,0) |

### 2.3 Fim
| t (s) | Evento |
|---|---|
| 722,4–724,4 | Véu escuro + pílula **"Defeat"** |
| 724,6–731,6 | Tela branca de carregamento (~7 s) |
| 731,8–735,2 | Tela "Defeat...": Card of the Game + estatísticas → cartas do oponente |
| 735,4–739,5 | Tela de rank: 120→115 pts ("pts lost −5") |
| 740–741,4 | "You did not acquire any rewards." + Next |
| 741,6–747,5 | Ficha do oponente: Send Friend Request / Thanks! / X |
| 747,8–755,5 | Fade, spinner, volta ao lobby Ranked Match (115 pts) |

---

## 3. Layout da tela de duelo

Medido com grade de 5% sobre `t0085_0.png` (turno 1), `t0091_0.png` (turno do oponente), `t0400_0.png`, `t0440_0.png` e `t0476_0.png` (meio de jogo). Os valores variam ±1–2% entre frames.

### 3.1 Estrutura geral
- O tabuleiro é uma **mesa circular** (aro grosso: **coral/laranja** na metade de cima = oponente, **azul-ciano** na metade de baixo = jogador). Só a parte central cabe na tela; o aro aparece nos cantos.
- **Simetria vertical**: oponente em cima, jogador embaixo; a linha divisória fica em y ≈ 46–47%, entre os dois Ativos, que quase se tocam.
- O **playmat muda com o turno** (confirmado em todos os segmentos): neutro lavanda no setup; **neon escuro do Pikachu** (o do Zanobi) nos turnos de Zanobi; **Poké Ball claro** (metade de cima salmão, de baixo branca/lavanda) nos turnos de techycha (inferência: cada jogador tem seu playmat e a mesa mostra o de quem joga).
- HUD em camada fixa por cima: placas dos jogadores, chips, toasts, botões.

### 3.2 Tabela de regiões
| Elemento | Posição (x, y em %) | Detalhes |
|---|---|---|
| **Placa do oponente** | x 40–100, y 5,3–8,3 | Barra cinza-ardósia escura translúcida colada à borda direita; ponta esquerda chanfrada/arredondada. Da esquerda para a direita: 3 círculos de ponto (x 43–56), nome "techycha" branco (x ~63–75), pílula mais escura com ícone de relógio + "20:00" (x 80–93) |
| **Placa do jogador** | x 0–60, y 96,8–100 | Espelho: relógio "⏱ 19:24" (x 6–17), nome "Zanobi" (x 25–36), 3 círculos de ponto (x 43–56); ponta direita chanfrada |
| Mão do oponente | x 25–75, y 5–17 | Leque de versos (5–8 cartas) **de cabeça para baixo**, sobrepostos, parcialmente sob a placa |
| Zona de energia do oponente | prato x 12–24, y 13–18 | "Prato" circular branco-lilás; ícone pequeno da próxima energia (Metal) em x 12–17, y 16–18; quando há energia disponível aparece um orbe grande (x 13–23, y 12–16) |
| Descarte do oponente | x 0–17, y 23–32 | Carta do topo em face, desbotada, cortada pela borda esquerda |
| Deck do oponente | x 0–17, y 33–44 | Verso Poké Ball padrão, cortado pela borda esquerda |
| Banco do oponente (3 slots) | y 18–28; x 21–38 / 41–59 / 61–79 | Slots vazios = contorno branco arredondado. Cartas **menores** que as do jogador (~17% de largura contra ~22%) |
| Ativo do oponente | x 36–64, y 29–45,5 | Cartas do oponente **não** ficam rotacionadas 180°: aparecem de frente para o jogador |
| Ativo do jogador | x 35–65, y 47,5–66 | Ganha **borda ciano brilhante pulsante** quando pode atacar/agir no próprio turno (ex.: 132–134, 440) |
| Banco do jogador (3 slots) | y 67,5–81; x 15–37 / 39–61 / 63–85 | ~22% de largura, ~2% de espaço entre slots. No mat neon, slot vazio mostra um ícone de Poké Ball em neon rosa |
| **Mão do jogador** | x 22–78, y 82–98 | Cartas ~24% de largura, sobrepostas ~45%, leque leve; cortadas embaixo pela placa |
| Deck do jogador | x 85–100, y 48–60 | Capa personalizada (arte verde/colorida com borda verde), cortada pela borda direita. Some quando o deck acaba (~333) |
| Chip de contagem do deck | x 81–97, y ~53 | "▢ 15" (49,5–50,1), "▢ 13" (85,9–87,9) — aparece em momentos de compra/consulta |
| Descarte do jogador | x 86–100, y 62–74 | Carta do topo (Poké Ball → Pokédex → Copycat → Sigilyph…), cortada pela borda |
| **Zona de energia do jogador** | prato x 81–100, y 81–89 | Prato branco-lilás 3D; ícone pequeno da **próxima** energia (Psíquica) em x 91–97, y 84–88; orbe grande (roxo com olho) quando a energia do turno está disponível |
| **Menu ≡** | x 3–13, y 76–81 | Círculo cinza-ardósia escuro com 3 linhas brancas; sempre visível |
| Botão "olho" | x 2–13, y 82–87 | Círculo branco com olho cinza; só em estados modais (prompt de troca, painel "Deck") |
| Botões de efeito ativo (laterais) | jogador x 2–15, y 70–75; oponente x 87–100, y 19–24 | Círculo branco com ícone laranja: **estrela de 4 pontas ✦** enquanto o X Speed está ativo (219–231, `t0219_0`) e **triângulo ▲** depois do estádio Bounded Field (319,9 em diante). Só aparecem com efeito ativo (ver §10) |
| Estádio em jogo | x 1–24, y 49–62 | Carta inclinada na lateral esquerda com **halo amarelo** constante |
| **End Turn** | x 70–96, y 46–51 | Pílula branca, texto cinza-azulado, contorno ciano com brilho; à direita do Ativo, na altura da divisória |
| **Time limit** (turno próprio) | x 70–100, y 55–61 | Pílula ardósia colada à borda direita: "⏱ Time limit" pequeno + número grande branco |
| Time limit (turno do oponente) | x 70–100, y 36–41 | Mesmo chip, acima da divisória, perto do Ativo do oponente (verificado em `t0091_0`, `t0476_0`) |
| Time limit (setup) | x 33–67, y 46–49 | Centralizado |
| Toast / banner de instrução | x 3–97, y 15–23 | Pílula branca ~90% opaca, sombra suave, texto centralizado |
| Pílula "You are going first" | x 32–68, y 22–24 | Azul, texto branco, presa à borda inferior do toast (só no setup) |
| Banner de turno | x 0–100, y 47–53 + pílula "Current turn: N" y 53,5–59 | Ver §6.12 |

### 3.3 Elementos de carta no tabuleiro
- **HP**: número grande branco com contorno escuro no **canto superior direito**, saindo para fora da carta; abaixo, **barra fina** (~1/3 da largura da carta). Verde = saudável; laranja/amarela com HP baixo (ex.: Sigilyph 20 em `t0400_0`).
- Pequeno **"▲" laranja** sobrescrito ao lado do HP quando o HP máximo foi aumentado (Mew ex 130→150 com Giant Cape, `t0091_0`).
- **Energias anexadas**: ícones circulares na borda inferior esquerda da carta (~4% cada).
- **Ferramenta anexada**: miniatura quadrada da arte com **moldura dourada** sobre a borda esquerda da carta (Mew ex x 37–46, y 71–74).
- Cartas do Pokémon são a arte impressa completa (texto legível), sem moldura extra.

### 3.4 Tamanhos relativos
- Carta do Ativo do jogador ≈ 30% da largura × 18,5% da altura (proporção ≈ 0,73 ≈ 5:7).
- Banco do jogador ≈ 22% × 13,5% (≈ 73% do Ativo). Mão ≈ 24% × 15%.
- Ativo do oponente ≈ 28% × 16,5% (proporção 0,76); banco do oponente ≈ 17% × 10% (proporção 0,77–0,79). O lado do oponente é menor e um pouco "achatado" (ver §4).
- End Turn ≈ 26% × 4,5% (largura ≈ 0,9 carta do Ativo). Menu ≡ ≈ 10% de diâmetro.

---

## 4. Câmera / visão

- **Visão base**: de cima, quase ortográfica. Medida: cartas do oponente ~7% menores no Ativo e ~23% menores no banco, e com proporção mais achatada (0,76–0,79 contra 0,73) → **leve inclinação de perspectiva** que encolhe o lado de cima (inferência pelas medidas; dois analistas viram a mesa como plana, dois como levemente inclinada). O enquadramento é fixo durante a partida.
- **Intro** (17,9–18,5): mesa inteira pequena e girada ~-25°, desgira e dá zoom-in (~1,5–2×), ease-out.
- **Pós-coin** (24,1–24,4): zoom-out até o enquadramento de jogo, revelando o aro.
- **"Ready? Go!"** (51,6–52,6): zoom-in ~1,1× e volta.
- **Saída do banner "Opponent's turn"** (88,0–88,2): "punch" curto com motion blur.
- **Arrasto de energia** (282,6–285; 591–604,7): zoom ~1,1× no lado do jogador; bancos sobem/aumentam (banco do jogador y 65–80, cartas ~25% de largura; `b0283_67`, `t0597_0`).
- **Escolha de alvo no lado do oponente (Cyrus)** (368,4–374,4; 447,75–450,75): pan/zoom ~1,35× para cima; o banco do oponente vai para o meio da tela (y 36–50%) e o Ativo do jogador desce para y 75–95%; volta em ~0,2–0,4 s.
- **Prompt de promoção** (416–422): o lado do oponente desce ~6% na tela (ajuste leve de câmera).
- **Cut-in de ataque**: fundo com push-in de ~1,05–1,3×, blur e escurecimento; no Psyshot do Mew ex o fundo também gira ~5–10° (235,6–236,8). Volta com corte seco/"tranco" com motion blur (~0,1 s) e começa o impacto.
- **Impactos e KO**: sem movimento de câmera; o "avanço" é da própria carta.
- **"+1 point!"**, cara ou coroa, "Defeat": blur de tela inteira + véu colorido, sem mover a câmera.
- O lado do oponente é sempre mostrado de frente (cartas legíveis); só a mão dele fica invertida.

---

## 5. Fluxo e ordem

### 5.1 Partida completa
1. **Lobby** → Battle! → busca (globo, Cancel) → "Opponent found!" → perfil do oponente (~2 s) → loading (~7 s).
2. **Intro da mesa** (~0,6 s) → **VS** (~2 s) → **cara ou coroa** (~0,6 s girando + ~1 s parada) → **"Going first"** (~0,8 s).
3. **Zoom-out** + decks entram + **distribuição de 5 cartas** para cada um (~0,5 s, ~0,1 s entre cartas).
4. **Setup** (chip "Time limit 90" central):
   - Toast "Please put a Basic Pokémon in the Active Spot." + pílula "You are going first".
   - Arrasta o Basic → slot ciano → encaixe → **revelação** (~2 s).
   - Toast "Please put up to 3 Basic Pokémon onto your Bench, then tap Start Battle." + botões **↺ Reset** (x 3–30, y 47–49,5) e **Start Battle** (x 70–97, contorno ciano), ladeando o chip de tempo.
   - "Waiting for opponent to set up..." até o oponente terminar. As cartas do oponente descem viradas e são reveladas juntas por flip.
5. **Placas entram** (topo pela direita, base pela esquerda) → **"Ready? Go!"** → banner **"Your turn" / "Current turn: 1"** + troca de playmat.
6. **Loop de turnos** (§5.2) até alguém fazer 3 pontos.
7. **Ponto final** → **"Defeat"/"Victory"** (só "Defeat" foi visto) → loading → telas de resultado (§8.6) → lobby.

### 5.2 Ordem dentro de um turno (lado do jogador)
1. Banner **"Your turn"** + "Current turn: N" (~0,5–1,0 s) com troca de playmat por hexágonos.
2. **Preview automático do Ativo do oponente** (~2 s) com o chip **"Expected damage · <ataque> <dano>"** (263,1–265,2; 584–589). Isso pode cobrir o banner (turno 15).
3. **Compra**: a carta sai do deck (direita), aparece **grande no centro** (~0,6 s) e vai para a **ponta direita** da mão (55,8–56,9; 265,3–266,7). Deck vazio → toast "No cards left in deck; unable to draw cards" (~2–3 s).
4. **Geração de energia**: estrela/flash no prato + orbe grande + rótulo **"Next Energy generated"** (x 60–97, y 74–78) (266,8–267,5; 428,3; 653,2). O turno 1 de quem começa não gera energia.
5. **Chip "Time limit"** aparece por ~4–5 s e o **End Turn** surge (fade-in, 132–133).
6. Ações livres, em qualquer ordem: jogar Basic, evoluir, Item, Supporter, Tool, Stadium, anexar 1 energia, habilidades, recuar.
7. **Atacar** (toque no Ativo → painel → toque no ataque) **encerra o turno sozinho**: cut-in → impacto → HP → (KO → ponto → promoção) → banner do oponente. Ou **End Turn**.
8. O **relógio da placa troca de dono** no instante em que o ataque é confirmado ou o End Turn é tocado, ainda durante a animação (533; 574; 646,6).

### 5.3 Turno do oponente (como é apresentado)
- Banner coral **"Opponent's turn"** entrando pela direita + playmat claro.
- Compra: verso sai do deck (esquerda) para o leque do topo (88,9). Energia: flash + orbe Metal no prato do topo (89,5–89,9; 473).
- Chip **Time limit** acima da divisória por ~4–5 s.
- Enquanto ele pensa: toast **"Waiting for opponent..."** em texto **vermelho**, intermitente (92,4–94,9; 476–492; 623,5…).
- Cartas jogadas: **verso** desce do leque → **flip em Y** → preview grande (~0,5–0,7 s) → resolução com luz (cores por tipo, §6.6).
- Basics/evoluções aparecem direto no slot com brilho; Basics e evoluções do oponente não passam pela revelação grande, exceto Pokémon ex (Mega Mawile ex teve revelação, 553,4–555).
- Ataques: mesmo cut-in, com a faixa do tipo dele.

### 5.4 Nocaute → ponto → promoção
1. HP chega a 0 em vermelho e **fica ~0,6–1 s parado** (ou mais, se houver efeito pendente: Jynx ficou ~3,5 s em 0 enquanto o Night Slash resolvia a troca, 571–574,6).
2. **Dissolução** num orbe/anel ciano (~0,4–0,6 s) → slot vazio → a carta **reaparece no descarte do dono**, entrando pela borda (~0,3 s).
3. Pausa ~1 s → tela **"+1 point!"** (~3,0–3,2 s) → a bolinha da placa vira dourada no mesmo instante.
4. Se quem perdeu o Ativo foi o jogador: véu escuro + toast **"Please choose a Pokémon to switch in"** + banco em ciano + botão olho + chip "Time limit 20–23" (inferência: ~20 s para escolher). Tocar → véu some (~0,15 s) → pausa ~1,3 s → **revelação** da carta indo para o Ativo (~2,1 s).
5. Depois disso vem o banner do próximo turno.

---

## 6. Animações

### 6.1 Matchmaking (1,2–10,6) — `burst_0001.20-0003.20.jpg`, `burst_0005.80-0010.60.jpg`
- Battle! pressionado: fica azul mais escuro com brilho/redemoinho; a UI perde opacidade e sobe ~3% (~0,2 s).
- "Searching for opponent..." em fade; o globo entra com pop (~30% da largura, y≈52%); a órbita gira e o núcleo pulsa a cada ~3 s (inferência).
- Achou: Cancel desabilita (6,0); o texto some e o globo encolhe; "Opponent found!" + aperto de mãos entra com leve rotação e overshoot (6,40→6,81).
- Faixa diagonal ciano→azul desce do topo (8,0); cartão de perfil em fade (8,21); tudo some em ~0,2 s (10,21).

### 6.2 Intro + VS (17,9–21,1) — `burst_0017.40-0020.40.jpg`, `burst_0020.40-0024.40.jpg`
- Mesa entra em fade, girada e afastada; desgira + zoom-in em ~0,5 s (ease-out).
- Overlay cinza ~50%; a faixa coral entra pela direita (avatar do oponente na ponta direita) e a azul pela esquerda (avatar do jogador na ponta esquerda).
- Dois arcos brancos em "C" giram e se juntam num contorno de Poké Ball (19,0–19,5); o centro estoura num disco branco (19,62) e uma onda de choque arco-íris se expande com partículas (19,71).
- Layout final: avatar circular do oponente (x 33–67, y 24–40), frase e nome; "VS." branco itálico enorme no centro (x 36–62, y 49–54); frase, nome e avatar do jogador (y 63–79); pílulas laranja "Poké Ball Rank 1" (oponente topo-direita, jogador base-esquerda).
- Fica ~1,1 s; saída: as faixas giram para um ângulo mais íngreme e somem em ~0,15 s.

### 6.3 Cara ou coroa
**Ordem de quem começa (21,1–24,0)** — `burst_0020.40-0024.40.jpg`
- Moeda no centro do tabuleiro escurecido (x 42–58, y 46–54).
- **Flip 3D rápido** (~0,6 s, 3–4 meias-voltas) com escala ~1,4× no meio; faces: arte do Pokémon do jogador (Rayquaza) / verso preto.
- Parada ~1 s; depois fundo ciano com raios horizontais, moeda ~2× e pílula azul "Going first" (y 40–43) por ~0,7 s; moeda encolhe e some (23,65–24,0).

**Efeito de carta (Lucky Ice Pop, 503,1–507,2)** — `burst_0503.00-0507.80.jpg`, `b0505_06.png`, `b0506_62.png`
- Véu **vermelho/salmão** ~70% sobre a mesa desfocada (cor de quem joga a carta, inferência); texto do efeito em branco no topo (x 2–98, y 9–15); pílula vermelha sólida "Waiting for opponent..." embaixo (y 86–89).
- Moeda entra com pop (8%→28% da largura em ~0,15 s), centro x 49, y 38, face **cara = Poké Ball vermelha/branca**; parada ~1,1 s (esperando o lançamento).
- **Lançamento** (504,69): o véu vira cinza-azulado; a moeda gira no eixo horizontal (~1,5 voltas em ~0,8 s) enquanto **desce** de y 38% para ~65%. Nenhum arco para cima foi visto.
- Pouso: coroa (preta, logo em relevo), parada ~0,75 s.
- Resultado: véu volta a vermelho; a moeda reaparece **grande** (~49% da largura, centro y 56) e o texto **"Tails!"** (branco itálico, contorno escuro) é **digitado letra a letra** acima dela (y ~41).
- Overlay some de uma vez (507,21). Total ~4,0 s.

### 6.4 Distribuição inicial (24,9–25,8) — `burst_0024.20-0027.60.jpg`
- O deck do oponente desliza da borda esquerda e o do jogador da direita (24,13–24,40). O menu ≡ e os pratos de energia aparecem em 24,62.
- As cartas voam em arco do deck esquerdo para o leque do topo (viradas) e do deck direito para a mão (aparecem como lâmina fina no meio do voo, ou seja, viram de face; inferência). Intervalo de ~0,1 s entre cartas, ~0,5 s no total. A mão se acomoda em 25,6–25,8.

### 6.5 Colocar Pokémon e revelação — `burst_0027.50-0031.70.jpg`, `burst_0061.30-0064.60.jpg`, `burst_0064.60-0068.60.jpg`, `b0029_42.png`
- **Arrasto**: o preview some, a mão volta ao normal e entra um overlay escuro no tabuleiro. Os slots válidos ganham **borda ciano grossa brilhante** (só o Ativo no setup; os 3 slots do banco em 63,6). A carta arrastada fica reduzida (~25% da largura), inclinada ~-10°, com contorno claro.
- **Soltar**: encaixa com brilho ciano e o overlay sai em ~0,4 s.
- **Revelação** (~1,2–1,6 s depois de soltar; ~2 s no total):
  - A carta sobe do slot e escala.
  - Comprime na horizontal e mostra o **verso** (capa do jogador) num giro em Y.
  - Fica de frente, **grande no centro** (x 17–83, y 33–71), com flash de reflexo e estrelinhas, por ~0,7 s.
  - Encolhe e volta ao slot (ease-in, ~0,35 s), com partículas douradas em volta.
- Só depois aparecem o **número de HP** e a barra (Jynx "80" em ~33; Mew ex "130" em 66,3).
- A **promoção após KO** usa a mesma revelação (424,15–426,3, `b0424_46.png`).

### 6.6 Jogar Trainer (Item / Supporter / Stadium) — `burst_0055.50-0058.90.jpg`, `burst_0058.90-0061.30.jpg`, `burst_0077.40-0081.60.jpg`, `burst_0315.80-0320.20.jpg`
- **Arrasto**: overlay escuro + **zona de soltura verde translúcida** (retângulo arredondado, borda verde-clara) sobre o centro da mesa (x 3–97, y 29–73). A carta arrastada fica inclinada, com contorno branco/verde (`b0057_90.png`).
- **Soltar fora** da zona: a carta volta para a mão (Copycat, 277–278).
- **Soltar dentro**: a zona some (~0,1 s); ~0,7 s depois a carta reaparece pequena no centro e cresce em ~0,1 s até preview grande levemente inclinado (x ~7–80, y 27–70); fica ~0,7 s.
- **Dissolução** (~0,4–0,5 s): a carta vira um retângulo superbrilhante, a moldura se expande para fora em camadas e vêm raios de luz e fade. **A cor segue o tipo da carta**:
  - Item: branco/ciano; várias molduras ciano deslocadas no Poké Ball do oponente (392,1).
  - Tool: branco com bordas lilás/roxas (74,29).
  - Supporter: laranja/dourado (96,21; 452,0; Copycat branco→feixes dourados 300,2).
  - Stadium: moldura verde neon que se expande até quase a tela toda e encolhe (317,8–318,2).
- O "clarão branco grande" do overview (80 s) é a dissolução do Pokédex.
- **Stadium**: depois da dissolução, a carta voa até o slot lateral esquerdo (x 2–23, y 50–62) com brilho amarelo (318,6–319,2). Em seguida vêm uma caixa de texto com o efeito no topo (319,9–322,5) e **colunas de luz dourada** subindo de todos os Pokémon (~0,6 s).
- **Efeitos de busca/compra**: a carta buscada sai do deck, aparece em preview grande inclinada (~0,6 s) e vai para a ponta direita da mão (60,9–62,0). Em compras múltiplas (Copycat) o ritmo é de ~1 carta/s, cada uma com preview (301–309,5); o deck "treme" ao embaralhar (301,9–303,1).
- **Olhar o topo do deck** (Pokédex 80,9–83,8; Mythical Slab 294,5–296,8):
  - Cartas de verso saem do deck; overlay escuro.
  - Folha branco-azulada "Deck" (y 41–87) com cabeçalho ardósia e ícone de olho; as cartas ficam em grade com **badge numerado** (ordem no deck).
  - Toast "Please tap OK after you've finished looking at the cards"; botão **OK** ciano com brilho; botão olho à esquerda.
  - As cartas voltam voando para o deck.

### 6.7 Pokémon Tool — `burst_0068.60-0072.60.jpg`, `burst_0072.60-0077.40.jpg`, `burst_0628.60-0632.20.jpg`
- Arrasto **sem zona verde**: overlay escuro, só os Pokémon válidos com contorno ciano e toast "Please choose a Pokémon to attach the Pokémon Tool to". Dá para pairar e afastar antes de soltar.
- Ao soltar: a carta sobe do alvo para o centro, preview ~0,7 s e dissolve (lilás).
- Faísca no canto inferior esquerdo do alvo → ícone quadrado com moldura dourada aparece na borda esquerda da carta (75,40) → **anel dourado pulsando** em volta da carta (76,25–76,94) → HP 130→150 + "▲" ao lado do HP → toast **"+20 HP"** (76,38–78,8).
- No oponente (628,9–632,2) a sequência é a mesma, mas o verso vira primeiro (flip em Y) e caem raios dourados sobre a carta.

### 6.8 Energia — `burst_0282.30-0285.50.jpg`, `burst_0428.80-0431.90_crop.jpg`, `b0283_67.png`
- **Geração**: estrela/flash branco no prato + orbe roxo com o olho; rótulo "Next Energy generated". **Antes de ser usado, o orbe pulsa** com halo rosa/roxo.
- **Arrasto** (só por arrasto; nenhum toque simples foi visto):
  - O orbe (~12–14% da largura) segue o dedo com **rastro de luz roxa**.
  - A câmera dá zoom ~1,1× no lado do jogador e o End Turn some.
  - Todos os Pokémon próprios (Ativo e banco) ganham **contorno ciano**.
  - O alvo sob o dedo recebe **véu verde translúcido + borda verde**.
- **Soltar**: o orbe encolhe para a fileira de ícones de energia da carta (canto inferior esquerdo), com brilho roxo na carta (~0,1 s). Arrasto típico ~0,8 s, mas o jogador pode pairar por vários segundos (591–604,7).
- **Oponente**: só se vê o orbe sumir do prato e o ícone aparecer na carta (inferência).

### 6.9 Evolução
- **Jogador** (Morelull→Shiinotic 173,6–175,8, `burst_0173.60-0176.60.jpg`, `b0174_90.png`; Drowzee→Hypno 523–525, só a 1 fps):
  - Na mão, a carta que pode evoluir ganha **contorno amarelo** (173,6–173,8), diferente do ciano das outras jogáveis.
  - Arrasto com contorno branco e leve escurecimento; encaixa sobre o Pokémon (174,31).
  - Riscos de luz diagonais (174,71) → a carta fica **toda branca** (silhueta, 174,81–175,12) → a cor volta (175,21) → **fitas de luz azul-brancas sobem** da carta (175,31–175,5) → assenta com o HP novo (175,62).
  - Total ~1,4 s.
- **Oponente** (Varoom→Revavroom 153,4–154,5, `b0153_71.png`; Meowth→Perrserker 548–550):
  - A carta, já de frente, desce do leque do topo até o slot, crescendo ~1,3×.
  - Fica branca e brilhante sobre o slot (153,71–154,0) → **feixes verticais de luz branca** sobem do slot (154,12–154,31) → assenta com o HP novo.
  - Total ~1,1 s.
- Uma "Mega evolução" com animação própria **não** foi vista: o Mega Mawile ex foi baixado já como ex no banco, com revelação grande (553,4–555).

### 6.10 Habilidade — `burst_0251.30-0255.30.jpg`, `burst_0268.30-0273.50.jpg`, `burst_0560.40-0565.40.jpg`
- **Jogador**: tocar no Pokémon do banco → a carta cresce (x 33–93, y 47–90) com um **painel "Ability | Illuminate"** por cima (fundo rosa claro, tag vermelha "Ability", nome em vermelho, **borda amarela brilhante pulsante** = acionável). Ao tocar, a borda fica branca e a carta volta ao slot (269,2–269,5).
- **Execução (jogador e oponente)**:
  - Véu cinza-azulado (~30%) na tela.
  - Estouro dourado + faíscas na carta.
  - Etiqueta **pílula branca com tag vermelha "Ability" + nome em vermelho** perto da carta (~1,3–1,4 s).
  - Enquanto a etiqueta está na tela, os números grandes de HP somem (270,1–271,4).
- **Troca de Ativo por efeito** (Metal Transport 254,3–254,9; 563,4–563,9): a carta do banco sobe com escala ~1,4× e uma **coluna azul translúcida** liga a origem ao destino; a carta desce ao Ativo em ~0,3 s (o outro Pokémon vai ao banco ao mesmo tempo); ao pousar, o novo Ativo pulsa com borda ciano por ~0,3 s.

### 6.11 Painel de ataque e recuo — `t0210_0.png`, `t0443_0.png`, `burst_0323.60-0327.60.jpg`, `burst_0608.40-0612.40.jpg`
- **Abrir** (tocar no próprio Ativo, ~0,2–0,3 s):
  - A carta sai do slot inclinada ~10° e cresce até x 33–96, y 47–88, levemente inclinada (~-3°).
  - O tabuleiro escurece ~30%.
  - No topo da carta ampliada aparece uma aba com HP + ícone do tipo.
- **Conteúdo do painel**:
  - **Linha de ataque**: retângulo arredondado translúcido (x 15–96, y ~62–79 conforme o número de ataques); custo de energia à esquerda, nome em negrito no centro, dano à direita (com "▲" laranja quando o dano está modificado, ex. "Psychic 50▲", "70▲") e texto do ataque embaixo.
  - **Estados**: utilizável = fundo lilás/rosa com **borda brilhante** (dourada na Jynx em `t0443_0`; ciano no Psyshot do Mew ex); sem energia = **cinza sem brilho** (`t0210_0`, Genome Hacking em 324).
  - **Pílula "retreat"**: branca, ícone do custo (energia incolor) à esquerda, contorno **ciano brilhante** quando possível (x 47–96, y 81–85).
- **Ataque sem energia**: tocar mostra o toast **"Not enough Energy"** (texto vermelho, y 15–22) e o painel continua aberto (210; 234).
- **Escolher o ataque**: ripple circular claro no ponto do toque; o botão escurece e perde o brilho; o painel recolhe ao slot (~0,2 s); o cut-in começa ~1–1,4 s depois (380,8→382,1; 456,5→457,9).
- **Ataque com escolha** (Genome Hacking 610,0–611,6): toast "Please choose the target attack"; a carta volta em zoom e a linha do ataque é **trocada pelo ataque copiado** ("Metal Claw 70" com o custo dele). Dá para voltar sem confirmar (661,8–663,4).
- **Recuo**:
  - Tocar "retreat" fecha o painel.
  - Véu escuro + botão olho; toast "Please choose a Pokémon to switch in"; banco em ciano (324,7–325,4).
  - Tocar no substituto: o véu sai; o substituto sobe do banco **em arco** (escala ~1,15× no meio do caminho) enquanto o antigo Ativo desce ao banco com **rastro rosa/roxo**; o novo Ativo assenta com borda ciano (~0,8 s, 325,6–326,5).
  - Variação 223,4–225,0: o substituto vira o verso no centro e é revelado grande antes de assentar.
  - Toast **"Retreat Cost is 1 less"** quando há desconto (X Speed, 220,6).

### 6.12 Banners de turno + troca de playmat — `burst_0052.40-0056.40.jpg`, `burst_0086.40-0089.60.jpg`, `burst_0616.40-0618.60.jpg`, `b0054_58.png`
- **"Your turn"**: faixa horizontal com gradiente **ciano → azul** (x 0–100, y 47–53) e borda de ponta inclinada; texto branco negrito grande. **Entra pela esquerda** (~0,15–0,2 s, ease-out); a saída foi vista para a direita (54,92; 652) e, em outros turnos, como deslize curto para a esquerda com fade/fragmentação (112,2–112,5; 262,85–262,96).
- **"Opponent's turn"**: gradiente **salmão/laranja → vermelho**; **entra pela direita**, sai pela esquerda (às vezes com motion blur e "punch" de câmera, 88,0).
- Abaixo, pílula cinza-ardósia/azul-marinho translúcida **"Current turn: N"** (x 20–80, y 53,5–59), com o número maior.
- Tempos: entrada ~0,1–0,2 s, permanência ~0,3–0,6 s, saída ~0,2 s; total **≈0,5–1,0 s**.
- **Troca de playmat**: durante o banner, **hexágonos** (branco, menta, lilás, rosa, amarelo-pálido, escuros) se acendem em mosaico aleatório e revelam o novo mat em ~0,5–0,7 s. As cartas não se movem.
- Antes do turno 1 vem **"Ready? Go!"** (52,40–53,30): texto branco itálico inclinado ~-8°, com traço laranja-vermelho acima e azul abaixo cruzando na diagonal; onda de choque branca do centro + partículas tipo neve; sai pela esquerda.

### 6.13 Cut-in do nome do ataque (≈1,0–1,5 s) — `burst_0407.30-0411.30.jpg`, `burst_0612.40-0616.40.jpg`, `burst_0689.40-0693.40.jpg`, `b0407_81.png`, `b0613_31.png`
- **t+0**: faixa diagonal (inclinação ~-8° a -12°, sobe para a direita, largura total, y ~60–75) entra deslizando pelo canto inferior. Cor do tipo do atacante: **lilás/rosa** = Psíquico (Mew, Jynx, Sigilyph); **bege/creme com listra azul-marinho** = Incolor/Metal (Revavroom, Bronzor); **cinza-prateado/branco** = Metal (Mawile, Bisharp).
- Linhas de velocidade brancas cruzam a tela; o fundo escurece/desfoca e dá push-in de ~1,05–1,3×. No Psyshot do Mew ex (235,6–236,8, `b0236_00.png`) o tabuleiro de fundo também **gira ~5–10°**, ganha tom roxo e a carta chega a ~2,3×. Nos ataques do Bronzor (Speed Dive) a carta só se ergue no próprio slot (~1,3×) com o fundo acinzentado (inferência: a intensidade varia por carta/raridade).
- A faixa entra deslizando pela lateral e fica completa em ~0,1 s. Na maioria dos bursts a ponta aparece primeiro do lado esquerdo/inferior (108,12; 613,0); em 407,62 foi vista primeiro à direita.
- **t+0,1**: nome do ataque em branco, negrito, arredondado e grande, com contorno cinza; nome do Pokémon menor embaixo à direita, na listra.
- Ao mesmo tempo, a **carta atacante sai do slot** pequena e inclinada (~+10°, perspectiva 3D em Y) e **cresce** até x ~5–95, y ~22–78, endireitando (ease-out). Do lado do oponente ela vai para o topo; o atacante do jogador sobe ao centro.
- **t+0,8–0,9**: faixa e texto somem (fade ou deslize para baixo/esquerda com motion blur).
- **t+0,9–1,3**: a carta fica sozinha, grande, com o holo animado.
- **t+1,4**: corte seco / "tranco" de volta à mesa e o impacto começa.

### 6.14 Impacto, número de dano e HP — `b0409_00.png`, `b0459_92.png`, `b0614_71.png`, `b0691_62.png`
- **Avanço**: a carta atacante encolhe e voa até o Ativo inimigo, sobrepondo a borda dele (para cima no ataque do jogador, para baixo no do oponente).
- **Flash branco** em estrela sobre o alvo (1–2 frames).
- **Explosão no estilo do tipo** (~0,3 s):
  - Psíquico: orbe/estrela **roxa-magenta espinhosa** com anéis; número branco com contorno roxo **dentro de um anel**.
  - Incolor/Metal: **estilhaços cinza/prateados** em estrela (ou quadrado cinza-escuro); número no centro.
- **Número de dano**: grande (~13% da largura), branco com contorno escuro, centrado na carta (y ~55–59 do alvo). Fica ~0,8 s estampado na carta, escurecido, e esmaece.
- **Tag laranja "▲ Damage"** abaixo do número quando o dano passa do valor base (691,6; 713,4).
- **HP**: o número fica **vermelho e maior** e conta para baixo **em degraus de ~0,1 s** (150→130→100→90; 40→30→20→10→0); a barra encolhe junto. No fim volta a branco (ou fica vermelho em 0).
- Do início do cut-in ao fim da contagem: **~2,6–3,1 s**.
- **Efeito pós-ataque** (Heat-Up Crunch): toast de 2 linhas "Heat-Up Crunch / does +30 damage" + **anel de fogo laranja-dourado** girando em volta do atacante por ~0,8 s (650,2; 694; 715,2).
- **Cura**: número **verde** "20" grande com contorno branco + arcos de luz verde; o HP fica verde e sobe em degraus (90→100→110), com brilhos (500,7–502,4; 130,0).
- **Indicador de fraqueza**: quando um Pokémon de tipo Metal vira Ativo do oponente, aparece um **badge circular vermelho pulsante** com o ícone do tipo no canto superior direito dele (x 55–68, y 25–34) e uma pílula branca de borda vermelha **"Weakness [ícone]"** sob o Pokémon do jogador que é fraco a esse tipo (Shiinotic). Pulsa 2–3 vezes (~1,2 s) e some (255,1; 453,75; 469,4; 564,3; 642,2).

### 6.15 Nocaute — `b0411_00.png`, `b0461_96.png`, `b0716_62.png`
- A carta clareia; aparece um **anel ciano fino** no centro.
- A carta encolhe/dissolve dentro de uma **esfera/orbe branco-ciano brilhante** com anel e partículas (x 32–68, y 49–64).
- O orbe expande e esmaece; fica uma silhueta fraca; o **slot vazio** reaparece (contorno).
- Dissolução total ~0,4–0,6 s.
- A carta reaparece **pequena no descarte do dono**, entrando pela borda (direita = jogador, esquerda = oponente), em ~0,3 s.

### 6.16 Tela "+1 point!" (≈3,0–3,2 s) — `burst_0411.30-0416.50.jpg`, `burst_0463.40-0467.60.jpg`, `burst_0715.40-0719.40.jpg`, `b0414_69.png`, `b0465_33.png`, `b0720_90.png`
- Mesa inteira com **blur + véu branco ~60%**.
- Faixa larga horizontal (x 0–100, y 44–65) entra pela lateral em ~0,15 s: **coral/vermelha** para o oponente (gradiente laranja→vermelho), **azul** para o jogador.
- **Avatar circular** grande (~32–34% da largura, centro x 50, y ~42) sobre o topo da faixa; nome em branco (y ~52–54).
- **Fita escura em chevron** (x 18–82, y 54–62) com **3 medalhões numerados** (x ~34/50/66, ~10% da largura): não conquistados = escuros da cor da faixa; conquistados = **moeda dourada com número laranja itálico**.
- Conquista: uma bola de luz voa até o medalhão (ou um **anel branco se contrai** sobre ele, no ponto final) → anel de choque + raios → o medalhão vira dourado (~0,3–0,5 s).
- **"+1 point!"** (branco negrito, sombra) aparece com pop acima do avatar (y ~29–31), enquanto um **disco/anel rosa ou azul-claro** se expande atrás do avatar; no ponto final há anéis concêntricos e um flash rosa de tela cheia de 1 frame (720,3).
- Parada ~0,7 s → a faixa sai lateralmente (direita ou esquerda) e a mesa volta nítida em ~0,1 s; a bolinha correspondente na placa já está dourada.

### 6.17 Derrota e transição (722,4–731,6) — `b0722_81.png`
- Véu azul-acinzentado escuro (~60%) instantâneo.
- Pílula **"Defeat"** (gradiente laranja→rosa-vermelho, texto branco negrito, x 0–96, y 49–55) entra com fade + leve scale-up (0,85→1,0) e fica ~2 s.
- Fade para cinza claro; tela vazia com spinner pontilhado rosa por ~7 s.

### 6.18 Previews (toque longo / toque)
- **Mão**: tocar expande a mão para a largura toda (x 0–100, y 77–97), cartas ~1,3× maiores em leque mais aberto (as da esquerda giram ~-8°, as da direita ~+5°); a carta sob o dedo **sobe** ~3%.
  - Preview grande em x 8–92, y 24–76, **trocado na hora** ao deslizar o dedo (~0,15 s por carta).
  - Chip **"▢ N"** com a contagem da mão (x 81–96, y 78–82).
  - O preview pode ficar **translúcido** (276; 322).
  - Ver `b0026_40.png`.
- **Carta no tabuleiro** (toque/segurar): preview grande (x 3–97, y 25–80) com pop de 1 frame e chip ardósia **"Expected damage / <ataque> <dano>"** (x 13–89, y 82–87; 44,4; 165; 205). Previews de cartas do oponente mostram uma seta "<" na borda esquerda (inferência: navegar entre cartas). Some ao soltar.

### 6.19 Telas pós-partida (731,8–755,5) — `t0734_0.png`, `t0736_0.png`, `t0742_0.png`
- Cabeçalho com **gradiente diagonal laranja→rosa** (borda inferior diagonal de y 17% a 8,5%); avatar do jogador (x 41–58, y 11–18); "vs. techycha"; **"Defeat..."** grande cinza-azulado escuro (y 22,5–26) em fade-in.
- **Página 1**: botão "Battle Log" (pílula, x 3–30, y 30–33); emblema "Card of the Game" (louros dourados + coroa) com a carta própria em destaque (Jynx holo levemente rotacionada); tabela de estatísticas em pílulas: Turn order **Went first**, Turns played **20**, Your points **1**, Opponent's points **3**, Damage done **230**; **"Tap to Proceed"** pulsando a opacidade (~2 s), embaixo.
- **Página 2**: "Your opponent's cards" + carta do jogo do oponente (Mega Mawile ex, com lupa).
- **Rank**: painel branco com emblema laranja-vermelho, "Poké Ball Rank 1", pontos contando 120→118→116→115 com a barra teal encolhendo, "pts lost −5", "25 pts to reach the next rank".
- **Recompensas**: "You did not acquire any rewards." + **Next** (pílula com contorno ciano).
- **Ficha do oponente**: sobe de baixo com fade (~0,2 s): avatar grande, nome, "Send Friend Request", "Send a thanks?" (com o texto sobre shop tickets), botão **Thanks!** (contorno ciano) e **X** circular.
  - Ao tocar Thanks!: um **coração rosa sobe** do botão até o avatar (743,2–743,8), um anel branco se expande sobre o avatar, e o texto "Thanks!" ondula letra a letra no lugar do botão.
- Fade branco → spinner → lobby Ranked Match (115 pts, deck "09 Mind", Battle!), com a barra de navegação de 5 ícones.

---

## 7. Botões e menus

| Botão / menu | Local | Forma e estados | O que faz | Quando aparece/some |
|---|---|---|---|---|
| **Battle!** (lobby) | x 27–73, y 80–85 | Pílula ciano; escurece quando pressionado | Inicia a busca | Lobby |
| **Cancel** (busca) | x 30–70, y 91–94 | Pílula branca, texto cinza; fica esmaecido ao achar oponente | Cancela a busca | 2,2–6,0 |
| **↺ Reset** (setup) | x 3–30, y 47–49,5 | Pílula branca simples | Desfaz o setup (inferência) | Após o Basic no Ativo (31,35) |
| **Start Battle** | x 70–97, y 47–49,5 | Pílula branca com contorno ciano brilhante | Confirma o setup | Idem; some ao tocar |
| **End Turn** | x 70–96, y 46–51 | Pílula branca, texto cinza-azulado, contorno ciano brilhante. Entra em fade (132→133); pressionado = escurece (86,62) | Passa o turno | Só no turno próprio, quando livre. Some com mão expandida, arrasto, painel, prompt ou animação; volta depois de cada ação (57,3; 67,4; 84,1; 434; 590) |
| **Menu ≡** | x 3–13, y 76–81 | Círculo ardósia; halo claro ao tocar (623,9) | Abre o popover | Sempre na mesa |
| **Popover do menu** | painel x 0–86, y 58,5–85 | Folha branca translúcida, cantos arredondados; **desliza da esquerda** em ≤0,12 s (ease-out); fecha **instantaneamente** | Itens: **"Concede"** (pílula branca com **contorno e texto vermelhos**, x 24–63, y 63,5–66,5), **"Settings"** (barra com engrenagem em marca d'água, x 5–80, y 69–73), **"Battle Log"** (barra com ícone de documento, x 5–80, y 76–80) | Cobre o ≡ e a mão; a mesa fica levemente esmaecida; o chip Time limit continua visível (`b0624_12.png`) |
| **Olho** | x 2–13, y 82–87 | Círculo branco com olho | Inferência: espiar a mesa sem o overlay | Só em prompts modais (troca, promoção, painel "Deck") |
| **Botões de efeito ativo** (✦ / ▲) | jogador x 2–15, y 70–75; oponente x 87–100, y 19–24 | Círculo branco com ícone laranja do efeito (✦ X Speed; ▲ estádio). O mesmo ícone pequeno aparece no canto das cartas afetadas | Não foram tocados no vídeo (inferência: mostram os efeitos ativos de cada lado) | Enquanto houver efeito ativo daquele lado (X Speed 219–231; Bounded Field 319,9 até o fim) |
| **Painel de ataque** | ver §6.11 | Linhas de ataque com brilho (utilizável) ou cinza; pílula "retreat" | Ataca / recua | Ao tocar no próprio Ativo |
| **Painel de habilidade** | x 15–95, y 70–78 sobre a carta ampliada | Borda amarela pulsante | Usa a habilidade | Ao tocar num Pokémon com habilidade ativável |
| **OK** (painel "Deck") | x 27–73, y 81,5–87 | Pílula ciano com brilho | Fecha o painel | Pokédex / Mythical Slab |
| Toasts | x 3–97, y 15–23 | Pílula branca, texto escuro; "Waiting for opponent..." e "Not enough Energy" em **vermelho**; entram/saem com fade ~0,1–0,2 s | Informativos | Textos vistos: setup, "Please choose a Pokémon to switch in", "Please choose a Pokémon to attach the Pokémon Tool to", "Please choose a Pokémon to heal", "Please choose the target attack", "Please tap OK after you've finished looking at the cards", "No cards left in deck; unable to draw cards", "+20 HP", "Retreat Cost is 1 less", "Heat-Up Crunch / does +30 damage", efeito do estádio |
| Chip "Time limit" | ver §3.2 | Ardósia, número grande | Contagem do turno (começa em 90; prompts de troca ~20–23) | Aparece em janelas de ~4–5 s no início do turno, nos prompts e periodicamente em turnos longos (44→42 em 514–516) |
| Relógio da placa | nas placas | "⏱ mm:ss" | Tempo total da partida de cada jogador (20:00), estilo **relógio de xadrez**: só corre o de quem age (inclusive nos prompts dele) | Sempre |
| Pós-partida | ver §6.19 | Battle Log, Tap to Proceed, Next, Send Friend Request, Thanks!, X | Navegação de resultado | 731,8–747,8 |

---

## 8. Detalhes de comportamento

- **Destaque de alvos válidos**: **borda ciano grossa brilhante** em slots e cartas válidas (setup, banco no arrasto de Pokémon, Pokémon para Tool, banco na troca/promoção). Com filtro de regra: no Cyrus **só o Bronzor danificado** ficou destacado (368,4; 447,75).
- **Alvo sob o dedo** (arrasto de energia): **véu verde translúcido + borda verde**; os demais alvos ficam em ciano.
- **Zona de soltura de Trainer**: retângulo verde translúcido grande sobre a mesa.
- **"Pode agir"**: Ativo com borda ciano pulsante quando pode atacar; **cartas jogáveis da mão com contorno ciano** (as que não podem ser jogadas ficam sem contorno, ex.: Potions sem alvo no turno 1); carta de **evolução jogável com contorno amarelo** (173,6); Pokémon do banco com **habilidade usável com contorno dourado** (176,2, inferência).
- **End Turn tocado**: escurece e **desliza para a direita** até sumir (134,6–134,9); ~0,3–0,4 s depois entra o banner do oponente.
- **Custo de recuo**: o ícone de custo some da pílula "retreat" quando o custo vira zero (depois do X Speed, 220,0); toast "Retreat Cost is 1 less".
- **Cura**: além do "20" verde, um orbe/feixe de luz vem em arco da esquerda até o alvo (129,7–130,3) antes de o HP subir.
- **Espera de rede** (inferência): ~1,3–1,7 s parado depois de escolher o substituto no recuo/promoção (221,6–223,3; 423–424,1) antes da animação.
- **Overlay escuro** (~30–50%) em todo estado modal: arrasto, painel, prompt, habilidade, revelação.
- **Ação inválida**: toast vermelho "Not enough Energy" mantendo o painel aberto. Trainer solto fora da zona volta para a mão sem toast.
- **Cancelamentos**: o Cyrus foi cancelado durante a escolha do alvo (a carta volta para a mão e a câmera volta), e o Genome Hacking também, voltando ao painel. Não há diálogo de confirmação.
- **Confirmações explícitas** só em Start Battle, OK (painel Deck), Next e Tap to Proceed. Ataque, recuo e End Turn não pedem confirmação.
- **Feedback de toque**: ripple circular claro + o botão escurece/perde o brilho antes da transição (609,4; 611,2; 665,6; 733,9; 741,0; 747,4).
- **Latência**: depois de confirmar ataque ou seleção, o efeito começa ~1–1,4 s depois.
- **Previews automáticos**: ativo do oponente no início do turno próprio; carta comprada; carta buscada; carta jogada pelo oponente.
- **Turno passa sozinho depois do ataque** (330→333,1; 385→385,6); não existe "End Turn" depois de atacar.
- **Tempo**: o relógio troca de dono no instante da confirmação do ataque/End Turn (as animações gastam o tempo do próximo jogador). Prompts de seleção não têm timeout visível além do chip "Time limit".
- **Aviso de deck vazio**: o jogador fica sem cartas no deck por volta do turno 9 (~333); a partir daí cada compra vira o toast "No cards left in deck; unable to draw cards".
- **HP impresso vs. HP grande**: durante a etiqueta de habilidade, os números grandes somem e só o HP impresso fica visível.

---

## 9. Outros detalhes distintivos

- **Paleta da UI**: branco/lavanda-gelo como base; **ciano** para ação/seleção (End Turn, Start Battle, OK, contornos de alvo); **vermelho** para avisos e para o oponente (faixa do VS, "Opponent's turn", "Waiting for opponent...", Concede, Defeat); **azul** para o jogador (faixa do VS, "Your turn", +1 point do jogador); **dourado** para pontos, ferramentas e habilidades; **verde** para soltar e para cura.
- **Placas/chips**: cinza-ardósia/azul-marinho translúcido com texto branco.
- **Tipografia**: sem serifa arredondada e negrita (estilo "Pokémon UI"). Banners e cut-ins usam branco negrito com contorno; "VS.", "Ready? Go!" e "Tails!" em itálico.
- **Iconografia**: relógio ⏱, ícones de tipo de energia, medalhões numerados 1-2-3, ≡, olho, ▲ laranja, "▢" de contagem de cartas.
- **Formas**: tudo em pílula ou retângulo bem arredondado; faixas de banner em paralelogramo ou diagonal; placas com uma ponta chanfrada colada à borda.
- **Transições**: fades curtos (~0,1–0,2 s), mosaico de hexágonos para o playmat, blur + véu colorido para eventos de pontuação/moeda, cut-in diagonal para ataques.
- **Linguagem visual por tipo**: a cor da faixa do cut-in, a explosão do impacto e a cor de dissolução do Trainer dependem do tipo (de Pokémon ou de carta).
- **Artefato da gravação**: a barra de status do Android aparece por instantes em ~347–348 s. Não faz parte do jogo.

---

## 10. Pontos incertos

- Função exata dos **ícones laranja** (✦ / ▲) nas cartas e nos botões laterais. Sequência observada: "▲" pequeno ao lado do HP do Mew ex com Giant Cape (HP aumentado, desde 76); **✦** no botão lateral e no Jynx durante o X Speed (219–231); **▲** no botão lateral e em todos os Pokémon depois do Bounded Field (319,9). Inferência: o ícone indica o modificador ativo (efeito de turno, estádio, HP extra) e o botão lateral lista os efeitos daquele lado. Nenhum foi tocado.
- Inclinação de perspectiva da mesa: as medidas indicam uma inclinação leve, mas visualmente ela parece plana.
- Duração do limite por turno (90 s) e do prompt de troca (~20–23 s): deduzidas pelos valores do chip.
- O banner "Your turn" do turno 15 não aparece; provavelmente ficou escondido pelo preview automático.
- A evolução do Hypno (523–525) só foi vista a 1 fps.
- O toque do botão olho e do ▲ não foi visto.

---

## 11. Frames mais representativos

Pasta: ``

1. `t0000_0.png` — lobby Ranked Match com Battle!
2. `b0019_81.png` — tela VS completa
3. `b0022_92.png` — "Going first" com a moeda ampliada no fundo ciano
4. `b0025_31.png` — distribuição das cartas a partir dos dois decks
5. `b0026_40.png` — setup: mão expandida, preview grande, toast + "You are going first", chip "▢ 5"
6. `b0027_63.png` — arrasto para o Ativo: overlay escuro e slot ciano
7. `b0029_42.png` — flip de revelação (verso) + Time limit 87 centralizado
8. `b0031_35.png` — Reset / Start Battle ao lado do Time limit
9. `b0054_58.png` — "Your turn" + "Current turn: 1" + mosaico de hexágonos
10. `b0057_90.png` — zona verde de soltura de Item + Time limit do turno próprio
11. `b0076_67.png` — Giant Cape: anel dourado, ícone da ferramenta, "+20 HP"
12. `t0082_0.png` — painel "Deck" do Pokédex com cartas numeradas e OK
13. `t0085_0.png` — mesa no turno próprio (mat neon, End Turn, placas, energia)
14. `b0087_12.png` — "Opponent's turn" entrando pela direita
15. `t0091_0.png` — HUD no turno do oponente (mat Poké Ball, Time limit no alto, orbe Metal)
16. `t0210_0.png` — painel de ataque com ataque cinza + "Not enough Energy" + retreat
17. `b0270_38.png` — etiqueta "Ability · Illuminate" com faíscas
18. `b0283_67.png` — arrasto de energia: orbe roxo, alvos ciano, alvo verde, zoom leve
19. `b0371_00.png` — Cyrus: câmera no lado do oponente, só o alvo válido destacado
20. `b0407_81.png` — cut-in "Outta-Control Dash / Revavroom"
21. `b0409_00.png` — impacto com estilhaços e "60"
22. `b0411_00.png` — KO: carta dissolvida em orbe ciano
23. `b0414_69.png` — "+1 point!" do oponente (faixa vermelha, medalhão 1 dourado)
24. `t0419_0.png` — prompt de promoção (véu, banco ciano, olho, Time limit)
25. `b0424_46.png` — promoção: Jynx grande a caminho do Ativo
26. `t0440_0.png` — mesa de meio de jogo (estádio, ▲, energias, End Turn, ponto na placa)
27. `t0443_0.png` — painel de ataque "Psychic 70▲" com borda dourada + retreat
28. `b0459_92.png` — impacto psíquico roxo "50"
29. `b0465_33.png` — "+1 point!" do jogador (faixa azul)
30. `b0501_00.png` — cura "20" verde
31. `b0505_06.png` — cara ou coroa: moeda girando, texto do efeito, "Waiting for opponent..."
32. `b0506_62.png` — resultado "Tails!" com a moeda grande
33. `b0610_21.png` — "Please choose the target attack" (Genome Hacking → Metal Claw 70)
34. `b0613_31.png` — cut-in "Genome Hacking / Mew ex" (faixa lilás)
35. `b0624_12.png` — popover do menu: Concede / Settings / Battle Log
36. `b0691_62.png` — impacto metálico "90" com tag "▲ Damage"
37. `b0720_90.png` — ponto final: 3 medalhões dourados, anéis rosa
38. `b0722_81.png` — pílula "Defeat"
39. `t0734_0.png` — tela "Defeat..." com Card of the Game e estatísticas
40. `b0236_00.png` — cut-in do Psyshot com o tabuleiro girado, Mew ex ~2,3× e faixa lilás

Extras úteis na mesma pasta `frames`: `t0742_0.png` (ficha do oponente: Send Friend Request / Thanks! / X), `b0174_90.png` (evolução própria, carta branca), `b0153_71.png` (evolução do oponente), `t0219_0.png` (botão ✦ do X Speed + "Retreat Cost is 1 less"), `b0108_40.png` (cut-in "Speed Dive" do oponente), `b0221_31.png` (escolher Pokémon para recuo), `b0191_62.png` (arrasto de energia com hover verde), `t0165_0.png` (inspeção de carta do oponente com "Expected damage" e seta "<").

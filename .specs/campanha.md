# 🗺️ Campanha — Jornada dos Ginásios

> **Versão da spec:** 3.2.0  
> **Data:** 14 de outubro de 2026  
> **Plataforma:** navegador desktop, local-only / offline-first, 16:9, Three.js  
> **Escopo:** campanha single-player autoral, progressão, desafios, recompensas e conteúdo 3D  
> **Status:** especificação de implementação; não é um jogo executável nem um catálogo final balanceado  
> **Complementos:** [gameplay.md](gameplay.md) · [interface-16x9.md](interface-16x9.md) · [runtime-offline-threejs.md](runtime-offline-threejs.md) · [efeitos-dsl.md](efeitos-dsl.md)
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — campo claro, paleta e animações na linguagem do TCG Pocket; os conceitos escuros anteriores não são referência.

> **Revisão 3.0:** SQLite substitui a persistência anterior. Autoria de cartas usa o Estúdio local, com regras e impressões versionadas. Detalhes normativos em [persistencia-sqlite.md](persistencia-sqlite.md) e [editor-de-cartas.md](editor-de-cartas.md). O escopo offline, a campanha e as animações/playmats da revisão 2.1 permanecem.

> **Revisão 3.2:** ex/Mega em objetivos passam a usar `ruleBox`; alternativas de Descoberta ficam permanentes no Empório; chaves de concessão sem perfil nem versão; status persistidos da tentativa alinhados ao banco; encontro com `arenaId`, `mapSceneId` e `{aiProfileId, npcDeckId}` por dificuldade; preço do Pacote Arquivo e regra de PROMO; sem migração de perfis legados.

> **Revisão 3.3 (conteúdo 2.0.0):** as cartas genéricas dão lugar ao set Genetic Apex (A1) e a seis Treinadores Promo-A do Pokémon TCG Pocket, com textos traduzidos para PT-BR. Conteúdo **2.1.0**: as impressões A1 usam a imagem da carta impressa no modo “Impressão completa” (`artKey` `art:a1:NNN`); **2.2.0**: as seis promos também (`art:pa:NNN`). Três pacotes reais (Pikachu, Charizard, Mewtwo), símbolos de raridade do Pocket, cartas-chave e objetivos refeitos; perfis criados com o catálogo antigo são recusados com aviso.

> **Revisão 3.3 (conteúdo 3.0.0, 16/10/2026):** entram todos os sets do Pokémon TCG Pocket depois do Genetic Apex — Mythical Island (A1a), Space-Time Smackdown (A2), Triumphant Light (A2a), Celestial Guardians (A3), Extradimensional Crisis (A3a), Eevee Grove (A3b), Wisdom of Sea and Sky (A4), Secluded Springs (A4a), Deluxe Pack ex (A4b), o resto do Promo-A e o Promo-B: 1.210 cartas de jogo e 2.069 impressões, todas em “Impressão completa” (`art:<set>:NNN`). Raridade brilhante ✵/✵✵ (§16.3); identidade das cartas entre sets (§20.6); 14 pacotes novos com as taxas oficiais por símbolo, enquanto os do A1 mantêm as do projeto (§16.1, §16.2); uma carta dirigida por impressão não PROMO (§15.2); oito decks iniciais, um por tipo de Energia gerável (§3); modelos de apoio dos sets novos e uma variação por capítulo (§3.6).

> **Revisão 3.3 (conteúdo 3.1.0, decisão do autor de 16/10/2026):** os rivais passam a ser treinadores da franquia — Líderes de Ginásio, Blue e Giovanni —, cada um com retrato próprio, e a campanha vira uma jornada de Ginásios: cada capítulo é um torneio de um tipo sediado num Ginásio, e a final é o Torneio de Kanto (§1.1, §1.4, §4–§11). Mudam só os textos de exibição — nomes, títulos, estilos, origens, dicas, nomes de decks, de nós, de capítulos e de tapetes, e os 194 diálogos; `npcId`, perfis de IA, grafo, objetivos, prêmios, cenas, arenas e texturas não mudam. O retrato passa a ser obrigatório no NPC (§20.5).

---

## 🧭 Sumário

**Leitura visual obrigatória:** [direção Pocket](direcao-visual-pocket.md) · [referências identificadas](referencias-visuais.md).


- [📖 0. Contrato da campanha](#campanha-00)
- [🎯 1. Fantasia, história e ciclo principal](#campanha-01)
- [🗺️ 2. Estrutura, contagem e grafo](#campanha-02)
- [👤 3. Novo perfil e coleção inicial](#campanha-03)
- [🎓 4. Prólogo — os seis tutoriais](#campanha-04)
- [🏞️ 5. C01 — Ginásio de Celadon](#campanha-05)
- [🏞️ 6. C02 — Ginásio de Sootopolis](#campanha-06)
- [🏞️ 7. C03 — Ginásio de Vermilion](#campanha-07)
- [🏞️ 8. C04 — Ginásio de Saffron](#campanha-08)
- [🏞️ 9. C05 — Ginásio de Stow-on-Side](#campanha-09)
- [🏞️ 10. C06 — Ginásio de Viridian](#campanha-10)
- [🏆 11. Final — Torneio de Kanto](#campanha-11)
- [🎯 12. Objetivos, medalhas e domínio](#campanha-12)
- [🧩 13. Puzzles, cenários e modificadores](#campanha-13)
- [🤖 14. Dificuldades, IA e assistência](#campanha-14)
- [💰 15. Economia inicial e recompensas](#campanha-15)
- [📦 16. Pacotes locais e aquisição dirigida](#campanha-16)
- [🌟 17. Descobertas e Empório](#campanha-17)
- [🏟️ 18. Arena, revisitas e pós-jogo](#campanha-18)
  - [🛠️ Campanha personalizada](#campanha-autoral)
- [💾 19. Tentativas, pausa e recuperação](#campanha-19)
- [🗃️ 20. Esquemas de conteúdo e validação](#campanha-20)
- [🧱 21. Conteúdo Three.js por etapa](#campanha-21)
  - [🎨 Playmats, arenas, acessórios e desbloqueios](#campanha-cosmeticos)
- [✅ 22. Testes de campanha](#campanha-22)
- [🚧 23. Marcos de conteúdo e aceite](#campanha-23)

---

<a id="campanha-00"></a>

## 📖 0. Contrato da campanha

Esta campanha é **conteúdo autoral proposto** para o projeto inspirado em Pokémon TCG Pocket. Não descreve uma campanha oficial do aplicativo. Nomes, preços, personagens, mapa e objetivos abaixo são decisões iniciais de design, ainda sujeitos a testes de balanceamento. As cartas (conteúdo 3.0.0) são dados de terceiros do Pokémon TCG Pocket — The Pokémon Company — usados apenas localmente neste projeto de fã. Desde o conteúdo 3.1.0 os rivais também são da franquia: treinadores Pokémon com nomes e retratos (emotes) de terceiros, igualmente de uso local; encontros, falas, objetivos e economia continuam autorais.

**Identificador:** `circuito-dos-arquivos-v1` (mantido; o nome exibido da campanha é Jornada dos Ginásios). **Ruleset:** `local-campaign-v2`. **Versão inicial do conteúdo:** `1.0.0`; **atual:** `3.5.0` (Genetic Apex até Deluxe Pack ex, Promo-A e Promo-B, desde o `3.0.0`; a estrutura da campanha é a do `2.0.0`; rivais e textos da jornada de Ginásios, desde o `3.1.0`; moedas do Pokémon TCG Pocket, desde o `3.2.0`, §21.6; receitas de deck, desde o `3.3.0`, §3.7; sleeves do Pocket, desde o `3.4.0`, §21.6; IA mais agressiva, desde o `3.5.0`, §14.1). Toda mudança no pacote publicado sai com versão nova, porque a instalação recusa a mesma versão com outro `content_hash` (`IMPORT_INVALID`, [persistência §8](persistencia-sqlite.md)); o `3.1.0` instala por cima do `3.0.x` sem apagar saves. A versão 3.2.0 desta documentação não significa que o conteúdo já foi implementado.

A campanha deve ser concluível inteiramente no dispositivo, inclusive quando o jogador abre um capítulo pela primeira vez sem internet. Não há conta, servidor de progresso, calendário de eventos, compra com dinheiro, espera de pacote, ranking externo ou adversário humano.

| Documento | Autoridade |
|---|---|
| [gameplay.md](gameplay.md) | Legalidade das ações e resolução dos duelos. |
| Este documento | Encontros, grafo, objetivos, concessões e economia autoral. |
| [interface-16x9.md](interface-16x9.md) | Telas, apresentação e navegação. |
| [runtime-offline-threejs.md](runtime-offline-threejs.md) | Execução local e renderização. |
| [persistencia-sqlite.md](persistencia-sqlite.md) | Banco, transações, saves e migrações. |
| [editor-de-cartas.md](editor-de-cartas.md) | Autoria, versões e uso de cartas personalizadas. |
| [efeitos-dsl.md](efeitos-dsl.md) | Linguagem de efeitos e opcodes das cartas, inclusive Treinadores e Fósseis. |

**DEVE** é requisito; **PODE** é opção explicitamente prevista. Uma animação 3D nunca muda o resultado de um objetivo ou de uma concessão.

---

<a id="campanha-01"></a>

## 🎯 1. Fantasia, história e ciclo principal

## 1.1. Premissa

Na **Jornada dos Ginásios**, o jogador aprende o básico na Escola de Treinadores com o professor Cheren e parte para seis Ginásios. Cada capítulo é um torneio de um tipo sediado num Ginásio: os desafiantes (E01, E03, E05) são Líderes do mesmo tipo vindos de outras regiões, e o Líder anfitrião (E02, E04 e o chefe E06) entrega a medalha. Com as seis medalhas, o jogador disputa o Torneio de Kanto: o exame de retorno com Cheren, a revanche com Blue e a final com Giovanni (§11).

A história acontece entre confrontos, com retratos, pequenos diálogos e dioramas tridimensionais. Não exige exploração de mundo aberto, caminhada de avatar, captura de criaturas ou física de deslocamento. O mapa é um seletor espacial de encontros.

A carta continua protagonista: vencer significa compreender uma combinação de cartas e decisões, não aumentar atributos permanentes de uma criatura.

## 1.2. Ciclo

```text
Retomar campanha
→ Selecionar nó disponível no mapa 3D
→ Ler briefing, objetivos e recompensas
→ Escolher ou ajustar deck
→ Disputar confronto contra IA local
→ Persistir resultado e concessões
→ Ver recompensa
→ Abrir pacotes / adquirir cartas dirigidas / aprimorar deck
→ Avançar ou revisitar confrontos
```

O jogador deve conseguir sair desse ciclo para examinar sua coleção, organizar fichários, testar um deck ou exportar seu save sem perder a posição na campanha.

## 1.3. Princípios

O caminho essencial não depende de um resultado raro de pacote. Derrotas não destroem cartas nem cobram novas entradas. Objetivos de domínio são opcionais. Reduzir a dificuldade não remove medalhas nem bloqueia o final.

O mapa não muda de disponibilidade à meia-noite. Um personagem não desaparece depois de uma data real. Toda descoberta adquirida continua acessível no diário.

## 1.4. Rivais e retratos

**[DP] 3.3.0 (conteúdo 3.1.0, decisão do autor):** os rivais são treinadores da franquia. Fonte: `src/content/source/npcs.ts` (nomes, títulos, estilo, origem e dicas), `campaign.ts` (capítulos e nós), `decks.ts` (nomes dos decks) e `dialogues.ts` (falas).

| Capítulo | Torneio | Líder anfitrião — E02, E04, E06 | Desafiantes — E01, E03, E05 | Medalha |
|---|---|---|---|---|
| P00 | Escola de Treinadores | Cheren, Professor da Escola de Treinadores (`lia`) | — | — |
| C01 | Ginásio de Celadon · Planta | Erika (`iris`) | Milo, de Turffield (`caio`); Gardenia, de Eterna (`dora`); Viola, de Santalune (`taina`) | Arco-Íris |
| C02 | Ginásio de Sootopolis · Água | Wallace (`mara`) | Marlon, de Humilau (`rui`); Crasher Wake, de Pastoria (`luma`); Melony, de Circhester (`icaro`) | Chuva |
| C03 | Ginásio de Vermilion · Elétrico | Tenente Surge (`teo`) | Elesa, de Nimbasa (`bia`); Clemont, de Lumiose (`otto`); Iono, de Levincia (`vivi`) | Trovão |
| C04 | Ginásio de Saffron · Psíquico | Sabrina (`nara`) | Koga, de Fuchsia (`davi`); Liza, de Mossdeep (`lis`); Morty, de Ecruteak (`enzo`) | Pântano |
| C05 | Ginásio de Stow-on-Side · Lutador | Bea (`breno`) | Chuck, de Cianwood (`malu`); Roark, de Oreburgh (`bento`); Jasmine, de Olivine (`jade`) | de Lutador |
| C06 | Ginásio de Viridian · o Campeão | Blue (`sol`) | Korrina, de Shalour (`iago`); Blaine, de Cinnabar (`clara`); Clay, de Driftveil (`nico`) | Terra |
| F00 | Torneio de Kanto | D01 Cheren (`lia`, exame de retorno), D02 Blue (`sol`, revanche), D03 Giovanni, Chefe da Equipe Rocket (`aurora`) | — | Troféu do torneio |

O título de cada Líder é “Líder do Ginásio de <cidade>”. Os nomes das medalhas aparecem só nas falas; os ids continuam `medal-c01`…`medal-c06` e `trophy-circuito-completo`.

**Ids estáveis.** Os `npcId` são os da campanha original e não mudam, porque duelos suspensos guardam o perfil de IA `<npcId>-<dificuldade>-v1`: em dados e exemplos, `mara` é o Wallace e `lia` é o Cheren. Personalidade de IA, decks (só o nome mudou; o do T06 é “Cheren — Chama da Escola”), puzzles, cenas, arenas e texturas de tapete são os mesmos do `3.0.x`.

**Retratos.** Cada NPC tem `portraitAssetKey` `portrait:<arquivo>`, um emote do treinador empacotado em `src/presentation/assets/portraits/` (§20.5; desenho e usos em [interface §5.5](interface-16x9.md#interface-05)): `lia` cheren-emote-4 · `iris` erika-emote-1 · `caio` milo-emote-3 · `dora` gardenia-emote-1 · `taina` viola-emote-1 · `mara` wallace-emote-1 · `rui` marlon-emote-1 · `luma` crasher-wake-emote-1 · `icaro` melony-emote-3 · `teo` lt-surge-emote-1 · `bia` elesa-classic-emote-2 · `otto` clemont-emote-3 · `vivi` iono-emote-1 · `nara` sabrina-arc-emote-1 · `davi` koga-emote-1 · `lis` liza-summer-2023-emote-2 · `enzo` morty-emote-3 · `breno` bea-emote-1 · `malu` chuck-emote-3 · `bento` roark-emote-3 · `jade` jasmine-emote-1 · `sol` blue-classic-emote-4 · `iago` korrina-emote-3 · `clara` blaine-emote-1 · `nico` clay-emote-3 · `aurora` giovanni-emote-2.

---

<a id="campanha-02"></a>

## 🗺️ 2. Estrutura, contagem e grafo

## 2.1. Escopo completo planejado

| Bloco | Nós | Batalhas / puzzles | Descobertas | Vitórias obrigatórias |
|---|---:|---:|---:|---:|
| Prólogo | 6 | 6 | 0 | 6 |
| Seis capítulos | 36 | 30 | 6 | 18 |
| Final | 3 | 3 | 0 | 3 |
| **Total** | **45** | **39** | **6** | **27** |

Cada capítulo possui seis nós: três confrontos essenciais, um puzzle opcional, uma Descoberta opcional e um confronto de elite opcional. Existem 12 confrontos opcionais além dos 27 essenciais.

A contagem representa o alvo da campanha completa, não a exigência de implementar tudo no primeiro incremento.

## 2.2. Grafo canônico de capítulo

```text
Capítulo anterior concluído
          │
         E01 ───────── E02 (puzzle opcional)
          │
         E03 ───────── E04 (Descoberta opcional)
          │
          ├─────────── E05 (elite opcional)
          │
         E06 (chefe)
          │
Próximo capítulo / Final
```

E02 exige E01. E03 exige E01. E04 e E05 exigem E03. E06 exige E03. Nenhum nó opcional é pré-requisito de E06.

O prólogo é `P00-T01 → ... → P00-T06`. C01-E01 exige P00-T06. C02-E01 exige C01-E06, e assim por diante. F00-D01 exige C06-E06; F00-D02 exige F00-D01; F00-D03 exige F00-D02.

## 2.3. Regras do grafo

Pré-requisitos usam IDs, nunca coordenadas ou ordem de renderização. Não pode haver ciclo na cadeia de desbloqueio. Cada nó não inicial precisa de um caminho a partir do prólogo. Qualquer desbloqueio deve ser derivável de concessões e conclusões persistidas.

Uma ligação decorativa no mapa não cria um pré-requisito. Um caminho escondido por enquadramento continua acessível na lista HTML equivalente.

## 2.4. Rejogar não fecha caminhos

Reiniciar um chefe concluído não bloqueia o capítulo seguinte. A conclusão histórica é monotônica, salvo restauração explícita de um backup anterior pelo jogador. Uma tentativa em andamento é um atributo separado do melhor progresso do nó.

---

<a id="campanha-03"></a>

## 👤 3. Novo perfil e coleção inicial

## 3.1. Primeira entrada

O jogador escolhe nome local, avatar — o retrato de um treinador da franquia, trocável depois no Perfil ([interface §6.3](interface-16x9.md#interface-06)) — e deck favorito entre oito estratégias, uma por tipo de Energia gerável. A seleção apenas destaca um deck: **todos os oito decks iniciais completos são concedidos ao perfil**.

A concessão inicial, a criação dos decks e o registro de onboarding devem ocorrer na mesma operação idempotente, com chave `onboarding:{campaignId}`. Fechar a tela não permite receber o presente outra vez.

```text
Inventário compartilhado: 76 cartas (38 impressões × 2)
Oito listas iniciais: 20 cartas cada
Créditos iniciais: 300
Pacotes: 1 pacote tutorial fixo + 1 pacote aleatório Genetic Apex — Pikachu
Próximo nó: P00-T01
```

As listas compartilham os Treinadores neutros. Não é necessário possuir 160 cartas ou dezesseis cópias de cada Treinador para manter os oito decks salvos.

O pacote tutorial tem cinco cartas predefinidas e é identificado como **recompensa guiada**, sem fingir que suas chances são as de um pacote aleatório.

## 3.2. Oito estratégias

**[DP] 3.3.0 (conteúdo 3.0.0, pedido do autor):** aos três decks do Genetic Apex somam-se cinco, para que cada tipo de Energia gerável tenha um deck inicial.

| Deck | Energia da Zona | Intenção | Fragilidade ensinada |
|---|---|---|---|
| Chama Constante | Fogo | Preparar evolução e pressionar com custo previsível. | Atacante de maior custo precisa ser desenvolvido antes. |
| Maré Serena | Água | Alternar atacantes e preservar recursos. | Recuar sem planejamento pode atrasar o próximo ataque. |
| Jardim Vivo | Planta | Curar pequenos danos e manter reservas prontas. | Curar não substitui causar pontos suficientes. |
| Faísca Veloz | Elétrico | Carregar o Banco e recuar cedo para manter o ritmo de ataque. | O golpe forte custa duas Energias; sem Banco carregado, o ritmo cai. |
| Eco Psíquico | Psíquico | Evoluir no Banco e responder com atacantes resistentes. | Expor um Básico no Ativo antes de evoluir entrega pontos. |
| Punho Firme | Lutador | Golpes baratos para atacar em mais turnos. | Dano baixo por golpe exige pressão contínua. |
| Sombra Astuta | Noturno | Atacar por uma Energia enquanto o golpe de 60 se prepara. | Trocar de atacante tarde desperdiça o turno de preparo. |
| Aço Paciente | Metálico | Aguentar dano com PS alto enquanto a Energia se acumula. | Recuo caro: o Ativo errado fica preso. |

Os nomes dos decks são do projeto; as cartas são do Pokémon TCG Pocket (conteúdo 3.0.0): os três primeiros decks usam Pokémon do Genetic Apex (A1), os outros cinco, Pokémon comuns dos sets seguintes, e todos os oito usam os seis Treinadores do Promo-A. Os tipos mantêm o vocabulário do `gameplay.md`.

## 3.3. Criaturas iniciais

Cada criatura abaixo é concedida em duas cópias; todas são linhas Básico → Estágio 1 sem ex, de um ponto. Fraqueza como impressa no set (+20): Fogo é fraco a Água; Água a Elétrico; Planta a Fogo; Elétrico a Lutador; Lutador a Psíquico; Noturno a Planta; Metálico a Fogo; no Psíquico, Swirlix/Slurpuff são fracos a Metálico e Duskull/Dusclops a Noturno. Os nomes dos ataques estão traduzidos e as regras vêm do effects-dsl (texto gerado em PT-BR).

**Genetic Apex (A1)** — Chama Constante, Maré Serena e Jardim Vivo:

| Nome / ID | Estágio / origem | PS | Recuo | Ataque |
|---|---|---:|---:|---|
| Charmander / `charmander` (A1-033) | Básico | 60 | 1 | Brasa — 1 Fogo: 30; descarta 1 Energia de Fogo deste Pokémon. |
| Charmeleon / `charmeleon` (A1-034) | Estágio 1 / Charmander | 90 | 2 | Garras de Fogo — 1 Fogo + 2 Incolor: 60. |
| Ponyta / `ponyta` (A1-042) | Básico | 60 | 1 | Labareda — 1 Fogo: 20. |
| Rapidash / `rapidash` (A1-043) | Estágio 1 / Ponyta | 100 | 1 | Juba de Fogo — 1 Fogo: 40. |
| Squirtle / `squirtle` (A1-053) | Básico | 60 | 1 | Revólver d'Água — 1 Água: 20. |
| Wartortle / `wartortle` (A1-054) | Estágio 1 / Squirtle | 80 | 1 | Respingo de Onda — 1 Água + 1 Incolor: 40. |
| Staryu / `staryu` (A1-074) | Básico | 50 | 1 | Golpear — 1 Água: 20. |
| Starmie / `starmie` (A1-075) | Estágio 1 / Staryu | 90 | 0 | Respingo de Onda — 1 Água: 40. |
| Bulbasaur / `bulbasaur` (A1-001) | Básico | 70 | 1 | Chicote de Vinha — 1 Planta + 1 Incolor: 40. |
| Ivysaur / `ivysaur` (A1-002) | Estágio 1 / Bulbasaur | 90 | 2 | Folha Navalha — 1 Planta + 2 Incolor: 60. |
| Exeggcute / `exeggcute` (A1-021) | Básico | 50 | 1 | Bomba de Sementes — 1 Planta: 20. |
| Exeggutor / `exeggutor` (A1-022) | Estágio 1 / Exeggcute | 130 | 3 | Pisotear — 1 Planta: 30; jogue uma moeda, se sair cara +30. |

**Sets seguintes (conteúdo 3.0.0)** — Pokémon comuns (◊/◊◊), duas linhas por deck:

| Deck | Nome / ID | Estágio / origem | PS | Recuo | Ataque |
|---|---|---|---:|---:|---|
| Faísca Veloz | Mareep / `mareep` (A4-067) | Básico | 60 | 1 | Choque Estático — 1 Elétrico: 20. |
| Faísca Veloz | Flaaffy / `flaaffy` (A4-068) | Estágio 1 / Mareep | 90 | 2 | Chute Elétrico — 2 Elétrico: 50. |
| Faísca Veloz | Blitzle / `blitzle-a3a-016` (A3a-016) | Básico | 60 | 1 | Coice — 2 Elétrico: 40. |
| Faísca Veloz | Zebstrika / `zebstrika-a3a-017` (A3a-017) | Estágio 1 / Blitzle | 90 | 1 | Cabeçada Elétrica — 2 Elétrico: 70. |
| Eco Psíquico | Swirlix / `swirlix` (A1a-039) | Básico | 60 | 1 | Vento de Fada — 1 Psíquico: 20. |
| Eco Psíquico | Slurpuff / `slurpuff` (A1a-040) | Estágio 1 / Swirlix | 100 | 2 | Tiro Mágico — 1 Psíquico + 1 Incolor: 60. |
| Eco Psíquico | Duskull / `duskull` (A2-070) | Básico | 60 | 1 | Fogo-Fátuo — 1 Psíquico: 20. |
| Eco Psíquico | Dusclops / `dusclops` (A2-071) | Estágio 1 / Duskull | 90 | 2 | Psicossoco — 1 Psíquico + 2 Incolor: 50. |
| Punho Firme | Timburr / `timburr` (A3-094) | Básico | 60 | 1 | Soco Saca-Rolhas — 1 Lutador: 20. |
| Punho Firme | Gurdurr / `gurdurr` (A3-095) | Estágio 1 / Timburr | 90 | 2 | Força — 1 Lutador + 1 Incolor: 40. |
| Punho Firme | Meditite / `meditite` (A2a-043) | Básico | 60 | 1 | Chute — 1 Lutador: 20. |
| Punho Firme | Medicham / `medicham-a3a-029` (A3a-029) | Estágio 1 / Meditite | 90 | 2 | Chute de Pulo Alto — 1 Lutador: 50. |
| Sombra Astuta | Poochyena / `poochyena` (A2-100) | Básico | 60 | 1 | Mordida — 1 Noturno: 20. |
| Sombra Astuta | Mightyena / `mightyena` (A2-101) | Estágio 1 / Poochyena | 90 | 1 | Presa das Trevas — 1 Noturno + 1 Incolor: 60. |
| Sombra Astuta | Purrloin / `purrloin` (A1a-051) | Básico | 60 | 1 | Arranhão — 1 Noturno: 20. |
| Sombra Astuta | Liepard / `liepard` (A1a-052) | Estágio 1 / Purrloin | 90 | 1 | Talho — 1 Noturno: 40. |
| Aço Paciente | Klink / `klink` (A4-126) | Básico | 60 | 1 | Agarrão — 1 Metálico: 20. |
| Aço Paciente | Klang / `klang` (A4-127) | Estágio 1 / Klink | 80 | 2 | Engrenagem Cortante — 1 Metálico + 1 Incolor: 40. |
| Aço Paciente | Aron / `aron` (A3a-048) | Básico | 70 | 2 | Cabeçada — 1 Metálico + 1 Incolor: 40. |
| Aço Paciente | Lairon / `lairon` (A3a-049) | Estágio 1 / Aron | 100 | 3 | Arremetida — 2 Metálico + 1 Incolor: 60. |

Esses 20 Pokémon só têm ataques diretos: nenhum liga ou move Energia, aplica Condição Especial ou modifica dano, para que nenhum deck inicial cumpra sozinho um objetivo de composição (§12.1). `blitzle-a3a-016`, `zebstrika-a3a-017` e `medicham-a3a-029` são definições próprias do set, com regras diferentes das versões de mesmo nome; o limite de duas cópias por nome vale entre as versões (§20.6). A impressão de cada carta inicial é a primeira de acabamento normal (`a4-067-mareep`, `a3a-016-blitzle`…), fonte em `src/content/source/starter.ts`.

Ajustes nesses valores exigem nova versão do conteúdo, não mudanças invisíveis no meio de uma tentativa.

## 3.4. Treinadores compartilhados (Promo-A)

Cada Treinador é concedido em duas cópias. O Genetic Apex não traz Itens de compra/busca; estes seis são os Treinadores básicos do Promo-A:

| Nome / ID | Categoria | Efeito |
|---|---|---|
| Poké Bola / `poke-bola` | Item | Coloca na mão 1 Pokémon Básico aleatório do próprio baralho (revela e embaralha). |
| Poção / `pocao` | Item | Cura 20 de dano de um Pokémon próprio com dano. |
| Pesquisa do Professor / `pesquisa-do-professor` | Apoiador | Compra 2 cartas. |
| Velocidade X / `velocidade-x` | Item | O Recuo do seu Pokémon Ativo custa 1 a menos neste turno. |
| Cartão Vermelho / `cartao-vermelho` | Item | O oponente embaralha a mão no baralho e compra 3 cartas. |
| Lupa de Mão / `lupa-de-mao` | Item | O oponente revela a mão. |

Precondições fazem parte das definições: Poção precisa de alvo com dano; Poké Bola, sem Básico no baralho, é inválida; Pesquisa do Professor precisa poder comprar ao menos uma carta. A validação não revela cartas ao adversário humano porque não existe PvP, mas o log público não expõe dados que a IA não deveria conhecer.

As seis impressões `PROMO` da coleção inicial (P-A 001, 002, 003, 005, 006 e 007) só são concedidas: ficam fora do Pacote Promo-A (§16.1) e não são vendidas como cartas dirigidas (§15.2).

## 3.5. Listas de exatamente 20

Cada um dos oito decks usa as quatro criaturas das suas duas linhas, **duas de cada**, totalizando oito Pokémon. Acrescenta os seis Treinadores, **dois de cada**, totalizando 12 Treinadores.

```text
4 definições de Pokémon × 2 = 8
6 definições de Treinador × 2 = 12
Total = 20; quatro Básicos; duas cadeias de Estágio 1.
```

A validação real usa os IDs e as quantidades, não essa descrição em prosa: o content-build recusa deck inicial fora de 4 Pokémon × 2 + 6 Treinadores × 2 e inventário inicial diferente de “impressões iniciais × 2”. A concessão inicial dá 32 criaturas × 2 = 64 + 6 Treinadores × 2 = 12, ou seja, **76 cartas** (38 impressões), suficientes para montar os oito decks ao mesmo tempo (C-005).

## 3.6. Decks de apoio

O projeto deve oferecer listas de apoio sem custo ou prazo quando um encontro apresentar uma mecânica nova. São empréstimos locais de conteúdo, não cartas transferidas ao inventário.

Uma lista de apoio deve conseguir vencer o encontro em História sem depender de sorte excepcional; essa afirmação só pode virar critério aprovado depois de simulação e teste humano. Até lá é requisito de balanceamento, não resultado comprovado.

No conteúdo 3.0.0 há 26 decks de apoio (`kind: SUPPORT`), em três famílias; com os 8 iniciais e os 82 de NPC, o pacote traz 116 decks. Fonte: `src/content/source/decks.ts`.

| Família | Decks | Onde aparecem |
|---|---|---|
| Apoio do capítulo | 11: `support-c01-v1` … `support-c06-v1`, `support-f00-v1` e os dos encontros mistos (`support-c06-psi-v1`, `support-c06-mare-v1`, `support-f00-chama-v1`, `support-f00-mare-v1`). | Briefing dos encontros de batalha do capítulo; o primeiro é o recomendado, com vantagem de tipo. |
| Modelos dos sets novos | 8, um por set do A1a ao A4a, montados em volta da mecânica que o set estreou: Totem da Selva (`support-a1a-v1`), Maré Dimensional (`support-a2-v1`), Arceus e o Bando (`support-a2a-v1`), Sol e Lua (`support-a3-v1`), Ultracriaturas (`support-a3a-v1`), Laço de Fada (`support-a3b-v1`), Fênix Arco-Íris (`support-a4-v1`) e Feras Lendárias (`support-a4a-v1`). Nome exibido com o set em PT-BR (“Modelo Ilha Mítica: Totem da Selva”). | Aba “Modelos e apoio” da biblioteca de decks e adversários do Treino; não são oferecidos nos encontros. |
| Variações na campanha | 7, uma por capítulo, adaptando um modelo à vantagem de tipo sobre os NPCs: `support-c01-fenix-v1` (Fogo), `support-c02-feras-v1` (Elétrico), `support-c03-uivo-v1` (Lutador), `support-c04-lua-v1` (Noturno), `support-c05-lua-v1` (Psíquico), `support-c06-eco-v1` (Psíquico, só Pokémon de um ponto) e `support-f00-palkia-v1` (Água). | Opção extra de apoio em todos os encontros de batalha daquele capítulo, depois das recomendadas (`SUPPORT_VARIANT_BY_CHAPTER`). |

Ordem das opções de apoio de um nó: as recomendadas (apoio específico do encontro misto ou o apoio do capítulo) e, por último, a variação do capítulo. Tutoriais P00 não têm apoio. Todos os modelos e variações são legais e jogam uma partida inteira contra um NPC do catálogo sem ação ilegal (C-067); isso prova jogabilidade, não a meta de vitória acima.

## 3.7. Receitas de deck

**[DP] 3.3.0 (conteúdo 3.3.0, pedido do autor de 16/10/2026):** para montar um deck com mais facilidade, o pacote traz **receitas de deck** (`deckRecipes`, schema `deck-recipe`): listas prontas de 20 cartas, que não são decks de conteúdo jogáveis por NPC nem empréstimos. Fonte: `src/content/source/recipes.ts`.

| Categoria | Quantidade | O que reúne |
|---|---:|---|
| Meta (`META`) | 22 | Arquétipos que marcaram o meta do Pokémon TCG Pocket, set a set, do Genetic Apex ao Deluxe Pack ex: Pikachu ex e Zapdos ex, Mewtwo ex e Gardevoir, Celebi ex e Serperior, Palkia ex e Vaporeon, Darkrai ex e Weavile ex, Arceus ex e Crobat, Giratina ex e Darkrai ex, Lugia ex e Ho-Oh ex, Suicune ex e Greninja e outros. |
| Por tipo (`TYPE`) | 18 | Duas por tipo de Energia gerável, mais Dragão (Dragonite ex) e Incolor (Snorlax ex): linhas acessíveis, boas para começar. |
| Comunidade (`COMMUNITY`) | 15 | Listas queridas pela comunidade: Greninja e Druddigon, Rampardos, Magnezone, Cães Lendários, Rolo Compressor de Golem, Fortaleza de Shuckle e outras. |

- Cada receita tem nome em PT-BR (até 40 caracteres), categoria, **era** (o set das cartas principais neste pacote, A1…A4b), 1 a 3 tipos de Energia, dificuldade (Iniciante, Intermediária ou Avançada), a lista, a carta da capa e a estratégia em uma ou duas frases.
- As listas são adaptações às cartas deste pacote; as do meta descrevem o arquétipo, não uma lista de torneio específica.
- O content-build recusa receita que não seja deck jogável (20 cartas, 2 cópias por nome, ao menos um Básico, Energia válida), com evolução sem o estágio anterior, com a capa fora da lista ou que não seja Pokémon, com era fora dos sets do pacote; exige ao menos 15 do meta, 10 da comunidade e 2 por tipo de Energia (C-068).
- Montar uma receita nunca concede cartas: o rascunho usa as cópias da coleção (qualquer impressão da mesma carta) e marca as que faltam ([interface §13.8](interface-16x9.md#interface-13)).

---

<a id="campanha-04"></a>

## 🎓 4. Prólogo — os seis tutoriais

O prólogo usa o professor **Cheren** (`lia`), a arena da Escola de Treinadores (`arena-academy`) e cenários fixos. Texto, mão e escolhas podem ser guiados, mas a resolução passa pelo mesmo motor. Não criar uma batalha falsa em que qualquer botão significa vitória.

| ID | Nome | Conteúdo e cenário | Critério de conclusão | Prêmio único |
|---|---|---|---|---|
| P00-T01 | Primeira Carta | Ativo, mão, Banco e seleção por clique; mão guiada. | Vencer depois de colocar um Básico como Ativo. | 50 Créditos. |
| P00-T02 | Acender a Energia | Ligação manual, custo e ataque sem descarte automático. | Vencer e realizar uma ligação manual válida. | 50 Créditos. |
| P00-T03 | Preparar a Reserva | Banco e distribuição antecipada de Energia. | Vencer tendo colocado ao menos um Básico no Banco. | 50 Créditos. |
| P00-T04 | A Próxima Forma | Evolução, primeiro turno próprio e preservação do dano. | Vencer e evoluir uma vez legalmente. | 50 Créditos. |
| P00-T05 | Apoio no Momento Certo | Item, Apoiador e limite compartilhado de uso. | Vencer e usar um Item e um Apoiador na mesma tentativa. | 50 Créditos. |
| P00-T06 | Mudar o Plano | Recuo, pagamento, troca por efeito e três pontos. | Vencer e executar um Recuo normal. | 100 Créditos + 1 pacote Genetic Apex — Pikachu. |

P00-T01 a T05 podem usar fixtures curtas com baralhos legais, dano inicial e campos predefinidos **explicitamente rotulados como tutorial**. O objetivo é terminar em vitória real, não clicar numa lista de passos sem combate. P00-T06 é um duelo guiado completo.

O jogador pode ocultar dicas, acelerar transições e revisitar lições. O prólogo continua compondo as seis vitórias obrigatórias desta versão. Um atalho de desenvolvimento que conclui tutoriais não deve aparecer como progressão normal.

Antes de confirmar o tutorial, mostrar “Cenário preparado: a mão inicial foi definida para esta lição”. Ao voltar à campanha, remover todos os facilitadores e sementes especiais do tutorial.

---

<a id="campanha-05"></a>

## 🏞️ 5. C01 — Ginásio de Celadon

**Tema:** Banco, evolução e preparação de Energia (torneio de Planta). **Líder:** Erika (`iris`). **Desafiantes:** Milo (E01), Gardenia (E03) e Viola (E05). **Cena:** `campaign-forest`.

| ID | Encontro | Tipo | Exige | Objetivo tático de domínio |
|---|---|---|---|---|
| C01-E01 | Primeiras Raízes | Duelo principal | P00-T06 | Vencer após colocar três Pokémon no Banco ao longo da partida. |
| C01-E02 | Um Lugar no Banco | Puzzle opcional | C01-E01 | Vencer o puzzle em até 2 turnos próprios. |
| C01-E03 | Crescimento em Dupla | Duelo principal | C01-E01 | Vencer após realizar uma evolução. |
| C01-E04 | O Jardim de Celadon | Descoberta opcional | C01-E03 | Escolher uma carta face-up; não requer vitória. |
| C01-E05 | Duas Copas | Elite opcional | C01-E03 | Vencer com ao menos dois Pokémon Básicos diferentes no deck. |
| C01-E06 | Erika, Líder de Celadon | Chefe principal | C01-E03 | Vencer após atacar com duas entidades distintas. |

### Contrato dos confrontos

**C01-E01 — Primeiras Raízes:** Básicos de um ponto; baixa pressão inicial.

**C01-E02 — Um Lugar no Banco:** Encontrar uma sequência legal que prepara o atacante reserva.

**C01-E03 — Crescimento em Dupla:** Duas linhas evolutivas; mostra o custo de depender de uma única criatura.

**C01-E05 — Duas Copas:** Adversário alterna duas linhas de Estágio 1.

**C01-E06 — Erika, Líder de Celadon:** Prepara o segundo atacante enquanto o primeiro recebe dano.


Todos os duelos exigem vitória para conclusão. O objetivo tático da tabela é adicional, exceto puzzles, cujo objetivo define a solução do cenário. Nos duelos, falhar o objetivo tático **não** impede o desbloqueio do caminho principal.

### Comportamento do chefe

O plano do adversário deve ser reconhecível, mas a sequência de ações é calculada pelo bot a partir das ações legais. Não forçar um ataque impossível apenas para seguir um roteiro.

**Contrajogo ensinado:** Preparar uma reserva antes de perder o Ativo; não concentrar todas as Energias em um único alvo.

Cartas, deck de apoio e ferramentas necessárias para praticar esse contrajogo ficam acessíveis antes do chefe. Em particular, um objetivo opcional de atacar o Banco não deve exigir abrir uma carta aleatória rara.

### Aquisição dirigida

**Prêmio-chave do chefe:** 2 cópias de Erika (A1), Apoiadora que cura 50 de dano de um Pokémon de Planta, após a vitória do chefe.

Esse prêmio complementa Créditos, pacotes e medalha definidos na economia. O Empório mostra onde obter as peças antes da vitória quando elas são necessárias à estratégia; a recompensa do chefe oferece cópias próprias adicionais, não o único acesso ao contrajogo.

### Diorama e arena Three.js

No mapa, bosque em miniatura com copas arredondadas, madeira clara e iluminação diurna difusa; verde menta e céu azul. No duelo, usar o campo claro abstrato com playmat ilustrado de folhas suaves e centro livre. Não colocar floresta volumétrica atrás das cartas.

Compartilhar a paleta e o tratamento de formas de `pocket-light-v1`, mas separar os ambientes: mapa é diorama; combate é campo abstrato claro. Um capítulo não troca a câmera, a posição das cartas, a legibilidade do HUD ou as regras para simular uma sala real.

---

<a id="campanha-06"></a>

## 🏞️ 6. C02 — Ginásio de Sootopolis

**Tema:** Recuo, troca e recursos (torneio de Água). **Líder:** Wallace (`mara`). **Desafiantes:** Marlon (E01), Crasher Wake (E03) e Melony (E05). **Cena:** `campaign-harbor`.

| ID | Encontro | Tipo | Exige | Objetivo tático de domínio |
|---|---|---|---|---|
| C02-E01 | Atracar | Duelo principal | C01-E06 | Vencer após um Recuo normal. |
| C02-E02 | Passagem Livre | Puzzle opcional | C02-E01 | Vencer no turno preparado usando um efeito de troca (Sabrina). |
| C02-E03 | Fluxo de Retorno | Duelo principal | C02-E01 | Vencer usando um efeito de troca. |
| C02-E04 | O Aquário de Sootopolis | Descoberta opcional | C02-E03 | Escolher uma carta face-up; não requer vitória. |
| C02-E05 | Corrente Cruzada | Elite opcional | C02-E03 | Vencer sem Pokémon ex no deck. |
| C02-E06 | Wallace, Líder de Sootopolis | Chefe principal | C02-E03 | Vencer após causar dano com dois atacantes diferentes. |

### Contrato dos confrontos

**C02-E01 — Atracar:** Atacantes com Recuo diferente.

**C02-E02 — Passagem Livre:** Alternar Ativo por efeito sem gastar o Recuo.

**C02-E03 — Fluxo de Retorno:** Cura moderada e alternância de Ativos.

**C02-E05 — Corrente Cruzada:** Oponente força uma escolha de novo Ativo.

**C02-E06 — Wallace, Líder de Sootopolis:** Alterna atacantes e preserva Energias para o próximo turno.


Todos os duelos exigem vitória para conclusão. O objetivo tático da tabela é adicional, exceto puzzles, cujo objetivo define a solução do cenário. Nos duelos, falhar o objetivo tático **não** impede o desbloqueio do caminho principal.

### Comportamento do chefe

O plano do adversário deve ser reconhecível, mas a sequência de ações é calculada pelo bot a partir das ações legais. Não forçar um ataque impossível apenas para seguir um roteiro.

**Contrajogo ensinado:** Distribuir Energia, calcular o custo de Recuo e usar trocas que não descartam recursos.

Cartas, deck de apoio e ferramentas necessárias para praticar esse contrajogo ficam acessíveis antes do chefe. Em particular, um objetivo opcional de atacar o Banco não deve exigir abrir uma carta aleatória rara.

### Aquisição dirigida

**Prêmio-chave do chefe:** 2 cópias de Misty (A1), Apoiadora que liga Energias de Água a um Pokémon de Água conforme moedas.

Esse prêmio complementa Créditos, pacotes e medalha definidos na economia. O Empório mostra onde obter as peças antes da vitória quando elas são necessárias à estratégia; a recompensa do chefe oferece cópias próprias adicionais, não o único acesso ao contrajogo.

### Diorama e arena Three.js

No mapa, porto diurno em miniatura com docas claras, água turquesa e barcos de formas simplificadas. Reflexo é decorativo, sem física de fluido. No duelo, ondas e motivos náuticos ilustrados no tapete claro; sem janela sobre uma cidade noturna, velas, madeira escura ou astrolábio ao redor da mesa.

Compartilhar a paleta e o tratamento de formas de `pocket-light-v1`, mas separar os ambientes: mapa é diorama; combate é campo abstrato claro. Um capítulo não troca a câmera, a posição das cartas, a legibilidade do HUD ou as regras para simular uma sala real.

---

<a id="campanha-07"></a>

## 🏞️ 7. C03 — Ginásio de Vermilion

**Tema:** Custo, Energia extra e gatilhos (torneio Elétrico). **Líder:** Tenente Surge (`teo`). **Desafiantes:** Elesa (E01), Clemont (E03) e Iono (E05). **Cena:** `campaign-powerplant`.

| ID | Encontro | Tipo | Exige | Objetivo tático de domínio |
|---|---|---|---|---|
| C03-E01 | Carga Inicial | Duelo principal | C02-E06 | Vencer com duas Energias ligadas a um mesmo Pokémon. |
| C03-E02 | Energia Bem Contada | Puzzle opcional | C03-E01 | Vencer no turno preparado usando o Item certo. |
| C03-E03 | Circuito Auxiliar | Duelo principal | C03-E01 | Vencer após usar uma Habilidade ativada. |
| C03-E04 | A Oficina de Vermilion | Descoberta opcional | C03-E03 | Escolher uma carta face-up; não requer vitória. |
| C03-E05 | Fio Desencapado | Elite opcional | C03-E03 | Vencer sem ultrapassar 12 turnos próprios. |
| C03-E06 | Tenente Surge, Líder de Vermilion | Chefe principal | C03-E03 | Vencer após Nocautear o Pokémon de apoio (Magneton). |

### Contrato dos confrontos

**C03-E01 — Carga Inicial:** Ataques com requisito específico e Incolor.

**C03-E02 — Energia Bem Contada:** Velocidade X reduz o Recuo; contar a Energia que sobra para o ataque do novo Ativo.

**C03-E03 — Circuito Auxiliar:** Aceleração de Energia com custo e limite explícitos.

**C03-E05 — Fio Desencapado:** Atacantes Elétricos rápidos; o relógio de turnos pune a preparação lenta.

**C03-E06 — Tenente Surge, Líder de Vermilion:** Magneton no Banco alimenta o atacante principal com a Habilidade de Energia.


Todos os duelos exigem vitória para conclusão. O objetivo tático da tabela é adicional, exceto puzzles, cujo objetivo define a solução do cenário. Nos duelos, falhar o objetivo tático **não** impede o desbloqueio do caminho principal.

### Comportamento do chefe

O plano do adversário deve ser reconhecível, mas a sequência de ações é calculada pelo bot a partir das ações legais. Não forçar um ataque impossível apenas para seguir um roteiro.

**Contrajogo ensinado:** Distinguir Energia ligada de fornecimento; interromper a fonte de aceleração, quando houver ataque ao Banco disponível.

Cartas, deck de apoio e ferramentas necessárias para praticar esse contrajogo ficam acessíveis antes do chefe. Em particular, um objetivo opcional de atacar o Banco não deve exigir abrir uma carta aleatória rara.

### Aquisição dirigida

**Prêmio-chave do chefe:** 2 cópias de Tenente Surge (A1), Apoiador que move as Energias Elétricas do Banco para o Raichu, Electrode ou Electabuzz Ativo; deck de apoio com ataque ao Banco desbloqueado antes do chefe.

Esse prêmio complementa Créditos, pacotes e medalha definidos na economia. O Empório mostra onde obter as peças antes da vitória quando elas são necessárias à estratégia; a recompensa do chefe oferece cópias próprias adicionais, não o único acesso ao contrajogo.

### Diorama e arena Three.js

No mapa, usina estilizada branca e cinza-claro, turbinas arredondadas e pequenos acentos amarelos/ciano. Movimento fica nos nós selecionados e pode ser desligado. No duelo, circuitos pastel discretos no tapete, não um painel hacker grafite com neon.

Compartilhar a paleta e o tratamento de formas de `pocket-light-v1`, mas separar os ambientes: mapa é diorama; combate é campo abstrato claro. Um capítulo não troca a câmera, a posição das cartas, a legibilidade do HUD ou as regras para simular uma sala real.

---

<a id="campanha-08"></a>

## 🏞️ 8. C04 — Ginásio de Saffron

**Tema:** Condições especiais e temporização (torneio Psíquico). **Líder:** Sabrina (`nara`). **Desafiantes:** Koga (E01), Liza (E03) e Morty (E05). **Cena:** `campaign-observatory`.

| ID | Encontro | Tipo | Exige | Objetivo tático de domínio |
|---|---|---|---|---|
| C04-E01 | Bruma Leve | Duelo principal | C03-E06 | Vencer após remover uma condição por troca ou evolução. |
| C04-E02 | Depois da Meia-Volta | Puzzle opcional | C04-E01 | Vencer no turno preparado curando a condição especial por evolução. |
| C04-E03 | Vigília | Duelo principal | C04-E01 | Vencer após evoluir um Pokémon que tinha condição especial. |
| C04-E04 | As Lentes de Saffron | Descoberta opcional | C04-E03 | Escolher uma carta face-up; não requer vitória. |
| C04-E05 | Ecos Sobrepostos | Elite opcional | C04-E03 | Vencer sem Pokémon ex no deck. |
| C04-E06 | Sabrina, Líder de Saffron | Chefe principal | C04-E03 | Vencer após usar uma Habilidade ativada. |

### Contrato dos confrontos

**C04-E01 — Bruma Leve:** Veneno e dano entre turnos.

**C04-E02 — Depois da Meia-Volta:** Haunter Adormecido evolui para Gengar, que acorda e ataca no mesmo turno.

**C04-E03 — Vigília:** Sono e Confusão em cartas diferentes, com moedas normais.

**C04-E05 — Ecos Sobrepostos:** Veneno coexistindo com uma condição de controle.

**C04-E06 — Sabrina, Líder de Saffron:** Sono e Veneno com Habilidades de controle (Gengar ex); todas as durações são legíveis.


Todos os duelos exigem vitória para conclusão. O objetivo tático da tabela é adicional, exceto puzzles, cujo objetivo define a solução do cenário. Nos duelos, falhar o objetivo tático **não** impede o desbloqueio do caminho principal.

### Comportamento do chefe

O plano do adversário deve ser reconhecível, mas a sequência de ações é calculada pelo bot a partir das ações legais. Não forçar um ataque impossível apenas para seguir um roteiro.

**Contrajogo ensinado:** Manter alternativas de troca e evolução; ler quando a condição termina, em vez de esperar uma cura automática.

Cartas, deck de apoio e ferramentas necessárias para praticar esse contrajogo ficam acessíveis antes do chefe. Em particular, um objetivo opcional de atacar o Banco não deve exigir abrir uma carta aleatória rara.

### Aquisição dirigida

**Prêmio-chave do chefe:** 2 cópias de Sabrina (A1), Apoiadora que obriga o oponente a trocar o Pokémon Ativo.

Esse prêmio complementa Créditos, pacotes e medalha definidos na economia. O Empório mostra onde obter as peças antes da vitória quando elas são necessárias à estratégia; a recompensa do chefe oferece cópias próprias adicionais, não o único acesso ao contrajogo.

### Diorama e arena Three.js

No mapa, observatório lilás-claro com cúpula perolada e estrelas gráficas, sem fundo preto espacial. Órbitas são lentas e desligáveis. No duelo, tapete lavanda com arcos e pequenas estrelas fora das áreas críticas; HUD branco/azul estável.

Compartilhar a paleta e o tratamento de formas de `pocket-light-v1`, mas separar os ambientes: mapa é diorama; combate é campo abstrato claro. Um capítulo não troca a câmera, a posição das cartas, a legibilidade do HUD ou as regras para simular uma sala real.

---

<a id="campanha-09"></a>

## 🏞️ 9. C05 — Ginásio de Stow-on-Side

**Tema:** Apoiadores, modificadores de dano e golpes pesados (torneio de Lutador). **Líder:** Bea (`breno`). **Desafiantes:** Chuck (E01), Roark (E03) e Jasmine (E05). **Cena:** `campaign-foundry`.

| ID | Encontro | Tipo | Exige | Objetivo tático de domínio |
|---|---|---|---|---|
| C05-E01 | Uma Camada a Mais | Duelo principal | C04-E06 | Vencer depois de jogar um Apoiador. |
| C05-E02 | O Peso da Moldura | Puzzle opcional | C05-E01 | Resolver o Nocaute do puzzle sem declarar ataque (com uma Habilidade). |
| C05-E03 | Terreno Compartilhado | Duelo principal | C05-E01 | Vencer depois de jogar um Item. |
| C05-E04 | O Dojo de Stow-on-Side | Descoberta opcional | C05-E03 | Escolher uma carta face-up; não requer vitória. |
| C05-E05 | Metal de Retorno | Elite opcional | C05-E03 | Vencer com no máximo 1 ponto concedido ao adversário. |
| C05-E06 | Bea, Líder de Stow-on-Side | Chefe principal | C05-E03 | Vencer com três Energias ligadas a um mesmo Pokémon. |

### Contrato dos confrontos

**C05-E01 — Uma Camada a Mais:** Giovanni e Blaine somam dano no turno; ler o modificador antes de atacar.

**C05-E02 — O Peso da Moldura:** Greninja no Banco usa Shuriken de Água para fechar o Nocaute sem declarar ataque.

**C05-E03 — Terreno Compartilhado:** Itens de mobilidade e cura em ambos os lados; escolher quando gastá-los.

**C05-E05 — Metal de Retorno:** Redução de dano recebido (Melmetal, Golem) e atacantes Lutadores pesados.

**C05-E06 — Bea, Líder de Stow-on-Side:** Brock acelera Golem e Onix; golpes caros que precisam de três Energias.


Todos os duelos exigem vitória para conclusão. O objetivo tático da tabela é adicional, exceto puzzles, cujo objetivo define a solução do cenário. Nos duelos, falhar o objetivo tático **não** impede o desbloqueio do caminho principal.

### Comportamento do chefe

O plano do adversário deve ser reconhecível, mas a sequência de ações é calculada pelo bot a partir das ações legais. Não forçar um ataque impossível apenas para seguir um roteiro.

**Contrajogo ensinado:** Inspecionar redução de dano e custos altos; derrubar o atacante pesado antes que junte Energia.

Cartas, deck de apoio e ferramentas necessárias para praticar esse contrajogo ficam acessíveis antes do chefe. Em particular, um objetivo opcional de atacar o Banco não deve exigir abrir uma carta aleatória rara.

### Aquisição dirigida

**Prêmio-chave do chefe:** 2 cópias de Brock (A1), Apoiador que liga Energia de Lutador ao Golem ou ao Onix.

Esse prêmio complementa Créditos, pacotes e medalha definidos na economia. O Empório mostra onde obter as peças antes da vitória quando elas são necessárias à estratégia; a recompensa do chefe oferece cópias próprias adicionais, não o único acesso ao contrajogo.

### Diorama e arena Three.js

No mapa, oficina limpa com aço claro, formas arredondadas e acentos pêssego; metal não significa ferrugem, brasas cinematográficas ou cobre escuro. No duelo, tapete prata pastel com símbolos suaves. O cenário é decoração; nenhum efeito de campo vem dele.

Compartilhar a paleta e o tratamento de formas de `pocket-light-v1`, mas separar os ambientes: mapa é diorama; combate é campo abstrato claro. Um capítulo não troca a câmera, a posição das cartas, a legibilidade do HUD ou as regras para simular uma sala real.

---

<a id="campanha-10"></a>

## 🏞️ 10. C06 — Ginásio de Viridian

**Tema:** Risco de pontos, múltiplos alvos e plano completo (o Ginásio do Campeão). **Líder:** Blue (`sol`). **Desafiantes:** Korrina (E01), Blaine (E03) e Clay (E05). **Cena:** `campaign-archive`.

| ID | Encontro | Tipo | Exige | Objetivo tático de domínio |
|---|---|---|---|---|
| C06-E01 | Um Ponto de Cada Vez | Duelo principal | C05-E06 | Vencer sem Pokémon ex no deck e em até 10 turnos próprios. |
| C06-E02 | Conta de Risco | Puzzle opcional | C06-E01 | Vencer no turno preparado selecionando a sequência de Nocautes correta. |
| C06-E03 | Duas Faces do Plano | Duelo principal | C06-E01 | Vencer sem conceder mais de 1 ponto. |
| C06-E04 | A Sala de Troféus de Viridian | Descoberta opcional | C06-E03 | Escolher uma carta face-up; não requer vitória. |
| C06-E05 | Ápice de Dois Pontos | Elite opcional | C06-E03 | Vencer Nocauteando um Pokémon ex. |
| C06-E06 | Blue, Líder de Viridian | Chefe principal | C06-E03 | Vencer atacando com ao menos duas entidades distintas. |

### Contrato dos confrontos

**C06-E01 — Um Ponto de Cada Vez:** Três alvos de um ponto.

**C06-E02 — Conta de Risco:** Escolher entre alvos com valores de pontos diferentes.

**C06-E03 — Duas Faces do Plano:** Atacante ex e apoio de um ponto.

**C06-E05 — Ápice de Dois Pontos:** Um Pokémon ex vale dois pontos; um único Nocaute pode decidir a partida.

**C06-E06 — Blue, Líder de Viridian:** Deck misto alterna o risco entre atacantes e apoio.


Todos os duelos exigem vitória para conclusão. O objetivo tático da tabela é adicional, exceto puzzles, cujo objetivo define a solução do cenário. Nos duelos, falhar o objetivo tático **não** impede o desbloqueio do caminho principal.

### Comportamento do chefe

O plano do adversário deve ser reconhecível, mas a sequência de ações é calculada pelo bot a partir das ações legais. Não forçar um ataque impossível apenas para seguir um roteiro.

**Contrajogo ensinado:** Contar pontos antes de maximizar dano; escolher a linha de vitória que usa menos turnos e recursos.

Cartas, deck de apoio e ferramentas necessárias para praticar esse contrajogo ficam acessíveis antes do chefe. Em particular, um objetivo opcional de atacar o Banco não deve exigir abrir uma carta aleatória rara.

### Aquisição dirigida

**Prêmio-chave do chefe:** 2 cópias de um Pokémon ex escolhido pelo jogador entre Charizard ex, Pikachu ex e Blastoise ex (impressões ◊◊◊◊ já à venda no Empório antes do chefe); os demais seguem no Empório.

Esse prêmio complementa Créditos, pacotes e medalha definidos na economia. O Empório mostra onde obter as peças antes da vitória quando elas são necessárias à estratégia; a recompensa do chefe oferece cópias próprias adicionais, não o único acesso ao contrajogo.

### Diorama e arena Three.js

No mapa, biblioteca aberta e luminosa, prateleiras brancas, páginas leves e passarelas azul-claro/lavanda. Altura é apenas visual. No duelo, tapete claro com motivos de páginas no perímetro; Pokémon ex continuam identificados pela carta e pelos três marcadores de pontuação.

Compartilhar a paleta e o tratamento de formas de `pocket-light-v1`, mas separar os ambientes: mapa é diorama; combate é campo abstrato claro. Um capítulo não troca a câmera, a posição das cartas, a legibilidade do HUD ou as regras para simular uma sala real.

---

<a id="campanha-11"></a>

## 🏆 11. Final — Torneio de Kanto

A final, o Torneio de Kanto, usa três duelos independentes e progressivos: o exame de retorno com Cheren, a revanche com Blue e a final com Giovanni. O torneio não é eliminatório nem custa a campanha: perder D03 não obriga refazer D01.

| ID | Confronto | Plano adversário | Pré-requisito | Objetivo extra |
|---|---|---|---|---|
| F00-D01 | Cheren, Exame de Retorno | Evolução, Banco e uso eficiente de Treinadores. | C06-E06. | Vencer após evoluir e usar uma troca por efeito. |
| F00-D02 | Revanche de Blue | Dois arquétipos compatíveis de Energia, risco de pontos e alternativas. | F00-D01. | Vencer após atacar com duas entidades diferentes. |
| F00-D03 | Giovanni, Chefe da Equipe Rocket | Combinação de apoio (Butterfree), Apoiadores e atacante ex de alto risco; sem regras ocultas. | F00-D02. | Vencer concedendo no máximo 1 ponto. |

Entre duelos, o jogador pode trocar de deck, abrir pacotes, salvar e sair. HP, dano e Energias não são carregados de uma partida para a seguinte. Não há desgaste permanente.

Cada vitória concede o prêmio de final definido na economia. D03 concede também o troféu do Torneio de Kanto (`trophy-circuito-completo`) e o tapete `mat-circuit-complete` (§15.5), cena curta pulável, entrada final no diário e acesso ao pós-jogo.

O final usa o mesmo campo claro arredondado e a mesma câmera de leitura. O anfiteatro pode existir como miniatura luminosa no mapa/briefing, nunca como sala escura ao redor do duelo. A entrada apresenta símbolos dos capítulos e um breve foco nas cartas, pulável; não cria câmera de RPG ou invocação de criaturas.

Créditos finais não simulam jogadores reais ou equipe externa. Nomes de criadores e licenças só aparecem quando estiverem efetivamente definidos no projeto.

---

<a id="campanha-12"></a>

## 🎯 12. Objetivos, medalhas e domínio

## 12.1. Semântica comum

Nos duelos de capítulo e final, cada nó possui três objetivos: vitória, objetivo tático da tabela do encontro e restrição de composição abaixo. Todos exigem vencer a mesma tentativa em que a condição é demonstrada.

| Região | Objetivo de composição |
|---|---|
| C01 | Snapshot com três linhas evolutivas distintas e pelo menos seis Pokémon de Planta. |
| C02 | Zona configurada com exatamente dois tipos de Energia e pelo menos quatro Pokémon de Água. |
| C03 | Snapshot com pelo menos duas cartas cujo efeito estruturado use `ATTACH_ENERGY` ou `MOVE_ENERGY` e quatro Pokémon Elétricos. |
| C04 | Snapshot com pelo menos duas cartas cujo efeito estruturado use `APPLY_CONDITION` ou `REMOVE_CONDITION` e quatro Pokémon Psíquicos ou Noturnos. |
| C05 | Snapshot com pelo menos duas cartas cujo efeito use `MODIFY` de dano causado ou recebido (Giovanni, Blaine, Melmetal…). |
| C06 | Snapshot com pelo menos duas cartas de `ruleBox` EX. |
| Final | Snapshot com quatro linhas evolutivas distintas e pelo menos um Pokémon ex. |

**[DP] 3.2.0:** os objetivos anteriores eram cumpridos automaticamente pelos três decks iniciais, transformando ~1.080 Créditos “opcionais” em renda garantida. Os critérios exigem desvio real da lista inicial e usam somente dados do snapshot (tipo do Pokémon, opcodes das definições, `ruleBox`, subtipo, linhas evolutivas). **[DP] 3.3.0 (conteúdo 2.0.0):** com um único conjunto (Genetic Apex), a contagem por conjunto de capítulo foi trocada pela contagem por tipo (`minTypeCards`); os decks iniciais têm no máximo dois Pokémon de cada linha por tipo, então nenhum cumpre um objetivo de outro capítulo por acaso. Todos são alcançáveis com cartas de obtenção dirigida anterior ao encontro (Empório, Descoberta ou prêmio de nó anterior); nenhum exige sorte de pacote. **[DP] 3.3.0 (conteúdo 3.0.0):** os cinco decks iniciais novos têm duas linhas evolutivas, nenhum ex e só ataques diretos — nenhuma carta liga ou move Energia, aplica Condição ou modifica dano —, e a Zona de Energia de cada inicial tem um só tipo; por isso nenhum dos oito cumpre sozinho um objetivo `-DECK` (C-066), nem o Faísca Veloz com seus oito Pokémon Elétricos em C03.

O limite de ex é um objetivo opcional, não uma mudança no limite por nome do baralho.

Tutoriais e puzzles possuem um objetivo obrigatório composto, sem três estrelas artificiais. Descobertas possuem estado de escolha concluída, não estatística de vitória.

## 12.2. Não exigir tudo na mesma partida

Para domínio do nó, acumular o conjunto de `objectiveId` concluídos em tentativas válidas diferentes. O jogador pode vencer uma vez com a restrição de deck e outra vez realizando o objetivo tático. Não é necessário cumprir os três simultaneamente.

Desbloquear próximo nó depende só da primeira vitória nos duelos principais. A opção “Iniciar” continua habilitada quando o deck é legal, mesmo que não possa cumprir um objetivo extra.

## 12.3. Eventos que contam

| Critério | Fonte e definição |
|---|---|
| Vencer | `MatchResult.winnerId` do humano; empate e desistência não contam. |
| Evoluir | Evento de evolução confirmado durante a tentativa; não apenas possuir uma carta evoluída. |
| Atacar com dois Pokémon | Duas entidades de campo distintas declararam ataques válidos; falha por Confusão não conta como ataque executado. |
| Causar dano com dois atacantes | Dois IDs de origem distintos em eventos de dano de ataque maior que zero. |
| Usar efeito de troca | Um efeito do jogador trocou um Ativo pelo Banco — o próprio ou o do oponente (Sabrina, Victreebel); Recuo normal não conta. |
| Remover condição por evolução/troca | Condição presente antes e removida por causa identificada no evento. |
| Usar Ferramenta | Ligação de Ferramenta aceita; não exige mantê-la até o fim, salvo objetivo específico. |
| Remover fonte de modificador | Remoção/substituição de carta fonte correspondente, registrada no evento. |
| Nocautear apoio | Alvo do Nocaute possui etiqueta de papel publicada para aquele cenário, não apenas posição de Banco. |
| Limite de turnos | Contador de turnos próprios do humano, incluindo o turno da vitória. |
| Pontos concedidos | Pontos realmente obtidos pelo NPC na partida. |
| Composição | Snapshot de entrada; não a lista atual editada depois. |
| Impedir efeito atrasado | Efeito agendado foi removido por uma causa válida; não basta ganhar antes de seu prazo. |

Não usar nomes de animação, coordenadas de mesh ou tempo de vídeo para avaliar essas condições.

## 12.4. Estados e prêmio

```text
Não concluído
→ Concluído em uma tentativa válida
→ Prêmio concedido na transação de resultado
```

A tela de resultado mostra “Recebido”. O botão de continuar não concede novamente. Fechar a página após a concessão preserva os objetivos.

Medalhas de capítulo registram a primeira vitória do chefe em qualquer dificuldade. Não são moedas e não são consumidas ao entrar em outro capítulo.

---

<a id="campanha-13"></a>

## 🧩 13. Puzzles, cenários e modificadores

## 13.1. Puzzle não é duelo aleatório disfarçado

Um puzzle informa no briefing que campo, mão, baralho e sequência aleatória foram preparados. Deve haver ao menos uma solução legal demonstrável por sequência de comandos e teste automatizado.

O objetivo não pode depender de descobrir um resultado aleatório favorável após centenas de reinícios. Preferir puzzles sem moedas ou com sequência declarada/fixa no conteúdo didático.

## 13.2. Fixture

Uma fixture define cartas nas zonas, danos, Energias, Ferramentas, Estádio, jogador do turno, contadores e objetivo. O validador verifica conservação das cartas do cenário e capacidade das zonas.

Ela também declara as exceções de início: um cenário avançado pode começar no turno próprio 4, com evoluções já em campo. Isso não autoriza evoluir ilegalmente depois.

```text
Carregar fixture validada
→ Aplicar jogador do turno e contadores
→ Calcular ações legais
→ Executar comandos normais
→ Avaliar resultado e objetivo
```

## 13.3. Reiniciar e ajuda

Reiniciar o puzzle volta à mesma fixture e cria outra tentativa, sem conceder novamente o prêmio inicial. Oferecer três níveis de ajuda: conceito, próxima decisão relevante e solução comentada.

Consultar ajuda não remove acesso à campanha ou cartas essenciais. Pode haver registro separado “resolvido sem dicas”, somente cosmético.

## 13.4. Modificadores

O conjunto inicial não depende de bônus secretos de HP ou geração extra do NPC. Qualquer variante futura deve declarar escopo, duração, beneficiários, texto de ajuda e precedência no ruleset.

Não usar um cenário “especial” para justificar um bug de cartas. Modificadores são dados validados, aparecem no briefing e na mesa.

## 13.5. Limites

Duelo normal: no máximo 60 turnos globais, conforme gameplay. Um puzzle pode fixar um limite menor de turnos próprios, exibido antes de iniciar. Não usar segundos reais como requisito essencial.

---

<a id="campanha-14"></a>

## 🤖 14. Dificuldades, IA e assistência

| Dificuldade | Comportamento pretendido | Consequência de progressão |
|---|---|---|
| História / `STORY` | Heurísticas mais simples, dicas opcionais, deck adversário de menor sinergia quando publicado. | Mesmos desbloqueios, cartas essenciais e primeira conclusão. |
| Padrão / `STANDARD` | Considera sequência do turno, desenvolvimento e risco de pontos. | Experiência principal de balanceamento. |
| Especialista / `EXPERT` | Busca de sequências mais ampla e deck mais consistente explicitamente descrito. | Recordes e emblemas opcionais; não bloqueia a história. |

A dificuldade fica congelada na tentativa. Para mudar, sair ou reiniciar de modo explícito. Retomar um save não muda silenciosamente a força do adversário.

A IA usa a mesma legalidade, custos e limites que o humano. Não compra cartas escolhidas secretamente, não troca resultados de moeda e não consulta a mão humana. O computador conhece o que seu controlador pode observar, mesmo que os dados completos estejam fisicamente no dispositivo.

## 14.1. Identidade tática

O `aiProfileId` define preferências por evolução, preservação de pontos, agressividade ou distribuição de Energia. Não define uma sequência rígida de comandos incompatível com o estado.

**Agressividade (conteúdo 3.5.0, decisão do autor de 18/10/2026):** todo rival ataca quando pode, em qualquer dificuldade ([gameplay §25.3](gameplay.md#gameplay-25)). O peso `weights.aggression` do perfil (base 1) regula o quanto ele arrisca o Ativo para isso: Wallace (`harbor`) 0,7 e Blue (`archive`) 0,85 são os mais cautelosos; Tenente Surge (`circuits`) 1,1, Bea (`foundry`) e Giovanni (`final`) 1,2 os mais ousados. A preservação de pontos base caiu de 1 para 0,8. Os ids `<npcId>-<dificuldade>-v1` não mudam.

A diferença de personalidade deve ser percebida nas escolhas, não em esperas artificiais de “pensamento” de muitos segundos.

## 14.2. Assistência

Dicas ao humano usam sua visão autorizada. Podem explicar custo, oportunidade de evolução e ameaça pública. Não revelam a próxima compra ou moeda por conhecer o save.

Depois de duas derrotas consecutivas no mesmo nó, oferecer revisar deck ou ativar História, sem mudar automaticamente a dificuldade. Depois de mais derrotas, destacar o deck de apoio e uma dica de contrajogo.

## 14.3. Autoplay

Pode existir em Arena e treino, desativado por padrão na campanha inicial. Qualquer expansão para campanha precisa declarar se conta para objetivos. Nesta versão, a campanha não possui autoplay de progressão; o bot controla apenas o adversário.

---

<a id="campanha-15"></a>

## 💰 15. Economia inicial e recompensas

Todos os valores desta seção são **parâmetros de balanceamento propostos**, não preços, probabilidades ou recompensas oficiais. Nenhum deles representa dinheiro real.

## 15.1. Concessões

| Fonte | Primeira conclusão | Repetição elegível |
|---|---|---|
| Perfil novo | 300 Créditos + coleção inicial + pacote tutorial + 1 pacote Genetic Apex — Pikachu. | Nunca se repete no mesmo perfil. |
| Tutorial T01–T05 | 50 Créditos cada. | Sem prêmio. |
| Tutorial T06 | 100 Créditos + 1 pacote Genetic Apex — Pikachu. | Sem prêmio. |
| Duelo principal E01/E03 | 80 Créditos + 1 pacote do capítulo (§16.1). | 20 Créditos por vitória. |
| Puzzle E02 | 100 Créditos. | Sem prêmio. |
| Descoberta E04 | Uma carta escolhida entre três opções. | Sem nova escolha. |
| Elite E05 | 160 Créditos + 1 pacote do capítulo. | 30 Créditos por vitória. |
| Chefe E06 | 250 Créditos + 2 pacotes do capítulo + medalha + carta-chave ×2. | 40 Créditos por vitória. |
| Duelo final D01–D03 | 300 Créditos + 1 pacote Charizard + 1 pacote Mewtwo (D03: Pikachu + Mewtwo). | 40 Créditos por vitória. |
| Objetivo extra de duelo | 40 Créditos por `objectiveId`, uma única vez. | Sem prêmio novamente. |
| Treino / laboratório | Nenhum prêmio de campanha. | Nenhum. |
| Derrota, empate ou desistência | Nenhum prêmio de vitória. | Nenhuma perda de inventário. |

Na primeira vitória, aplicar o prêmio inicial **ou** o repetível, nunca os dois para o mesmo encontro. Objetivos extras novos podem ser acrescentados ao prêmio da tentativa, mesmo em uma repetição.

Chaves de concessão: primeira conclusão `first-clear:{campaignId}:{nodeId}`; objetivo `objective:{campaignId}:{objectiveId}`. O perfil é coluna da concessão e a versão do conteúdo nunca entra na chave: atualizar a campanha não repete uma primeira vitória. Tabela completa em [gameplay §24.5](gameplay.md#gameplay-24) e [persistência §13](persistencia-sqlite.md#sqlite-13).

O prêmio-chave da C06 possui uma decisão pendente de escolha entre três Pokémon ex (Charizard ex, Pikachu ex, Blastoise ex). O resultado e a vitória já são persistidos; a concessão da carta é uma operação separada, única e retomável. Não perder o prêmio se o jogador sair antes de escolher. Os demais prêmios da vitória são concedidos normalmente.

## 15.2. Valores do Empório

| Produto | Preço-base em Créditos | Disponibilidade |
|---|---:|---|
| Pacote Genetic Apex — Pikachu (`pack-a1-pikachu`) | 100 | Desde o início. |
| Pacote Genetic Apex — Charizard (`pack-a1-charizard`) | 100 | Após C01-E01. |
| Pacote Genetic Apex — Mewtwo (`pack-a1-mewtwo`) | 100 | Após C04-E01. |
| Pacotes dos sets seguintes e promocionais (14, §16.1) | 100 | Desde o início. |
| Carta ◊ dirigida (COMMON) | 80 por cópia | A1: junto com o pacote de origem da impressão (sem pacote: desde o início). Outros sets: desde o início. |
| Carta ◊◊ dirigida (UNCOMMON) | 160 por cópia | Idem. |
| Carta ◊◊◊ dirigida (RARE) | 300 por cópia | Idem. |
| Carta ◊◊◊◊/☆/☆☆/☆☆☆/✵/✵✵/♛ dirigida (ULTRA) | 600 por cópia | A1: Pikachu após C03-E06; Charizard após C05-E06; Mewtwo após C06-E06; sem pacote (Mew ☆☆☆, coroas ♛) após F00-D03. Outros sets: desde o início. |
| Verso de deck | 200 | Conforme marco de capítulo. |
| Moeda cosmética | 300 | Conforme marco de capítulo. |
| Tapete temático | 500 | Após o chefe correspondente. |

Cartas dirigidas: **uma oferta por impressão não PROMO** — 1.849 no conteúdo 3.0.0 (286 do A1 e 1.563 dos outros sets), uma cópia por compra. O preço sai da raridade da impressão; brilhantes (✵/✵✵), ☆ e ♛ são ULTRA. As travas do A1 acima continuam; fora do A1 tudo fica à venda desde o início (**[DP] 3.3.0**, decisão do autor de 16/10/2026).

Raridade de aquisição e `ruleBox` (EX/MEGA_EX) são eixos separados; no Genetic Apex todo ex impresso é ◊◊◊◊ ou superior, por isso custa 600 pela raridade, não por ser ex. O preço vem do produto, não de uma busca pelo nome.

Impressões de raridade `PROMO` (220 no conteúdo 3.0.0: 117 do Promo-A e 103 do Promo-B) nunca são vendidas como cartas dirigidas nem entram no pool de um pacote de set. Os seis Treinadores Promo-A da coleção inicial só são concedidos (coleção inicial ou recompensas definidas); as demais promos saem apenas nos pacotes promocionais Promo-A e Promo-B (§16.1).

Nenhum item tem limite diário ou desaparece por relógio. As compras são repetíveis enquanto houver saldo, salvo cosméticos já possuídos.

## 15.3. Recursos sem destruição de coleção

Cartas repetidas continuam no inventário. Não há venda, desmonte, sacrifício, fusão de cópias para aumentar dano ou consumo da última cópia em crafting nesta versão.

Os cosméticos usam Créditos e não alteram atributos. Trocar a arte selecionada num deck não muda seu poder.

## 15.4. Auditoria de progressão

Somente a rota obrigatória, sem objetivos extras, oferece 4.010 Créditos ao longo de toda a campanha, incluindo os 300 iniciais:

```text
Perfil: 300
Prólogo: 5 × 50 + 100 = 350
Capítulos: 6 × (80 + 80 + 250) = 2.460
Final: 3 × 300 = 900
Total: 4.010 Créditos
```

Essa renda é adicional aos pacotes, cartas garantidas e recompensas opcionais. Ao editar valores, gerar novamente a auditoria a partir dos dados; não manter um total manual divergente.

Renda opcional única (auditada pelo build a partir dos dados, **[DP] 3.2.0**):

```text
Puzzles E02: 6 × 100 = 600
Elites E05: 6 × 160 = 960
Objetivos extras: 54 × 40 = 2.160   (24 duelos de capítulo + 3 finais, 2 objetivos cada)
Total opcional: 3.720 Créditos
Máximo único (obrigatória + opcional): 7.730 Créditos
```

Nenhum objetivo extra é cumprido automaticamente pelos decks iniciais (§12.1); a renda opcional depende de jogar de modo diferente, não de repetir a mesma partida.

Com 300 Créditos iniciais, o jogador já pode comprar uma carta ◊◊◊ dirigida ou três pacotes Pikachu. Gastar tudo em cosméticos não pode impedir uma vitória porque os decks iniciais e apoios são gratuitos.

O número de vitórias repetidas necessário para uma carta de preço P é `ceil(P / recompensa repetível)`. Esse indicador serve para detectar excesso de repetição na progressão, não para impor grind obrigatório.


## 15.5. Cosmético de conclusão na revisão 2.1

F00-D03 concede também `mat-circuit-complete`, uma única vez, conforme [catálogo de playmats](#campanha-cosmeticos). É um entitlement, não Créditos extras; o total monetário de 4.010 da rota principal permanece inalterado. Neutro e Escola de Treinadores são gratuitos; os seis tapetes de capítulo continuam custando 500 Créditos após seu chefe.

---

<a id="campanha-16"></a>

## 📦 16. Pacotes locais e aquisição dirigida

## 16.1. Produtos

O conteúdo 3.0.0 tem 17 pacotes aleatórios, todos de 100 Créditos, e o pacote tutorial (§16.4).

Os três pacotes reais do Genetic Apex (A1), inalterados desde o conteúdo 2.0.0: `pack-a1-pikachu` desde o início, `pack-a1-charizard` após C01-E01 e `pack-a1-mewtwo` após C04-E01. O pool de cada pacote = impressões marcadas para aquele pacote no set + as impressões que não pertencem a nenhum (inclusive as ☆☆☆/♛ e as reimpressões alternativas). Capa de cada pacote: o ex do nome.

Os 14 pacotes dos sets seguintes (`src/content/source/pocket/packs.ts`), à venda desde o início (**[DP] 3.3.0**, decisão do autor de 16/10/2026):

| Produto | Nome | Tabela (§16.2) | Cartas | Pool | Pacote raro | 6ª carta |
|---|---|---|---:|---:|---:|---:|
| `pack-a1a-mew` | Mythical Island — Mew | Clássica | 5 | 86 | 18 | — |
| `pack-a2-dialga` | Space-Time Smackdown — Dialga | Clássica | 5 | 126 | 27 | — |
| `pack-a2-palkia` | Space-Time Smackdown — Palkia | Clássica | 5 | 126 | 27 | — |
| `pack-a2a-arceus` | Triumphant Light — Arceus | Clássica | 5 | 96 | 21 | — |
| `pack-a3-solgaleo` | Celestial Guardians — Solgaleo | Brilhante | 5 | 140 | 43 | — |
| `pack-a3-lunala` | Celestial Guardians — Lunala | Brilhante | 5 | 140 | 43 | — |
| `pack-a3a` | Extradimensional Crisis | Brilhante | 5 | 103 | 34 | — |
| `pack-a3b` | Eevee Grove | Brilhante | 5 | 107 | 38 | — |
| `pack-a4-lugia` | Wisdom of Sea and Sky — Lugia | Brilhante | 5 | 132 | 40 | 4 |
| `pack-a4-ho-oh` | Wisdom of Sea and Sky — Ho-Oh | Brilhante | 5 | 132 | 40 | 4 |
| `pack-a4a` | Secluded Springs | Brilhante | 5 | 101 | 33 | 4 |
| `pack-a4b` | Deluxe Pack ex | Deluxe | 4 | 379 | 26 | — |
| `pack-pa-promo` | Pacote Promo-A | Promo (inventada) | 5 | 111 | — | — |
| `pack-pb-promo` | Pacote Promo-B | Promo (inventada) | 5 | 103 | — | — |

“Pool” conta as impressões distintas das posições normais; “Pacote raro”, as impressões ☆ ou acima desse pool; “6ª carta”, os bebês do pool próprio (três ◊◊◊ e um ☆ por pacote). Os tamanhos por símbolo e a chance de cada carta estão no [catálogo de conteúdo](catalogo-conteudo.md) §5, gerado pelo content-build.

Pool de um pacote dos sets seguintes = impressões daquele pacote + as do set que não pertencem a nenhum pacote, **exceto os bebês do A4/A4a**, que só saem na 6ª carta. Sets sem pacotes nomeados (A3a, A3b, A4a, A4b) têm um único pacote com o set inteiro. Um pacote nunca mistura sets. Pacote Promo-A: as impressões do P-A, exceto os seis Treinadores da coleção inicial (111 de 117); Pacote Promo-B: as 103 do P-B. Capa (`POCKET_PACKS`): um ex do set — Mew ex, Dialga ex, Palkia ex, Arceus ex, Solgaleo ex, Lunala ex, Buzzwole ex, Eevee ex, Lugia ex, Ho-Oh ex, Suicune ex e Pikachu ex no Deluxe; nos promocionais, Pikachu (P-A 009) e Mega Garchomp ex (P-B 099).

As recompensas da campanha continuam usando só os pacotes do A1. Cada capítulo concede o pacote do seu tema de tipos: P00, C02 e C03 → Pikachu; C01 e C05 → Charizard; C04, C06 e a final → Mewtwo (a final alterna, ver §15.1). Os pacotes dos sets seguintes vêm do Empório.

Toda arte, tabela e texto desses produtos pertence ao pacote de instalação. “Desbloquear” permite usar conteúdo local existente; não inicia download da internet.

## 16.2. Probabilidades

Dois modelos convivem (decisão do autor, 16/10/2026): os pacotes do A1 mantêm as probabilidades do projeto, sem mudança; os 14 pacotes novos usam as taxas oficiais do Pokémon TCG Pocket por símbolo.

O símbolo do Pocket exibido na carta é derivado de (raridade, acabamento, cena imersiva, brilhante): ◊ COMMON · ◊◊ UNCOMMON · ◊◊◊ RARE · ◊◊◊◊ ULTRA normal · ☆ ULTRA holográfica · ☆☆ ULTRA foil · ☆☆☆ ULTRA foil imersiva · ✵ ULTRA holográfica brilhante · ✵✵ ULTRA foil brilhante · ♛ ULTRA cromada (`src/domain/cards/rarity.ts`). Ordem crescente: ◊ < ◊◊ < ◊◊◊ < ◊◊◊◊ < ☆ < ☆☆ < ☆☆☆ < ✵ < ✵✵ < ♛; `PROMO` fica à parte.

### Modelo do projeto — pacotes do Genetic Apex

Cada pacote contém cinco cartas. As categorias do motor são `COMMON`, `UNCOMMON`, `RARE`, `ULTRA`. As probabilidades são do projeto, não as oficiais. `PROMO` nunca aparece nesses pools (seção 15.2).

| Posição | Comum | Incomum | Rara | Ultra |
|---|---:|---:|---:|---:|
| 1 | 100% | 0% | 0% | 0% |
| 2 | 100% | 0% | 0% | 0% |
| 3 | 100% | 0% | 0% | 0% |
| 4 | 30% | 70% | 0% | 0% |
| 5 | 0% | 70% | 25% | 5% |

Depois de sortear a categoria de uma posição, sortear uma impressão do pool daquela categoria com pesos explícitos por símbolo: ◊…◊◊◊◊ = 10, ☆ = 4, ☆☆ = 3, ☆☆☆ = 1, ♛ = 1. Probabilidade de uma impressão = chance da categoria × seu peso dividido pela soma de pesos da categoria. Esse modelo mantém o consumo de RNG do conteúdo 2.x (categoria e impressão ponderada, posição a posição).

### Modelo oficial por símbolo — pacotes dos sets seguintes

Taxas oficiais por símbolo e posição em `src/content/source/pocket/rates.ts`, com cópia independente no validador (`tools/content-build/validate.ts`, `TIER_PACK_RULES`), que recusa qualquer divergência.

- **Unidade:** milésimos de ponto percentual; cada posição soma **100000** (= 100,000%). Exemplo: 2572 = 2,572%.
- **Uniforme dentro do símbolo:** sorteado o símbolo, cada impressão do pool daquele símbolo tem a mesma chance.
- **Arredondamento:** duas tabelas oficiais somam 99,999%; o 0,001 que falta vai para o símbolo de maior chance — ◊◊◊ da 3ª posição do Deluxe e ◊◊◊ dos bebês.

1ª a 3ª posição: ◊ 100,000% nas tabelas Clássica e Brilhante. 4ª e 5ª:

| Símbolo | Clássica (A1a, A2, A2a) — 4ª | Clássica — 5ª | Brilhante (A3, A3a, A3b, A4, A4a) — 4ª | Brilhante — 5ª |
|---|---:|---:|---:|---:|
| ◊◊ | 90,000% | 60,000% | 89,000% | 56,000% |
| ◊◊◊ | 5,000% | 20,000% | 4,953% | 19,810% |
| ◊◊◊◊ | 1,666% | 6,664% | 1,666% | 6,664% |
| ☆ | 2,572% | 10,288% | 2,572% | 10,288% |
| ☆☆ | 0,500% | 2,000% | 0,500% | 2,000% |
| ☆☆☆ | 0,222% | 0,888% | 0,222% | 0,888% |
| ✵ | — | — | 0,714% | 2,857% |
| ✵✵ | — | — | 0,333% | 1,333% |
| ♛ | 0,040% | 0,160% | 0,040% | 0,160% |

Deluxe (A4b), quatro cartas:

| Posição | Taxas |
|---|---|
| 1ª | ◊ 100,000% |
| 2ª | ◊◊ 82,270% · ◊ 17,730% |
| 3ª | ◊◊◊ 40,660% · ◊ 23,021% · ◊◊ 17,985% · ☆ 12,858% · ☆☆ 2,500% · ✵✵ 1,667% · ☆☆☆ 1,111% · ♛ 0,198% |
| 4ª | ◊◊◊◊ 100,000% |

- **6ª carta (A4 e A4a):** 8,330% dos pacotes normais trazem uma sexta carta, sempre a última, de um pool próprio de bebês: ◊◊◊ 87,100% (três impressões, 29,033% cada) e ☆ 12,900% (uma). Os bebês não saem nas posições 1–5.
- **Pacote raro:** 0,050% dos pacotes dos sets seguintes (os do A1 e os promocionais não têm). Todas as cartas do pacote raro são sorteadas de forma uniforme entre as impressões ☆, ☆☆, ☆☆☆, ✵, ✵✵ e ♛ do pool; pacote raro não tem 6ª carta.
- **Promo (inventada):** os pacotes Promo-A e Promo-B têm cinco cartas `PROMO`, uniformes em todas as posições (100,000% PROMO), sem pacote raro nem 6ª carta. O Pocket não vende pacotes promocionais; essa taxa é do projeto e deve ser apresentada assim.
- **Estimativas registradas:** a chance da 6ª carta do A4a repete a do A4; no Deluxe Pack ex, impressões que a fonte agrupa em par recebem a mesma taxa por carta (cada ✵✵ tem 0,8335% na 3ª posição).

**Ordem do sorteio** (`economyRng`, função pura em `src/domain/economy/packs.ts`; mesma semente, mesmo resultado):

1. **Pacote raro:** um inteiro uniforme em [0, 100000); abaixo de 50, o pacote é raro e cada uma das N cartas é uma impressão uniforme da união ☆…♛ do pool — o sorteio termina aqui.
2. **Posições 1…N, em ordem:** primeiro o símbolo, pelos pesos da posição; depois uma impressão uniforme do pool daquele símbolo.
3. **6ª carta** (só A4/A4a, só em pacote normal): um inteiro uniforme em [0, 100000); abaixo de 8330, sorteia símbolo e impressão do pool dos bebês e acrescenta a carta no fim.

O pacote promocional, sem pacote raro, começa no passo 2. O recibo guarda as cartas na ordem do sorteio, o símbolo de cada uma, se o pacote foi raro e se veio a 6ª carta.

**Exibição:** S05 mostra o modelo oficial como símbolo × posições (1ª–3ª | 4ª | 5ª | 6ª) com **três casas decimais** no formato pt-BR (“2,572%”), as linhas do pacote raro e da 6ª carta e, em cada carta, as cópias esperadas por pacote = pacote normal × (1 − 0,050%) + pacote raro + 6ª carta ([interface §8.4](interface-16x9.md#interface-08)). O catálogo gerado usa o mesmo formato.

Repetidas são permitidas, inclusive dentro de um pacote. Não há garantia oculta depois de N aberturas. A qualidade visual da animação não interfere no sorteio.

A definição de cada produto deve trazer todos os pools e pesos concretos. Categoria ou símbolo de chance positiva sem cartas elegíveis torna o produto inválido no build (C-031); não redistribuir probabilidades silenciosamente.

## 16.3. Acabamentos

Uma impressão com holo, foil, cromado, brilhante ou arte alternativa pode ter raridade e peso próprios. O formato visual não cria poderes extras. Um único exemplar não recebe um segundo sorteio de gameplay porque saiu cromado.

Brilhante é a marca `variant.shiny` sobre o acabamento, sem mudar schema: ✵ = ULTRA holográfica brilhante, ✵✵ = ULTRA foil brilhante. São 100 impressões no conteúdo 3.0.0 (A3, A3a, A3b, A4, A4a e duas ✵✵ no A4b); na face 3D o símbolo usa o glifo de estrela cintilante. As ☆☆☆ usam a cena imersiva genérica `a1-immersive` enquanto não houver cena própria. Todas as impressões, de qualquer acabamento, usam a imagem da carta impressa em “Impressão completa” (`artKey` `art:<set>:NNN`, arquivos em `src/presentation/assets/cards/<set>/`).

## 16.4. Pacote tutorial

ID `pack-tutorial-v1`, exatamente uma unidade inicial. Conteúdo fixo: **cinco cartas ◊ diferentes do Genetic Apex que não fazem parte da coleção inicial** (Pikachu, Meowth, Abra, Pidgey e Rattata), uma cópia de cada, impressões normais; a lista é publicada com o conteúdo 2.0.0 em `catalogo-conteudo.md`.

**[DP] 3.2.0:** a proposta anterior (Kit de Reparo, Rastreador, Troca Tática, Estudioso e Talismã) entregava a terceira cópia de Treinadores já possuídos em duas cópias, inútil com o limite de duas por nome. O pacote agora amplia as opções de deck desde o prólogo.

A interface informa “Conteúdo guiado”. Esse pacote não usa a tabela aleatória acima.

## 16.5. Garantia de acesso útil

O jogo nunca exige obter uma carta aleatória específica para abrir o próximo capítulo. Cada ferramenta essencial possui pelo menos uma origem dirigida anterior ao encontro relevante: estoque do Empório, empréstimo de deck ou prêmio de nó anterior.

O botão “Como obter” distingue origem já desbloqueada, origem futura e deck de apoio. Não enviar o jogador para uma página externa.

## 16.6. Comprometimento

Na abertura, saldo de pacotes, resultado, quantidades, cursor de RNG e recibo mudam juntos. A cena 3D só começa a revelar depois de confirmar a gravação.

Na escolha de prêmio, persistir as opções antes de exibir. Recarregar não muda as opções nem duplica o crédito.

---

<a id="campanha-17"></a>

## 🌟 17. Descobertas e Empório

## 17.1. Descoberta

Cada E04 é um pequeno acervo do Líder anfitrião do capítulo. Mostra três cartas **viradas para cima** e permite escolher uma, sem custo. Não simula pacote aberto por outro jogador nem informa presença online.

As três opções são IDs de impressões fixadas na definição do nó, consultáveis antes de confirmar. A escolha é única por perfil/nó, independente da dificuldade.

A operação `CLAIM_DISCOVERY` registra `nodeId`, `choiceId`, impressão recebida e recibo, com chave `discovery:{campaignId}:{nodeId}`. Cancelar antes de confirmar é livre. Depois do commit, só é possível rever o resultado, não escolher de novo.

As opções não escolhidas ficam disponíveis no Empório **permanentemente** a partir da confirmação, como cartas dirigidas; itens do Empório não expiram. Nenhuma escolha destrói uma estratégia ou exige criar novo perfil para obter a alternativa.

## 17.2. Empório

É uma loja funcional com moeda do próprio jogo. Não usar texto “compra demonstrativa” ou pedir dados de pagamento. O saldo é real dentro daquele save, não saldo monetário.

Categorias: cartas dirigidas, pacotes e cosméticos. Os produtos já adquiridos permanentemente, como um tapete, não podem ser comprados novamente por acidente.

A vitrine pode conter uma carta 3D selecionada e prévia de mesa/cosmético. A listagem, preço, saldo e confirmação ficam em HTML.

## 17.3. Ausência de estoque temporário

Não existem rodízio por dia, limite baseado no relógio, taxa de troca entre jogadores ou preço que exige consulta externa. Qualquer atualização do catálogo chega com uma nova versão local do pacote e respeita saves existentes.

---

<a id="campanha-18"></a>

## 🏟️ 18. Arena, revisitas e pós-jogo

## 18.1. Arena

Após C01-E06, a Arena libera duelos contra NPCs já vencidos, nas dificuldades permitidas. O jogador escolhe oponente; “Aleatório” sorteia somente entre opções desbloqueadas.

Reutiliza o perfil de recompensa repetível do confronto de origem. Não concede uma segunda primeira-vitória, medalha ou objetivo exclusivo de uma versão diferente sem regra explícita.

Objetivos de domínio de um nó podem ser concluídos ao escolher “Revisitar nó” no mapa. Para evitar ambiguidade, a Arena genérica não conclui objetivos específicos da campanha; só concede Créditos repetíveis e estatísticas próprias.

## 18.2. Treino

Treino livre oferece oponentes e simulações sem alterar objetivos ou saldos. Testar um deck não deve ser uma fonte invisível de farm.

Opções de ver mãos ou forçar Energia pertencem ao laboratório isolado. Uma partida iniciada com qualquer auxílio de debug recebe `progressionEligible=false`.

## 18.3. Pós-jogo

Vencer F00-D03 preserva tudo e permite continuar:

```text
Dominar objetivos opcionais
Rejogar chefes em Especialista
Completar coleção por aquisição dirigida e pacotes
Organizar fichários e troféus
Experimentar outros decks
Consultar replays
```

Não reiniciar a campanha automaticamente. Novo perfil é uma ação explícita, separada de “Continuar”.

## 18.4. Estatísticas

Guardar vitórias/derrotas por modo, melhor dificuldade por nó, objetivos concluídos, turnos da melhor vitória e tempo ativo aproximado. Tempo em pausa ou com aba oculta não conta como tempo ativo de batalha.

Nenhuma estatística precisa de telemetria. O botão de diagnóstico gera arquivo local, não envia dados.

---


<a id="campanha-autoral"></a>

### 🛠️ Campanha personalizada com cartas autorais

A campanha padrão (`circuito-dos-arquivos-v1`) mantém sua progressão STANDARD. O Estúdio pode gerar cartas para perfis CUSTOM, com indicador “Campanha personalizada”. É permitido iniciar do zero ou clonar um perfil padrão mediante confirmação; a cópia não devolve saldos/prêmios ao original.

Em CUSTOM, o usuário pode adicionar cópias publicadas por concessão local explícita e montar decks com elas. Os encontros usam o mesmo motor, mas a dificuldade/recompensa não representa uma auditoria de balanceamento da campanha padrão.

LAB permite testar rascunhos e fixtures sem progresso. Uma publicação não é vitória, descoberta ou abertura de pacote. Cartas autorais não entram nas tabelas dos pacotes (Genetic Apex, sets seguintes ou promocionais) sem uma alteração de conteúdo versionada.

Resultado, escolha de prêmio e desbloqueio são transações SQLite. A campanha não lê o estado de um mesh ou slider do Estúdio para determinar força/posse de carta. Replays e tentativas preservam as versões utilizadas, mesmo quando o criador publica uma revisão nova.

A estrutura de 45 nós, os 4.010 Créditos da rota principal e os nove playmats não são alterados por esta revisão documental.

---

<a id="campanha-19"></a>

## 💾 19. Tentativas, pausa e recuperação

## 19.1. Tentativa

Uma tentativa possui `attemptId`, nó, dificuldade, snapshot de deck, versão de conteúdo, `matchId`, estado, RNG, objetivos em avaliação e vínculo ao perfil.

```text
RUNNING ↔ SUSPENDED
RUNNING → FINISHED                 resultado terminal da partida
RUNNING ou SUSPENDED → ABANDONED   abandono explícito
```

Somente esses quatro status são persistidos. A tentativa nasce `RUNNING`; a preparação (`SETUP`) e as demais fases da partida ([gameplay §8.2](gameplay.md#gameplay-08)) ficam registradas no estado de batalha da tentativa, não como status.

Há uma tentativa de duelo ativa por perfil. Retomar não cria uma segunda. Para iniciar outro duelo, o jogador precisa concluir ou abandonar explicitamente o atual.

## 19.2. Pausar

Menu de pausa, perda de foco prevista pelo produto ou ocultação da aba interrompem a IA e a aceitação de ações de combate. A unidade atômica já aceita termina em um estado seguro antes de a pausa ficar efetiva.

Não existe derrota por desconexão: nenhum serviço remoto participa. Ao fechar o navegador, a retomada usa o último checkpoint confirmado.

## 19.3. Retomar versus reiniciar

| Ação | Resultado |
|---|---|
| Retomar | Mesma mão, campo, RNG, escolhas pendentes e snapshot de deck. |
| Reiniciar duelo normal | Abandona tentativa atual e cria outra; nova semente de tentativa. |
| Reiniciar puzzle | Nova tentativa da mesma fixture e sequência preparada. |
| Editar deck com duelo suspenso | Altera apenas deck salvo para tentativas futuras. |
| Restaurar backup anterior | Substitui o perfil selecionado depois de confirmação; não mescla saldos. |

Dano, HP e moedas já resolvidos não podem mudar porque uma animação foi interrompida. A tela de conclusão pode ser reconstruída do recibo sem executar o confronto novamente.

## 19.4. Integridade local, não anti-cheat

Evitar corrupção e duplicação involuntária faz parte do produto. Impedir o proprietário do computador de inspecionar ou editar seus próprios dados não é uma garantia possível desta arquitetura.

Checksum do save identifica alterações ou corrupção acidentais; não é uma assinatura inviolável de competitividade.

---

<a id="campanha-20"></a>

## 🗃️ 20. Esquemas de conteúdo e validação

## 20.1. Encontro

Exemplo de estrutura, não um pacote de dados executável completo:

```json
{
  "nodeId": "C02-E06",
  "campaignId": "circuito-dos-arquivos-v1",
  "chapterId": "C02",
  "contentVersion": "1.0.0",
  "kind": "BOSS",
  "title": "Wallace, Líder de Sootopolis",
  "prerequisites": {
    "allOf": ["C02-E03"]
  },
  "npcId": "mara",
  "arenaId": "arena-harbor",
  "mapSceneId": "campaign-harbor",
  "rulesetId": "local-campaign-v2",
  "entryCost": null,
  "difficultyProfiles": {
    "STORY": {
      "aiProfileId": "mara-story-v1",
      "npcDeckId": "npc-c02-e06-story-v1"
    },
    "STANDARD": {
      "aiProfileId": "mara-standard-v1",
      "npcDeckId": "npc-c02-e06-standard-v1"
    },
    "EXPERT": {
      "aiProfileId": "mara-expert-v1",
      "npcDeckId": "npc-c02-e06-expert-v1"
    }
  },
  "completionObjectiveId": "C02-E06-WIN",
  "optionalObjectiveIds": [
    "C02-E06-TACTIC",
    "C02-E06-DECK"
  ],
  "firstClearRewardTableId": "chapter-boss-c02-v1",
  "repeatRewardTableId": "boss-repeat-v1"
}
```

`npcId` `mara` é o Wallace: os ids de NPC e de perfil de IA são estáveis (§1.4). Cada referência precisa existir nos dados do build. Um ID listado numa spec não significa que o arquivo de deck, a arte ou a arena correspondente já foi criado.

## 20.2. Objetivo

```json
{
  "objectiveId": "C02-E06-TACTIC",
  "scope": "SINGLE_ATTEMPT",
  "requiresVictory": true,
  "predicate": {
    "type": "DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST",
    "count": 2,
    "controller": "HUMAN",
    "minimumDamage": 1
  },
  "reward": {
    "credits": 40
  },
  "claimPolicy": "AUTOMATIC_ON_RESULT",
  "grantKey": "objective:circuito-dos-arquivos-v1:C02-E06-TACTIC"
}
```

## 20.3. Progresso

```json
{
  "nodeId": "C02-E06",
  "firstClearAttemptId": "attempt-028",
  "clearedDifficulties": ["STORY", "STANDARD"],
  "completedObjectiveIds": [
    "C02-E06-WIN",
    "C02-E06-DECK"
  ],
  "rewardReceiptIds": [
    "receipt-120",
    "receipt-121"
  ],
  "bestHumanTurnCount": 8,
  "activeAttemptId": null
}
```

## 20.4. Estado visível

`LOCKED`, `AVAILABLE`, `CLEARED` e `MASTERED` são derivados de pré-requisitos e histórico. `IN_PROGRESS` é um marcador de tentativa sobre esse progresso. Não substituir um nó já dominado por “nunca concluído” quando for revisitado.

## 20.5. Validações de build

Verificar grafo sem ciclos, 45 IDs únicos, 39 conteúdos de batalha/puzzle, seis Descobertas, decks legais, objetivos suportados, tabelas de sorteio válidas, caminhos locais de assets, traduções e recompensas idempotentes.

A validação deve falhar quando uma carta não possui implementação de efeito. Não fazer a IA “aproximar” o texto durante o duelo.

Regras acrescentadas no conteúdo 3.0.0 (`tools/content-build/validate.ts`):

- **Pacotes por símbolo** (`TIER_PACK_RULES`, `tierPackErrors`): tabela exata da §16.2 por pacote, número de cartas (4 no Deluxe, 5 nos demais), 100 Créditos desde o início, soma 100000 por posição, pool coerente com o símbolo de cada impressão e de um único set, nenhuma impressão repetida entre os pools, `PROMO` só nos pacotes promocionais, 6ª carta só no A4/A4a (8330 com ◊◊◊ 87100 e ☆ 12900), pacote raro 50/100000 com ☆…♛ em todo pacote de set. Pacote aleatório fora das regras do A1 e de `TIER_PACK_RULES` é erro.
- **Origem de toda impressão:** cada impressão vem da coleção inicial, de um pool de pacote (inclusive o da 6ª carta), de pacote fixo, de carta dirigida ou de carta-chave; impressão sem origem falha o build.
- **Cartas dirigidas:** fora do A1, à venda desde o início; no A1, as travas da §15.2.
- **Identidade:** várias definições podem compartilhar uma `deckLimitKey` (mesmo nome, regras diferentes, §20.6); evolução cujo estágio anterior não existe em nenhum set só é aceita para as seis promos de `ORPHAN_EVOLUTIONS`.
- **Decks iniciais:** 4 Pokémon × 2 + 6 Treinadores × 2; inventário inicial = impressões iniciais × 2.
- **Arte:** o arquivo de cada `artKey` existe com a caixa exata do nome (`cards/<set>/<SET>-NNN.webp`).

Regra acrescentada no conteúdo 3.1.0:

- **Retrato do NPC** (`portraitErrors`): todo NPC tem `portraitAssetKey` no formato `portrait:<arquivo>`, e o PNG existe em `src/presentation/assets/portraits/` (a pasta é a própria origem, sem importador). Chave ausente (`null`), malformada ou sem arquivo falha o build (`src/content/validation.test.ts`, “rival sem retrato empacotado”). O schema `npc.schema.json` continua aceitando `null`; a exigência é do validador do conteúdo `base`.

## 20.6. Identidade das cartas entre sets

**Mesmas regras de jogo ⇒ mesma definição.** A chave de jogo de uma linha do set (nome, categoria, subtipo, tipo, PS, evolui de, Fraqueza, Recuo, Habilidades, ataques e efeito) decide a definição. A reimpressão em outro set, inclusive arte alternativa e promo, aponta para a definição existente: A4b Pikachu ex → `pikachu-ex`; A4b Pesquisa do Professor → `pesquisa-do-professor`. O A1 e as seis promos antigas são a semente e não mudam (golden test, C-059).

**Regras diferentes com o mesmo nome ⇒ definição nova** com id `<chave>-<set>-<NNN>` da primeira impressão (`blitzle-a3a-016`, `shellder-a3-042`). Os ids são calculados sobre todas as linhas na ordem canônica dos sets — A1, P-A, A1a, A2, A2a, A3, A3a, A3b, A4, A4a, A4b, P-B —; a primeira definição de cada nome fica com o id simples. Set novo entra sempre no fim da ordem, para não mudar ids existentes. A `deckLimitKey` continua a do nome: o limite de duas cópias vale para todas as versões juntas.

**Impressões:** id `<set>-<NNN>-<deckLimitKey>` (`a3a-016-blitzle`, `a4-067-mareep`). Seis promos do P-A/P-B cujo estágio anterior não saiu em nenhum set — Pawmot, Cinderace, Haxorus, Noivern, Mega Sceptile ex e Meowstic — entram na coleção e no pacote promocional, mas ainda não evoluem: são só colecionáveis (`ORPHAN_EVOLUTIONS` em `src/content/source/pocket/cards.ts`).

Nomes de ataques, Habilidades e Treinadores de todos os sets estão em PT-BR; formas regionais e especiais usam o nome oficial em PT-BR (Raichu de Alola, Dialga Forma Origem). Todos os efeitos estão no effects-dsl ([efeitos-dsl.md](efeitos-dsl.md)), e o texto de regras é gerado dele; a face mostra só a imagem impressa, em inglês.

---

<a id="campanha-21"></a>

## 🧱 21. Conteúdo Three.js por etapa

## 21.1. Escopo tridimensional obrigatório

| Etapa | Elemento tridimensional | Informação que permanece em HTML |
|---|---|---|
| Escola de Treinadores (prólogo) | Mesa, carta inicial, moeda e pedestal de deck. | Passo da lição, regras e ações. |
| Mapa geral | Seis dioramas de capítulo e arena final. | Nome, progresso, pré-requisito e lista equivalente. |
| Mapa de capítulo | Nós com profundidade e conexões visuais. | Objetivos, dificuldade e recompensas. |
| Briefing | Miniatura da arena e carta-chave em pedestal. | Composição autorizada do oponente, texto e botão iniciar. |
| Batalha | Mesa, cartas com espessura, Energia, moeda e pilhas. | HP, custos, turnos, decisões e histórico. |
| Descoberta | Três cartas face-up, seleção elevada. | Nome, tipo, regras, confirmar escolha. |
| Empório | Carta/pack/cosmético selecionado. | Preço, saldo, filtro e compra. |
| Vitória | Cartas de prêmio e troféu do capítulo. | Recibo, objetivos e próximo passo. |
| Galeria | Fichários, pedestais e troféus. | Índice, nomes, edição e voltar. |

## 21.2. Três limites de produção

Não é obrigatório modelar cada criatura como personagem 3D. A própria carta precisa ser um objeto tridimensional e o cenário precisa ter profundidade real. Uma projeção de criatura pode ser extensão futura, sem condicionar o combate.

Não criar um mundo aberto navegável para ligar seis arenas. O mapa com dioramas é suficiente e permite manter o escopo viável.

Não renderizar todas as miniaturas de coleção em contextos WebGL independentes. Usar miniaturas locais e um palco compartilhado para a seleção.

## 21.3. Áudio, falas e assets

Todos os textos de diálogo ficam no pacote. Falas podem ser texto sem dublagem. Não exigir serviço de voz ou geração de imagem durante o jogo.

Assets indisponíveis usam substitutos locais funcionais. O relatório de build deve identificar placeholders; não apresentar arte provisória como conteúdo final autorizado.


<a id="campanha-cosmeticos"></a>

## 21.4. Catálogo inicial de nove playmats

IDs e artes descritos são autorais para este projeto; desde o conteúdo 3.1.0 os nomes seguem a jornada de Ginásios (§1.4), com IDs, texturas, preços e requisitos inalterados. Esta tabela define conteúdo a produzir; não inclui imagens prontas nem corresponde a acessórios oficiais do Pocket.

| ID | Nome | Linguagem visual | Aquisição |
|---|---|---|---|
| `mat-neutral` | Mesa Neutra | Gradiente azul-claro/lavanda, linhas brancas e superfície de baixo contraste. | Gratuito no perfil; fallback universal. |
| `mat-academy` | Escola de Treinadores | Branco perolado, azul-claro e lavanda; marca geométrica central discreta. | Gratuito no perfil; apresentado no prólogo. |
| `mat-c01-grove` | Ginásio de Celadon | Menta e verde-claro, folhas ilustradas na periferia, centro calmo. | Empório, 500 Créditos, após C01-E06. |
| `mat-c02-harbor` | Ginásio de Sootopolis | Azul-céu, turquesa e areia clara, ondas ilustradas nas bordas. | Empório, 500 Créditos, após C02-E06. |
| `mat-c03-circuits` | Ginásio de Vermilion | Branco azulado e amarelo pastel, trilhas ciano periféricas e pulsos discretos. | Empório, 500 Créditos, após C03-E06. |
| `mat-c04-observatory` | Ginásio de Saffron | Lavanda, azul-pálido e prata clara, arcos e estrelas espaçadas. | Empório, 500 Créditos, após C04-E06. |
| `mat-c05-foundry` | Ginásio de Stow-on-Side | Prata clara e pêssego, acabamento mate limpo e marcas suaves. | Empório, 500 Créditos, após C05-E06. |
| `mat-c06-archive` | Ginásio de Viridian | Azul-claro e marfim, páginas e selos delicados, pequenos detalhes amarelos. | Empório, 500 Créditos, após C06-E06. |
| `mat-circuit-complete` | Troféu do Torneio de Kanto | Branco, ciano e lavanda; símbolos dos seis capítulos no perímetro e medalhão amarelo. | Concessão única ao vencer F00-D03. |

Vencer o chefe **desbloqueia a compra** do tapete de capítulo; não concede esse tapete automaticamente. A única concessão final extra desta revisão é `mat-circuit-complete`, além dos dois iniciais gratuitos. A tabela econômica da seção 15 continua valendo.

Texturas e materiais possuem variante Calma disponível sem nova compra. O modo Neutro é sempre permitido, inclusive contra chefes. Luz intensa, movimento e brilho são ajustáveis por conforto, não recompensas que obriguem efeitos visuais.

## 21.5. Arena, playmat do NPC e identidade do encontro

`arenaId` escolhe uma variação do campo abstrato, não uma sala 3D. Todas preservam base branca, lado humano ciano, lado NPC coral, câmera e slots.

| Faixa de conteúdo | `arenaId` | Preset de playmat do NPC | Motivo secundário permitido |
|---|---|---|---|
| P00-T01 a P00-T06 | `arena-academy` | `mat-academy` | Linhas de estudo azul-pálido no perímetro. |
| C01 | `arena-grove` | `mat-c01-grove` | Pequenas folhas gráficas em menta. |
| C02 | `arena-harbor` | `mat-c02-harbor` | Ondas ilustradas claras, sem cenário de porto real. |
| C03 | `arena-circuits` | `mat-c03-circuits` | Traços ciano/amarelo de baixa intensidade. |
| C04 | `arena-observatory` | `mat-c04-observatory` | Arcos lilás e estrelas pequenas. |
| C05 | `arena-foundry` | `mat-c05-foundry` | Símbolos em prata/pêssego no perímetro. |
| C06 | `arena-archive` | `mat-c06-archive` | Páginas gráficas azul-claro. |
| F00-D01 a F00-D03 | `arena-final` | `mat-circuit-complete` | Símbolos dos capítulos e pequeno detalhe amarelo. |

O identificador canônico do porto é `arena-harbor`. Motivos são textura, decalque controlado ou detalhe raso fora da superfície interativa; não objetos realistas volumétricos. Não usar a miniatura do mapa como cenário atrás da mesa.

O NPC pode usar seu tapete antes de o humano desbloqueá-lo. Isso não concede posse ao jogador. Cada encontro resolve `npcCosmeticPresetId` pelo catálogo; não sorteia acessórios a cada frame.

A base da arena permanece igual nos dois turnos. Apenas o material do playmat muda em `TURN_OWNER`, conforme política do projeto; preferência Neutro continua disponível contra qualquer NPC.

## 21.6. Flairs, versos e moedas

O pacote de conteúdo deve incluir um flair básico neutro, um verso neutro e uma moeda neutra gratuitos, suficientes para a fatia vertical. O brilho padrão de uma impressão não exige entitlement separado.

Flairs adicionais de capítulo podem ser concedidos por medalhas já previstas, com chave `cosmetic:{milestoneId}:{cosmeticId}`; o perfil é coluna da concessão, não parte da chave. Não vincular sua obtenção à destruição de cartas ou a sorte obrigatória de pacote. Novos cosméticos pagos precisam de produto/preço explícito; não presumir cobrança por clicar em “Experimentar”.

Versos e moedas temáticos mantêm os preços existentes de 200 e 300 Créditos. Um efeito de ataque é escolhido pelo perfil visual do ataque e por acessibilidade, não comprado como aumento de dano.

**Moedas do Pokémon TCG Pocket (conteúdo 3.2.0, decisão do autor de 16/10/2026):** as 84 moedas da página de moedas do Serebii (o Bulbagarden recusa acesso automatizado) entram como cosméticos `COIN` **gratuitos**, `coin-pocket-<stem>`, com `assetKey` `coin-art:<stem>` e nome em PT-BR (“Moeda Poké Bola”, “Moeda Charizard Brilhante”, “Moeda Equipe Rocket”), em ordem alfabética depois da Neutra e das seis temáticas. A imagem é a cara; a coroa é derivada dela em prata. Paleta e acento (cor média e da borda da face) servem ao desenho de reserva. O validador exige as duas faces empacotadas.
- O preset padrão do jogador (`preset-player-default`) passa a usar a **Poké Bola**; os rivais, uma moeda do Pocket ligada ao Ginásio: Prólogo, Poké Bola; C01, Erika (alternativa); C02, Blastoise; C03, Pikachu; C04, Mewtwo; C05, Lucario; C06, Charizard; final, Chefe da Equipe Rocket.
- A moeda do deck é a que ele lança no cara ou coroa de quem começa e em todo efeito com moeda dos seus Pokémon ([gameplay-pocket §3, §10.6](gameplay-pocket.md#pocket-3)). Moedas continuam sem efeito em regra, resultado ou probabilidade.
- Presets já salvos com a Moeda Neutra continuam com ela até o jogador trocar na oficina.

**Sleeves do Pokémon TCG Pocket (conteúdo 3.4.0, decisão do autor de 17/10/2026):** os 78 sleeves da página de sleeves do Serebii entram como cosméticos `SLEEVE` **gratuitos**, `sleeve-pocket-<stem>`, com `assetKey` `sleeve-art:<stem>` e nome em PT-BR (“Verso Pikachu”, “Verso Chefe da Equipe Rocket”, “Verso Erika e Vileplume”), depois do Verso Neutro e dos seis temáticos. A imagem é o verso inteiro das cartas do deck que o equipa; o validador exige o arquivo empacotado.
- O jogador começa com o **Verso Neutro** (a arte padrão do verso) e troca na aparência do deck (aba Verso).
- Os rivais usam um sleeve do Pocket ligado ao encontro, como as moedas: Prólogo, Professor Carvalho; C01, Erika e Vileplume; C02, Blastoise; C03, Pikachu; C04, Mewtwo; C05, Lucario; C06, Charizard; final, Chefe da Equipe Rocket.
- Versos não mudam regra nem identificam cartas: o mesmo verso vale para as 20 cartas do deck.

## 21.7. Recompensa final e save

Na vitória sobre F00-D03, a transação de resultado grava de forma atômica resultado, progresso, prêmio normal e o entitlement `mat-circuit-complete`. Mostrar o tapete no resumo depois de confirmado; sair da tela não perde o item.

Não há migração de perfis anteriores nesta linha: nenhuma implementação ou save anterior existe. Chefes concluídos liberam seus produtos, mas não entregam gratuitamente os seis tapetes pagos.

Prévia de um item bloqueado não concede posse. Um template local customizado usa a superfície neutra como base, não burla a condição de posse de um cosmético premium do próprio jogo.

## 21.8. Produção visual por prioridade

Primeira fatia: superfícies Neutra e Escola de Treinadores, um verso, uma moeda, flair básico, coreografia completa do duelo, pacote e workshop simples.

Capítulos: produzir os temas na ordem C01→C06, com materiais, áudio e decoração periférica correspondentes. Final: tema Troféu do Torneio de Kanto (`mat-circuit-complete`) e concessão verificada.

Todos os temas passam pelas mesmas fixtures com oito slots ocupados, dez cartas na mão, nomes longos, múltiplas Energias e condições. Um cenário bonito vazio não é evidência suficiente de legibilidade em batalha.

## 21.9. Revisão visual sem reiniciar a campanha

Os nove IDs de playmat, os preços, os requisitos e os entitlements são preservados. A revisão ilustrada clara recebe `definitionVersion: 2` e novos IDs/hash de assets; não sobrescrever o conteúdo imutável de uma tentativa antiga.

Os playmats nascem na versão 2; não há presets legados a migrar nesta linha. Uma revisão visual futura dá acesso à nova variante a quem já possui o tapete, sem pagar novamente; snapshots de duelos/replays permanecem associados às versões registradas.

Referência autoritativa: [direção visual](direcao-visual-pocket.md#visual-08). Os exemplos são especificações de assets a produzir, não uma declaração de que o pacote já inclui essas artes.

---

<a id="campanha-22"></a>

## ✅ 22. Testes de campanha

| ID | Caso | Critério |
|---|---|---|
| C-001 | Contagem | Há 45 nós: 39 de batalha/puzzle e 6 de Descoberta. |
| C-002 | Rota principal | 27 vitórias abrem o final sem exigir opcionais. |
| C-003 | Grafo | Todos os nós são alcançáveis; não há ciclo de pré-requisitos. |
| C-004 | Novo perfil | Concessão inicial ocorre uma vez. |
| C-005 | Inventário inicial | As 76 cartas iniciais permitem montar os oito decks de 20 ao mesmo tempo. |
| C-006 | Deck inicial | Cada lista tem quatro Básicos e no máximo duas cópias por nome. |
| C-007 | Escolha favorita | Não bloqueia os outros decks iniciais. |
| C-008 | Tutorial | Fixture guiada é identificada e usa motor real. |
| C-009 | T06 | Completar libera C01-E01. |
| C-010 | E02 | Não bloqueia E03 nem E06. |
| C-011 | E04 | Escolha não precisa de vitória e não bloqueia chefe. |
| C-012 | Elite | Ignorar E05 não bloqueia capítulo seguinte. |
| C-013 | Chefe | Primeira vitória concede uma medalha. |
| C-014 | Revisita | Não remove desbloqueios históricos. |
| C-015 | História | Concede o mesmo conteúdo essencial. |
| C-016 | Especialista | Não altera moedas nem HP secretamente. |
| C-017 | Deck de apoio | Uso não credita cartas ao inventário. |
| C-018 | Derrota | Não retira cartas ou cobra entrada. |
| C-019 | Empate | Não conclui objetivo que exige vitória. |
| C-020 | Objetivo extra | Não bloqueia entrada com deck legal. |
| C-021 | Composição | Usa snapshot de entrada. |
| C-022 | Turno limite | Conta turnos próprios quando esse é o contrato. |
| C-023 | Domínio | União de objetivos permite concluir em partidas distintas. |
| C-024 | Prêmio inicial | Não acumula com prêmio repetível da mesma vitória. |
| C-025 | Objetivo repetido | Não concede Créditos duas vezes. |
| C-026 | Descoberta | Recarregar preserva opções e escolha registrada. |
| C-027 | C06 recompensa | Escolha de ex pendente pode ser retomada. |
| C-028 | Empório | Nenhum produto usa dinheiro ou prazo real. |
| C-029 | Sem saldo | Decks gratuitos continuam utilizáveis. |
| C-030 | Pacotes Genetic Apex | Tabelas por posição somam 100%. |
| C-031 | Pool vazio | Produto com categoria positiva vazia falha no build. |
| C-032 | Pacote tutorial | Mostra conteúdo guiado e não tabela aleatória. |
| C-033 | Abertura interrompida | Mesmo recibo e cartas depois de retomar. |
| C-034 | Mudança de relógio | Não gera recursos ou altera desbloqueios. |
| C-035 | Arena | Só sorteia NPCs elegíveis e não concede primeiras vitórias. |
| C-036 | Treino | Não altera economia ou objetivos. |
| C-037 | Final | D03 perdido não invalida D01/D02. |
| C-038 | Conclusão | Não apaga perfil, coleção ou objetivos. |
| C-039 | Pausa | IA não aplica comandos durante suspensão. |
| C-040 | Reiniciar | Novo duelo normal tem nova tentativa; puzzle mantém fixture. |
| C-041 | Retomar | Preserva estado e fluxo de escolhas. |
| C-042 | Backup | Importar não mistura recompensas de dois históricos. |
| C-043 | Cena ausente | Placeholder local não inventa derrota. |
| C-044 | Mapa teclado | Lista equivalente alcança todos os nós disponíveis. |
| C-045 | Contexto 3D perdido | Pausa e retomada mantêm campanha. |
| C-046 | Primeiro uso offline | Novo capítulo abre sem buscar assets externos. |
| C-047 | Balanceamento | Deck de apoio vence cenários essenciais em testes registrados. |
| C-048 | Diagnóstico | Relatório local separa implementação e metas não aprovadas. |

Os testes acima são critérios a implementar. Esta entrega documental não executou os duelos, não mediu taxa de vitória e não demonstrou equilíbrio do catálogo. A revisão de conteúdo precisa registrar as sementes, decks, versão e amostra de partidas utilizada.


### 🧪 Critérios adicionais da revisão 2.1

| ID | Verificação | Critério |
|---|---|---|
| C-049 | Cosméticos iniciais | Perfil novo recebe Neutro/Escola de Treinadores (`mat-academy`) e acessórios básicos sem consumir Créditos. |
| C-050 | Seis produtos | Cada chefe C01–C06 libera apenas seu produto de playmat por 500 Créditos. |
| C-051 | Final | F00-D03 concede `mat-circuit-complete` (Troféu do Torneio de Kanto) uma vez, além do prêmio existente. |
| C-052 | NPC e posse | NPC pode exibir tema ainda bloqueado ao humano; visualização não concede o item. |
| C-053 | Versos e moedas | Preços anteriores permanecem; compra é permanente e não destrói cartas. |
| C-054 | Migração | N/A — sem perfis legados nesta linha; final concluído recebe entitlement ausente; não duplica prêmios nem concede os seis tapetes pagos. |
| C-055 | Cenário e regras | Arena/tema não mudam slots, HP, Energia, IA ou condições para completar objetivos. |
| C-056 | Economia principal | Os cosméticos adicionais não alteram o total monetário de 4.010 Créditos nem criam gate obrigatório. |

São critérios planejados de implementação, não resultados de execução de uma aplicação neste pacote.

### 🧪 Critérios adicionais do conteúdo 3.0.0

| ID | Verificação | Critério |
|---|---|---|
| C-057 | Catálogo 3.0.0 | 1.210 definições e 2.069 impressões (220 PROMO, 100 brilhantes), todas em Impressão completa com a imagem empacotada do próprio número. |
| C-058 | Identidade entre sets | Reimpressão com as mesmas regras aponta para a mesma definição; regras diferentes com o mesmo nome geram `<chave>-<set>-<NNN>` com a mesma `deckLimitKey`. |
| C-059 | Conteúdo legado | Definições, impressões, pacotes do A1, pacote tutorial e cartas dirigidas do A1 idênticos aos do conteúdo 2.2.0 (taxas do projeto inalteradas). |
| C-060 | Pacotes dos sets novos | Os 14 pacotes seguem a tabela oficial da §16.2 (soma 100000 por posição), custam 100 desde o início, não têm símbolo positivo vazio e só os promocionais têm PROMO. |
| C-061 | Ordem do sorteio | Pacote raro → posições → 6ª carta; mesma semente, mesmo resultado; a 6ª carta é sempre a última. |
| C-062 | Taxas observadas | 200 mil aberturas ficam a ±4σ das taxas da 5ª carta, da 6ª carta e do pacote raro. |
| C-063 | Deluxe Pack ex | Quatro cartas, a 4ª sempre ◊◊◊◊; chance por carta da 3ª posição conforme a tabela. |
| C-064 | Origem das impressões | Toda impressão tem origem (coleção inicial, pool, pacote fixo, carta dirigida ou carta-chave); sem origem, o build falha. |
| C-065 | Oito iniciais | Um deck inicial legal por tipo de Energia gerável, cada um com 4 Pokémon × 2 e os 6 Treinadores × 2. |
| C-066 | Iniciais sem objetivo extra | Nenhum dos oito decks iniciais cumpre um objetivo de composição (`-DECK`). |
| C-067 | Decks dos sets novos | Os iniciais novos, os oito modelos e as variações de capítulo jogam uma partida inteira contra NPC sem ação ilegal; há uma variação por capítulo com apoio. |
| C-068 | Receitas de deck | 22 do meta, 18 por tipo (2 por tipo de Energia) e 15 da comunidade; toda receita é deck jogável de 20 cartas, com evoluções completas, capa Pokémon na lista e era de um set do pacote; montar não concede cartas. |

Automatizados no conteúdo 3.0.0 (mapa em `src/tests/criteria-map.json`); C-067 prova jogabilidade, não a meta de vitória de C-047.

---

<a id="campanha-23"></a>

## 🚧 23. Marcos de conteúdo e aceite

| Marco | Conteúdo | Gate de qualidade |
|---|---|---|
| A — Combate e save | Duelo local completo, uma arena Three.js, retomada e os decks iniciais. | Partida válida e persistente sem rede. |
| B — Fatia vertical | Seis tutoriais + C01 completo: 12 nós, incluindo uma Descoberta. | Caminho de capítulo, objetivos, deck editor, pacotes e recibos funcionando. |
| C — Diversidade | C02 e C03 completos. | Mobilidade, Energia e IA distinta, sem regressão. |
| D — Efeitos | C04 e C05 completos. | Condições, modificadores e casos extremos testados. |
| E — Campanha completa | C06 e final; total de 45 nós. | Progressão auditada e acesso dirigido às peças essenciais. |
| F — Acabamento | Arena, domínio, galeria, áudio e visuais finais. | Performance medida, acessibilidade e pacote offline integral. |

Não preencher 45 botões com a mesma batalha e declarar campanha completa. Cada nó precisa de identidade, definição válida, objetivo, conexão de progressão e tratamento de recompensa.

Entregáveis de conteúdo: arquivos de encontros, decks, objetivos, diálogos, produtos, tabelas de prêmio, cenas, manifest de assets e fixtures de teste. Esses arquivos de produção serão implementados a partir desta spec; não estão incluídos nesta entrega de documentação.

**Diretriz:** a campanha dá sentido à coleção; a coleção oferece opções; o motor preserva as regras; Three.js comunica o espaço e a recompensa. Nenhuma dessas camadas pode exigir internet ou bloquear o jogador por sorte de pacote.

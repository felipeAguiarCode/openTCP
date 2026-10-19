# 📚 Catálogo de conteúdo — base 3.5.0

> **Versão da spec:** 3.2.0 · **Pacote:** `base` 3.5.0 · **Campanha:** `circuito-dos-arquivos-v1` · **Ruleset:** `local-campaign-v2`
> **contentHash (JCS/SHA-256):** `a0de4775b32bf1e8377c1c0d6e20daffbe378b71d1ad9c6d3486a8f1ba4f9d79`
> **Gerado por** `npm run content:build` a partir de `src/content/` — não editar à mão; alterações entram como nova versão do conteúdo.

Catálogo da jornada de Ginásios sobre os sets reais do Pokémon TCG Pocket — **Genetic Apex (A1)** até **Deluxe Pack ex (A4b)**, mais **Promo-A** e **Promo-B** — com nomes de ataques/Habilidades/Treinadores traduzidos e regras reescritas em effects-dsl. Dados de terceiros (The Pokémon Company): uso local; revisar antes de qualquer distribuição. Os pacotes do A1 usam as probabilidades do projeto; os dos outros sets, as taxas oficiais do Pocket (campanha §16.2). Toda impressão usa a imagem da carta impressa (`artMode: FULL_PRINTING`, `artKey` `art:<set>:NNN`, arquivos em `src/presentation/assets/cards/<set>/`): a face mostra só a imagem, em inglês, e as regras continuam vindo dos dados. As cartas de cada set ficam em `.specs/catalogo/cartas-<set>.md`.

## 📊 1. Resumo

| Item | Quantidade |
|---|---:|
| Definições de carta | 1210 |
| Impressões | 2069 |
| Impressões por raridade (C/I/R/U/P) | 586/444/226/593/220 |
| Decks (iniciais/apoio/NPC) | 8/26/82 |
| Receitas de deck (meta/por tipo/comunidade) | 22/18/15 |
| Produtos (pacotes/dirigidos/cosméticos) | 18/1849/18 |
| Nós / objetivos / tabelas de prêmio | 45 / 93 / 28 |
| NPCs / perfis de IA / diálogos | 26 / 78 / 194 |
| Fixtures (tutoriais + puzzles) | 12 |
| Cosméticos / presets | 192 / 9 |

## 🗂️ 2. Conjuntos

| Conjunto | Nome | Liberado após | Definições | Impressões | Comum | Incomum | Rara | Ultra | Promo |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| `a1` | Genetic Apex | início | 225 | 286 | 100 | 69 | 42 | 75 | 0 |
| `pa` | Promo-A | início | 113 | 117 | 0 | 0 | 0 | 0 | 117 |
| `a1a` | Mythical Island | início | 68 | 86 | 32 | 23 | 8 | 23 | 0 |
| `a2` | Space-Time Smackdown | início | 155 | 207 | 67 | 54 | 24 | 62 | 0 |
| `a2a` | Triumphant Light | início | 75 | 96 | 31 | 26 | 13 | 26 | 0 |
| `a3` | Celestial Guardians | início | 182 | 239 | 66 | 51 | 28 | 94 | 0 |
| `a3a` | Extradimensional Crisis | início | 83 | 103 | 32 | 24 | 8 | 39 | 0 |
| `a3b` | Eevee Grove | início | 83 | 107 | 32 | 23 | 8 | 44 | 0 |
| `a4` | Wisdom of Sea and Sky | início | 185 | 241 | 66 | 51 | 34 | 90 | 0 |
| `a4a` | Secluded Springs | início | 85 | 105 | 32 | 23 | 11 | 39 | 0 |
| `a4b` | Deluxe Pack ex | início | 215 | 379 | 128 | 100 | 50 | 101 | 0 |
| `pb` | Promo-B | início | 101 | 103 | 0 | 0 | 0 | 0 | 103 |

Fraqueza: +20, um tipo por carta, como impressa no set. Raridade exibida com os símbolos do Pocket: ◊ Comum · ◊◊ Incomum · ◊◊◊ Rara · ◊◊◊◊ Ultra (ex) · ☆/☆☆ Ultra de arte alternativa · ☆☆☆ imersiva · ✵/✵✵ brilhantes · ♛ coroa · PROMO.

## 🃏 3. Cartas

Uma tabela por conjunto, com todas as impressões, as regras em PT-BR e os pacotes em que cada uma sai.

| Conjunto | Arquivo |
|---|---|
| Genetic Apex (`a1`) | [catalogo/cartas-a1.md](catalogo/cartas-a1.md) |
| Promo-A (`pa`) | [catalogo/cartas-pa.md](catalogo/cartas-pa.md) |
| Mythical Island (`a1a`) | [catalogo/cartas-a1a.md](catalogo/cartas-a1a.md) |
| Space-Time Smackdown (`a2`) | [catalogo/cartas-a2.md](catalogo/cartas-a2.md) |
| Triumphant Light (`a2a`) | [catalogo/cartas-a2a.md](catalogo/cartas-a2a.md) |
| Celestial Guardians (`a3`) | [catalogo/cartas-a3.md](catalogo/cartas-a3.md) |
| Extradimensional Crisis (`a3a`) | [catalogo/cartas-a3a.md](catalogo/cartas-a3a.md) |
| Eevee Grove (`a3b`) | [catalogo/cartas-a3b.md](catalogo/cartas-a3b.md) |
| Wisdom of Sea and Sky (`a4`) | [catalogo/cartas-a4.md](catalogo/cartas-a4.md) |
| Secluded Springs (`a4a`) | [catalogo/cartas-a4a.md](catalogo/cartas-a4a.md) |
| Deluxe Pack ex (`a4b`) | [catalogo/cartas-a4b.md](catalogo/cartas-a4b.md) |
| Promo-B (`pb`) | [catalogo/cartas-pb.md](catalogo/cartas-pb.md) |

## ✨ 4. Acabamentos e PROMO

| Conjunto | Normal | Holográfica | Foil | Cromada | Imersiva (☆☆☆) | Brilhante (✵/✵✵) | PROMO |
|---|---:|---:|---:|---:|---:|---:|---:|
| `a1` | 226 | 24 | 33 | 3 | 4 | 0 | 0 |
| `pa` | 0 | 0 | 0 | 0 | 0 | 0 | 117 |
| `a1a` | 68 | 6 | 11 | 1 | 1 | 0 | 0 |
| `a2` | 155 | 24 | 26 | 2 | 2 | 0 | 0 |
| `a2a` | 75 | 6 | 14 | 1 | 1 | 0 | 0 |
| `a3` | 155 | 44 | 38 | 2 | 2 | 28 | 0 |
| `a3a` | 69 | 16 | 17 | 1 | 1 | 14 | 0 |
| `a3b` | 69 | 19 | 18 | 1 | 1 | 14 | 0 |
| `a4` | 161 | 44 | 34 | 2 | 2 | 28 | 0 |
| `a4a` | 71 | 16 | 17 | 1 | 1 | 14 | 0 |
| `a4b` | 353 | 6 | 19 | 1 | 1 | 2 | 0 |
| `pb` | 0 | 0 | 0 | 0 | 0 | 0 | 103 |

### 4.1. Pacote tutorial (`pack-tutorial-v1`)

Conteúdo guiado (não aleatório, não vendido): cinco cartas ◊ do Genetic Apex fora da coleção inicial, uma cópia de cada, impressões normais.

- Pikachu — `a1-094-pikachu`
- Meowth — `a1-196-meowth`
- Abra — `a1-115-abra`
- Pidgey — `a1-186-pidgey`
- Rattata — `a1-189-rattata`

## 📦 5. Produtos e pools

Pacotes do Genetic Apex: 5 cartas, 100 Créditos, tabela por categoria de campanha §16.2 (probabilidade de uma impressão numa posição = chance da categoria × peso ÷ soma dos pesos da categoria). Pacotes dos outros sets: taxas oficiais do Pocket por símbolo, uniformes dentro do símbolo, com 6ª carta (A4/A4a) e pacote raro; pacotes promocionais: 5 cartas PROMO uniformes. Repetidas são permitidas; PROMO só entra nos pacotes promocionais.

### 5.1. Genetic Apex — Pikachu (`pack-a1-pikachu`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Posição | Comum | Incomum | Rara | Ultra |
|---:|---:|---:|---:|---:|
| 1 | 100% | 0% | 0% | 0% |
| 2 | 100% | 0% | 0% | 0% |
| 3 | 100% | 0% | 0% | 0% |
| 4 | 30% | 70% | 0% | 0% |
| 5 | 0% | 70% | 25% | 5% |

| Impressão | Raridade | Peso | P(posição 1–3) cada | P(posição 4) | P(posição 5) | P(≥1 no pacote) |
|---|---|---:|---:|---:|---:|---:|
| Caterpie (`a1-005-caterpie`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Metapod (`a1-006-metapod`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Paras (`a1-014-paras`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Cottonee (`a1-027-cottonee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Petilil (`a1-029-petilil`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Growlithe (`a1-039-growlithe`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ponyta (`a1-042-ponyta`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Heatmor (`a1-048-heatmor`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Sizzlipede (`a1-051-sizzlipede`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Squirtle (`a1-053-squirtle`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Psyduck (`a1-057-psyduck`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Seel (`a1-064-seel`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Horsea (`a1-070-horsea`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Goldeen (`a1-072-goldeen`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Seaking (`a1-073-seaking`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Magikarp (`a1-077-magikarp`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Snom (`a1-092-snom`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pikachu (`a1-094-pikachu`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Magnemite (`a1-097-magnemite`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Voltorb (`a1-099-voltorb`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Electabuzz (`a1-101-electabuzz`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Blitzle (`a1-105-blitzle`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Helioptile (`a1-110-helioptile`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Heliolisk (`a1-111-heliolisk`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Clefairy (`a1-113-clefairy`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Slowpoke (`a1-118-slowpoke`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Drowzee (`a1-124-drowzee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Woobat (`a1-133-woobat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Swoobat (`a1-134-swoobat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Golett (`a1-135-golett`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Sandshrew (`a1-137-sandshrew`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Diglett (`a1-139-diglett`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Geodude (`a1-147-geodude`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Mienfoo (`a1-160-mienfoo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Clobbopus (`a1-162-clobbopus`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ekans (`a1-164-ekans`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Nidoran♀ (`a1-166-nidoran-f`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Nidoran♂ (`a1-169-nidoran-m`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pawniard (`a1-179-pawniard`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Rattata (`a1-189-rattata`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Raticate (`a1-190-raticate`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Jigglypuff (`a1-193-jigglypuff`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Wigglytuff (`a1-194-wigglytuff`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Farfetch'd (`a1-198-farfetch-d`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Doduo (`a1-199-doduo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Eevee (`a1-208-eevee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Minccino (`a1-212-minccino`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Wooloo (`a1-214-wooloo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Dubwool (`a1-215-dubwool`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Fóssil Hélix (`a1-216-fossil-helix`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Parasect (`a1-015-parasect`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Pinsir (`a1-026-pinsir`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Whimsicott (`a1-028-whimsicott`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Lilligant (`a1-030-lilligant`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Rapidash (`a1-043-rapidash`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Centiskorch (`a1-052-centiskorch`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Wartortle (`a1-054-wartortle`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golduck (`a1-058-golduck`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Dewgong (`a1-065-dewgong`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Seadra (`a1-071-seadra`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Omanyte (`a1-081-omanyte`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Bruxish (`a1-091-bruxish`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Frosmoth (`a1-093-frosmoth`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Electrode (`a1-100-electrode`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Zebstrika (`a1-106-zebstrika`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Pincurchin (`a1-112-pincurchin`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Clefable (`a1-114-clefable`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Slowbro (`a1-119-slowbro`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golurk (`a1-136-golurk`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Sandslash (`a1-138-sandslash`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Dugtrio (`a1-140-dugtrio`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Graveler (`a1-148-graveler`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Onix (`a1-150-onix`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Mienshao (`a1-161-mienshao`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Grapploct (`a1-163-grapploct`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Arbok (`a1-165-arbok`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Nidorina (`a1-167-nidorina`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Nidorino (`a1-170-nidorino`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Bisharp (`a1-180-bisharp`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Dodrio (`a1-200-dodrio`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Chansey (`a1-202-chansey`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Cinccino (`a1-213-cinccino`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Misty (`a1-220-misty`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Brock (`a1-224-brock`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Tenente Surge (`a1-226-tenente-surge`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Butterfree (`a1-007-butterfree`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Arcanine (`a1-040-arcanine`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Blastoise (`a1-055-blastoise`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Gyarados (`a1-078-gyarados`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Omastar (`a1-082-omastar`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Raichu (`a1-095-raichu`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Magneton (`a1-098-magneton`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Jolteon (`a1-102-jolteon`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Zapdos (`a1-103-zapdos`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Hypno (`a1-125-hypno`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Golem (`a1-149-golem`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Nidoqueen (`a1-168-nidoqueen`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Nidoking (`a1-171-nidoking`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Snorlax (`a1-211-snorlax`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Arcanine ex (`a1-041-arcanine-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Blastoise ex (`a1-056-blastoise-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Pikachu ex (`a1-096-pikachu-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Zapdos ex (`a1-104-zapdos-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Wigglytuff ex (`a1-195-wigglytuff-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Squirtle (Holográfica) (`a1-232-squirtle`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Gyarados (Holográfica) (`a1-233-gyarados`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Electrode (Holográfica) (`a1-235-electrode`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Diglett (Holográfica) (`a1-238-diglett`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Nidoqueen (Holográfica) (`a1-240-nidoqueen`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Nidoking (Holográfica) (`a1-241-nidoking`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Eevee (Holográfica) (`a1-248-eevee`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Snorlax (Holográfica) (`a1-250-snorlax`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Arcanine ex (Foil) (`a1-254-arcanine-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Blastoise ex (Foil) (`a1-256-blastoise-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Pikachu ex (Foil) (`a1-259-pikachu-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Zapdos ex (Foil) (`a1-260-zapdos-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Wigglytuff ex (Foil) (`a1-265-wigglytuff-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Misty (Foil) (`a1-267-misty`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Brock (Foil) (`a1-271-brock`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Tenente Surge (Foil) (`a1-273-tenente-surge`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Zapdos ex (Foil) (`a1-276-zapdos-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Wigglytuff ex (Foil) (`a1-279-wigglytuff-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Pikachu ex (Foil) (`a1-281-pikachu-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Mew (Foil) (`a1-283-mew`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Charizard ex (Cromada) (`a1-284-charizard-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Pikachu ex (Cromada) (`a1-285-pikachu-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Mewtwo ex (Cromada) (`a1-286-mewtwo-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |

### 5.2. Genetic Apex — Charizard (`pack-a1-charizard`)

Disponível: após C01-E01 · Preço: 100 Créditos · 5 cartas.

| Posição | Comum | Incomum | Rara | Ultra |
|---:|---:|---:|---:|---:|
| 1 | 100% | 0% | 0% | 0% |
| 2 | 100% | 0% | 0% | 0% |
| 3 | 100% | 0% | 0% | 0% |
| 4 | 30% | 70% | 0% | 0% |
| 5 | 0% | 70% | 25% | 5% |

| Impressão | Raridade | Peso | P(posição 1–3) cada | P(posição 4) | P(posição 5) | P(≥1 no pacote) |
|---|---|---:|---:|---:|---:|---:|
| Oddish (`a1-011-oddish`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Bellsprout (`a1-018-bellsprout`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Exeggcute (`a1-021-exeggcute`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Tangela (`a1-024-tangela`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Cottonee (`a1-027-cottonee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Petilil (`a1-029-petilil`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Skiddo (`a1-031-skiddo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Gogoat (`a1-032-gogoat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Charmander (`a1-033-charmander`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Vulpix (`a1-037-vulpix`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ponyta (`a1-042-ponyta`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Magmar (`a1-044-magmar`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Heatmor (`a1-048-heatmor`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Sizzlipede (`a1-051-sizzlipede`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Psyduck (`a1-057-psyduck`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Poliwag (`a1-059-poliwag`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Staryu (`a1-074-staryu`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ducklett (`a1-085-ducklett`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Froakie (`a1-087-froakie`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pyukumuku (`a1-090-pyukumuku`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Snom (`a1-092-snom`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Blitzle (`a1-105-blitzle`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Helioptile (`a1-110-helioptile`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Heliolisk (`a1-111-heliolisk`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Abra (`a1-115-abra`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Slowpoke (`a1-118-slowpoke`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Woobat (`a1-133-woobat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Swoobat (`a1-134-swoobat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Golett (`a1-135-golett`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Sandshrew (`a1-137-sandshrew`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Mankey (`a1-141-mankey`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Machop (`a1-143-machop`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Hitmonchan (`a1-155-hitmonchan`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Clobbopus (`a1-162-clobbopus`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ekans (`a1-164-ekans`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Mawile (`a1-178-mawile`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pawniard (`a1-179-pawniard`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Meltan (`a1-181-meltan`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Rattata (`a1-189-rattata`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Raticate (`a1-190-raticate`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Spearow (`a1-191-spearow`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Fearow (`a1-192-fearow`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Meowth (`a1-196-meowth`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Farfetch'd (`a1-198-farfetch-d`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Doduo (`a1-199-doduo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Eevee (`a1-206-eevee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Minccino (`a1-212-minccino`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Wooloo (`a1-214-wooloo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Dubwool (`a1-215-dubwool`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Fóssil Domo (`a1-217-fossil-domo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Gloom (`a1-012-gloom`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Weepinbell (`a1-019-weepinbell`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Pinsir (`a1-026-pinsir`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Whimsicott (`a1-028-whimsicott`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Lilligant (`a1-030-lilligant`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Charmeleon (`a1-034-charmeleon`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Ninetales (`a1-038-ninetales`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Rapidash (`a1-043-rapidash`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Centiskorch (`a1-052-centiskorch`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golduck (`a1-058-golduck`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Poliwhirl (`a1-060-poliwhirl`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Starmie (`a1-075-starmie`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Swanna (`a1-086-swanna`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Frogadier (`a1-088-frogadier`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Bruxish (`a1-091-bruxish`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Frosmoth (`a1-093-frosmoth`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Zebstrika (`a1-106-zebstrika`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Pincurchin (`a1-112-pincurchin`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Kadabra (`a1-116-kadabra`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Slowbro (`a1-119-slowbro`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golurk (`a1-136-golurk`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Sandslash (`a1-138-sandslash`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Primeape (`a1-142-primeape`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Machoke (`a1-144-machoke`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Kabuto (`a1-158-kabuto`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Grapploct (`a1-163-grapploct`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Arbok (`a1-165-arbok`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Bisharp (`a1-180-bisharp`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Persian (`a1-197-persian`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Dodrio (`a1-200-dodrio`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Tauros (`a1-204-tauros`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Cinccino (`a1-213-cinccino`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Erika (`a1-219-erika`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Blaine (`a1-221-blaine`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Sabrina (`a1-225-sabrina`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Vileplume (`a1-013-vileplume`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Victreebel (`a1-020-victreebel`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Exeggutor (`a1-022-exeggutor`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Charizard (`a1-035-charizard`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Flareon (`a1-045-flareon`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Moltres (`a1-046-moltres`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Poliwrath (`a1-061-poliwrath`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Lapras (`a1-079-lapras`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Greninja (`a1-089-greninja`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Alakazam (`a1-117-alakazam`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Machamp (`a1-145-machamp`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Kabutops (`a1-159-kabutops`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Melmetal (`a1-182-melmetal`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Kangaskhan (`a1-203-kangaskhan`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Exeggutor ex (`a1-023-exeggutor-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Charizard ex (`a1-036-charizard-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Moltres ex (`a1-047-moltres-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Starmie ex (`a1-076-starmie-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Machamp ex (`a1-146-machamp-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,43% | 0,43% |
| Gloom (Holográfica) (`a1-228-gloom`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Pinsir (Holográfica) (`a1-229-pinsir`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Charmander (Holográfica) (`a1-230-charmander`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Rapidash (Holográfica) (`a1-231-rapidash`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Lapras (Holográfica) (`a1-234-lapras`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Alakazam (Holográfica) (`a1-236-alakazam`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Slowpoke (Holográfica) (`a1-237-slowpoke`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Meowth (Holográfica) (`a1-246-meowth`) | Ultra | 4 | 0,00% | 0,00% | 0,17% | 0,17% |
| Exeggutor ex (Foil) (`a1-252-exeggutor-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Charizard ex (Foil) (`a1-253-charizard-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Moltres ex (Foil) (`a1-255-moltres-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Starmie ex (Foil) (`a1-257-starmie-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Machamp ex (Foil) (`a1-263-machamp-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Erika (Foil) (`a1-266-erika`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Blaine (Foil) (`a1-268-blaine`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Sabrina (Foil) (`a1-272-sabrina`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Moltres ex (Foil) (`a1-274-moltres-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Machamp ex (Foil) (`a1-278-machamp-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Charizard ex (Foil) (`a1-280-charizard-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Mew (Foil) (`a1-283-mew`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Charizard ex (Cromada) (`a1-284-charizard-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Pikachu ex (Cromada) (`a1-285-pikachu-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Mewtwo ex (Cromada) (`a1-286-mewtwo-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |

### 5.3. Genetic Apex — Mewtwo (`pack-a1-mewtwo`)

Disponível: após C04-E01 · Preço: 100 Créditos · 5 cartas.

| Posição | Comum | Incomum | Rara | Ultra |
|---:|---:|---:|---:|---:|
| 1 | 100% | 0% | 0% | 0% |
| 2 | 100% | 0% | 0% | 0% |
| 3 | 100% | 0% | 0% | 0% |
| 4 | 30% | 70% | 0% | 0% |
| 5 | 0% | 70% | 25% | 5% |

| Impressão | Raridade | Peso | P(posição 1–3) cada | P(posição 4) | P(posição 5) | P(≥1 no pacote) |
|---|---|---:|---:|---:|---:|---:|
| Bulbasaur (`a1-001-bulbasaur`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Weedle (`a1-008-weedle`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Kakuna (`a1-009-kakuna`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Venonat (`a1-016-venonat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Scyther (`a1-025-scyther`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Cottonee (`a1-027-cottonee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Petilil (`a1-029-petilil`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ponyta (`a1-042-ponyta`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Heatmor (`a1-048-heatmor`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Salandit (`a1-049-salandit`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Salazzle (`a1-050-salazzle`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Sizzlipede (`a1-051-sizzlipede`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Psyduck (`a1-057-psyduck`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Tentacool (`a1-062-tentacool`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Shellder (`a1-066-shellder`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Krabby (`a1-068-krabby`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Snom (`a1-092-snom`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Blitzle (`a1-105-blitzle`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Tynamo (`a1-107-tynamo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Helioptile (`a1-110-helioptile`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Heliolisk (`a1-111-heliolisk`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Slowpoke (`a1-118-slowpoke`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Gastly (`a1-120-gastly`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Jynx (`a1-127-jynx`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ralts (`a1-130-ralts`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Woobat (`a1-133-woobat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Swoobat (`a1-134-swoobat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Golett (`a1-135-golett`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Sandshrew (`a1-137-sandshrew`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Cubone (`a1-151-cubone`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Hitmonlee (`a1-154-hitmonlee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Rhyhorn (`a1-156-rhyhorn`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Clobbopus (`a1-162-clobbopus`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ekans (`a1-164-ekans`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Zubat (`a1-172-zubat`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Grimer (`a1-174-grimer`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Koffing (`a1-176-koffing`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pawniard (`a1-179-pawniard`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Dratini (`a1-183-dratini`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pidgey (`a1-186-pidgey`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Pidgeotto (`a1-187-pidgeotto`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Rattata (`a1-189-rattata`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Raticate (`a1-190-raticate`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Farfetch'd (`a1-198-farfetch-d`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Doduo (`a1-199-doduo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Eevee (`a1-207-eevee`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Minccino (`a1-212-minccino`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Wooloo (`a1-214-wooloo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Dubwool (`a1-215-dubwool`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Âmbar Antigo (`a1-218-ambar-antigo`) | Comum | 10 | 2,00% | 0,60% | 0,00% | 6,45% |
| Ivysaur (`a1-002-ivysaur`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Venomoth (`a1-017-venomoth`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Pinsir (`a1-026-pinsir`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Whimsicott (`a1-028-whimsicott`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Lilligant (`a1-030-lilligant`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Rapidash (`a1-043-rapidash`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Centiskorch (`a1-052-centiskorch`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golduck (`a1-058-golduck`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Tentacruel (`a1-063-tentacruel`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Cloyster (`a1-067-cloyster`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Kingler (`a1-069-kingler`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Bruxish (`a1-091-bruxish`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Frosmoth (`a1-093-frosmoth`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Zebstrika (`a1-106-zebstrika`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Eelektrik (`a1-108-eelektrik`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Pincurchin (`a1-112-pincurchin`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Slowbro (`a1-119-slowbro`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Haunter (`a1-121-haunter`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Mr. Mime (`a1-126-mr-mime`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Kirlia (`a1-131-kirlia`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golurk (`a1-136-golurk`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Sandslash (`a1-138-sandslash`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Marowak (`a1-152-marowak`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Rhydon (`a1-157-rhydon`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Grapploct (`a1-163-grapploct`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Arbok (`a1-165-arbok`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Golbat (`a1-173-golbat`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Bisharp (`a1-180-bisharp`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Dragonair (`a1-184-dragonair`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Dodrio (`a1-200-dodrio`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Lickitung (`a1-201-lickitung`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Porygon (`a1-209-porygon`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Cinccino (`a1-213-cinccino`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Koga (`a1-222-koga`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Giovanni (`a1-223-giovanni`) | Incomum | 10 | 0,00% | 2,00% | 2,00% | 3,96% |
| Venusaur (`a1-003-venusaur`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Beedrill (`a1-010-beedrill`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Vaporeon (`a1-080-vaporeon`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Articuno (`a1-083-articuno`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Eelektross (`a1-109-eelektross`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Gengar (`a1-122-gengar`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Mewtwo (`a1-128-mewtwo`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Gardevoir (`a1-132-gardevoir`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Muk (`a1-175-muk`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Weezing (`a1-177-weezing`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Dragonite (`a1-185-dragonite`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Pidgeot (`a1-188-pidgeot`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Ditto (`a1-205-ditto`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Aerodactyl (`a1-210-aerodactyl`) | Rara | 10 | 0,00% | 0,00% | 1,79% | 1,79% |
| Venusaur ex (`a1-004-venusaur-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,44% | 0,44% |
| Articuno ex (`a1-084-articuno-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,44% | 0,44% |
| Gengar ex (`a1-123-gengar-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,44% | 0,44% |
| Mewtwo ex (`a1-129-mewtwo-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,44% | 0,44% |
| Marowak ex (`a1-153-marowak-ex`) | Ultra | 10 | 0,00% | 0,00% | 0,44% | 0,44% |
| Bulbasaur (Holográfica) (`a1-227-bulbasaur`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Cubone (Holográfica) (`a1-239-cubone`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Golbat (Holográfica) (`a1-242-golbat`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Weezing (Holográfica) (`a1-243-weezing`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Dragonite (Holográfica) (`a1-244-dragonite`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Pidgeot (Holográfica) (`a1-245-pidgeot`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Ditto (Holográfica) (`a1-247-ditto`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Porygon (Holográfica) (`a1-249-porygon`) | Ultra | 4 | 0,00% | 0,00% | 0,18% | 0,18% |
| Venusaur ex (Foil) (`a1-251-venusaur-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Articuno ex (Foil) (`a1-258-articuno-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Gengar ex (Foil) (`a1-261-gengar-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Mewtwo ex (Foil) (`a1-262-mewtwo-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Marowak ex (Foil) (`a1-264-marowak-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Koga (Foil) (`a1-269-koga`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Giovanni (Foil) (`a1-270-giovanni`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Articuno ex (Foil) (`a1-275-articuno-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Gengar ex (Foil) (`a1-277-gengar-ex`) | Ultra | 3 | 0,00% | 0,00% | 0,13% | 0,13% |
| Mewtwo ex (Foil) (`a1-282-mewtwo-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Mew (Foil) (`a1-283-mew`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Charizard ex (Cromada) (`a1-284-charizard-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Pikachu ex (Cromada) (`a1-285-pikachu-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |
| Mewtwo ex (Cromada) (`a1-286-mewtwo-ex`) | Ultra | 1 | 0,00% | 0,00% | 0,04% | 0,04% |

### 5.4. Mythical Island — Mew (`pack-a1a-mew`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 32 | 100,000% | 0,000% | 0,000% | 3,125% | 0,000% | 0,000% |
| ◊◊ | 23 | 0,000% | 90,000% | 60,000% | 0,000% | 3,913% | 2,609% |
| ◊◊◊ | 8 | 0,000% | 5,000% | 20,000% | 0,000% | 0,625% | 2,500% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 6 | 0,000% | 2,572% | 10,288% | 0,000% | 0,429% | 1,715% |
| ☆☆ | 10 | 0,000% | 0,500% | 2,000% | 0,000% | 0,050% | 0,200% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ♛ | 1 | 0,000% | 0,040% | 0,160% | 0,000% | 0,040% | 0,160% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 18 impressões ☆ ou acima do pool (5,556% cada).

### 5.5. Space-Time Smackdown — Dialga (`pack-a2-dialga`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 46 | 100,000% | 0,000% | 0,000% | 2,174% | 0,000% | 0,000% |
| ◊◊ | 34 | 0,000% | 90,000% | 60,000% | 0,000% | 2,647% | 1,765% |
| ◊◊◊ | 14 | 0,000% | 5,000% | 20,000% | 0,000% | 0,357% | 1,429% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 12 | 0,000% | 2,572% | 10,288% | 0,000% | 0,214% | 0,857% |
| ☆☆ | 12 | 0,000% | 0,500% | 2,000% | 0,000% | 0,042% | 0,167% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ♛ | 2 | 0,000% | 0,040% | 0,160% | 0,000% | 0,020% | 0,080% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 27 impressões ☆ ou acima do pool (3,704% cada).

### 5.6. Space-Time Smackdown — Palkia (`pack-a2-palkia`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 44 | 100,000% | 0,000% | 0,000% | 2,273% | 0,000% | 0,000% |
| ◊◊ | 36 | 0,000% | 90,000% | 60,000% | 0,000% | 2,500% | 1,667% |
| ◊◊◊ | 14 | 0,000% | 5,000% | 20,000% | 0,000% | 0,357% | 1,429% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 12 | 0,000% | 2,572% | 10,288% | 0,000% | 0,214% | 0,857% |
| ☆☆ | 12 | 0,000% | 0,500% | 2,000% | 0,000% | 0,042% | 0,167% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ♛ | 2 | 0,000% | 0,040% | 0,160% | 0,000% | 0,020% | 0,080% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 27 impressões ☆ ou acima do pool (3,704% cada).

### 5.7. Triumphant Light — Arceus (`pack-a2a-arceus`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 31 | 100,000% | 0,000% | 0,000% | 3,226% | 0,000% | 0,000% |
| ◊◊ | 26 | 0,000% | 90,000% | 60,000% | 0,000% | 3,462% | 2,308% |
| ◊◊◊ | 13 | 0,000% | 5,000% | 20,000% | 0,000% | 0,385% | 1,538% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 6 | 0,000% | 2,572% | 10,288% | 0,000% | 0,429% | 1,715% |
| ☆☆ | 13 | 0,000% | 0,500% | 2,000% | 0,000% | 0,038% | 0,154% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ♛ | 1 | 0,000% | 0,040% | 0,160% | 0,000% | 0,040% | 0,160% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 21 impressões ☆ ou acima do pool (4,762% cada).

### 5.8. Celestial Guardians — Solgaleo (`pack-a3-solgaleo`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 44 | 100,000% | 0,000% | 0,000% | 2,273% | 0,000% | 0,000% |
| ◊◊ | 34 | 0,000% | 89,000% | 56,000% | 0,000% | 2,618% | 1,647% |
| ◊◊◊ | 14 | 0,000% | 4,953% | 19,810% | 0,000% | 0,354% | 1,415% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 12 | 0,000% | 2,572% | 10,288% | 0,000% | 0,214% | 0,857% |
| ☆☆ | 14 | 0,000% | 0,500% | 2,000% | 0,000% | 0,036% | 0,143% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 2 | 0,000% | 0,040% | 0,160% | 0,000% | 0,020% | 0,080% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 43 impressões ☆ ou acima do pool (2,326% cada).

### 5.9. Celestial Guardians — Lunala (`pack-a3-lunala`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 44 | 100,000% | 0,000% | 0,000% | 2,273% | 0,000% | 0,000% |
| ◊◊ | 34 | 0,000% | 89,000% | 56,000% | 0,000% | 2,618% | 1,647% |
| ◊◊◊ | 14 | 0,000% | 4,953% | 19,810% | 0,000% | 0,354% | 1,415% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 12 | 0,000% | 2,572% | 10,288% | 0,000% | 0,214% | 0,857% |
| ☆☆ | 14 | 0,000% | 0,500% | 2,000% | 0,000% | 0,036% | 0,143% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 2 | 0,000% | 0,040% | 0,160% | 0,000% | 0,020% | 0,080% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 43 impressões ☆ ou acima do pool (2,326% cada).

### 5.10. Extradimensional Crisis (`pack-a3a`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 32 | 100,000% | 0,000% | 0,000% | 3,125% | 0,000% | 0,000% |
| ◊◊ | 24 | 0,000% | 89,000% | 56,000% | 0,000% | 3,708% | 2,333% |
| ◊◊◊ | 8 | 0,000% | 4,953% | 19,810% | 0,000% | 0,619% | 2,476% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 6 | 0,000% | 2,572% | 10,288% | 0,000% | 0,429% | 1,715% |
| ☆☆ | 12 | 0,000% | 0,500% | 2,000% | 0,000% | 0,042% | 0,167% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 1 | 0,000% | 0,040% | 0,160% | 0,000% | 0,040% | 0,160% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 34 impressões ☆ ou acima do pool (2,941% cada).

### 5.11. Eevee Grove (`pack-a3b`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 32 | 100,000% | 0,000% | 0,000% | 3,125% | 0,000% | 0,000% |
| ◊◊ | 23 | 0,000% | 89,000% | 56,000% | 0,000% | 3,870% | 2,435% |
| ◊◊◊ | 8 | 0,000% | 4,953% | 19,810% | 0,000% | 0,619% | 2,476% |
| ◊◊◊◊ | 6 | 0,000% | 1,666% | 6,664% | 0,000% | 0,278% | 1,111% |
| ☆ | 9 | 0,000% | 2,572% | 10,288% | 0,000% | 0,286% | 1,143% |
| ☆☆ | 13 | 0,000% | 0,500% | 2,000% | 0,000% | 0,038% | 0,154% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 1 | 0,000% | 0,040% | 0,160% | 0,000% | 0,040% | 0,160% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 38 impressões ☆ ou acima do pool (2,632% cada).

### 5.12. Wisdom of Sea and Sky — Lugia (`pack-a4-lugia`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 42 | 100,000% | 0,000% | 0,000% | 2,381% | 0,000% | 0,000% |
| ◊◊ | 31 | 0,000% | 89,000% | 56,000% | 0,000% | 2,871% | 1,806% |
| ◊◊◊ | 14 | 0,000% | 4,953% | 19,810% | 0,000% | 0,354% | 1,415% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 11 | 0,000% | 2,572% | 10,288% | 0,000% | 0,234% | 0,935% |
| ☆☆ | 12 | 0,000% | 0,500% | 2,000% | 0,000% | 0,042% | 0,167% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 2 | 0,000% | 0,040% | 0,160% | 0,000% | 0,020% | 0,080% |

6ª carta: sai em 8,330% dos pacotes normais, de um pool próprio (bebês).

| Símbolo | Cartas | Chance do símbolo | Por carta |
|---|---:|---:|---:|
| ◊◊◊ | 3 | 87,100% | 29,033% |
| ☆ | 1 | 12,900% | 12,900% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 40 impressões ☆ ou acima do pool (2,500% cada).

### 5.13. Wisdom of Sea and Sky — Ho-Oh (`pack-a4-ho-oh`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 42 | 100,000% | 0,000% | 0,000% | 2,381% | 0,000% | 0,000% |
| ◊◊ | 31 | 0,000% | 89,000% | 56,000% | 0,000% | 2,871% | 1,806% |
| ◊◊◊ | 14 | 0,000% | 4,953% | 19,810% | 0,000% | 0,354% | 1,415% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 11 | 0,000% | 2,572% | 10,288% | 0,000% | 0,234% | 0,935% |
| ☆☆ | 12 | 0,000% | 0,500% | 2,000% | 0,000% | 0,042% | 0,167% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 2 | 0,000% | 0,040% | 0,160% | 0,000% | 0,020% | 0,080% |

6ª carta: sai em 8,330% dos pacotes normais, de um pool próprio (bebês).

| Símbolo | Cartas | Chance do símbolo | Por carta |
|---|---:|---:|---:|
| ◊◊◊ | 3 | 87,100% | 29,033% |
| ☆ | 1 | 12,900% | 12,900% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 40 impressões ☆ ou acima do pool (2,500% cada).

### 5.14. Secluded Springs (`pack-a4a`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–3ª | 4ª | 5ª | Por carta (1ª–3ª) | Por carta (4ª) | Por carta (5ª) |
|---|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 32 | 100,000% | 0,000% | 0,000% | 3,125% | 0,000% | 0,000% |
| ◊◊ | 23 | 0,000% | 89,000% | 56,000% | 0,000% | 3,870% | 2,435% |
| ◊◊◊ | 8 | 0,000% | 4,953% | 19,810% | 0,000% | 0,619% | 2,476% |
| ◊◊◊◊ | 5 | 0,000% | 1,666% | 6,664% | 0,000% | 0,333% | 1,333% |
| ☆ | 5 | 0,000% | 2,572% | 10,288% | 0,000% | 0,514% | 2,058% |
| ☆☆ | 12 | 0,000% | 0,500% | 2,000% | 0,000% | 0,042% | 0,167% |
| ☆☆☆ | 1 | 0,000% | 0,222% | 0,888% | 0,000% | 0,222% | 0,888% |
| ✵ | 10 | 0,000% | 0,714% | 2,857% | 0,000% | 0,071% | 0,286% |
| ✵✵ | 4 | 0,000% | 0,333% | 1,333% | 0,000% | 0,083% | 0,333% |
| ♛ | 1 | 0,000% | 0,040% | 0,160% | 0,000% | 0,040% | 0,160% |

6ª carta: sai em 8,330% dos pacotes normais, de um pool próprio (bebês).

| Símbolo | Cartas | Chance do símbolo | Por carta |
|---|---:|---:|---:|
| ◊◊◊ | 3 | 87,100% | 29,033% |
| ☆ | 1 | 12,900% | 12,900% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 33 impressões ☆ ou acima do pool (3,030% cada).

### 5.15. Deluxe Pack ex (`pack-a4b`)

Disponível: desde o início · Preço: 100 Créditos · 4 cartas.

| Símbolo | Cartas no pool | 1ª | 2ª | 3ª | 4ª | Por carta (1ª) | Por carta (2ª) | Por carta (3ª) | Por carta (4ª) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ◊ | 128 | 100,000% | 17,730% | 23,021% | 0,000% | 0,781% | 0,139% | 0,180% | 0,000% |
| ◊◊ | 100 | 0,000% | 82,270% | 17,985% | 0,000% | 0,000% | 0,823% | 0,180% | 0,000% |
| ◊◊◊ | 50 | 0,000% | 0,000% | 40,660% | 0,000% | 0,000% | 0,000% | 0,813% | 0,000% |
| ◊◊◊◊ | 75 | 0,000% | 0,000% | 0,000% | 100,000% | 0,000% | 0,000% | 0,000% | 1,333% |
| ☆ | 6 | 0,000% | 0,000% | 12,858% | 0,000% | 0,000% | 0,000% | 2,143% | 0,000% |
| ☆☆ | 16 | 0,000% | 0,000% | 2,500% | 0,000% | 0,000% | 0,000% | 0,156% | 0,000% |
| ☆☆☆ | 1 | 0,000% | 0,000% | 1,111% | 0,000% | 0,000% | 0,000% | 1,111% | 0,000% |
| ✵✵ | 2 | 0,000% | 0,000% | 1,667% | 0,000% | 0,000% | 0,000% | 0,834% | 0,000% |
| ♛ | 1 | 0,000% | 0,000% | 0,198% | 0,000% | 0,000% | 0,000% | 0,198% | 0,000% |

Pacote raro: 0,050% dos pacotes; todas as cartas saem uniformes entre as 26 impressões ☆ ou acima do pool (3,846% cada).

### 5.16. Pacote Promo-A (`pack-pa-promo`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–5ª | Por carta (1ª–5ª) |
|---|---:|---:|---:|
| PROMO | 111 | 100,000% | 0,901% |

### 5.17. Pacote Promo-B (`pack-pb-promo`)

Disponível: desde o início · Preço: 100 Créditos · 5 cartas.

| Símbolo | Cartas no pool | 1ª–5ª | Por carta (1ª–5ª) |
|---|---:|---:|---:|
| PROMO | 103 | 100,000% | 0,971% |

### 5.18. Cartas dirigidas

Uma oferta por impressão não PROMO: Comum 80, Incomum 160, Rara 300, Ultra 600 Créditos por cópia (brilhantes, ☆ e ♛ são Ultra). No Genetic Apex, não Ultra conforme o pacote de origem (Pikachu desde o início, Charizard após C01-E01, Mewtwo após C04-E01) e Ultra só após o chefe que fecha o pacote (Pikachu C03-E06, Charizard C05-E06, Mewtwo C06-E06; sem pacote F00-D03). Nos outros sets, tudo à venda desde o início.

| Conjunto | Comum | Incomum | Rara | Ultra | Disponível |
|---|---:|---:|---:|---:|---|
| `a1` | 100 | 69 | 42 | 75 | C04-E01, C06-E06, início, C01-E01, C05-E06, C03-E06, F00-D03 |
| `a1a` | 32 | 23 | 8 | 23 | início |
| `a2` | 67 | 54 | 24 | 62 | início |
| `a2a` | 31 | 26 | 13 | 26 | início |
| `a3` | 66 | 51 | 28 | 94 | início |
| `a3a` | 32 | 24 | 8 | 39 | início |
| `a3b` | 32 | 23 | 8 | 44 | início |
| `a4` | 66 | 51 | 34 | 90 | início |
| `a4a` | 32 | 23 | 11 | 39 | início |
| `a4b` | 128 | 100 | 50 | 101 | início |

### 5.19. Cosméticos à venda

| Produto | Cosmético | Preço | Disponível |
|---|---|---:|---|
| `cosmetic-mat-c01-grove` | Ginásio de Celadon | 500 | após C01-E06 |
| `cosmetic-mat-c02-harbor` | Ginásio de Sootopolis | 500 | após C02-E06 |
| `cosmetic-mat-c03-circuits` | Ginásio de Vermilion | 500 | após C03-E06 |
| `cosmetic-mat-c04-observatory` | Ginásio de Saffron | 500 | após C04-E06 |
| `cosmetic-mat-c05-foundry` | Ginásio de Stow-on-Side | 500 | após C05-E06 |
| `cosmetic-mat-c06-archive` | Ginásio de Viridian | 500 | após C06-E06 |
| `cosmetic-sleeve-c01` | Verso Celadon | 200 | após C01-E03 |
| `cosmetic-sleeve-c02` | Verso Sootopolis | 200 | após C02-E03 |
| `cosmetic-sleeve-c03` | Verso Vermilion | 200 | após C03-E03 |
| `cosmetic-sleeve-c04` | Verso Saffron | 200 | após C04-E03 |
| `cosmetic-sleeve-c05` | Verso Stow-on-Side | 200 | após C05-E03 |
| `cosmetic-sleeve-c06` | Verso Viridian | 200 | após C06-E03 |
| `cosmetic-coin-c01` | Moeda Celadon | 300 | após C01-E06 |
| `cosmetic-coin-c02` | Moeda Sootopolis | 300 | após C02-E06 |
| `cosmetic-coin-c03` | Moeda Vermilion | 300 | após C03-E06 |
| `cosmetic-coin-c04` | Moeda Saffron | 300 | após C04-E06 |
| `cosmetic-coin-c05` | Moeda Stow-on-Side | 300 | após C05-E06 |
| `cosmetic-coin-c06` | Moeda Viridian | 300 | após C06-E06 |

## 🧰 6. Decks iniciais e de apoio

| Deck | Tipo | Energia | Lista | Nota |
|---|---|---|---|---|
| **Chama Constante** `starter-chama-constante` | Inicial | Fogo | 2× Charmander, 2× Charmeleon, 2× Ponyta, 2× Rapidash, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Ponyta e Rapidash atacam por uma Energia enquanto Charmeleon se prepara; Brasa descarta Energia, então planeje a próxima. |
| **Maré Serena** `starter-mare-serena` | Inicial | Água | 2× Squirtle, 2× Wartortle, 2× Staryu, 2× Starmie, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Starmie recua de graça: alterne atacantes e preserve Energia; Wartortle segura a linha enquanto o outro recarrega. |
| **Jardim Vivo** `starter-jardim-vivo` | Inicial | Planta | 2× Bulbasaur, 2× Ivysaur, 2× Exeggcute, 2× Exeggutor, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Exeggutor bate forte com sorte; Ivysaur dá estabilidade. Poção segura o Ativo enquanto a reserva cresce. |
| **Faísca Veloz** `starter-faisca-veloz` | Inicial | Elétrico | 2× Mareep, 2× Flaaffy, 2× Blitzle, 2× Zebstrika, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Zebstrika bate forte com duas Energias; Flaaffy segura a frente enquanto o Banco carrega. Recue cedo e mantenha o ritmo. |
| **Eco Psíquico** `starter-eco-psiquico` | Inicial | Psíquico | 2× Swirlix, 2× Slurpuff, 2× Duskull, 2× Dusclops, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Slurpuff aguenta e responde com 60; Dusclops é a reserva pesada. Evolua no Banco antes de expor o Ativo. |
| **Punho Firme** `starter-punho-firme` | Inicial | Lutador | 2× Timburr, 2× Gurdurr, 2× Meditite, 2× Medicham, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Medicham chuta por uma Energia; Gurdurr dá corpo à linha de frente. Golpes baratos rendem mais turnos de ataque. |
| **Sombra Astuta** `starter-sombra-astuta` | Inicial | Noturno | 2× Poochyena, 2× Mightyena, 2× Purrloin, 2× Liepard, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Liepard ataca por uma Energia enquanto Mightyena se prepara para o golpe de 60; troque de atacante sem perder tempo. |
| **Aço Paciente** `starter-aco-paciente` | Inicial | Metálico | 2× Klink, 2× Klang, 2× Aron, 2× Lairon, 2× Poké Bola (Promo), 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Cartão Vermelho (Promo), 2× Lupa de Mão (Promo) | Lairon e Aron aguentam muito dano; Klang fecha a conta. Paciência: cada Energia ligada vira um golpe mais pesado. |
| **Apoio do Bosque: Fogo na Clareira** `support-c01-v1` | Apoio | Fogo | 2× Charmander, 2× Charmeleon, 1× Charizard, 2× Vulpix, 2× Ninetales, 2× Growlithe, 1× Arcanine, 2× Blaine, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Fogo contra Planta: Blaine reforça Ninetales no turno certo; encha o Banco antes de perder o Ativo. |
| **Apoio do Porto: Faísca na Doca** `support-c02-v1` | Apoio | Elétrico | 2× Pikachu, 1× Raichu, 2× Magnemite, 2× Magneton, 2× Voltorb, 2× Electrode, 2× Electabuzz, 1× Tenente Surge, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo) | Elétrico contra Água; Velocidade X barateia o Recuo e Magneton carrega a si mesmo. |
| **Apoio da Usina: Terra Firme** `support-c03-v1` | Apoio | Lutador | 2× Diglett, 2× Dugtrio, 2× Machop, 2× Machoke, 1× Machamp, 2× Hitmonlee, 2× Mankey, 1× Primeape, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Giovanni | Lutador contra Elétrico; Hitmonlee alcança o Banco e derruba o Pokémon que carrega a usina. |
| **Apoio do Observatório: Sombra Densa** `support-c04-v1` | Apoio | Noturno | 2× Koffing, 2× Weezing, 2× Ekans, 2× Arbok, 2× Nidoran♂, 2× Nidorino, 1× Nidoking, 1× Koga, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Noturno contra Psíquico; Recuo e evolução limpam as condições que o observatório aplica. |
| **Apoio da Fundição: Mente Afiada** `support-c05-v1` | Apoio | Psíquico | 2× Abra, 2× Kadabra, 1× Alakazam, 2× Gastly, 2× Haunter, 1× Gengar, 2× Jynx, 2× Mr. Mime, 2× Giovanni, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo) | Psíquico contra Lutador; Giovanni e Alakazam punem quem acumula Energia. |
| **Apoio do Arquivo: Conta Certa** `support-c06-v1` | Apoio | Elétrico | 2× Pikachu, 1× Raichu, 2× Electabuzz, 2× Zapdos, 2× Voltorb, 2× Electrode, 2× Blitzle, 2× Zebstrika, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 1× Giovanni | Só atacantes de um ponto; Zebstrika escolhe o alvo que vale mais. |
| **Apoio do Arquivo: Leitura Psíquica** `support-c06-psi-v1` | Apoio | Psíquico | 2× Ralts, 2× Kirlia, 1× Gardevoir, 2× Mewtwo, 2× Jynx, 2× Mr. Mime, 2× Drowzee, 1× Hypno, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Giovanni | Psíquico contra Lutador: derrube o ex sem expor um ex seu; Gardevoir acelera o Ativo. |
| **Apoio do Arquivo: Maré Contada** `support-c06-mare-v1` | Apoio | Água | 2× Squirtle, 2× Wartortle, 1× Blastoise, 2× Staryu, 2× Starmie, 1× Lapras, 2× Horsea, 2× Seadra, 2× Misty, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo) | Água contra Fogo, só com Pokémon de um ponto: o risco fica todo do outro lado. |
| **Apoio do Circuito: Chama Final** `support-f00-chama-v1` | Apoio | Fogo | 2× Charmander, 2× Charmeleon, 1× Charizard ex, 2× Growlithe, 2× Arcanine ex, 1× Moltres, 2× Vulpix, 2× Ninetales, 2× Blaine, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo) | Fogo contra Planta, com ex para fechar a conta de pontos. |
| **Apoio do Circuito: Maré Final** `support-f00-mare-v1` | Apoio | Água | 2× Squirtle, 2× Wartortle, 2× Blastoise ex, 2× Staryu, 1× Starmie ex, 1× Lapras, 2× Psyduck, 1× Golduck, 2× Misty, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 1× Poção (Promo) | Água contra Fogo; Psyduck tira o Apoiador do adversário antes do golpe decisivo. |
| **Apoio do Circuito: Circuito Fechado** `support-f00-v1` | Apoio | Elétrico | 2× Pikachu ex, 1× Zapdos ex, 2× Pikachu, 1× Raichu, 2× Magnemite, 2× Magneton, 2× Voltorb, 1× Electrode, 1× Tenente Surge, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Giovanni | Pikachu ex cresce com o Banco cheio de Elétricos; Magneton acelera e um ex decide a conta de pontos. |
| **Modelo Ilha Mítica: Totem da Selva** `support-a1a-v1` | Apoio | Planta | 2× Celebi ex, 2× Snivy, 2× Servine, 2× Serperior, 2× Exeggcute, 2× Erika, 1× Leaf, 1× Blue, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Serperior faz cada Energia de Planta valer duas: Celebi ex joga mais moedas e bate muito mais forte. |
| **Modelo Choque Espaço-Tempo: Maré Dimensional** `support-a2-v1` | Apoio | Água | 2× Palkia ex, 2× Manaphy (Promo), 2× Piplup (Promo), 2× Prinplup, 1× Empoleon, 2× Swinub, 1× Piloswine, 1× Mamoswine, 1× Dawn, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Palkia ex fecha o jogo com 150; Mamoswine e Piloswine aguentam Fogo e Água enquanto a Energia se acumula. |
| **Modelo Luz Triunfante: Arceus e o Bando** `support-a2a-v1` | Apoio | Noturno | 2× Arceus ex, 2× Zubat, 2× Golbat, 2× Crobat, 1× Shaymin, 1× Rotom, 1× Cyrus, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo), 1× Lupa de Mão (Promo) | Com Arceus ex em jogo, cada Crobat espalha dano todo turno e Rotom recua de graça; Arceus ex não sofre Condições. |
| **Modelo Guardiões Celestiais: Sol e Lua** `support-a3-v1` | Apoio | Metálico, Psíquico | 2× Cosmog (Promo), 2× Cosmoem, 2× Solgaleo ex, 2× Lunala ex, 2× Comfey, 2× Doce Raro, 2× Lillie, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Doce Raro pula Cosmoem; Lunala ex passa as Energias de Psíquico para quem vai atacar e Solgaleo ex entra no Ativo do Banco. |
| **Modelo Crise Extradimensional: Ultracriaturas** `support-a3a-v1` | Apoio | Planta | 2× Buzzwole ex, 2× Pheromosa, 2× Kartana (Promo), 1× Celesteela, 2× Lusamine, 2× Muralha das Feras, 1× Bestita, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo) | Ultracriaturas crescem quando você pontua: Bestita soma dano por ponto e Lusamine recarrega depois do primeiro ponto do oponente. |
| **Modelo Bosque de Eevee: Laço de Fada** `support-a3b-v1` | Apoio | Psíquico | 2× Eevee ex (Promo), 2× Eevee, 2× Sylveon ex, 2× Espeon, 2× Bolsa de Eevee, 1× Penny, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo), 1× Lupa de Mão (Promo) | Eevee ex evolui para qualquer evolução de Eevee; Sylveon ex compra duas cartas ao entrar e a Bolsa de Eevee escolhe entre dano e cura. |
| **Modelo Sabedoria do Mar e do Céu: Fênix Arco-Íris** `support-a4-v1` | Apoio | Fogo, Água, Elétrico | 2× Ho-Oh ex, 2× Lugia ex, 2× Hoothoot, 2× Noctowl, 2× Troca Elemental, 1× Will, 1× Cachecol de Resgate, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo) | Ho-Oh ex distribui Fogo, Água e Elétrico pelo Banco; Lugia ex usa as três de uma vez para 180. |
| **Modelo Fontes Ocultas: Feras Lendárias** `support-a4a-v1` | Apoio | Água, Elétrico | 2× Suicune ex, 2× Raikou ex, 2× Tynamo, 2× Eelektrik, 1× Eelektross, 2× Bote Inflável, 1× Mercador Viajante, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo) | Suicune ex e Raikou ex compram uma carta por turno no Ativo; Bote Inflável deixa a troca entre eles barata. |
| **Apoio do Bosque: Fênix na Clareira** `support-c01-fenix-v1` | Apoio | Fogo | 2× Ho-Oh ex, 2× Eevee, 2× Flareon ex, 2× Fletchling, 2× Fletchinder, 1× Talonflame, 1× Bolsa de Eevee, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo) | Variação de Fênix Arco-Íris contra Planta: Flareon ex recicla o Fogo do descarte e Talonflame fecha a conta. |
| **Apoio do Porto: Trovão das Feras** `support-c02-feras-v1` | Apoio | Elétrico | 2× Raikou ex, 2× Tynamo, 2× Eelektrik, 1× Eelektross, 2× Mareep, 2× Flaaffy, 1× Ampharos, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo) | Variação de Feras Lendárias contra Água: Raikou ex compra no Ativo enquanto Eelektross e Ampharos se armam. |
| **Apoio da Usina: Uivo de Pedra** `support-c03-uivo-v1` | Apoio | Lutador | 2× Rockruff, 2× Lycanroc ex, 2× Timburr, 2× Gurdurr, 1× Conkeldurr, 1× Passimian ex, 2× Doce Raro, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Velocidade X (Promo) | Variação de Ultracriaturas contra Elétrico: Lycanroc ex bate 130 e Conkeldurr pode sobreviver com 10 PS. |
| **Apoio do Observatório: Lua Sombria** `support-c04-lua-v1` | Apoio | Noturno | 2× Eevee, 2× Umbreon ex, 1× Eevee ex (Promo), 2× Murkrow, 2× Honchkrow, 2× Poochyena, 2× Mightyena, 1× Bolsa de Eevee, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Variação de Laço de Fada contra Psíquico: Umbreon ex puxa o alvo certo para o Ativo e o Noturno bate na Fraqueza. |
| **Apoio da Fundição: Lua Crescente** `support-c05-lua-v1` | Apoio | Psíquico | 2× Cosmog (Promo), 2× Cosmoem, 2× Lunala ex, 2× Swirlix, 2× Slurpuff, 1× Comfey, 2× Doce Raro, 1× Lillie, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo) | Variação de Sol e Lua contra Lutador: Lunala ex leva o Psíquico para quem vai atacar, Slurpuff segura a frente. |
| **Apoio do Arquivo: Eco sem Risco** `support-c06-eco-v1` | Apoio | Psíquico | 2× Duskull, 2× Dusclops, 1× Dusknoir, 2× Swirlix, 2× Slurpuff, 2× Comfey, 2× Doce Raro, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Poção (Promo), 1× Velocidade X (Promo) | Variação de Sol e Lua só com Pokémon de um ponto: Dusknoir move o dano para longe de quem está ameaçado. |
| **Apoio do Circuito: Maré Dimensional** `support-f00-palkia-v1` | Apoio | Água | 2× Palkia ex, 2× Manaphy (Promo), 2× Piplup (Promo), 2× Prinplup, 1× Empoleon, 1× Suicune ex, 2× Swinub, 1× Piloswine, 1× Mamoswine, 1× Dawn, 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 1× Poção (Promo) | Variação de Maré Dimensional para a final: Água contra os decks de Fogo, com Suicune ex para comprar cartas. |

### 6.1. Receitas de deck

Listas prontas para montar um deck (campanha §3.7): por tipo, do meta e conhecidas na comunidade do Pocket, adaptadas às cartas deste pacote. Todas são decks jogáveis de 20 cartas; montar uma receita nunca concede cartas.

| Receita | Categoria | Era | Energia | Dificuldade | Capa | Lista | Estratégia |
|---|---|---|---|---|---|---|---|
| **Pikachu ex e Zapdos ex** `meta-pikachu-ex-zapdos-ex` | Meta | A1 | Elétrico | Iniciante | Pikachu ex | 2× Pikachu ex, 2× Zapdos ex, 2× Voltorb, 2× Electrode, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Velocidade X (Promo), 2× Sabrina, 2× Giovanni, 1× Poção (Promo), 1× Cartão Vermelho (Promo) | O deck que definiu o começo do Pocket: Pikachu ex ataca por duas Energias e bate 30 por Pokémon Elétrico no Banco. Zapdos ex e Electrode enchem o Banco; Sabrina e Giovanni fecham as contas. |
| **Mewtwo ex e Gardevoir** `meta-mewtwo-ex-gardevoir` | Meta | A1 | Psíquico | Intermediária | Mewtwo ex | 2× Mewtwo ex, 2× Ralts, 2× Kirlia, 2× Gardevoir, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Sabrina, 2× Giovanni, 2× Poção (Promo), 1× Velocidade X (Promo), 1× Cartão Vermelho (Promo) | Gardevoir no Banco liga uma Energia Psíquica extra por turno ao Ativo: Mewtwo ex chega ao Psicoimpulso de 150 um turno antes. Evolua Ralts cedo e proteja a Gardevoir. |
| **Charizard ex e Moltres ex** `meta-charizard-ex-moltres-ex` | Meta | A1 | Fogo | Intermediária | Charizard ex | 2× Charmander, 2× Charmeleon, 2× Charizard ex, 2× Moltres ex, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 2× Poção (Promo), 1× Velocidade X (Promo) | Moltres ex acelera Energia de Fogo no Banco com Dança Infernal; Charizard ex descarrega a Tempestade Carmesim de 200. Doce Raro pula o Charmeleon quando a mão ajuda. |
| **Starmie ex e Articuno ex** `meta-starmie-ex-articuno-ex` | Meta | A1 | Água | Iniciante | Starmie ex | 2× Staryu, 2× Starmie ex, 2× Articuno ex, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Sabrina, 2× Giovanni, 2× Velocidade X (Promo), 2× Poção (Promo) | Starmie ex evolui rápido e bate 90 por duas Energias; Articuno ex segura a frente e varre o Banco com Nevasca. Misty acelera a Água quando a moeda ajuda. |
| **Celebi ex e Serperior** `meta-celebi-ex-serperior` | Meta | A1a | Planta | Intermediária | Celebi ex | 2× Celebi ex, 2× Snivy, 2× Servine, 2× Serperior, 2× Dhelmise, 2× Doce Raro, 2× Erika, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Leaf, 1× Poção (Promo) | Serperior dobra cada Energia de Planta: Celebi ex joga uma moeda por Energia e Dhelmise passa dos 90. Monte Serperior no Banco antes de expor o Celebi ex; Erika cura o atacante. |
| **Aerodactyl ex e Marowak ex** `meta-aerodactyl-ex-marowak-ex` | Meta | A1a | Lutador | Intermediária | Aerodactyl ex | 2× Âmbar Antigo, 2× Aerodactyl ex, 2× Cubone, 2× Marowak ex, 2× Hitmonlee, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 2× Poção (Promo), 1× Velocidade X (Promo) | Aerodactyl ex impede o rival de evoluir o Ativo com a Lei Primordial; Marowak ex bate forte com Ossomerangue. Hitmonlee alcança o Banco enquanto o Âmbar Antigo vira fóssil. |
| **Gyarados ex e Greninja** `meta-gyarados-ex-greninja` | Meta | A1a | Água | Intermediária | Gyarados ex | 2× Magikarp, 2× Gyarados ex, 2× Froakie, 2× Frogadier, 2× Greninja, 2× Doce Raro, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Sabrina | Greninja dá 20 de dano onde quiser a cada turno e prepara os nocautes; Gyarados ex fecha com Redemoinho Desenfreado de 140. Misty encurta a espera pela Energia. |
| **Dialga ex e Melmetal** `meta-dialga-ex-melmetal` | Meta | A2 | Metálico | Intermediária | Dialga ex | 2× Dialga ex, 2× Meltan, 2× Melmetal, 1× Heatran, 2× Dawn, 2× Cyrus, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 2× Poção (Promo), 1× Velocidade X (Promo) | Dialga ex liga duas Energias de Metal a um Pokémon do Banco com Turbo Metálico: Melmetal, que toma 20 a menos de cada ataque, entra pronto. Dawn puxa Energia para o Ativo. |
| **Palkia ex e Vaporeon** `meta-palkia-ex-vaporeon` | Meta | A2 | Água | Avançada | Palkia ex | 2× Palkia ex, 2× Eevee, 2× Vaporeon, 2× Manaphy (Promo), 2× Misty, 2× Irida, 1× Cyrus, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Velocidade X (Promo), 1× Poção (Promo) | Manaphy e Vaporeon carregam Água no Banco; Vaporeon passa as Energias para o Palkia ex no Ativo, que solta a Tempestade Dimensional de 150 e 20 em cada Pokémon do Banco rival. |
| **Darkrai ex e Weavile ex** `meta-darkrai-ex-weavile-ex` | Meta | A2 | Noturno | Intermediária | Darkrai ex (Promo) | 2× Darkrai ex (Promo), 2× Sneasel, 2× Weavile ex, 2× Cyrus, 1× Mars, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Sabrina, 2× Giovanni, 1× Velocidade X (Promo), 2× Poção (Promo) | Cada Energia Noturna ligada ao Darkrai ex dá 20 de dano no Ativo rival; Weavile ex aproveita o dano e bate 70 por uma Energia. Cyrus puxa o Pokémon ferido do Banco. |
| **Infernape ex e Moltres ex** `meta-infernape-ex-moltres-ex` | Meta | A2 | Fogo | Intermediária | Infernape ex | 2× Chimchar (Promo), 2× Monferno, 2× Infernape ex, 2× Moltres ex, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 1× Velocidade X (Promo), 2× Poção (Promo) | Infernape ex não paga recuo e queima 140 por duas Energias; Moltres ex repõe o Fogo no Banco. Alterne os atacantes depois de cada Ataque Flamejante. |
| **Gallade ex e Lucario** `meta-gallade-ex-lucario` | Meta | A2 | Lutador | Intermediária | Gallade ex | 2× Ralts, 2× Kirlia, 2× Gallade ex, 2× Riolu, 2× Lucario, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Sabrina, 1× Poção (Promo), 1× Velocidade X (Promo) | Gallade ex bate 20 a mais por Energia do Ativo rival, ótimo contra atacantes pesados; Lucario no Banco soma 20 a cada ataque Lutador. |
| **Arceus ex e Crobat** `meta-arceus-ex-crobat` | Meta | A2a | Noturno | Avançada | Arceus ex | 2× Arceus ex, 1× Arceus, 2× Zubat, 2× Golbat, 2× Crobat, 2× Doce Raro, 1× Cyrus, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Velocidade X (Promo), 1× Poção (Promo) | Arceus ex soma 20 por Pokémon no Banco e ignora as Condições Especiais; com um Arceus em jogo, cada Crobat dá 30 no Ativo rival por turno. Encha o Banco e deixe os morcegos trabalharem. |
| **Garchomp ex e Lucario** `meta-garchomp-ex-lucario` | Meta | A2a | Lutador | Intermediária | Garchomp ex | 2× Gible (Promo), 2× Gabite, 2× Garchomp ex, 2× Riolu, 2× Lucario, 2× Doce Raro, 2× Cynthia, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Velocidade X (Promo) | Lucario no Banco soma 20 a cada ataque Lutador; Garchomp ex escolhe o alvo com Ataque Linear e fecha com Garra de Dragão. Cynthia dá mais 50 no turno decisivo. |
| **Solgaleo ex e Skarmory ex** `meta-solgaleo-ex-skarmory-ex` | Meta | A3 | Metálico | Intermediária | Solgaleo ex | 2× Cosmog (Promo), 2× Cosmoem, 2× Solgaleo ex, 2× Skarmory ex, 2× Doce Raro, 1× Dawn, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Sabrina, 2× Poção (Promo), 1× Avental de Aço | Solgaleo ex no Banco troca de lugar com o Ativo sem custo (Caminho Ascendente): recue de graça e ataque com quem estiver pronto. Skarmory ex segura a frente enquanto o Cosmog evolui. |
| **Ultra Feras: Buzzwole ex e Pheromosa** `meta-buzzwole-ex-pheromosa` | Meta | A3a | Planta | Intermediária | Buzzwole ex | 2× Buzzwole ex, 2× Pheromosa, 2× Kartana (Promo), 2× Bestita, 1× Muralha das Feras, 2× Lusamine, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina, 2× Giovanni, 1× Velocidade X (Promo), 1× Poção (Promo) | Pheromosa fere o Banco por uma Energia e Buzzwole ex bate 120 em turnos alternados. Bestita cresce a cada ponto seu; Lusamine devolve Energias quando o rival marca. |
| **Tapu Koko ex e Pikachu ex** `meta-tapu-koko-ex-pikachu-ex` | Meta | A3a | Elétrico | Iniciante | Tapu Koko ex (Promo) | 2× Tapu Koko ex (Promo), 2× Pikachu ex, 2× Oricorio, 2× Cabo Elétrico, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina, 2× Giovanni, 2× Velocidade X (Promo), 2× Poção (Promo), 1× Cartão Vermelho (Promo) | Tapu Koko ex se carrega sozinho com Furacão de Plasma; Pikachu ex cresce com o Banco Elétrico. Oricorio, imune a ex, atrapalha os rivais; o Cabo Elétrico salva Energias. |
| **Flareon ex e Moltres ex** `meta-flareon-ex-moltres-ex` | Meta | A3b | Fogo | Intermediária | Flareon ex | 2× Eevee ex (Promo), 1× Eevee, 2× Flareon ex, 2× Moltres ex, 2× Bolsa de Eevee, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 1× Velocidade X (Promo), 2× Poção (Promo), 1× Restos | Flareon ex reaproveita Energia de Fogo do descarte com Inflamar e bate 130; Moltres ex abastece o Banco. Eevee ex pode evoluir em qualquer forma do Eevee. |
| **Umbreon ex e Darkrai ex** `meta-umbreon-ex-darkrai-ex` | Meta | A4 | Noturno | Intermediária | Umbreon ex | 2× Eevee, 2× Umbreon ex, 2× Darkrai ex (Promo), 1× Bolsa de Eevee, 2× Pingente Sombrio, 2× Cyrus, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina, 2× Giovanni, 1× Velocidade X (Promo), 1× Poção (Promo) | Darkrai ex fere o Ativo rival a cada Energia; Umbreon ex traz para o Ativo o Pokémon ferido do Banco e termina o serviço com Presa das Trevas. |
| **Lugia ex e Ho-Oh ex** `meta-lugia-ex-ho-oh-ex` | Meta | A4 | Fogo, Água, Elétrico | Avançada | Lugia ex | 2× Lugia ex, 2× Ho-Oh ex, 1× Raikou ex, 1× Suicune ex, 2× Troca Elemental, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 1× Velocidade X (Promo), 2× Poção (Promo), 1× Leaf, 1× Capa Gigante | Ho-Oh ex distribui uma Energia de Fogo, Água e Elétrica pelo Banco de uma vez; Lugia ex descarrega a Explosão Elemental de 180. Raikou ex e Suicune ex compram cartas enquanto seguram o Ativo. |
| **Suicune ex e Greninja** `meta-suicune-ex-greninja` | Meta | A4a | Água | Intermediária | Suicune ex | 2× Suicune ex, 2× Froakie, 2× Frogadier, 2× Greninja, 2× Doce Raro, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Velocidade X (Promo), 2× Poção (Promo) | Suicune ex compra uma carta por turno no Ativo e bate 20 por Pokémon em qualquer Banco; Greninja tira 20 onde precisar. Bancos cheios, dos dois lados, rendem mais. |
| **Giratina ex e Darkrai ex** `meta-giratina-ex-darkrai-ex` | Meta | A4b | Psíquico, Noturno | Avançada | Giratina ex | 2× Giratina ex, 2× Darkrai ex (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Cyrus, 2× Mars, 1× Sabrina, 2× Giovanni, 2× Velocidade X (Promo), 2× Poção (Promo), 1× Capa Gigante | Giratina ex liga a própria Energia e encerra o turno; Darkrai ex fere o Ativo rival a cada Energia Noturna. Com só quatro Pokémon, a Poké Bola sempre acha um atacante; Mars aperta a mão do rival. |
| **Jardim de Venusaur** `tipo-planta-venusaur-ex` | Por tipo | A1 | Planta | Iniciante | Venusaur ex | 2× Bulbasaur, 2× Ivysaur, 2× Venusaur ex, 2× Exeggcute, 2× Exeggutor ex, 2× Doce Raro, 2× Erika, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) | Exeggutor ex ataca por uma Energia desde cedo enquanto Venusaur ex cresce no Banco; Erika cura 50 e mantém o jardim de pé. |
| **Flechas de Decidueye** `tipo-planta-decidueye-ex` | Por tipo | A3 | Planta | Intermediária | Decidueye ex | 2× Rowlet, 2× Dartrix, 2× Decidueye ex, 2× Morelull, 2× Shiinotic, 2× Doce Raro, 1× Hau, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Capa de Folha, 2× Poção (Promo) | Shiinotic adormece o Ativo rival; Decidueye ex finaliza com Perfurar a Dor em qualquer Pokémon ferido. Hau soma 30 no turno do golpe. |
| **Brasa de Arcanine** `tipo-fogo-arcanine-ex` | Por tipo | A1 | Fogo | Iniciante | Arcanine ex | 2× Growlithe, 2× Arcanine ex, 2× Ponyta, 2× Rapidash, 2× Magmar, 2× Blaine, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo), 1× Giovanni | Rapidash e Magmar atacam cedo e ficam mais fortes com Blaine (+30); Arcanine ex fecha com 120. Fogo direto e fácil de pilotar. |
| **Fúria de Incineroar** `tipo-fogo-incineroar-ex` | Por tipo | A3 | Fogo | Intermediária | Incineroar ex | 2× Litten, 2× Torracat, 2× Incineroar ex, 2× Salandit, 2× Salazzle, 2× Doce Raro, 2× Hau, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) | Incineroar ex fica mais forte machucado: Presas de Fogo queimam e o golpe carregado chega a 140. Salazzle envenena enquanto o gato evolui; Hau soma 30. |
| **Canhões de Blastoise** `tipo-agua-blastoise-ex` | Por tipo | A1 | Água | Iniciante | Blastoise ex | 2× Squirtle, 2× Wartortle, 2× Blastoise ex, 2× Lapras, 2× Doce Raro, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo), 1× Giovanni | Blastoise ex bate mais com Energia extra; Misty e Doce Raro aceleram a montagem. Lapras segura a frente enquanto o canhão carrega. |
| **Ária de Primarina** `tipo-agua-primarina-ex` | Por tipo | A3b | Água | Intermediária | Primarina ex | 2× Popplio, 2× Brionne, 2× Primarina ex, 2× Alomomola, 2× Doce Raro, 2× Misty, 1× Hau, 1× Irida, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Giovanni | Primarina ex cura 20 a cada Ária Cintilante; Irida e Misty mantêm a Água fluindo. Alomomola dá tempo para a evolução. |
| **Trovão de Raichu** `tipo-eletrico-raichu` | Por tipo | A1 | Elétrico | Iniciante | Raichu | 2× Pikachu, 2× Raichu, 2× Magnemite, 2× Magneton, 2× Electabuzz, 2× Tenente Surge, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Velocidade X (Promo), 2× Poção (Promo) | Magneton carrega Energia Elétrica sozinho no Banco; Tenente Surge passa tudo para o Raichu no Ativo, que solta o Relâmpago de 140. |
| **Farol de Lanturn** `tipo-eletrico-lanturn-ex` | Por tipo | A4 | Elétrico | Iniciante | Lanturn ex | 2× Chinchou, 2× Lanturn ex, 2× Mareep, 2× Flaaffy, 2× Ampharos, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo), 1× Giovanni | Lanturn ex paralisa ou confunde a cada ataque; Ampharos é a reserva pesada. Um deck Elétrico de controle simples. |
| **Sombras de Gengar** `tipo-psiquico-gengar-ex` | Por tipo | A1 | Psíquico | Intermediária | Gengar ex | 2× Gastly, 2× Haunter, 2× Gengar ex, 2× Misdreavus, 2× Mismagius ex, 2× Doce Raro, 1× Sabrina, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo) | Gengar ex impede o rival de usar Apoiadores enquanto estiver no Ativo; Mismagius ex confunde. Um deck Psíquico de controle. |
| **Eclipse de Lunala** `tipo-psiquico-lunala-ex` | Por tipo | A3 | Psíquico | Intermediária | Lunala ex | 2× Cosmog (Promo), 2× Cosmoem, 2× Lunala ex, 2× Mewtwo ex, 2× Doce Raro, 2× Tábua Mítica, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina, 1× Giovanni, 2× Poção (Promo) | Lunala ex move as Energias Psíquicas do Banco para o Ativo: Mewtwo ex ataca com Psicoimpulso no turno em que entra. A Tábua Mítica acha os Pokémon Psíquicos. |
| **Força de Machamp** `tipo-lutador-machamp-ex` | Por tipo | A1 | Lutador | Iniciante | Machamp ex | 2× Machop, 2× Machoke, 2× Machamp ex, 2× Hitmonlee, 2× Hitmonchan, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Giovanni, 1× Sabrina | Hitmonchan e Hitmonlee atacam por pouca Energia enquanto Machamp ex se prepara para o Megassoco de 120. |
| **Presas de Lycanroc** `tipo-lutador-lycanroc-ex` | Por tipo | A3a | Lutador | Intermediária | Lycanroc ex | 2× Rockruff, 2× Lycanroc ex, 2× Riolu, 2× Lucario, 1× Passimian ex, 1× Montanhista, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 2× Poção (Promo), 1× Capacete Rochoso | Lycanroc ex morde 130 e Lucario soma 20 a cada golpe Lutador; Passimian ex passa as Energias adiante quando cai. |
| **Reis Venenosos** `tipo-noturno-nidoking` | Por tipo | A1 | Noturno | Iniciante | Nidoking | 2× Nidoran♂, 2× Nidorino, 2× Nidoking, 2× Nidoran♀, 2× Nidorina, 2× Nidoqueen, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) | Nidoqueen e Nidoking crescem juntos e desgastam o Ativo rival. Doce Raro encurta a espera pelas formas finais. |
| **Neblina de Koga** `tipo-noturno-koga` | Por tipo | A1 | Noturno | Iniciante | Weezing | 2× Koffing, 2× Weezing, 2× Ekans, 2× Arbok, 2× Grimer, 2× Muk, 2× Koga, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) | Weezing e Muk envenenam; Arbok prende o rival no lugar. Koga devolve o Ativo ferido à mão para jogá-lo de novo, inteiro. |
| **Martelo de Tinkaton** `tipo-metal-tinkaton-ex` | Por tipo | A4b | Metálico | Iniciante | Tinkaton ex | 2× Tinkatink, 2× Tinkatuff, 2× Tinkaton ex, 2× Mawile, 2× Klefki, 2× Doce Raro, 2× Avental de Aço, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Giovanni | Tinkaton ex martela 80, e 160 com cara na moeda; o Avental de Aço tira 10 de cada golpe e afasta as Condições Especiais. |
| **Muralha de Aggron** `tipo-metal-aggron` | Por tipo | A3a | Metálico | Iniciante | Aggron | 2× Aron, 2× Lairon, 2× Aggron, 2× Bronzor, 2× Bronzong, 2× Doce Raro, 1× Adaman, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Avental de Aço | Metal paciente: Bronzong e Lairon aguentam, Aggron derruba. Adaman tira 20 de cada ataque no turno do rival. |
| **Voo de Dragonite** `tipo-dragao-dragonite-ex` | Por tipo | A3b | Água, Elétrico | Intermediária | Dragonite ex | 2× Dratini, 2× Dragonair, 2× Dragonite ex, 1× Lapras, 1× Zapdos, 2× Doce Raro, 2× Troca Elemental, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Giovanni, 1× Velocidade X (Promo) | Dragonite ex bate 180 com Água, Eletricidade e mais uma Energia; a Troca Elemental move a Energia do Banco para o Ativo. Lapras e Zapdos seguram até lá. |
| **Soneca de Snorlax** `tipo-incolor-snorlax-ex` | Por tipo | A3b | Metálico | Iniciante | Snorlax ex | 2× Snorlax ex, 2× Kangaskhan, 2× Lickitung, 2× Lickilicky ex, 2× Farfetch'd, 2× Restos, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Giovanni, 1× Velocidade X (Promo) | Snorlax ex cura 20 no Ativo a cada turno e bate 130; os Restos curam mais. Lickilicky ex e Kangaskhan aproveitam qualquer Energia: troque o tipo à vontade. |
| **Greninja e Druddigon** `comunidade-greninja-druddigon` | Comunidade | A1a | Água | Intermediária | Greninja | 2× Froakie, 2× Frogadier, 2× Greninja, 2× Druddigon, 2× Doce Raro, 2× Misty, 2× Capa Gigante, 2× Capacete Rochoso, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) | Druddigon no Ativo devolve 20 a cada golpe; com o Capacete Rochoso, 40. Greninja tira 20 por turno de onde quiser. Vença pelo desgaste. |
| **Cabeçada de Rampardos** `comunidade-rampardos` | Comunidade | A2 | Lutador | Intermediária | Rampardos | 2× Fóssil Crânio, 2× Cranidos, 2× Rampardos, 2× Riolu, 2× Lucario, 1× Montanhista, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Sabrina, 1× Poção (Promo), 1× Velocidade X (Promo) | Rampardos bate 130 por uma única Energia Lutadora; com Lucario no Banco, 150. O Fóssil Crânio abre o caminho. |
| **Ímã de Magnezone** `comunidade-magnezone` | Comunidade | A2 | Elétrico | Intermediária | Magnezone | 2× Magnemite, 2× Magneton, 2× Magnezone, 2× Pachirisu ex, 1× Voltorb, 1× Electrode, 2× Doce Raro, 1× Cabo Elétrico, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Velocidade X (Promo), 1× Giovanni | Magneton liga Energia sozinho e evolui no Magnezone de 110; Pachirisu ex com o Cabo Elétrico bate 80 por duas Energias. |
| **Canção de Wigglytuff** `comunidade-wigglytuff-ex` | Comunidade | A1 | Psíquico | Iniciante | Wigglytuff ex | 2× Jigglypuff, 2× Wigglytuff ex, 2× Chansey, 2× Blissey, 2× Restos, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Velocidade X (Promo), 1× Giovanni, 1× Sabrina | Wigglytuff ex bate 80 por três Energias quaisquer; Blissey aguenta qualquer golpe e os Restos curam no Ativo. Toda Energia serve: troque o tipo à vontade. |
| **Fadas de Sylveon** `comunidade-sylveon-espeon` | Comunidade | A3b | Psíquico | Iniciante | Sylveon ex | 2× Eevee ex (Promo), 2× Eevee, 2× Sylveon ex, 2× Espeon ex, 2× Bolsa de Eevee, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Sabrina, 1× Giovanni, 1× Velocidade X (Promo), 1× Restos | Sylveon ex compra duas cartas ao evoluir; Espeon ex cura 30 por turno no Ativo. A Bolsa de Eevee reforça toda a família. |
| **Cães Lendários** `comunidade-caes-lendarios` | Comunidade | A4a | Fogo, Água, Elétrico | Intermediária | Entei ex (Promo) | 2× Entei ex (Promo), 2× Suicune ex, 2× Raikou ex, 2× Troca Elemental, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Velocidade X (Promo), 2× Giovanni, 1× Sabrina, 1× Lyra | Entei ex, Suicune ex e Raikou ex compram uma carta por turno no Ativo (Pulso Lendário); a Troca Elemental e Lyra giram o trio sem perder Energia. |
| **Rolo Compressor de Golem** `comunidade-golem-brock` | Comunidade | A1a | Lutador | Iniciante | Golem | 2× Geodude, 2× Graveler, 2× Golem, 2× Onix, 2× Brock, 2× Doce Raro, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Giovanni, 1× Sabrina | Brock liga Energia extra ao Golem e ao Onix; Golem pressiona com 120 e toma 30 a menos no turno seguinte. |
| **Fortaleza de Shuckle** `comunidade-shuckle-ex` | Comunidade | A4 | Planta | Iniciante | Shuckle ex | 2× Shuckle ex, 2× Pinsir, 2× Scyther, 2× Heracross, 2× Capa de Folha, 2× Erika, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Giovanni, 1× Sabrina | Shuckle ex toma 20 a menos de cada golpe e, com a Capa de Folha, chega a 150 PS: insetos que apanham pouco e batem por uma Energia. |
| **Enguias de Wugtrio** `comunidade-wugtrio-ex` | Comunidade | A4b | Água | Iniciante | Wugtrio ex | 2× Wiglett, 2× Wugtrio ex, 2× Palkia ex, 1× Manaphy (Promo), 2× Misty, 1× Cyrus, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo), 2× Giovanni, 1× Sabrina | Wugtrio ex escolhe três alvos ao acaso e dá 50 em cada: ótimo contra Bancos frágeis. Palkia ex varre 20 de cada Pokémon do Banco rival. |
| **Enxame de Beedrill** `comunidade-beedrill-ex` | Comunidade | A4b | Planta | Iniciante | Beedrill ex | 2× Weedle, 2× Kakuna, 2× Beedrill ex, 2× Combee, 2× Vespiquen, 2× Doce Raro, 1× Erika, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Giovanni | Beedrill ex descarta uma Energia do Ativo rival a cada Lança Esmagadora; Vespiquen cresce com as abelhas que caem. |
| **Punho d'Água de Poliwrath** `comunidade-poliwrath-ex` | Comunidade | A4a | Lutador, Água | Intermediária | Poliwrath ex | 2× Poliwag, 2× Poliwhirl, 2× Poliwrath ex, 2× Hitmonlee, 2× Doce Raro, 1× Troca Elemental, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Giovanni, 1× Sabrina | Poliwrath ex soma 40 com qualquer Energia de Água ligada: misture Lutador e Água na Zona. Hitmonlee alcança o Banco enquanto a evolução sobe. |
| **Tempestade de Kingdra** `comunidade-kingdra-ex` | Comunidade | A4 | Água | Iniciante | Kingdra ex | 2× Horsea, 2× Seadra, 2× Kingdra ex, 2× Remoraid, 2× Octillery, 2× Doce Raro, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Giovanni | Kingdra ex prende o Defensor no lugar e bate 90 por duas Energias; Octillery dá cobertura enquanto o Horsea evolui. |
| **Veneno Duplo** `comunidade-crobat-ex-clodsire` | Comunidade | A4 | Noturno | Intermediária | Crobat ex | 2× Zubat, 2× Golbat, 2× Crobat ex, 2× Wooper de Paldea, 2× Clodsire de Paldea ex, 2× Doce Raro, 2× Farpa Venenosa, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Poção (Promo) | Crobat ex e a Farpa Venenosa envenenam; Paldean Clodsire ex bate 120 em quem estiver envenenado. |
| **Rolo de Donphan** `comunidade-donphan-ex` | Comunidade | A4 | Lutador | Iniciante | Donphan ex | 2× Phanpy, 2× Donphan ex, 2× Sudowoodo, 2× Hitmonlee, 2× Montanhista, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Giovanni, 1× Sabrina, 1× Capacete Rochoso | Donphan ex bate 110 com duas Energias extras; Sudowoodo e Hitmonlee seguram a frente enquanto ele carrega. |
| **Castor Teimoso** `comunidade-bibarel-ex` | Comunidade | A4b | Lutador | Iniciante | Bibarel ex | 2× Bidoof, 2× Bibarel ex, 1× Snorlax ex, 2× Kangaskhan (Promo), 1× Tauros, 2× Restos, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Giovanni, 1× Sabrina, 1× Velocidade X (Promo) | Bibarel ex bate 100 e cura 30 por ataque; Kangaskhan pune evoluções. Toda Energia serve: troque o tipo à vontade. |

## 🤖 7. Decks de NPC por nó e dificuldade

STANDARD é a lista autoral; STORY reduz em uma cópia cada peça de sinergia (Estágio 2, ex, Apoiadores) e completa com Básicos e cartas simples; EXPERT aplica trocas autorais de consistência.

| Nó | Dificuldade | Deck | Energia | Básicos | ex/Mega | Lista |
|---|---|---|---|---:|---:|---|
| P00-T06 | História | `npc-p00-t06-v1` | Fogo | 8 | 0 | 2× Charmander, 1× Charmeleon, 2× Ponyta, 1× Rapidash, 2× Growlithe, 2× Pidgey, 2× Poção (Promo), 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Lupa de Mão (Promo) |
| P00-T06 | Padrão | `npc-p00-t06-v1` | Fogo | 8 | 0 | 2× Charmander, 1× Charmeleon, 2× Ponyta, 1× Rapidash, 2× Growlithe, 2× Pidgey, 2× Poção (Promo), 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Lupa de Mão (Promo) |
| P00-T06 | Especialista | `npc-p00-t06-v1` | Fogo | 8 | 0 | 2× Charmander, 1× Charmeleon, 2× Ponyta, 1× Rapidash, 2× Growlithe, 2× Pidgey, 2× Poção (Promo), 2× Poké Bola (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Lupa de Mão (Promo) |
| C01-E01 | História | `npc-c01-e01-story-v1` | Planta | 13 | 0 | 2× Oddish, 2× Bellsprout, 2× Paras, 2× Tangela, 2× Bulbasaur, 2× Scyther, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Lupa de Mão (Promo), 1× Rattata |
| C01-E01 | Padrão | `npc-c01-e01-standard-v1` | Planta | 12 | 0 | 2× Oddish, 2× Bellsprout, 2× Paras, 2× Tangela, 2× Bulbasaur, 2× Scyther, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Lupa de Mão (Promo) |
| C01-E01 | Especialista | `npc-c01-e01-expert-v1` | Planta | 10 | 0 | 2× Oddish, 2× Bellsprout, 2× Paras, 2× Tangela, 2× Bulbasaur, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Erika, 2× Gloom |
| C01-E03 | História | `npc-c01-e03-story-v1` | Planta | 9 | 0 | 2× Oddish, 2× Gloom, 2× Bellsprout, 2× Weepinbell, 2× Tangela, 2× Paras, 1× Erika, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Rattata |
| C01-E03 | Padrão | `npc-c01-e03-standard-v1` | Planta | 6 | 0 | 2× Oddish, 2× Gloom, 2× Bellsprout, 2× Weepinbell, 1× Tangela, 1× Paras, 2× Erika, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni |
| C01-E03 | Especialista | `npc-c01-e03-expert-v1` | Planta | 4 | 0 | 2× Oddish, 2× Gloom, 2× Bellsprout, 2× Weepinbell, 2× Erika, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni, 1× Vileplume, 1× Victreebel |
| C01-E05 | História | `npc-c01-e05-story-v1` | Planta | 6 | 0 | 2× Petilil, 2× Lilligant, 2× Skiddo, 2× Gogoat, 2× Exeggcute, 2× Exeggutor, 1× Erika, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Velocidade X (Promo), 2× Poké Bola (Promo) |
| C01-E05 | Padrão | `npc-c01-e05-standard-v1` | Planta | 6 | 0 | 2× Petilil, 2× Lilligant, 2× Skiddo, 2× Gogoat, 2× Exeggcute, 2× Exeggutor, 2× Erika, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Velocidade X (Promo) |
| C01-E05 | Especialista | `npc-c01-e05-expert-v1` | Planta | 6 | 1 | 2× Petilil, 2× Lilligant, 2× Skiddo, 2× Gogoat, 2× Exeggcute, 2× Exeggutor, 2× Erika, 1× Poção (Promo), 2× Pesquisa do Professor (Promo), 1× Velocidade X (Promo), 1× Exeggutor ex, 1× Poké Bola (Promo) |
| C01-E06 | História | `npc-c01-e06-story-v1` | Planta | 6 | 0 | 2× Bulbasaur, 2× Ivysaur, 1× Venusaur, 2× Oddish, 2× Gloom, 1× Vileplume, 2× Petilil, 2× Lilligant, 1× Erika, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C01-E06 | Padrão | `npc-c01-e06-standard-v1` | Planta | 6 | 0 | 2× Bulbasaur, 2× Ivysaur, 1× Venusaur, 2× Oddish, 2× Gloom, 1× Vileplume, 2× Petilil, 2× Lilligant, 2× Erika, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C01-E06 | Especialista | `npc-c01-e06-expert-v1` | Planta | 6 | 0 | 2× Bulbasaur, 2× Ivysaur, 1× Venusaur, 2× Oddish, 2× Gloom, 2× Vileplume, 2× Petilil, 1× Lilligant, 2× Erika, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Poção (Promo) |
| C02-E01 | História | `npc-c02-e01-story-v1` | Água | 9 | 0 | 2× Staryu, 2× Starmie, 2× Seel, 2× Dewgong, 2× Shellder, 2× Cloyster, 2× Krabby, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Rattata |
| C02-E01 | Padrão | `npc-c02-e01-standard-v1` | Água | 8 | 0 | 2× Staryu, 2× Starmie, 2× Seel, 2× Dewgong, 2× Shellder, 2× Cloyster, 2× Krabby, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C02-E01 | Especialista | `npc-c02-e01-expert-v1` | Água | 8 | 0 | 2× Staryu, 2× Starmie, 2× Seel, 2× Dewgong, 2× Shellder, 2× Cloyster, 2× Krabby, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Kingler |
| C02-E03 | História | `npc-c02-e03-story-v1` | Água | 6 | 0 | 2× Psyduck, 2× Golduck, 2× Horsea, 2× Seadra, 2× Squirtle, 2× Wartortle, 1× Misty, 2× Poção (Promo), 2× Velocidade X (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C02-E03 | Padrão | `npc-c02-e03-standard-v1` | Água | 6 | 0 | 2× Psyduck, 2× Golduck, 2× Horsea, 2× Seadra, 2× Squirtle, 2× Wartortle, 2× Misty, 2× Poção (Promo), 2× Velocidade X (Promo), 2× Pesquisa do Professor (Promo) |
| C02-E03 | Especialista | `npc-c02-e03-expert-v1` | Água | 6 | 0 | 2× Psyduck, 2× Golduck, 2× Horsea, 2× Seadra, 2× Squirtle, 2× Wartortle, 2× Misty, 1× Poção (Promo), 1× Velocidade X (Promo), 2× Pesquisa do Professor (Promo), 1× Sabrina, 1× Blastoise |
| C02-E05 | História | `npc-c02-e05-story-v1` | Água | 9 | 0 | 2× Tentacool, 2× Tentacruel, 2× Goldeen, 2× Seaking, 2× Krabby, 1× Kingler, 2× Lapras, 1× Sabrina, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Rattata |
| C02-E05 | Padrão | `npc-c02-e05-standard-v1` | Água | 7 | 0 | 2× Tentacool, 2× Tentacruel, 2× Goldeen, 2× Seaking, 2× Krabby, 1× Kingler, 1× Lapras, 2× Sabrina, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C02-E05 | Especialista | `npc-c02-e05-expert-v1` | Água | 9 | 0 | 2× Tentacool, 2× Tentacruel, 2× Goldeen, 2× Seaking, 2× Krabby, 1× Kingler, 2× Lapras, 2× Sabrina, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Poção (Promo), 1× Articuno |
| C02-E06 | História | `npc-c02-e06-story-v1` | Água | 6 | 0 | 2× Squirtle, 2× Wartortle, 1× Blastoise, 2× Staryu, 2× Starmie, 2× Froakie, 2× Frogadier, 1× Greninja, 1× Misty, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C02-E06 | Padrão | `npc-c02-e06-standard-v1` | Água | 6 | 0 | 2× Squirtle, 2× Wartortle, 1× Blastoise, 2× Staryu, 2× Starmie, 2× Froakie, 2× Frogadier, 1× Greninja, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C02-E06 | Especialista | `npc-c02-e06-expert-v1` | Água | 6 | 0 | 2× Squirtle, 2× Wartortle, 2× Blastoise, 1× Staryu, 2× Starmie, 2× Froakie, 2× Frogadier, 1× Greninja, 2× Misty, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Lapras |
| C03-E01 | História | `npc-c03-e01-story-v1` | Elétrico | 11 | 0 | 2× Pikachu, 2× Magnemite, 2× Voltorb, 2× Electrode, 2× Blitzle, 2× Zebstrika, 2× Electabuzz, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Rattata |
| C03-E01 | Padrão | `npc-c03-e01-standard-v1` | Elétrico | 10 | 0 | 2× Pikachu, 2× Magnemite, 2× Voltorb, 2× Electrode, 2× Blitzle, 2× Zebstrika, 2× Electabuzz, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C03-E01 | Especialista | `npc-c03-e01-expert-v1` | Elétrico | 10 | 0 | 2× Pikachu, 2× Magnemite, 2× Voltorb, 2× Electrode, 2× Blitzle, 2× Zebstrika, 2× Electabuzz, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Raichu |
| C03-E03 | História | `npc-c03-e03-story-v1` | Elétrico | 8 | 0 | 2× Magnemite, 2× Magneton, 2× Pikachu, 1× Raichu, 2× Voltorb, 2× Electrode, 2× Helioptile, 1× Heliolisk, 1× Tenente Surge, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C03-E03 | Padrão | `npc-c03-e03-standard-v1` | Elétrico | 8 | 0 | 2× Magnemite, 2× Magneton, 2× Pikachu, 1× Raichu, 2× Voltorb, 2× Electrode, 2× Helioptile, 1× Heliolisk, 2× Tenente Surge, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C03-E03 | Especialista | `npc-c03-e03-expert-v1` | Elétrico | 8 | 0 | 2× Magnemite, 2× Magneton, 2× Pikachu, 2× Raichu, 2× Voltorb, 2× Electrode, 1× Helioptile, 2× Tenente Surge, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Zapdos |
| C03-E05 | História | `npc-c03-e05-story-v1` | Elétrico | 9 | 0 | 2× Tynamo, 2× Eelektrik, 1× Eelektross, 2× Pincurchin, 2× Blitzle, 2× Zebstrika, 2× Electabuzz, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo), 1× Rattata |
| C03-E05 | Padrão | `npc-c03-e05-standard-v1` | Elétrico | 8 | 0 | 2× Tynamo, 2× Eelektrik, 1× Eelektross, 2× Pincurchin, 2× Blitzle, 2× Zebstrika, 2× Electabuzz, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Velocidade X (Promo) |
| C03-E05 | Especialista | `npc-c03-e05-expert-v1` | Elétrico | 9 | 0 | 2× Tynamo, 2× Eelektrik, 2× Eelektross, 2× Pincurchin, 2× Blitzle, 2× Zebstrika, 2× Electabuzz, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Zapdos |
| C03-E06 | História | `npc-c03-e06-story-v1` | Elétrico | 9 | 0 | 2× Magnemite, 2× Magneton, 2× Pikachu, 2× Raichu, 2× Zapdos, 2× Electabuzz, 1× Tenente Surge, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 2× Poção (Promo), 1× Rattata |
| C03-E06 | Padrão | `npc-c03-e06-standard-v1` | Elétrico | 8 | 0 | 2× Magnemite, 2× Magneton, 2× Pikachu, 2× Raichu, 2× Zapdos, 2× Electabuzz, 2× Tenente Surge, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Giovanni |
| C03-E06 | Especialista | `npc-c03-e06-expert-v1` | Elétrico | 8 | 1 | 2× Magnemite, 2× Magneton, 2× Pikachu, 2× Raichu, 2× Zapdos, 1× Electabuzz, 2× Tenente Surge, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Giovanni, 1× Pikachu ex, 1× Poção (Promo) |
| C04-E01 | História | `npc-c04-e01-story-v1` | Noturno, Psíquico | 9 | 0 | 2× Koffing, 2× Weezing, 2× Grimer, 1× Muk, 2× Gastly, 2× Haunter, 2× Ekans, 1× Arbok, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Rattata |
| C04-E01 | Padrão | `npc-c04-e01-standard-v1` | Noturno, Psíquico | 8 | 0 | 2× Koffing, 2× Weezing, 2× Grimer, 1× Muk, 2× Gastly, 2× Haunter, 2× Ekans, 1× Arbok, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C04-E01 | Especialista | `npc-c04-e01-expert-v1` | Noturno, Psíquico | 8 | 0 | 2× Koffing, 2× Weezing, 2× Grimer, 2× Muk, 2× Gastly, 2× Haunter, 2× Ekans, 1× Arbok, 1× Poção (Promo), 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Gengar |
| C04-E03 | História | `npc-c04-e03-story-v1` | Psíquico | 10 | 0 | 2× Drowzee, 2× Hypno, 2× Jigglypuff, 1× Wigglytuff, 2× Clefairy, 2× Clefable, 2× Jynx, 2× Mr. Mime, 2× Poção (Promo), 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C04-E03 | Padrão | `npc-c04-e03-standard-v1` | Psíquico | 9 | 0 | 2× Drowzee, 2× Hypno, 2× Jigglypuff, 1× Wigglytuff, 2× Clefairy, 2× Clefable, 2× Jynx, 1× Mr. Mime, 2× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C04-E03 | Especialista | `npc-c04-e03-expert-v1` | Psíquico | 9 | 1 | 2× Drowzee, 2× Hypno, 2× Jigglypuff, 2× Clefairy, 2× Clefable, 2× Jynx, 1× Mr. Mime, 1× Poção (Promo), 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Wigglytuff ex, 1× Sabrina |
| C04-E05 | História | `npc-c04-e05-story-v1` | Noturno, Psíquico | 8 | 0 | 2× Koffing, 2× Weezing, 2× Drowzee, 2× Hypno, 2× Gastly, 2× Haunter, 1× Gengar, 2× Grimer, 1× Koga, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo) |
| C04-E05 | Padrão | `npc-c04-e05-standard-v1` | Noturno, Psíquico | 8 | 0 | 2× Koffing, 2× Weezing, 2× Drowzee, 2× Hypno, 2× Gastly, 2× Haunter, 1× Gengar, 2× Grimer, 1× Koga, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C04-E05 | Especialista | `npc-c04-e05-expert-v1` | Noturno, Psíquico | 8 | 0 | 2× Koffing, 2× Weezing, 2× Drowzee, 2× Hypno, 2× Gastly, 2× Haunter, 2× Gengar, 2× Grimer, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Muk |
| C04-E06 | História | `npc-c04-e06-story-v1` | Psíquico | 8 | 0 | 2× Ralts, 2× Kirlia, 1× Gardevoir, 2× Gastly, 2× Haunter, 1× Gengar, 2× Mewtwo, 2× Drowzee, 1× Hypno, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina, 1× Poção (Promo) |
| C04-E06 | Padrão | `npc-c04-e06-standard-v1` | Psíquico | 7 | 0 | 2× Ralts, 2× Kirlia, 2× Gardevoir, 2× Gastly, 2× Haunter, 1× Gengar, 2× Mewtwo, 1× Drowzee, 1× Hypno, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina |
| C04-E06 | Especialista | `npc-c04-e06-expert-v1` | Psíquico | 8 | 2 | 2× Ralts, 2× Kirlia, 2× Gardevoir, 2× Gastly, 2× Haunter, 1× Gengar, 2× Mewtwo, 1× Drowzee, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Gengar ex, 1× Mewtwo ex |
| C05-E01 | História | `npc-c05-e01-story-v1` | Lutador | 10 | 0 | 2× Machop, 2× Machoke, 2× Hitmonchan, 2× Hitmonlee, 2× Mankey, 2× Primeape, 1× Giovanni, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Rattata |
| C05-E01 | Padrão | `npc-c05-e01-standard-v1` | Lutador | 8 | 0 | 2× Machop, 2× Machoke, 2× Hitmonchan, 2× Hitmonlee, 2× Mankey, 2× Primeape, 2× Giovanni, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C05-E01 | Especialista | `npc-c05-e01-expert-v1` | Lutador | 8 | 0 | 2× Machop, 2× Machoke, 2× Hitmonchan, 2× Hitmonlee, 2× Mankey, 2× Primeape, 2× Giovanni, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Poção (Promo), 2× Machamp |
| C05-E03 | História | `npc-c05-e03-story-v1` | Lutador | 8 | 0 | 2× Geodude, 2× Graveler, 1× Golem, 2× Onix, 2× Rhyhorn, 1× Rhydon, 2× Sandshrew, 2× Sandslash, 1× Brock, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C05-E03 | Padrão | `npc-c05-e03-standard-v1` | Lutador | 8 | 0 | 2× Geodude, 2× Graveler, 1× Golem, 2× Onix, 2× Rhyhorn, 1× Rhydon, 2× Sandshrew, 2× Sandslash, 2× Brock, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| C05-E03 | Especialista | `npc-c05-e03-expert-v1` | Lutador | 8 | 0 | 2× Geodude, 2× Graveler, 2× Golem, 2× Onix, 2× Rhyhorn, 2× Rhydon, 2× Sandshrew, 1× Sandslash, 2× Brock, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo) |
| C05-E05 | História | `npc-c05-e05-story-v1` | Metálico, Lutador | 8 | 0 | 2× Meltan, 2× Melmetal, 2× Mawile, 2× Pawniard, 2× Bisharp, 2× Cubone, 2× Marowak, 1× Giovanni, 1× Pesquisa do Professor (Promo), 2× Poção (Promo), 2× Poké Bola (Promo) |
| C05-E05 | Padrão | `npc-c05-e05-standard-v1` | Metálico, Lutador | 8 | 0 | 2× Meltan, 2× Melmetal, 2× Mawile, 2× Pawniard, 2× Bisharp, 2× Cubone, 2× Marowak, 2× Giovanni, 2× Pesquisa do Professor (Promo), 2× Poção (Promo) |
| C05-E05 | Especialista | `npc-c05-e05-expert-v1` | Metálico, Lutador | 8 | 1 | 2× Meltan, 2× Melmetal, 1× Mawile, 2× Pawniard, 2× Bisharp, 2× Cubone, 2× Marowak, 2× Giovanni, 2× Pesquisa do Professor (Promo), 1× Poção (Promo), 1× Marowak ex, 1× Hitmonchan |
| C05-E06 | História | `npc-c05-e06-story-v1` | Lutador, Metálico | 8 | 0 | 2× Machop, 2× Machoke, 1× Machamp, 2× Meltan, 2× Melmetal, 2× Onix, 2× Hitmonchan, 1× Giovanni, 1× Brock, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C05-E06 | Padrão | `npc-c05-e06-standard-v1` | Lutador, Metálico | 6 | 0 | 2× Machop, 2× Machoke, 2× Machamp, 2× Meltan, 2× Melmetal, 1× Onix, 1× Hitmonchan, 2× Giovanni, 1× Brock, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo) |
| C05-E06 | Especialista | `npc-c05-e06-expert-v1` | Lutador, Metálico | 5 | 1 | 2× Machop, 2× Machoke, 2× Machamp, 2× Meltan, 2× Melmetal, 1× Hitmonchan, 2× Giovanni, 1× Brock, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Machamp ex, 1× Velocidade X (Promo) |
| C06-E01 | História | `npc-c06-e01-story-v1` | Lutador | 11 | 0 | 2× Hitmonlee, 2× Hitmonchan, 2× Mankey, 2× Primeape, 2× Clobbopus, 2× Grapploct, 2× Farfetch'd, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 1× Rattata |
| C06-E01 | Padrão | `npc-c06-e01-standard-v1` | Lutador | 10 | 0 | 2× Hitmonlee, 2× Hitmonchan, 2× Mankey, 2× Primeape, 2× Clobbopus, 2× Grapploct, 2× Farfetch'd, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C06-E01 | Especialista | `npc-c06-e01-expert-v1` | Lutador | 11 | 0 | 2× Hitmonlee, 2× Hitmonchan, 2× Mankey, 2× Primeape, 2× Clobbopus, 2× Grapploct, 2× Farfetch'd, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sandshrew, 1× Sandslash |
| C06-E03 | História | `npc-c06-e03-story-v1` | Fogo | 9 | 1 | 2× Growlithe, 1× Arcanine ex, 2× Vulpix, 2× Ninetales, 2× Ponyta, 2× Rapidash, 1× Blaine, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Rattata, 1× Pidgey |
| C06-E03 | Padrão | `npc-c06-e03-standard-v1` | Fogo | 6 | 2 | 2× Growlithe, 2× Arcanine ex, 2× Vulpix, 2× Ninetales, 2× Ponyta, 2× Rapidash, 2× Blaine, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| C06-E03 | Especialista | `npc-c06-e03-expert-v1` | Fogo | 7 | 3 | 2× Growlithe, 2× Arcanine ex, 2× Vulpix, 2× Ninetales, 2× Ponyta, 1× Rapidash, 2× Blaine, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo), 1× Moltres ex, 1× Arcanine |
| C06-E05 | História | `npc-c06-e05-story-v1` | Lutador | 8 | 2 | 2× Cubone, 1× Marowak ex, 2× Machop, 2× Machoke, 1× Machamp ex, 2× Diglett, 2× Dugtrio, 1× Giovanni, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Rattata |
| C06-E05 | Padrão | `npc-c06-e05-standard-v1` | Lutador | 6 | 3 | 2× Cubone, 2× Marowak ex, 2× Machop, 2× Machoke, 1× Machamp ex, 2× Diglett, 2× Dugtrio, 2× Giovanni, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo) |
| C06-E05 | Especialista | `npc-c06-e05-expert-v1` | Lutador | 6 | 4 | 2× Cubone, 2× Marowak ex, 2× Machop, 2× Machoke, 2× Machamp ex, 2× Diglett, 2× Dugtrio, 2× Giovanni, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Sabrina |
| C06-E06 | História | `npc-c06-e06-story-v1` | Psíquico, Água | 9 | 3 | 1× Mewtwo ex, 2× Ralts, 2× Kirlia, 1× Gardevoir, 1× Articuno ex, 2× Staryu, 1× Starmie ex, 1× Misty, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina, 2× Poção (Promo), 2× Rattata, 1× Pidgey |
| C06-E06 | Padrão | `npc-c06-e06-standard-v1` | Psíquico, Água | 7 | 4 | 2× Mewtwo ex, 2× Ralts, 2× Kirlia, 2× Gardevoir, 1× Articuno ex, 2× Staryu, 1× Starmie ex, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Sabrina |
| C06-E06 | Especialista | `npc-c06-e06-expert-v1` | Psíquico, Água | 8 | 6 | 2× Mewtwo ex, 2× Ralts, 2× Kirlia, 2× Gardevoir, 2× Articuno ex, 2× Staryu, 2× Starmie ex, 1× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Sabrina |
| F00-D01 | História | `npc-f00-d01-story-v1` | Planta | 8 | 2 | 2× Bulbasaur, 2× Ivysaur, 1× Venusaur ex, 2× Petilil, 2× Lilligant, 2× Exeggcute, 1× Exeggutor ex, 2× Weedle, 1× Kakuna, 1× Erika, 1× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 2× Poção (Promo) |
| F00-D01 | Padrão | `npc-f00-d01-standard-v1` | Planta | 8 | 2 | 2× Bulbasaur, 2× Ivysaur, 1× Venusaur ex, 2× Petilil, 2× Lilligant, 2× Exeggcute, 1× Exeggutor ex, 2× Weedle, 1× Kakuna, 2× Erika, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo) |
| F00-D01 | Especialista | `npc-f00-d01-expert-v1` | Planta | 7 | 4 | 2× Bulbasaur, 2× Ivysaur, 2× Venusaur ex, 2× Petilil, 2× Lilligant, 2× Exeggcute, 2× Exeggutor ex, 1× Weedle, 1× Kakuna, 2× Erika, 2× Pesquisa do Professor (Promo) |
| F00-D02 | História | `npc-f00-d02-story-v1` | Fogo, Água | 6 | 2 | 2× Charmander, 2× Charmeleon, 1× Charizard ex, 2× Squirtle, 2× Wartortle, 1× Blastoise ex, 2× Vulpix, 1× Ninetales, 1× Blaine, 1× Misty, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo) |
| F00-D02 | Padrão | `npc-f00-d02-standard-v1` | Fogo, Água | 6 | 2 | 2× Charmander, 2× Charmeleon, 1× Charizard ex, 2× Squirtle, 2× Wartortle, 1× Blastoise ex, 2× Vulpix, 1× Ninetales, 1× Blaine, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| F00-D02 | Especialista | `npc-f00-d02-expert-v1` | Fogo, Água | 5 | 4 | 2× Charmander, 2× Charmeleon, 2× Charizard ex, 2× Squirtle, 2× Wartortle, 2× Blastoise ex, 1× Vulpix, 1× Ninetales, 2× Misty, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo) |
| F00-D03 | História | `npc-f00-d03-story-v1` | Fogo, Planta | 8 | 2 | 2× Charmander, 2× Charmeleon, 1× Charizard ex, 1× Moltres ex, 2× Caterpie, 2× Metapod, 1× Butterfree, 1× Blaine, 1× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 2× Poção (Promo), 2× Rattata, 1× Pidgey |
| F00-D03 | Padrão | `npc-f00-d03-standard-v1` | Fogo, Planta | 5 | 3 | 2× Charmander, 2× Charmeleon, 2× Charizard ex, 1× Moltres ex, 2× Caterpie, 2× Metapod, 2× Butterfree, 2× Blaine, 2× Pesquisa do Professor (Promo), 2× Poké Bola (Promo), 1× Poção (Promo) |
| F00-D03 | Especialista | `npc-f00-d03-expert-v1` | Fogo, Planta | 6 | 4 | 2× Charmander, 2× Charmeleon, 2× Charizard ex, 2× Moltres ex, 2× Caterpie, 2× Metapod, 2× Butterfree, 2× Blaine, 2× Pesquisa do Professor (Promo), 1× Poké Bola (Promo), 1× Giovanni |

## 🗺️ 8. Campanha

| Nó | Tipo | Título | Exige | NPC | Arena | Prêmio inicial | Repetível | Carta-chave / Descoberta |
|---|---|---|---|---|---|---|---|---|
| P00-T01 ★ | Tutorial | Primeira Carta | — | lia | arena-academy | 50 Cr | — | — |
| P00-T02 ★ | Tutorial | Acender a Energia | P00-T01 | lia | arena-academy | 50 Cr | — | — |
| P00-T03 ★ | Tutorial | Preparar a Reserva | P00-T02 | lia | arena-academy | 50 Cr | — | — |
| P00-T04 ★ | Tutorial | A Próxima Forma | P00-T03 | lia | arena-academy | 50 Cr | — | — |
| P00-T05 ★ | Tutorial | Apoio no Momento Certo | P00-T04 | lia | arena-academy | 50 Cr | — | — |
| P00-T06 ★ | Tutorial | Mudar o Plano | P00-T05 | lia | arena-academy | 100 Cr + 1× pack-a1-pikachu | — | — |
| C01-E01 ★ | Duelo | Primeiras Raízes | P00-T06 | caio | arena-grove | 80 Cr + 1× pack-a1-charizard | 20 Cr | — |
| C01-E02 | Puzzle | Um Lugar no Banco | C01-E01 | iris | arena-grove | 100 Cr | — | — |
| C01-E03 ★ | Duelo | Crescimento em Dupla | C01-E01 | dora | arena-grove | 80 Cr + 1× pack-a1-charizard | 20 Cr | — |
| C01-E04 | Descoberta | O Jardim de Celadon | C01-E03 | iris | arena-grove | 0 Cr | — | Escolha 1: Vileplume / Victreebel / Kangaskhan |
| C01-E05 | Elite | Duas Copas | C01-E03 | taina | arena-grove | 160 Cr + 1× pack-a1-charizard | 30 Cr | — |
| C01-E06 ★ | Chefe | Erika, Líder de Celadon | C01-E03 | iris | arena-grove | 250 Cr + 2× pack-a1-charizard + medal-c01 + flair-c01 | 40 Cr | Erika ×2 |
| C02-E01 ★ | Duelo | Atracar | C01-E06 | rui | arena-harbor | 80 Cr + 1× pack-a1-pikachu | 20 Cr | — |
| C02-E02 | Puzzle | Passagem Livre | C02-E01 | mara | arena-harbor | 100 Cr | — | — |
| C02-E03 ★ | Duelo | Fluxo de Retorno | C02-E01 | luma | arena-harbor | 80 Cr + 1× pack-a1-pikachu | 20 Cr | — |
| C02-E04 | Descoberta | O Aquário de Sootopolis | C02-E03 | mara | arena-harbor | 0 Cr | — | Escolha 1: Blastoise / Gyarados / Omastar |
| C02-E05 | Elite | Corrente Cruzada | C02-E03 | icaro | arena-harbor | 160 Cr + 1× pack-a1-pikachu | 30 Cr | — |
| C02-E06 ★ | Chefe | Wallace, Líder de Sootopolis | C02-E03 | mara | arena-harbor | 250 Cr + 2× pack-a1-pikachu + medal-c02 + flair-c02 | 40 Cr | Misty ×2 |
| C03-E01 ★ | Duelo | Carga Inicial | C02-E06 | bia | arena-circuits | 80 Cr + 1× pack-a1-pikachu | 20 Cr | — |
| C03-E02 | Puzzle | Energia Bem Contada | C03-E01 | teo | arena-circuits | 100 Cr | — | — |
| C03-E03 ★ | Duelo | Circuito Auxiliar | C03-E01 | otto | arena-circuits | 80 Cr + 1× pack-a1-pikachu | 20 Cr | — |
| C03-E04 | Descoberta | A Oficina de Vermilion | C03-E03 | teo | arena-circuits | 0 Cr | — | Escolha 1: Raichu / Magneton / Zapdos |
| C03-E05 | Elite | Fio Desencapado | C03-E03 | vivi | arena-circuits | 160 Cr + 1× pack-a1-pikachu | 30 Cr | — |
| C03-E06 ★ | Chefe | Tenente Surge, Líder de Vermilion | C03-E03 | teo | arena-circuits | 250 Cr + 2× pack-a1-pikachu + medal-c03 + flair-c03 | 40 Cr | Tenente Surge ×2 |
| C04-E01 ★ | Duelo | Bruma Leve | C03-E06 | davi | arena-observatory | 80 Cr + 1× pack-a1-mewtwo | 20 Cr | — |
| C04-E02 | Puzzle | Depois da Meia-Volta | C04-E01 | nara | arena-observatory | 100 Cr | — | — |
| C04-E03 ★ | Duelo | Vigília | C04-E01 | lis | arena-observatory | 80 Cr + 1× pack-a1-mewtwo | 20 Cr | — |
| C04-E04 | Descoberta | As Lentes de Saffron | C04-E03 | nara | arena-observatory | 0 Cr | — | Escolha 1: Gengar / Gardevoir / Mewtwo |
| C04-E05 | Elite | Ecos Sobrepostos | C04-E03 | enzo | arena-observatory | 160 Cr + 1× pack-a1-mewtwo | 30 Cr | — |
| C04-E06 ★ | Chefe | Sabrina, Líder de Saffron | C04-E03 | nara | arena-observatory | 250 Cr + 2× pack-a1-mewtwo + medal-c04 + flair-c04 | 40 Cr | Sabrina ×2 |
| C05-E01 ★ | Duelo | Uma Camada a Mais | C04-E06 | malu | arena-foundry | 80 Cr + 1× pack-a1-charizard | 20 Cr | — |
| C05-E02 | Puzzle | O Peso da Moldura | C05-E01 | breno | arena-foundry | 100 Cr | — | — |
| C05-E03 ★ | Duelo | Terreno Compartilhado | C05-E01 | bento | arena-foundry | 80 Cr + 1× pack-a1-charizard | 20 Cr | — |
| C05-E04 | Descoberta | O Dojo de Stow-on-Side | C05-E03 | breno | arena-foundry | 0 Cr | — | Escolha 1: Machamp / Kabutops / Melmetal |
| C05-E05 | Elite | Metal de Retorno | C05-E03 | jade | arena-foundry | 160 Cr + 1× pack-a1-charizard | 30 Cr | — |
| C05-E06 ★ | Chefe | Bea, Líder de Stow-on-Side | C05-E03 | breno | arena-foundry | 250 Cr + 2× pack-a1-charizard + medal-c05 + flair-c05 | 40 Cr | Brock ×2 |
| C06-E01 ★ | Duelo | Um Ponto de Cada Vez | C05-E06 | iago | arena-archive | 80 Cr + 1× pack-a1-mewtwo | 20 Cr | — |
| C06-E02 | Puzzle | Conta de Risco | C06-E01 | sol | arena-archive | 100 Cr | — | — |
| C06-E03 ★ | Duelo | Duas Faces do Plano | C06-E01 | clara | arena-archive | 80 Cr + 1× pack-a1-mewtwo | 20 Cr | — |
| C06-E04 | Descoberta | A Sala de Troféus de Viridian | C06-E03 | sol | arena-archive | 0 Cr | — | Escolha 1: Dragonite / Pidgeot / Aerodactyl |
| C06-E05 | Elite | Ápice de Dois Pontos | C06-E03 | nico | arena-archive | 160 Cr + 1× pack-a1-mewtwo | 30 Cr | — |
| C06-E06 ★ | Chefe | Blue, Líder de Viridian | C06-E03 | sol | arena-archive | 250 Cr + 2× pack-a1-mewtwo + medal-c06 + flair-c06 | 40 Cr | Escolha: Charizard ex / Pikachu ex / Blastoise ex ×2 |
| F00-D01 ★ | Final | Cheren, Exame de Retorno | C06-E06 | lia | arena-final | 300 Cr + 1× pack-a1-charizard + 1× pack-a1-mewtwo | 40 Cr | — |
| F00-D02 ★ | Final | Revanche de Blue | F00-D01 | sol | arena-final | 300 Cr + 1× pack-a1-charizard + 1× pack-a1-mewtwo | 40 Cr | — |
| F00-D03 ★ | Final | Giovanni, Chefe da Equipe Rocket | F00-D02 | aurora | arena-final | 300 Cr + 1× pack-a1-pikachu + 1× pack-a1-mewtwo + trophy-circuito-completo + mat-circuit-complete | 40 Cr | — |

★ = vitória obrigatória (27). Estrutura: 45 nós, 39 batalhas/puzzles, 6 Descobertas.

## 🎯 9. Objetivos

| Objetivo | Créditos | Descrição | Predicados |
|---|---:|---|---|
| `P00-T01-TUTORIAL` | 0 | Vencer depois de colocar um Básico como Ativo. | WIN |
| `P00-T02-TUTORIAL` | 0 | Vencer e realizar uma ligação manual válida de Energia. | WIN; MANUAL_ENERGY_ATTACHED_AT_LEAST 1 |
| `P00-T03-TUTORIAL` | 0 | Vencer tendo colocado ao menos um Básico no Banco. | WIN; PLACED_ON_BENCH_AT_LEAST 1 |
| `P00-T04-TUTORIAL` | 0 | Vencer e evoluir uma vez legalmente. | WIN; EVOLVED_AT_LEAST 1 |
| `P00-T05-TUTORIAL` | 0 | Vencer e usar um Item e um Apoiador na mesma tentativa. | WIN; PLAYED_SUBTYPES |
| `P00-T06-TUTORIAL` | 0 | Vencer o duelo guiado e executar um Recuo normal. | WIN; RETREATED_AT_LEAST 1 |
| `C01-E01-WIN` | 0 | Vencer o duelo. | WIN |
| `C01-E01-TACTIC` | 40 | Vencer após colocar três Pokémon no Banco ao longo da partida. | PLACED_ON_BENCH_AT_LEAST 3 |
| `C01-E01-DECK` | 40 | Vencer com 3 linhas evolutivas distintas e pelo menos 6 Pokémon de Planta no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":3,"minTypeCards":{"types":["GRASS"],"count":6}} |
| `C01-E02-PUZZLE` | 0 | Vencer o puzzle em até 2 turnos próprios. | WIN; OWN_TURNS_AT_MOST 2 |
| `C01-E03-WIN` | 0 | Vencer o duelo. | WIN |
| `C01-E03-TACTIC` | 40 | Vencer após realizar uma evolução. | EVOLVED_AT_LEAST 1 |
| `C01-E03-DECK` | 40 | Vencer com 3 linhas evolutivas distintas e pelo menos 6 Pokémon de Planta no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":3,"minTypeCards":{"types":["GRASS"],"count":6}} |
| `C01-E05-WIN` | 0 | Vencer o duelo. | WIN |
| `C01-E05-TACTIC` | 40 | Vencer com ao menos dois Pokémon Básicos diferentes no deck. | DECK_COMPOSITION {"minBasic":2} |
| `C01-E05-DECK` | 40 | Vencer com 3 linhas evolutivas distintas e pelo menos 6 Pokémon de Planta no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":3,"minTypeCards":{"types":["GRASS"],"count":6}} |
| `C01-E06-WIN` | 0 | Vencer o duelo. | WIN |
| `C01-E06-TACTIC` | 40 | Vencer após atacar com duas entidades distintas. | DISTINCT_ATTACKERS_AT_LEAST 2 |
| `C01-E06-DECK` | 40 | Vencer com 3 linhas evolutivas distintas e pelo menos 6 Pokémon de Planta no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":3,"minTypeCards":{"types":["GRASS"],"count":6}} |
| `C02-E01-WIN` | 0 | Vencer o duelo. | WIN |
| `C02-E01-TACTIC` | 40 | Vencer após um Recuo normal. | RETREATED_AT_LEAST 1 |
| `C02-E01-DECK` | 40 | Vencer com a Zona configurada com exatamente 2 tipos de Energia e pelo menos 4 Pokémon de Água no deck. | DECK_COMPOSITION {"exactEnergyTypeCount":2,"minTypeCards":{"types":["WATER"],"count":4}} |
| `C02-E02-PUZZLE` | 0 | Vencer no turno preparado usando um efeito de troca. | WIN_IN_PREPARED_TURN; SWITCH_EFFECT_USED 1 |
| `C02-E03-WIN` | 0 | Vencer o duelo. | WIN |
| `C02-E03-TACTIC` | 40 | Vencer usando um efeito de troca. | SWITCH_EFFECT_USED 1 |
| `C02-E03-DECK` | 40 | Vencer com a Zona configurada com exatamente 2 tipos de Energia e pelo menos 4 Pokémon de Água no deck. | DECK_COMPOSITION {"exactEnergyTypeCount":2,"minTypeCards":{"types":["WATER"],"count":4}} |
| `C02-E05-WIN` | 0 | Vencer o duelo. | WIN |
| `C02-E05-TACTIC` | 40 | Vencer sem Pokémon ex no deck. | DECK_COMPOSITION {"maxRuleBoxCopies":{"EX":0,"MEGA_EX":0}} |
| `C02-E05-DECK` | 40 | Vencer com a Zona configurada com exatamente 2 tipos de Energia e pelo menos 4 Pokémon de Água no deck. | DECK_COMPOSITION {"exactEnergyTypeCount":2,"minTypeCards":{"types":["WATER"],"count":4}} |
| `C02-E06-WIN` | 0 | Vencer o duelo. | WIN |
| `C02-E06-TACTIC` | 40 | Vencer após causar dano com dois atacantes diferentes. | DISTINCT_ATTACK_DAMAGE_SOURCES_AT_LEAST 2 |
| `C02-E06-DECK` | 40 | Vencer com a Zona configurada com exatamente 2 tipos de Energia e pelo menos 4 Pokémon de Água no deck. | DECK_COMPOSITION {"exactEnergyTypeCount":2,"minTypeCards":{"types":["WATER"],"count":4}} |
| `C03-E01-WIN` | 0 | Vencer o duelo. | WIN |
| `C03-E01-TACTIC` | 40 | Vencer com duas Energias ligadas a um mesmo Pokémon. | ENERGY_ON_ONE_POKEMON_AT_LEAST 2 |
| `C03-E01-DECK` | 40 | Vencer com 2 cartas que liguem ou movam Energia e pelo menos 4 Pokémon Elétricos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["ATTACH_ENERGY","MOVE_ENERGY"],"count":2},"minTypeCards":{"types":["LIGHTNING"],"count":4}} |
| `C03-E02-PUZZLE` | 0 | Vencer no turno preparado usando o Item certo. | WIN_IN_PREPARED_TURN; PLAYED_SUBTYPES |
| `C03-E03-WIN` | 0 | Vencer o duelo. | WIN |
| `C03-E03-TACTIC` | 40 | Vencer após usar uma Habilidade ativada. | ACTIVATED_ABILITY_USED 1 |
| `C03-E03-DECK` | 40 | Vencer com 2 cartas que liguem ou movam Energia e pelo menos 4 Pokémon Elétricos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["ATTACH_ENERGY","MOVE_ENERGY"],"count":2},"minTypeCards":{"types":["LIGHTNING"],"count":4}} |
| `C03-E05-WIN` | 0 | Vencer o duelo. | WIN |
| `C03-E05-TACTIC` | 40 | Vencer sem ultrapassar 12 turnos próprios. | OWN_TURNS_AT_MOST 12 |
| `C03-E05-DECK` | 40 | Vencer com 2 cartas que liguem ou movam Energia e pelo menos 4 Pokémon Elétricos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["ATTACH_ENERGY","MOVE_ENERGY"],"count":2},"minTypeCards":{"types":["LIGHTNING"],"count":4}} |
| `C03-E06-WIN` | 0 | Vencer o duelo. | WIN |
| `C03-E06-TACTIC` | 40 | Vencer após Nocautear o Pokémon de apoio (Magneton). | KNOCKED_OUT_ROLE |
| `C03-E06-DECK` | 40 | Vencer com 2 cartas que liguem ou movam Energia e pelo menos 4 Pokémon Elétricos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["ATTACH_ENERGY","MOVE_ENERGY"],"count":2},"minTypeCards":{"types":["LIGHTNING"],"count":4}} |
| `C04-E01-WIN` | 0 | Vencer o duelo. | WIN |
| `C04-E01-TACTIC` | 40 | Vencer após remover uma condição por troca ou evolução. | CONDITION_REMOVED_BY_CAUSE |
| `C04-E01-DECK` | 40 | Vencer com 2 cartas que apliquem ou removam condições e pelo menos 4 Pokémon Psíquicos ou Noturnos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["APPLY_CONDITION","REMOVE_CONDITION"],"count":2},"minTypeCards":{"types":["PSYCHIC","DARKNESS"],"count":4}} |
| `C04-E02-PUZZLE` | 0 | Vencer no turno preparado curando a condição especial por evolução. | WIN_IN_PREPARED_TURN; CONDITION_REMOVED_BY_CAUSE |
| `C04-E03-WIN` | 0 | Vencer o duelo. | WIN |
| `C04-E03-TACTIC` | 40 | Vencer após evoluir um Pokémon que tinha condição especial. | EVOLVED_POKEMON_WITH_CONDITION 1 |
| `C04-E03-DECK` | 40 | Vencer com 2 cartas que apliquem ou removam condições e pelo menos 4 Pokémon Psíquicos ou Noturnos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["APPLY_CONDITION","REMOVE_CONDITION"],"count":2},"minTypeCards":{"types":["PSYCHIC","DARKNESS"],"count":4}} |
| `C04-E05-WIN` | 0 | Vencer o duelo. | WIN |
| `C04-E05-TACTIC` | 40 | Vencer sem Pokémon ex no deck. | DECK_COMPOSITION {"maxRuleBoxCopies":{"EX":0,"MEGA_EX":0}} |
| `C04-E05-DECK` | 40 | Vencer com 2 cartas que apliquem ou removam condições e pelo menos 4 Pokémon Psíquicos ou Noturnos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["APPLY_CONDITION","REMOVE_CONDITION"],"count":2},"minTypeCards":{"types":["PSYCHIC","DARKNESS"],"count":4}} |
| `C04-E06-WIN` | 0 | Vencer o duelo. | WIN |
| `C04-E06-TACTIC` | 40 | Vencer após usar uma Habilidade ativada. | ACTIVATED_ABILITY_USED 1 |
| `C04-E06-DECK` | 40 | Vencer com 2 cartas que apliquem ou removam condições e pelo menos 4 Pokémon Psíquicos ou Noturnos no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["APPLY_CONDITION","REMOVE_CONDITION"],"count":2},"minTypeCards":{"types":["PSYCHIC","DARKNESS"],"count":4}} |
| `C05-E01-WIN` | 0 | Vencer o duelo. | WIN |
| `C05-E01-TACTIC` | 40 | Vencer depois de jogar um Apoiador. | PLAYED_SUBTYPES |
| `C05-E01-DECK` | 40 | Vencer com pelo menos 2 cartas que modificam dano (como Giovanni, Blaine ou Melmetal) no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["MODIFY:DAMAGE_DEALT","MODIFY:DAMAGE_TAKEN"],"count":2}} |
| `C05-E02-PUZZLE` | 0 | Resolver o Nocaute do puzzle sem declarar ataque (com uma Habilidade). | WIN_IN_PREPARED_TURN; KNOCKOUT_WITHOUT_ATTACK 1 |
| `C05-E03-WIN` | 0 | Vencer o duelo. | WIN |
| `C05-E03-TACTIC` | 40 | Vencer depois de jogar um Item. | PLAYED_SUBTYPES |
| `C05-E03-DECK` | 40 | Vencer com pelo menos 2 cartas que modificam dano (como Giovanni, Blaine ou Melmetal) no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["MODIFY:DAMAGE_DEALT","MODIFY:DAMAGE_TAKEN"],"count":2}} |
| `C05-E05-WIN` | 0 | Vencer o duelo. | WIN |
| `C05-E05-TACTIC` | 40 | Vencer com no máximo 1 ponto concedido ao adversário. | OPPONENT_POINTS_AT_MOST 1 |
| `C05-E05-DECK` | 40 | Vencer com pelo menos 2 cartas que modificam dano (como Giovanni, Blaine ou Melmetal) no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["MODIFY:DAMAGE_DEALT","MODIFY:DAMAGE_TAKEN"],"count":2}} |
| `C05-E06-WIN` | 0 | Vencer o duelo. | WIN |
| `C05-E06-TACTIC` | 40 | Vencer com três Energias ligadas a um mesmo Pokémon. | ENERGY_ON_ONE_POKEMON_AT_LEAST 3 |
| `C05-E06-DECK` | 40 | Vencer com pelo menos 2 cartas que modificam dano (como Giovanni, Blaine ou Melmetal) no deck. | DECK_COMPOSITION {"minCardsWithOpcode":{"opcodes":["MODIFY:DAMAGE_DEALT","MODIFY:DAMAGE_TAKEN"],"count":2}} |
| `C06-E01-WIN` | 0 | Vencer o duelo. | WIN |
| `C06-E01-TACTIC` | 40 | Vencer sem Pokémon ex no deck e em até 10 turnos próprios. | DECK_COMPOSITION {"maxRuleBoxCopies":{"EX":0,"MEGA_EX":0}}; OWN_TURNS_AT_MOST 10 |
| `C06-E01-DECK` | 40 | Vencer com pelo menos 2 cartas ex no deck. | DECK_COMPOSITION {"minRuleBoxCopies":{"EX":2}} |
| `C06-E02-PUZZLE` | 0 | Vencer no turno preparado selecionando a sequência de Nocautes correta. | WIN_IN_PREPARED_TURN |
| `C06-E03-WIN` | 0 | Vencer o duelo. | WIN |
| `C06-E03-TACTIC` | 40 | Vencer sem conceder mais de 1 ponto. | OPPONENT_POINTS_AT_MOST 1 |
| `C06-E03-DECK` | 40 | Vencer com pelo menos 2 cartas ex no deck. | DECK_COMPOSITION {"minRuleBoxCopies":{"EX":2}} |
| `C06-E05-WIN` | 0 | Vencer o duelo. | WIN |
| `C06-E05-TACTIC` | 40 | Vencer Nocauteando um Pokémon ex. | KNOCKED_OUT_RULEBOX |
| `C06-E05-DECK` | 40 | Vencer com pelo menos 2 cartas ex no deck. | DECK_COMPOSITION {"minRuleBoxCopies":{"EX":2}} |
| `C06-E06-WIN` | 0 | Vencer o duelo. | WIN |
| `C06-E06-TACTIC` | 40 | Vencer atacando com ao menos duas entidades distintas. | DISTINCT_ATTACKERS_AT_LEAST 2 |
| `C06-E06-DECK` | 40 | Vencer com pelo menos 2 cartas ex no deck. | DECK_COMPOSITION {"minRuleBoxCopies":{"EX":2}} |
| `F00-D01-WIN` | 0 | Vencer o duelo. | WIN |
| `F00-D01-TACTIC` | 40 | Vencer após evoluir e usar uma troca por efeito. | EVOLVED_AT_LEAST 1; SWITCH_EFFECT_USED 1 |
| `F00-D01-DECK` | 40 | Vencer com pelo menos 4 linhas evolutivas distintas e 1 Pokémon ex no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":4,"minRuleBoxCopies":{"EX":1}} |
| `F00-D02-WIN` | 0 | Vencer o duelo. | WIN |
| `F00-D02-TACTIC` | 40 | Vencer após atacar com duas entidades diferentes. | DISTINCT_ATTACKERS_AT_LEAST 2 |
| `F00-D02-DECK` | 40 | Vencer com pelo menos 4 linhas evolutivas distintas e 1 Pokémon ex no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":4,"minRuleBoxCopies":{"EX":1}} |
| `F00-D03-WIN` | 0 | Vencer o duelo. | WIN |
| `F00-D03-TACTIC` | 40 | Vencer concedendo no máximo 1 ponto. | OPPONENT_POINTS_AT_MOST 1 |
| `F00-D03-DECK` | 40 | Vencer com pelo menos 4 linhas evolutivas distintas e 1 Pokémon ex no deck. | DECK_COMPOSITION {"minDistinctEvolutionLines":4,"minRuleBoxCopies":{"EX":1}} |

Composição (`DECK_COMPOSITION`): `minBasic` conta Pokémon Básicos distintos; `minCardsWithOpcode` conta cópias de cartas cujo efeito estruturado usa o opcode (`MODIFY:<stat>` incluído); `minSetCards` usa o conjunto da impressão do snapshot. Nenhum objetivo `-DECK` é cumprido pelos três decks iniciais:

- `C01-E01-DECK`: nenhum deck inicial cumpre
- `C01-E03-DECK`: nenhum deck inicial cumpre
- `C01-E05-DECK`: nenhum deck inicial cumpre
- `C01-E06-DECK`: nenhum deck inicial cumpre
- `C02-E01-DECK`: nenhum deck inicial cumpre
- `C02-E03-DECK`: nenhum deck inicial cumpre
- `C02-E05-DECK`: nenhum deck inicial cumpre
- `C02-E06-DECK`: nenhum deck inicial cumpre
- `C03-E01-DECK`: nenhum deck inicial cumpre
- `C03-E03-DECK`: nenhum deck inicial cumpre
- `C03-E05-DECK`: nenhum deck inicial cumpre
- `C03-E06-DECK`: nenhum deck inicial cumpre
- `C04-E01-DECK`: nenhum deck inicial cumpre
- `C04-E03-DECK`: nenhum deck inicial cumpre
- `C04-E05-DECK`: nenhum deck inicial cumpre
- `C04-E06-DECK`: nenhum deck inicial cumpre
- `C05-E01-DECK`: nenhum deck inicial cumpre
- `C05-E03-DECK`: nenhum deck inicial cumpre
- `C05-E05-DECK`: nenhum deck inicial cumpre
- `C05-E06-DECK`: nenhum deck inicial cumpre
- `C06-E01-DECK`: nenhum deck inicial cumpre
- `C06-E03-DECK`: nenhum deck inicial cumpre
- `C06-E05-DECK`: nenhum deck inicial cumpre
- `C06-E06-DECK`: nenhum deck inicial cumpre
- `F00-D01-DECK`: nenhum deck inicial cumpre
- `F00-D02-DECK`: nenhum deck inicial cumpre
- `F00-D03-DECK`: nenhum deck inicial cumpre

## 🎁 10. Tabelas de prêmio

| Tabela | Créditos | Pacotes | Medalha | Cosméticos | Desbloqueios |
|---|---:|---|---|---|---|
| `tutorial-v1` | 50 | — | — | — | — |
| `tutorial-final-v1` | 100 | 1× pack-a1-pikachu | — | — | chapter:C01, emporium:pack-a1-charizard |
| `puzzle-v1` | 100 | — | — | — | — |
| `discovery-v1` | 0 | — | — | — | emporium:discovery-alternatives |
| `chapter-duel-c01-v1` | 80 | 1× pack-a1-charizard | — | — | — |
| `chapter-elite-c01-v1` | 160 | 1× pack-a1-charizard | — | — | — |
| `chapter-boss-c01-v1` | 250 | 2× pack-a1-charizard | medal-c01 | flair-c01 | chapter:C02, emporium:mat-c01-grove, mode:arena |
| `chapter-duel-c02-v1` | 80 | 1× pack-a1-pikachu | — | — | — |
| `chapter-elite-c02-v1` | 160 | 1× pack-a1-pikachu | — | — | — |
| `chapter-boss-c02-v1` | 250 | 2× pack-a1-pikachu | medal-c02 | flair-c02 | chapter:C03, emporium:mat-c02-harbor |
| `chapter-duel-c03-v1` | 80 | 1× pack-a1-pikachu | — | — | — |
| `chapter-elite-c03-v1` | 160 | 1× pack-a1-pikachu | — | — | — |
| `chapter-boss-c03-v1` | 250 | 2× pack-a1-pikachu | medal-c03 | flair-c03 | chapter:C04, emporium:mat-c03-circuits, emporium:ultra-pikachu, emporium:pack-a1-mewtwo |
| `chapter-duel-c04-v1` | 80 | 1× pack-a1-mewtwo | — | — | — |
| `chapter-elite-c04-v1` | 160 | 1× pack-a1-mewtwo | — | — | — |
| `chapter-boss-c04-v1` | 250 | 2× pack-a1-mewtwo | medal-c04 | flair-c04 | chapter:C05, emporium:mat-c04-observatory |
| `chapter-duel-c05-v1` | 80 | 1× pack-a1-charizard | — | — | — |
| `chapter-elite-c05-v1` | 160 | 1× pack-a1-charizard | — | — | — |
| `chapter-boss-c05-v1` | 250 | 2× pack-a1-charizard | medal-c05 | flair-c05 | chapter:C06, emporium:mat-c05-foundry, emporium:ultra-charizard |
| `chapter-duel-c06-v1` | 80 | 1× pack-a1-mewtwo | — | — | — |
| `chapter-elite-c06-v1` | 160 | 1× pack-a1-mewtwo | — | — | — |
| `chapter-boss-c06-v1` | 250 | 2× pack-a1-mewtwo | medal-c06 | flair-c06 | chapter:F00, emporium:mat-c06-archive, emporium:ultra-mewtwo |
| `final-v1` | 300 | 1× pack-a1-charizard, 1× pack-a1-mewtwo | — | — | — |
| `final-complete-v1` | 300 | 1× pack-a1-pikachu, 1× pack-a1-mewtwo | trophy-circuito-completo | mat-circuit-complete | mode:postgame, emporium:ultra-a1 |
| `duel-repeat-v1` | 20 | — | — | — | — |
| `elite-repeat-v1` | 30 | — | — | — | — |
| `boss-repeat-v1` | 40 | — | — | — | — |
| `final-repeat-v1` | 40 | — | — | — | — |

Onboarding: 300 Créditos, decks starter-chama-constante, starter-mare-serena, starter-jardim-vivo, starter-faisca-veloz, starter-eco-psiquico, starter-punho-firme, starter-sombra-astuta, starter-aco-paciente, inventário de 76 cartas (38 × 2), pacotes 1× pack-tutorial-v1 + 1× pack-a1-pikachu, cosméticos mat-neutral, mat-academy, sleeve-neutral, coin-neutral, flair-basic; primeiro nó P00-T01.

## 💰 11. Auditoria econômica

Recalculada a partir dos dados pelo build (falha se divergir de campanha §15.4).

| Parcela | Créditos |
|---|---:|
| Perfil novo | 300 |
| Prólogo (T01–T06) | 350 |
| Capítulos (E01 + E03 + E06) × 6 | 2460 |
| Final (D01–D03) | 900 |
| **Rota obrigatória** | **4010** |
| Puzzles E02 | 600 |
| Elites E05 | 960 |
| Objetivos extras (54 × 40) | 2160 |
| Total opcional | 3720 |
| **Máximo único** | **7730** |

Pacotes da rota obrigatória (inclui onboarding): 11× pack-a1-pikachu, 10× pack-a1-charizard, 11× pack-a1-mewtwo, 1× pack-tutorial-v1. Pacotes opcionais: 2× pack-a1-charizard, 2× pack-a1-pikachu, 2× pack-a1-mewtwo.

| Repetível | Créditos | Vitórias para Comum/Incomum/Rara/Ultra/Pacote/Verso/Moeda/Tapete |
|---|---:|---|
| `boss-repeat-v1` | 40 | 2 / 4 / 8 / 15 / 3 / 5 / 8 / 13 |
| `duel-repeat-v1` | 20 | 4 / 8 / 15 / 30 / 5 / 10 / 15 / 25 |
| `elite-repeat-v1` | 30 | 3 / 6 / 10 / 20 / 4 / 7 / 10 / 17 |
| `final-repeat-v1` | 40 | 2 / 4 / 8 / 15 / 3 / 5 / 8 / 13 |

## 🧩 12. Tutoriais e puzzles

Cenários preparados e identificados como tal. As soluções abaixo são comandos simbólicos (`src/content/source/script.ts`) executados pelo motor real em várias sementes pelo build; o NPC dos tutoriais e puzzles segue `npcScript`.

### fx-p00-t01 — P00-T01 Primeira Carta

Primeira Carta — cenário preparado: a mão inicial foi definida para esta lição. Início: preparação, turno global 1, joga o NPC. Verificação: resolvida (2 turno(s) próprio(s)).

- Roteiro do NPC: Escolher hand:a1-011-oddish → Encerrar o turno → Ligar Energia da Zona a ACTIVE → Atacar com ram
1. Escolher hand:a1-033-charmander — Escolha Charmander como Pokémon Ativo.
2. Ligar Energia da Zona a ACTIVE — Ligue a Energia de Fogo pronta ao Ativo.
3. Atacar com ember — Brasa causa 30 + 20 de Fraqueza: Planta é fraca a Fogo. A Energia usada é descartada.
4. Ligar Energia da Zona a ACTIVE — Ligue outra Energia: Brasa descartou a anterior.
5. Atacar com ember — Segundo ataque: Oddish é Nocauteado e Cheren fica sem Pokémon em campo.

### fx-p00-t02 — P00-T02 Acender a Energia

Acender a Energia — cenário preparado: campo e mão definidos para esta lição. Início: fase principal, turno global 2, joga o humano. Verificação: resolvida (1 turno(s) próprio(s)).

1. Ligar Energia da Zona a ACTIVE — Ligação manual: uma Energia da Zona por turno.
2. Atacar com flare — O custo é pago com a Energia ligada, que não é descartada.

### fx-p00-t03 — P00-T03 Preparar a Reserva

Preparar a Reserva — cenário preparado: seu Ativo está quase sem PS. Início: fase principal, turno global 4, joga o humano. Verificação: resolvida (2 turno(s) próprio(s)).

- Roteiro do NPC: Atacar com ember
1. Jogar a1-074-staryu no Banco 0 — Coloque Staryu no Banco: é a sua reserva.
2. Ligar Energia da Zona a BENCH:0 — Distribua a Energia antes: Staryu já estará pronto no próximo turno.
3. Atacar com water-gun — Squirtle ainda ataca com Fraqueza; Charmander é fraco a Água.
4. Atacar com smack — Staryu foi promovido com a Energia já ligada e finaliza.

### fx-p00-t04 — P00-T04 A Próxima Forma

A Próxima Forma — cenário preparado: Ponyta está em campo desde o turno anterior. Início: fase principal, turno global 3, joga o humano. Verificação: resolvida (1 turno(s) próprio(s)).

1. Evoluir ACTIVE com a1-043-rapidash — Evolua: o dano de Ponyta continua em Rapidash, mas os PS máximos sobem.
2. Ligar Energia da Zona a ACTIVE — Ligue a Energia do turno.
3. Atacar com fire-mane — Juba de Fogo: 40 + 20 de Fraqueza Nocauteiam Bulbasaur.

### fx-p00-t05 — P00-T05 Apoio no Momento Certo

Apoio no Momento Certo — cenário preparado: você já ligou a Energia deste turno. Início: fase principal, turno global 4, joga o humano. Verificação: resolvida (1 turno(s) próprio(s)).

1. Jogar pa-002-velocidade-x — Item: Velocidade X zera o Recuo de Exeggcute neste turno.
2. Recuar para o Banco 0 pagando nada — Recue sem pagar Energia e traga Bulbasaur, que já tem o ataque pago.
3. Jogar a1-223-giovanni — Apoiador: só um por turno. Giovanni soma +10 ao dano no Ativo do oponente.
4. Atacar com vine-whip — Chicote de Vinha: 40 + 10 = 50, exatamente os PS restantes de Squirtle.

### fx-p00-t06 — P00-T06 Mudar o Plano

Mudar o Plano — duelo guiado completo com abertura preparada; Cheren joga pela IA. Início: preparação, turno global 1, joga o humano. Duelo guiado completo; NPC pela IA de Cheren.


### fx-c01-e02 — C01-E02 Um Lugar no Banco

Um Lugar no Banco — puzzle preparado: vença em até 2 turnos próprios, sem moedas. Início: fase principal, turno global 2, joga o humano. Verificação: resolvida (2 turno(s) próprio(s), limite 2).

- Roteiro do NPC: Atacar com fire-mane
1. Jogar a1-011-oddish no Banco 0 — Oddish vai para o Banco: é a reserva que vai evoluir.
2. Ligar Energia da Zona a BENCH:0 — A Energia do turno vai para a reserva, não para o Ativo condenado.
3. Atacar com vine-whip — Bulbasaur ainda causa 40 antes de cair.
4. Evoluir ACTIVE com a1-012-gloom — Gloom comprado no turno: evolua a reserva promovida.
5. Ligar Energia da Zona a ACTIVE — Segunda Energia: Babar fica pago.
6. Atacar com drool — 40 de dano fecham os 100 PS de Rapidash: terceiro ponto.

### fx-c02-e02 — C02-E02 Passagem Livre

Passagem Livre — puzzle preparado: vença neste turno usando um efeito de troca. Início: fase principal, turno global 6, joga o humano. Verificação: resolvida (1 turno(s) próprio(s), limite 1).

1. Jogar a1-225-sabrina — Sabrina manda o Ativo do oponente para o Banco; só sobra o Charmander para entrar.
2. Atacar com wave-splash — Respingo de Onda: 40 + 20 de Fraqueza Nocauteiam Charmander: terceiro ponto.

### fx-c03-e02 — C03-E02 Energia Bem Contada

Energia Bem Contada — puzzle preparado: conte o Recuo antes de ligar a Energia. Início: fase principal, turno global 6, joga o humano. Verificação: resolvida (1 turno(s) próprio(s), limite 1).

1. Jogar pa-002-velocidade-x — Velocidade X: o Recuo de Eelektrik cai de 2 para 1.
2. Recuar para o Banco 0 pagando Elétrico — Recue pagando a única Energia de Eelektrik.
3. Ligar Energia da Zona a ACTIVE — A Energia do turno completa o custo de Electrode.
4. Atacar com electro-ball — Eletrobola: 70 + 20 de Fraqueza Nocauteiam Wartortle: terceiro ponto.

### fx-c04-e02 — C04-E02 Depois da Meia-Volta

Depois da Meia-Volta — puzzle preparado: seu Ativo está Adormecido; vença neste turno. Início: fase principal, turno global 7, joga o humano. Verificação: resolvida (1 turno(s) próprio(s), limite 1).

1. Evoluir ACTIVE com a1-122-gengar — Evoluir remove todas as condições especiais: Gengar acorda.
2. Ligar Energia da Zona a ACTIVE — Ligue a Energia Psíquica do turno.
3. Atacar com bother — Importunar causa 50 e fecha os 90 PS de Frosmoth: terceiro ponto.

### fx-c05-e02 — C05-E02 O Peso da Moldura

O Peso da Moldura — puzzle preparado: Nocauteie sem declarar ataque. Início: fase principal, turno global 6, joga o humano. Verificação: resolvida (1 turno(s) próprio(s), limite 1).

1. Usar water-shuriken de BENCH:0 — Shuriken d'Água não é ataque: o Revestimento Rígido não reduz e o dano de 20 Nocauteia.

### fx-c06-e02 — C06-E02 Conta de Risco

Conta de Risco — puzzle preparado: some 3 pontos neste turno escolhendo o alvo certo. Início: fase principal, turno global 8, joga o humano. Verificação: resolvida (1 turno(s) próprio(s), limite 1).

1. Usar fragrance-trap de ACTIVE — Armadilha Aromática: você escolhe qual Básico do Banco do oponente vem para o Ativo.
2. Escolher OPP_BENCH:0 — Articuno ex vale 2 pontos e tem só 60 PS restantes.
3. Atacar com vine-whip — Chicote de Vinha causa 60: Nocaute de 2 pontos, total 3.

## 🎨 13. Cosméticos

| Cosmético | Tipo | Nome | Aquisição | Padrão | Paleta |
|---|---|---|---|---|---|
| `mat-neutral` | PLAYMAT | Mesa Neutra | Gratuito | LINES | #EAF4FA #DCD6F7 #FFFFFF #75C7FA |
| `mat-academy` | PLAYMAT | Escola de Treinadores | Gratuito | LINES | #FFFFFF #CFE8FB #DCD6F7 #357DE4 |
| `mat-c01-grove` | PLAYMAT | Ginásio de Celadon | Empório 500 Cr após C01-E06 | LEAVES | #DFF5E3 #B9E4C0 #A7D8F5 #72B75D |
| `mat-c02-harbor` | PLAYMAT | Ginásio de Sootopolis | Empório 500 Cr após C02-E06 | WAVES | #BFE9FA #8EE3E0 #F3E6C8 #2DECE5 |
| `mat-c03-circuits` | PLAYMAT | Ginásio de Vermilion | Empório 500 Cr após C03-E06 | CIRCUITS | #EEF5FC #FFF1B8 #9BE7F0 #E8C83E |
| `mat-c04-observatory` | PLAYMAT | Ginásio de Saffron | Empório 500 Cr após C04-E06 | STARS | #E7DDF5 #D6E4F7 #E9ECF2 #A279CB |
| `mat-c05-foundry` | PLAYMAT | Ginásio de Stow-on-Side | Empório 500 Cr após C05-E06 | SYMBOLS | #E6EAEE #FBD9C9 #F5F7F9 #EF785B |
| `mat-c06-archive` | PLAYMAT | Ginásio de Viridian | Empório 500 Cr após C06-E06 | PAGES | #FBF8EF #D3EAFB #E3DDF5 #75C7FA |
| `mat-circuit-complete` | PLAYMAT | Troféu do Torneio de Kanto | Concessão (final-f00-d03) após F00-D03 | CHAPTERS | #FFFFFF #C8FAF5 #DCD6F7 #F6CE3D |
| `sleeve-neutral` | SLEEVE | Verso Neutro | Gratuito | LINES | #FFFFFF #75C7FA |
| `sleeve-c01` | SLEEVE | Verso Celadon | Empório 200 Cr após C01-E03 | LEAVES | #DFF5E3 #72B75D |
| `sleeve-c02` | SLEEVE | Verso Sootopolis | Empório 200 Cr após C02-E03 | WAVES | #BFE9FA #2DECE5 |
| `sleeve-c03` | SLEEVE | Verso Vermilion | Empório 200 Cr após C03-E03 | CIRCUITS | #FFF1B8 #E8C83E |
| `sleeve-c04` | SLEEVE | Verso Saffron | Empório 200 Cr após C04-E03 | STARS | #E7DDF5 #A279CB |
| `sleeve-c05` | SLEEVE | Verso Stow-on-Side | Empório 200 Cr após C05-E03 | SYMBOLS | #FBD9C9 #EF785B |
| `sleeve-c06` | SLEEVE | Verso Viridian | Empório 200 Cr após C06-E03 | PAGES | #FBF8EF #75C7FA |
| `sleeve-pocket-acerola` | SLEEVE | Verso Acerola | Gratuito | NONE | #625D8A #8860B8 |
| `sleeve-pocket-thenewyearwithpikachu` | SLEEVE | Verso Ano-Novo com Pikachu | Gratuito | NONE | #995029 #5E1617 |
| `sleeve-pocket-arceus` | SLEEVE | Verso Arceus | Gratuito | NONE | #4F483D #917D58 |
| `sleeve-pocket-arven` | SLEEVE | Verso Arven | Gratuito | NONE | #A6775F #F9A140 |
| `sleeve-pocket-blastoise` | SLEEVE | Verso Blastoise | Gratuito | NONE | #859AA7 #37B7DE |
| `sleeve-pocket-pokemon30thcelebrationdesign` | SLEEVE | Verso Celebração de 30 anos | Gratuito | NONE | #63513F #000000 |
| `sleeve-pocket-charizard` | SLEEVE | Verso Charizard | Gratuito | NONE | #965D41 #D7421A |
| `sleeve-pocket-shinycharizard` | SLEEVE | Verso Charizard Brilhante | Gratuito | NONE | #7E4654 #3D395E |
| `sleeve-pocket-teamrocketsboss` | SLEEVE | Verso Chefe da Equipe Rocket | Gratuito | NONE | #32171D #000000 |
| `sleeve-pocket-chimchar` | SLEEVE | Verso Chimchar | Gratuito | NONE | #E3A57B #FE5D65 |
| `sleeve-pocket-specialset01` | SLEEVE | Verso Conjunto Especial 1 | Gratuito | NONE | #393635 #000001 |
| `sleeve-pocket-specialset02` | SLEEVE | Verso Conjunto Especial 2 | Gratuito | NONE | #D3631E #CD9216 |
| `sleeve-pocket-cynthia` | SLEEVE | Verso Cynthia | Gratuito | NONE | #AB9874 #E39A55 |
| `sleeve-pocket-darkrai` | SLEEVE | Verso Darkrai | Gratuito | NONE | #463F45 #2D2D2D |
| `sleeve-pocket-eevee` | SLEEVE | Verso Eevee | Gratuito | NONE | #958B5E #D19356 |
| `sleeve-pocket-eeveever-2` | SLEEVE | Verso Eevee (versão 2) | Gratuito | NONE | #C99172 #D69460 |
| `sleeve-pocket-elesa` | SLEEVE | Verso Elesa | Gratuito | NONE | #A1A294 #FFD72A |
| `sleeve-pocket-teamrocket` | SLEEVE | Verso Equipe Rocket | Gratuito | NONE | #472F30 #A1A5A8 |
| `sleeve-pocket-erikaandvileplume` | SLEEVE | Verso Erika e Vileplume | Gratuito | NONE | #B69789 #E57A70 |
| `sleeve-pocket-espeon-umbreon` | SLEEVE | Verso Espeon e Umbreon | Gratuito | NONE | #729EC2 #4FB9E1 |
| `sleeve-pocket-fennekin` | SLEEVE | Verso Fennekin | Gratuito | NONE | #D6B1B3 #8879BE |
| `sleeve-pocket-streetparty` | SLEEVE | Verso Festa na Rua | Gratuito | NONE | #B58B5F #BC7555 |
| `sleeve-pocket-gardevoir` | SLEEVE | Verso Gardevoir | Gratuito | NONE | #D79AC7 #FC1F90 |
| `sleeve-pocket-gladion` | SLEEVE | Verso Gladion | Gratuito | NONE | #6D5E57 #27262B |
| `sleeve-pocket-goomy` | SLEEVE | Verso Goomy | Gratuito | NONE | #67947C #015C7B |
| `sleeve-pocket-greninja` | SLEEVE | Verso Greninja | Gratuito | NONE | #6C89B5 #112595 |
| `sleeve-pocket-ho-oh-lugia` | SLEEVE | Verso Ho-Oh e Lugia | Gratuito | NONE | #8C7D83 #0C283E |
| `sleeve-pocket-hoopa` | SLEEVE | Verso Hoopa | Gratuito | NONE | #876B81 #BE2D88 |
| `sleeve-pocket-iono` | SLEEVE | Verso Iono | Gratuito | NONE | #C4B25A #FEF900 |
| `sleeve-pocket-koraidon` | SLEEVE | Verso Koraidon | Gratuito | NONE | #945274 #2D3EFE |
| `sleeve-pocket-lillie` | SLEEVE | Verso Lillie | Gratuito | NONE | #8591AA #100A36 |
| `sleeve-pocket-lilliever-2` | SLEEVE | Verso Lillie (versão 2) | Gratuito | NONE | #B2CDDF #92DDD9 |
| `sleeve-pocket-lucario` | SLEEVE | Verso Lucario | Gratuito | NONE | #85AFAB #0177BF |
| `sleeve-pocket-manaphy` | SLEEVE | Verso Manaphy | Gratuito | NONE | #B1D7E5 #54C5E5 |
| `sleeve-pocket-may` | SLEEVE | Verso May | Gratuito | NONE | #D1956D #FF3109 |
| `sleeve-pocket-megaaltaria` | SLEEVE | Verso Mega Altaria | Gratuito | NONE | #BDBDBD #6BC3D1 |
| `sleeve-pocket-megablaziken` | SLEEVE | Verso Mega Blaziken | Gratuito | NONE | #774124 #000000 |
| `sleeve-pocket-megacharizardx` | SLEEVE | Verso Mega Charizard X | Gratuito | NONE | #736D80 #1D4A8E |
| `sleeve-pocket-megacharizardy` | SLEEVE | Verso Mega Charizard Y | Gratuito | NONE | #955C47 #CE7D62 |
| `sleeve-pocket-megagardevoir` | SLEEVE | Verso Mega Gardevoir | Gratuito | NONE | #ADA7B3 #4D5E8C |
| `sleeve-pocket-shinymegagengar` | SLEEVE | Verso Mega Gengar Brilhante | Gratuito | NONE | #A078BE #DD48EC |
| `sleeve-pocket-megagyarados` | SLEEVE | Verso Mega Gyarados | Gratuito | NONE | #514F53 #000000 |
| `sleeve-pocket-megakangaskhan` | SLEEVE | Verso Mega Kangaskhan | Gratuito | NONE | #9F6C56 #EE750A |
| `sleeve-pocket-megalucario` | SLEEVE | Verso Mega Lucario | Gratuito | NONE | #76503D #A82610 |
| `sleeve-pocket-megarayquaza` | SLEEVE | Verso Mega Rayquaza | Gratuito | NONE | #64AB6A #D4D400 |
| `sleeve-pocket-megasceptile` | SLEEVE | Verso Mega Sceptile | Gratuito | NONE | #678845 #02D31F |
| `sleeve-pocket-meowth` | SLEEVE | Verso Meowth | Gratuito | NONE | #D3CB7F #F8D41E |
| `sleeve-pocket-metagross` | SLEEVE | Verso Metagross | Gratuito | NONE | #6F6C5C #357982 |
| `sleeve-pocket-mythicalislandmew` | SLEEVE | Verso Mew da Ilha Mítica | Gratuito | NONE | #699894 #44D3A8 |
| `sleeve-pocket-mewtwo` | SLEEVE | Verso Mewtwo | Gratuito | NONE | #81609C #FA6AEE |
| `sleeve-pocket-shinymewtwo` | SLEEVE | Verso Mewtwo Brilhante | Gratuito | NONE | #563867 #45084E |
| `sleeve-pocket-mimikyu` | SLEEVE | Verso Mimikyu | Gratuito | NONE | #74657F #B97490 |
| `sleeve-pocket-miraidon` | SLEEVE | Verso Miraidon | Gratuito | NONE | #866ABF #FE45E8 |
| `sleeve-pocket-morpeko` | SLEEVE | Verso Morpeko | Gratuito | NONE | #A3D0D2 #02A2F0 |
| `sleeve-pocket-oshawott` | SLEEVE | Verso Oshawott | Gratuito | NONE | #B5D0CF #30C0B7 |
| `sleeve-pocket-pichu` | SLEEVE | Verso Pichu | Gratuito | NONE | #A9B6C8 #605DAC |
| `sleeve-pocket-pikachu` | SLEEVE | Verso Pikachu | Gratuito | NONE | #96832C #648F4A |
| `sleeve-pocket-piplup` | SLEEVE | Verso Piplup | Gratuito | NONE | #81A29A #8CC7C3 |
| `sleeve-pocket-pokemonoftheforest` | SLEEVE | Verso Pokémon da Floresta | Gratuito | NONE | #8BBBBC #2F8CAD |
| `sleeve-pocket-professoroak` | SLEEVE | Verso Professor Carvalho | Gratuito | NONE | #D2C0BA #A8739F |
| `sleeve-pocket-psyduck` | SLEEVE | Verso Psyduck | Gratuito | NONE | #6B9470 #FEC538 |
| `sleeve-pocket-quagsire-clodsire` | SLEEVE | Verso Quagsire e Clodsire | Gratuito | NONE | #9C7972 #BA6C6C |
| `sleeve-pocket-redandpikachu` | SLEEVE | Verso Red e Pikachu | Gratuito | NONE | #C18C73 #C92A27 |
| `sleeve-pocket-rowlet` | SLEEVE | Verso Rowlet | Gratuito | NONE | #ABC794 #52BA97 |
| `sleeve-pocket-sableye` | SLEEVE | Verso Sableye | Gratuito | NONE | #3D4072 #1F2C7B |
| `sleeve-pocket-serena` | SLEEVE | Verso Serena | Gratuito | NONE | #978888 #C19D5F |
| `sleeve-pocket-solgaleo` | SLEEVE | Verso Solgaleo | Gratuito | NONE | #B27B68 #C21A27 |
| `sleeve-pocket-sprigatito` | SLEEVE | Verso Sprigatito | Gratuito | NONE | #95B77F #8ACD66 |
| `sleeve-pocket-suicune` | SLEEVE | Verso Suicune | Gratuito | NONE | #6B8FB1 #0F466F |
| `sleeve-pocket-sylveon` | SLEEVE | Verso Sylveon | Gratuito | NONE | #4B6B83 #0A486D |
| `sleeve-pocket-toxtricity` | SLEEVE | Verso Toxtricity | Gratuito | NONE | #7C45C3 #CA1DCF |
| `sleeve-pocket-tyranitar` | SLEEVE | Verso Tyranitar | Gratuito | NONE | #99BB9B #95D69E |
| `sleeve-pocket-ultranecrozma` | SLEEVE | Verso Ultra Necrozma | Gratuito | NONE | #898E93 #1A0808 |
| `sleeve-pocket-venusaur` | SLEEVE | Verso Venusaur | Gratuito | NONE | #B9924B #9CB05B |
| `sleeve-pocket-alolanvulpix` | SLEEVE | Verso Vulpix de Alola | Gratuito | NONE | #E1ECE9 #A6DBE3 |
| `sleeve-pocket-yampergrowlithelillipuprockruffandfidough` | SLEEVE | Verso Yamper e Companhia | Gratuito | NONE | #CDA974 #C38167 |
| `sleeve-pocket-zapdosarticunoandmoltres` | SLEEVE | Verso Zapdos, Articuno e Moltres | Gratuito | NONE | #795143 #0C0C24 |
| `sleeve-pocket-zoroark` | SLEEVE | Verso Zoroark | Gratuito | NONE | #694540 #24222D |
| `coin-neutral` | COIN | Moeda Neutra | Gratuito | NONE | #FFFFFF #357DE4 |
| `coin-c01` | COIN | Moeda Celadon | Empório 300 Cr após C01-E06 | LEAVES | #DFF5E3 #72B75D |
| `coin-c02` | COIN | Moeda Sootopolis | Empório 300 Cr após C02-E06 | WAVES | #BFE9FA #2DECE5 |
| `coin-c03` | COIN | Moeda Vermilion | Empório 300 Cr após C03-E06 | CIRCUITS | #FFF1B8 #E8C83E |
| `coin-c04` | COIN | Moeda Saffron | Empório 300 Cr após C04-E06 | STARS | #E7DDF5 #A279CB |
| `coin-c05` | COIN | Moeda Stow-on-Side | Empório 300 Cr após C05-E06 | SYMBOLS | #FBD9C9 #EF785B |
| `coin-c06` | COIN | Moeda Viridian | Empório 300 Cr após C06-E06 | PAGES | #FBF8EF #75C7FA |
| `coin-pocket-acerola` | COIN | Moeda Acerola | Gratuito | NONE | #655C71 #8379A8 |
| `coin-pocket-arceus` | COIN | Moeda Arceus | Gratuito | NONE | #787A7A #98979A |
| `coin-pocket-arven` | COIN | Moeda Arven | Gratuito | NONE | #606355 #09454E |
| `coin-pocket-blastoise` | COIN | Moeda Blastoise | Gratuito | NONE | #637981 #0678D5 |
| `coin-pocket-pokemon30thcelebrationdesign` | COIN | Moeda Celebração de 30 anos | Gratuito | NONE | #5E4A0F #FF9206 |
| `coin-pocket-charizard` | COIN | Moeda Charizard | Gratuito | NONE | #83572E #DB3820 |
| `coin-pocket-shinycharizard` | COIN | Moeda Charizard Brilhante | Gratuito | NONE | #635752 #555557 |
| `coin-pocket-teamrocketsboss` | COIN | Moeda Chefe da Equipe Rocket | Gratuito | NONE | #616261 #A3A4A3 |
| `coin-pocket-chimchar` | COIN | Moeda Chimchar | Gratuito | NONE | #9B7241 #EE8408 |
| `coin-pocket-specialset01` | COIN | Moeda Conjunto Especial 1 | Gratuito | NONE | #6F5A55 #EEF6EA |
| `coin-pocket-specialset02` | COIN | Moeda Conjunto Especial 2 | Gratuito | NONE | #D46633 #FEF767 |
| `coin-pocket-cynthia` | COIN | Moeda Cynthia | Gratuito | NONE | #847F60 #6B6819 |
| `coin-pocket-darkrai` | COIN | Moeda Darkrai | Gratuito | NONE | #6E555C #DADEE0 |
| `coin-pocket-eevee` | COIN | Moeda Eevee | Gratuito | NONE | #866B44 #CC904E |
| `coin-pocket-eeveever-2` | COIN | Moeda Eevee (versão 2) | Gratuito | NONE | #9F803E #B46C12 |
| `coin-pocket-elesa` | COIN | Moeda Elesa | Gratuito | NONE | #727055 #050604 |
| `coin-pocket-teamrocket` | COIN | Moeda Equipe Rocket | Gratuito | NONE | #7E3435 #A8ACAF |
| `coin-pocket-erikaalt` | COIN | Moeda Erika (alternativa) | Gratuito | NONE | #0D451E #18701F |
| `coin-pocket-rainbowerika` | COIN | Moeda Erika Arco-Íris | Gratuito | NONE | #A17F82 #CE62D3 |
| `coin-pocket-espeon-umbreon` | COIN | Moeda Espeon e Umbreon | Gratuito | NONE | #676569 #07070B |
| `coin-pocket-fennekin` | COIN | Moeda Fennekin | Gratuito | NONE | #A0764A #FA752B |
| `coin-pocket-gardevoir` | COIN | Moeda Gardevoir | Gratuito | NONE | #77886D #7F4BA7 |
| `coin-pocket-glaceon` | COIN | Moeda Glaceon | Gratuito | NONE | #7D90B4 #BCFFFE |
| `coin-pocket-goomy` | COIN | Moeda Goomy | Gratuito | NONE | #767084 #8365CE |
| `coin-pocket-greninja` | COIN | Moeda Greninja | Gratuito | NONE | #406480 #117BD9 |
| `coin-pocket-ho-oh-lugia` | COIN | Moeda Ho-Oh e Lugia | Gratuito | NONE | #766F66 #1A2A15 |
| `coin-pocket-hoopa` | COIN | Moeda Hoopa | Gratuito | NONE | #8A6E6F #B7347C |
| `coin-pocket-iono` | COIN | Moeda Iono | Gratuito | NONE | #979370 #D4A007 |
| `coin-pocket-koraidon` | COIN | Moeda Koraidon | Gratuito | NONE | #6D4955 #000000 |
| `coin-pocket-leafeon` | COIN | Moeda Leafeon | Gratuito | NONE | #11602C #0C6C0C |
| `coin-pocket-lillie` | COIN | Moeda Lillie | Gratuito | NONE | #A6AB9E #181D1D |
| `coin-pocket-lilliever-2` | COIN | Moeda Lillie (versão 2) | Gratuito | NONE | #7C7A75 #F6F5C9 |
| `coin-pocket-lucario` | COIN | Moeda Lucario | Gratuito | NONE | #375A6B #177CAD |
| `coin-pocket-manaphy` | COIN | Moeda Manaphy | Gratuito | NONE | #327F96 #0992D1 |
| `coin-pocket-may` | COIN | Moeda May | Gratuito | NONE | #7E5452 #920700 |
| `coin-pocket-megaabsol` | COIN | Moeda Mega Absol | Gratuito | NONE | #698393 #0F3F7B |
| `coin-pocket-megaaltaria` | COIN | Moeda Mega Altaria | Gratuito | NONE | #B4B9BC #8187F1 |
| `coin-pocket-megablaziken` | COIN | Moeda Mega Blaziken | Gratuito | NONE | #86674A #E04F17 |
| `coin-pocket-megacharizardx` | COIN | Moeda Mega Charizard X | Gratuito | NONE | #3C5E6C #10465F |
| `coin-pocket-megacharizardy` | COIN | Moeda Mega Charizard Y | Gratuito | NONE | #8C773B #110000 |
| `coin-pocket-megagardevoir` | COIN | Moeda Mega Gardevoir | Gratuito | NONE | #767B6D #72C42E |
| `coin-pocket-shinymegagengar` | COIN | Moeda Mega Gengar Brilhante | Gratuito | NONE | #8E8C90 #9971A9 |
| `coin-pocket-megagyarados` | COIN | Moeda Mega Gyarados | Gratuito | NONE | #3C5E72 #0C63BC |
| `coin-pocket-megakangaskhan` | COIN | Moeda Mega Kangaskhan | Gratuito | NONE | #71604B #724A21 |
| `coin-pocket-megalucario` | COIN | Moeda Mega Lucario | Gratuito | NONE | #4D5C56 #08588F |
| `coin-pocket-megarayquaza` | COIN | Moeda Mega Rayquaza | Gratuito | NONE | #4C764C #55DA82 |
| `coin-pocket-megasceptile` | COIN | Moeda Mega Sceptile | Gratuito | NONE | #51673B #020A03 |
| `coin-pocket-meowth` | COIN | Moeda Meowth | Gratuito | NONE | #898063 #F3BA5A |
| `coin-pocket-metagross` | COIN | Moeda Metagross | Gratuito | NONE | #416571 #1DCAEF |
| `coin-pocket-mew` | COIN | Moeda Mew | Gratuito | NONE | #7B737D #9E65AE |
| `coin-pocket-mewtwo` | COIN | Moeda Mewtwo | Gratuito | NONE | #8F8591 #AE6BB3 |
| `coin-pocket-shinymewtwo` | COIN | Moeda Mewtwo Brilhante | Gratuito | NONE | #6D7D68 #5F5B60 |
| `coin-pocket-mimikyu` | COIN | Moeda Mimikyu | Gratuito | NONE | #797155 #08070A |
| `coin-pocket-miraidon` | COIN | Moeda Miraidon | Gratuito | NONE | #646A75 #6C48E7 |
| `coin-pocket-morpeko` | COIN | Moeda Morpeko | Gratuito | NONE | #54445D #561D8E |
| `coin-pocket-oshawott` | COIN | Moeda Oshawott | Gratuito | NONE | #7F9390 #53E1DE |
| `coin-pocket-pichu` | COIN | Moeda Pichu | Gratuito | NONE | #8F8640 #FE9609 |
| `coin-pocket-pikachu` | COIN | Moeda Pikachu | Gratuito | NONE | #AA9419 #FC961F |
| `coin-pocket-pikachuver-2` | COIN | Moeda Pikachu (versão 2) | Gratuito | NONE | #8F7A1D #FD931A |
| `coin-pocket-piplup` | COIN | Moeda Piplup | Gratuito | NONE | #577B95 #0A81D7 |
| `coin-pocket-pokeball` | COIN | Moeda Poké Bola | Gratuito | NONE | #A26D6A #848484 |
| `coin-pocket-professoroak` | COIN | Moeda Professor Carvalho | Gratuito | NONE | #807E7E #A9AAAC |
| `coin-pocket-psyduck` | COIN | Moeda Psyduck | Gratuito | NONE | #B49A3B #F2A013 |
| `coin-pocket-quagsire` | COIN | Moeda Quagsire | Gratuito | NONE | #6E96A4 #4AA3D3 |
| `coin-pocket-red` | COIN | Moeda Red | Gratuito | NONE | #7D1528 #541414 |
| `coin-pocket-redrainbow` | COIN | Moeda Red Arco-Íris | Gratuito | NONE | #AE8E88 #876DCD |
| `coin-pocket-rowlet` | COIN | Moeda Rowlet | Gratuito | NONE | #8F8878 #A1672C |
| `coin-pocket-sableye` | COIN | Moeda Sableye | Gratuito | NONE | #514270 #662DB8 |
| `coin-pocket-serena` | COIN | Moeda Serena | Gratuito | NONE | #73524B #180200 |
| `coin-pocket-shayminskyforme` | COIN | Moeda Shaymin Forma Céu | Gratuito | NONE | #948F83 #15A222 |
| `coin-pocket-silvally` | COIN | Moeda Silvally | Gratuito | NONE | #7A7D81 #000000 |
| `coin-pocket-sobble` | COIN | Moeda Sobble | Gratuito | NONE | #6C8A96 #FFF963 |
| `coin-pocket-solgaleo` | COIN | Moeda Solgaleo | Gratuito | NONE | #A39A89 #FB7F0C |
| `coin-pocket-sprigatito` | COIN | Moeda Sprigatito | Gratuito | NONE | #6B8660 #2DAA0A |
| `coin-pocket-suicune` | COIN | Moeda Suicune | Gratuito | NONE | #688494 #0790A6 |
| `coin-pocket-sylveon` | COIN | Moeda Sylveon | Gratuito | NONE | #A89EA4 #D3698B |
| `coin-pocket-toxtricity` | COIN | Moeda Toxtricity | Gratuito | NONE | #4D4F6F #7225C4 |
| `coin-pocket-tyranitar` | COIN | Moeda Tyranitar | Gratuito | NONE | #6E7D5E #3C7A17 |
| `coin-pocket-ultranecrozma` | COIN | Moeda Ultra Necrozma | Gratuito | NONE | #76724C #B6A20B |
| `coin-pocket-venusaur` | COIN | Moeda Venusaur | Gratuito | NONE | #52786C #593514 |
| `coin-pocket-alolanvulpix` | COIN | Moeda Vulpix de Alola | Gratuito | NONE | #9FAAB0 #010204 |
| `coin-pocket-yamper` | COIN | Moeda Yamper | Gratuito | NONE | #ACA572 #CAB786 |
| `coin-pocket-zapdos` | COIN | Moeda Zapdos | Gratuito | NONE | #AD9F58 #F3C625 |
| `coin-pocket-zoroark` | COIN | Moeda Zoroark | Gratuito | NONE | #592C3E #272C39 |
| `flair-basic` | FLAIR | Brilho Básico | Gratuito | NONE | #FFFFFF #2DECE5 |
| `flair-c01` | FLAIR | Brilho Celadon | Concessão (medal-c01) após C01-E06 | NONE | #DFF5E3 #72B75D |
| `flair-c02` | FLAIR | Brilho Sootopolis | Concessão (medal-c02) após C02-E06 | NONE | #BFE9FA #2DECE5 |
| `flair-c03` | FLAIR | Brilho Vermilion | Concessão (medal-c03) após C03-E06 | NONE | #FFF1B8 #E8C83E |
| `flair-c04` | FLAIR | Brilho Saffron | Concessão (medal-c04) após C04-E06 | NONE | #E7DDF5 #A279CB |
| `flair-c05` | FLAIR | Brilho Stow-on-Side | Concessão (medal-c05) após C05-E06 | NONE | #FBD9C9 #EF785B |
| `flair-c06` | FLAIR | Brilho Viridian | Concessão (medal-c06) após C06-E06 | NONE | #FBF8EF #75C7FA |

| Preset | Playmat | Verso | Moeda | Flair |
|---|---|---|---|---|
| `preset-player-default` | mat-neutral | sleeve-neutral | coin-pocket-pokeball | flair-basic |
| `preset-npc-academy` | mat-academy | sleeve-pocket-professoroak | coin-pocket-pokeball | flair-basic |
| `preset-npc-c01` | mat-c01-grove | sleeve-pocket-erikaandvileplume | coin-pocket-erikaalt | flair-c01 |
| `preset-npc-c02` | mat-c02-harbor | sleeve-pocket-blastoise | coin-pocket-blastoise | flair-c02 |
| `preset-npc-c03` | mat-c03-circuits | sleeve-pocket-pikachu | coin-pocket-pikachu | flair-c03 |
| `preset-npc-c04` | mat-c04-observatory | sleeve-pocket-mewtwo | coin-pocket-mewtwo | flair-c04 |
| `preset-npc-c05` | mat-c05-foundry | sleeve-pocket-lucario | coin-pocket-lucario | flair-c05 |
| `preset-npc-c06` | mat-c06-archive | sleeve-pocket-charizard | coin-pocket-charizard | flair-c06 |
| `preset-npc-final` | mat-circuit-complete | sleeve-pocket-teamrocketsboss | coin-pocket-teamrocketsboss | flair-basic |

## 🧑‍🤝‍🧑 14. NPCs e perfis de IA

Todos os adversários são personagens locais controlados por IA. STORY: orçamento pequeno e 25% de chance de escolha subótima; STANDARD: orçamento médio; EXPERT: busca ampla.

| NPC | Título | Capítulo | Estilo | Dicas do caderno |
|---|---|---|---|---|
| **Cheren** `lia` | Professor da Escola de Treinadores | P00 | Paciente e direto; joga o básico bem feito e explica cada passo. | Cheren evolui assim que pode; deixe uma reserva pronta no Banco. / No exame final ele usa trocas por efeito: conte o Recuo antes de comprometer Energias. |
| **Erika** `iris` | Líder do Ginásio de Celadon | C01 | Planta com calma: enche o Banco e prepara o segundo atacante enquanto o primeiro aguenta. | Erika nunca concentra todas as Energias num só Pokémon. / Pólen carrega o Banco dela: pressione antes que a reserva evolua. / Fogo encontra Fraqueza em quase todo o jardim. |
| **Wallace** `mara` | Líder do Ginásio de Sootopolis | C02 | Alterna atacantes e preserva Energias para o turno seguinte. | Wallace recua quando o Ativo corre risco; finalize antes da troca. / Elétrico explora a Fraqueza da Água. / Lontra no Banco barateia o Recuo dele. |
| **Tenente Surge** `teo` | Líder do Ginásio de Vermilion | C03 | Monta uma fonte de Energia no Banco e descarrega tudo num atacante principal. | Magneton se carrega sozinho uma vez por turno; a carta Tenente Surge leva a carga para a frente. / Hitmonlee alcança o Banco: interrompa a fonte. / Raichu descarta todas as Energias ao atacar. |
| **Sabrina** `nara` | Líder do Ginásio de Saffron | C04 | Joga com o tempo: condições especiais, Habilidades e durações bem medidas. | Gengar no Ativo impede que você jogue Apoiadores. / Trocar, recuar ou evoluir remove condições especiais. / Gardevoir liga Energia Psíquica ao Ativo dela a cada turno. |
| **Bea** `breno` | Líder do Ginásio de Stow-on-Side | C05 | Empilha modificadores de dano; Melmetal e Giovanni mudam todas as contas. | Dano de Habilidade não sofre a redução do Melmetal. / Machamp precisa de três Energias: derrube-o antes. / Metálico é fraco a Fogo. |
| **Blue** `sol` | Líder do Ginásio de Viridian | C06 | Conta pontos antes de tudo; alterna risco entre ex e apoio de um ponto. | Os ex de Blue valem 2 pontos: escolha bem o alvo. / Gardevoir no Banco acelera o Mewtwo ex. / Contar pontos vale mais que maximizar dano. |
| **Giovanni** `aurora` | Chefe da Equipe Rocket | F00 | Combina cura em campo e um atacante de alto risco — tudo à vista na mesa. | O Charizard ex de Giovanni vale 2 pontos. / Butterfree cura 20 de todos os Pokémon dele a cada turno. / Moltres ex distribui Energia de Fogo pelo Banco. |
| **Milo** `caio` | Líder do Ginásio de Turffield | C01 | Só Básicos e muita calma. | Milo não evolui: aproveite para encher o seu Banco. |
| **Gardenia** `dora` | Líder do Ginásio de Eterna | C01 | Duas linhas evolutivas em paralelo. | Derrube o Básico antes da evolução chegar. |
| **Viola** `taina` | Líder do Ginásio de Santalune | C01 | Alterna duas linhas de Estágio 1. | Viola traz Básicos direto do baralho com Mudas Prontas. |
| **Marlon** `rui` | Líder do Ginásio de Humilau | C02 | Atacantes com Recuos bem diferentes. | Dewgong quase não recua: é um alvo parado. |
| **Crasher Wake** `luma` | Líder do Ginásio de Pastoria | C02 | Cura e troca sem parar. | Cada troca de Crasher Wake cura um pouco; finalize de uma vez. |
| **Melony** `icaro` | Líder do Ginásio de Circhester | C02 | Força você a trocar de Ativo. | Tenha mais de um atacante pronto no Banco. |
| **Elesa** `bia` | Líder do Ginásio de Nimbasa | C03 | Ataques com custo específico e Incolor. | Conte as Energias que Elesa ainda precisa para atacar. |
| **Clemont** `otto` | Líder do Ginásio de Lumiose | C03 | Acelera Energia do Banco. | Magneton liga Energia a si mesmo uma vez por turno. |
| **Iono** `vivi` | Líder do Ginásio de Levincia | C03 | Paralisia na moeda e dano no Banco. | Pincurchin e Eelektross podem Paralisar o seu Ativo. / Mover Energia não dispara o Fusível. |
| **Koga** `davi` | Líder do Ginásio de Fuchsia | C04 | Veneno e paciência. | Trocar o Ativo envenenado remove o Veneno. |
| **Liza** `lis` | Líder do Ginásio de Mossdeep | C04 | Sono e Confusão em cartas diferentes. | Evoluir um Pokémon com condição remove a condição. |
| **Morty** `enzo` | Líder do Ginásio de Ecruteak | C04 | Veneno com uma condição de controle. | Veneno e Sono coexistem; uma troca limpa os dois. |
| **Chuck** `malu` | Líder do Ginásio de Cianwood | C05 | Apoiadores no turno certo. | A carta Giovanni soma 10 a todos os ataques do turno. |
| **Roark** `bento` | Líder do Ginásio de Oreburgh | C05 | Pokémon pesados e lentos. | A carta Brock liga Energia de Lutador direto no Onix ou no Golem. |
| **Jasmine** `jade` | Líder do Ginásio de Olivine | C05 | Defesa blindada. | Melmetal recebe 20 a menos de dano de ataques. / Cubone reduz o seu dano no turno seguinte. |
| **Korrina** `iago` | Líder do Ginásio de Shalour | C06 | Só Pokémon de um ponto. | Cada Nocaute vale um ponto; ganhe no ritmo. |
| **Blaine** `clara` | Líder do Ginásio de Cinnabar | C06 | Um ex protegido por apoio. | Arcanine ex vale 2 pontos; Vulpix trava o seu ataque. |
| **Clay** `nico` | Líder do Ginásio de Driftveil | C06 | Tudo para os ex de Lutador. | Marowak ex e Machamp ex valem 2 pontos cada. |

| Perfil | Política | Orçamento (nós/profundidade/determinizações) | Subótimo | Alvo | Pesos (pontos, dano, energia, evolução, Banco, condições) |
|---|---|---|---:|---|---|
| `lia-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.84 / 0.7 / 0.35 |
| `lia-standard-v1` | Padrão | 2500/3/4 | 0.08 | MAX_DAMAGE | 3 / 1 / 1 / 1.2 / 1 / 0.5 |
| `lia-expert-v1` | Especialista | 4000/8/4 | 0 | MAX_DAMAGE | 3.45 / 1.15 / 1.15 / 1.38 / 1.15 / 0.57 |
| `iris-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 1.26 / 1.26 / 0.35 |
| `iris-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1.8 / 1.8 / 0.5 |
| `iris-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 2.07 / 2.07 / 0.57 |
| `mara-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.56 / 0.84 / 0.7 / 0.56 / 0.35 |
| `mara-standard-v1` | Padrão | 2500/3/4 | 0.08 | MAX_DAMAGE | 3 / 0.8 / 1.2 / 1 / 0.8 / 0.5 |
| `mara-expert-v1` | Especialista | 4000/8/4 | 0 | MAX_DAMAGE | 3.45 / 0.92 / 1.38 / 1.15 / 0.92 / 0.57 |
| `teo-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 1.75 / 0.7 / 0.84 / 0.35 |
| `teo-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 2.5 / 1 / 1.2 / 0.5 |
| `teo-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 2.88 / 1.15 / 1.38 / 0.57 |
| `nara-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 1.75 |
| `nara-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 2.5 |
| `nara-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 2.88 |
| `breno-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `breno-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 0.5 |
| `breno-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `sol-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.8 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `sol-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_HIGH_POINTS | 4 / 1 / 1 / 1 / 0.8 / 0.5 |
| `sol-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_HIGH_POINTS | 4.6 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `aurora-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.8 / 1.05 / 1.05 / 1.05 / 0.56 / 0.35 |
| `aurora-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_HIGH_POINTS | 4 / 1.5 / 1.5 / 1.5 / 0.8 / 0.5 |
| `aurora-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_HIGH_POINTS | 4.6 / 1.73 / 1.73 / 1.73 / 0.92 / 0.57 |
| `caio-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 1.26 / 1.26 / 0.35 |
| `caio-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1.8 / 1.8 / 0.5 |
| `caio-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 2.07 / 2.07 / 0.57 |
| `dora-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 1.26 / 1.26 / 0.35 |
| `dora-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1.8 / 1.8 / 0.5 |
| `dora-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 2.07 / 2.07 / 0.57 |
| `taina-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 1.26 / 1.26 / 0.35 |
| `taina-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1.8 / 1.8 / 0.5 |
| `taina-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 2.07 / 2.07 / 0.57 |
| `rui-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.56 / 0.84 / 0.7 / 0.56 / 0.35 |
| `rui-standard-v1` | Padrão | 2500/3/4 | 0.08 | MAX_DAMAGE | 3 / 0.8 / 1.2 / 1 / 0.8 / 0.5 |
| `rui-expert-v1` | Especialista | 4000/8/4 | 0 | MAX_DAMAGE | 3.45 / 0.92 / 1.38 / 1.15 / 0.92 / 0.57 |
| `luma-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.56 / 0.84 / 0.7 / 0.56 / 0.35 |
| `luma-standard-v1` | Padrão | 2500/3/4 | 0.08 | MAX_DAMAGE | 3 / 0.8 / 1.2 / 1 / 0.8 / 0.5 |
| `luma-expert-v1` | Especialista | 4000/8/4 | 0 | MAX_DAMAGE | 3.45 / 0.92 / 1.38 / 1.15 / 0.92 / 0.57 |
| `icaro-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.56 / 0.84 / 0.7 / 0.56 / 0.35 |
| `icaro-standard-v1` | Padrão | 2500/3/4 | 0.08 | MAX_DAMAGE | 3 / 0.8 / 1.2 / 1 / 0.8 / 0.5 |
| `icaro-expert-v1` | Especialista | 4000/8/4 | 0 | MAX_DAMAGE | 3.45 / 0.92 / 1.38 / 1.15 / 0.92 / 0.57 |
| `bia-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 1.75 / 0.7 / 0.84 / 0.35 |
| `bia-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 2.5 / 1 / 1.2 / 0.5 |
| `bia-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 2.88 / 1.15 / 1.38 / 0.57 |
| `otto-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 1.75 / 0.7 / 0.84 / 0.35 |
| `otto-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 2.5 / 1 / 1.2 / 0.5 |
| `otto-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 2.88 / 1.15 / 1.38 / 0.57 |
| `vivi-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 1.75 / 0.7 / 0.84 / 0.35 |
| `vivi-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 2.5 / 1 / 1.2 / 0.5 |
| `vivi-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 2.88 / 1.15 / 1.38 / 0.57 |
| `davi-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 1.75 |
| `davi-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 2.5 |
| `davi-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 2.88 |
| `lis-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 1.75 |
| `lis-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 2.5 |
| `lis-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 2.88 |
| `enzo-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 1.75 |
| `enzo-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 2.5 |
| `enzo-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 2.88 |
| `malu-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `malu-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 0.5 |
| `malu-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `bento-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `bento-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 0.5 |
| `bento-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `jade-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.1 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `jade-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_KNOCKOUT | 3 / 1 / 1 / 1 / 0.8 / 0.5 |
| `jade-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_KNOCKOUT | 3.45 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `iago-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.8 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `iago-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_HIGH_POINTS | 4 / 1 / 1 / 1 / 0.8 / 0.5 |
| `iago-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_HIGH_POINTS | 4.6 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `clara-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.8 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `clara-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_HIGH_POINTS | 4 / 1 / 1 / 1 / 0.8 / 0.5 |
| `clara-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_HIGH_POINTS | 4.6 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |
| `nico-story-v1` | História | 200/1/1 | 0.25 | MAX_DAMAGE | 2.8 / 0.7 / 0.7 / 0.7 / 0.56 / 0.35 |
| `nico-standard-v1` | Padrão | 2500/3/4 | 0.08 | PREFER_HIGH_POINTS | 4 / 1 / 1 / 1 / 0.8 / 0.5 |
| `nico-expert-v1` | Especialista | 4000/8/4 | 0 | PREFER_HIGH_POINTS | 4.6 / 1.15 / 1.15 / 1.15 / 0.92 / 0.57 |

## 📝 15. Decisões de conteúdo

- Cada capítulo usa um dos três pacotes do Genetic Apex pela temática de tipos (P00, C02, C03 → Pikachu; C01, C05 → Charizard; C04, C06 → Mewtwo; F00 → os três). Pool de cada pacote = impressões daquele pacote + as que não pertencem a nenhum; peso por símbolo (◊–◊◊◊◊ 10, ☆ 4, ☆☆ 3, ☆☆☆ 1, ♛ 1).
- Ultra dirigida só após o chefe que fecha o pacote de origem; Mew ☆☆☆ e as coroas ♛ (sem pacote) só após F00-D03. Objetivos de composição por tipo (`minTypeCards`) usam cartas à venda antes do encontro.
- Reimpressões do set (artes alternativas e o Eevee repetido) são impressões da mesma carta de jogo: o limite de 2 cópias vale para todas juntas.
- P00-T06 usa fixture TUTORIAL em preparação, com mãos e ordem de baralho fixas (Maré Serena × Chama da Escola); a dificuldade só troca o perfil de IA de Cheren — o deck do NPC é único (`npc-p00-t06-v1`) e idêntico ao lado NPC da fixture.
- Tutoriais T01–T05 e puzzles usam `npcScript`; se um comando roteirizado do NPC deixar de ser legal porque o humano jogou diferente, a aplicação deve substituí-lo por encerrar o turno (o roteiro nunca joga a favor do NPC).
- Condição especial nos rótulos: Envenenado, Queimado, Adormecido, Paralisado, Confuso.
- `minBasic` em composição conta Pokémon Básicos distintos (C01-E05: “dois Básicos diferentes”).

### 15.1. Limitações conhecidas do motor e do gerador de texto

- A estatística `knockoutsWithoutAttack` do motor também conta Nocautes por ataque (o quadro do ataque é removido antes do KO_CHECK); por isso o Ativo do puzzle C05-E02 não consegue Nocautear atacando (Revestimento Rígido zera o Chute Baixo).
- Fixtures declaram condições especiais iniciais: C04-E02 começa no turno do jogador com o Ativo Adormecido.
- Dragonite (Meteoro Dracônico) é codificado como quatro blocos de dano em 1 alvo aleatório cada — o mesmo Pokémon pode ser escolhido mais de uma vez, como no texto do set.


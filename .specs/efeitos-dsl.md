# 🧪 Effect DSL v1 — linguagem de efeitos, seletores e opcodes

> **Versão:** 3.2.0 · **Revisão:** 14 de outubro de 2026  
> **Identificador:** `effects-dsl-v1` · **Ruleset:** `local-campaign-v2` · **Formato de carta:** `dataVersion 2`  
> **Autoridade:** estrutura executável de ataques, Habilidades e Treinadores. Regras gerais continuam em [gameplay.md](gameplay.md); autoria em [editor-de-cartas.md](editor-de-cartas.md); schema estrutural em [card-definition.schema.json](schemas/card-definition.schema.json).
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — esta spec não define aparência.

> **Revisão 3.3.0 (em preparação; conteúdo 3.0.0, sets depois do Genetic Apex):** escopo `TARGET`; filtros, fórmulas, condições e filtros de gatilho novos; 20 opcodes novos (54 no registro, 12 contínuos); parâmetros novos nos opcodes existentes; custo alternativo de ataque e dano que ignora efeitos no Defensor; Habilidade `UNLIMITED`; gatilho de Ferramenta (`toolTrigger`) e `onKnockedOut`; decisão `SELECT_MODE`; Nocaute em duas etapas (§13.3); regras novas do texto gerado (§15); critérios `FX-025`…`FX-041`. Todas as extensões são compatíveis com as cartas existentes (`effects-dsl-v1` continua valendo).

## 🧭 Sumário

- [🎯 1. Objetivo e princípios](#dsl-1)
- [🧱 2. Blocos de efeito](#dsl-2)
- [🎯 3. Seletores e filtros](#dsl-3)
- [🧮 4. Fórmulas](#dsl-4)
- [❓ 5. Condições](#dsl-5)
- [⏳ 6. Durações e expiração](#dsl-6)
- [⚡ 7. Gatilhos](#dsl-7)
- [💳 8. Custos adicionais e precondições](#dsl-8)
- [🧰 9. Registro de opcodes](#dsl-9)
- [⚔️ 10. Ataques](#dsl-10)
- [✨ 11. Habilidades](#dsl-11)
- [🧑‍🏫 12. Treinadores, Ferramentas, Estádios e Fósseis](#dsl-12)
- [🔁 13. Ordem de resolução](#dsl-13)
- [📐 14. Modificadores contínuos e valores derivados](#dsl-14)
- [🧾 15. Texto gerado](#dsl-15)
- [🚫 16. Validação e erros](#dsl-16)
- [📚 17. Exemplos do catálogo inicial](#dsl-17)
- [✅ 18. Critérios de aceite](#dsl-18)

---

<a id="dsl-1"></a>

## 🎯 1. Objetivo e princípios

O DSL é a única forma de uma carta alterar o estado de uma partida. É **dado declarativo**, nunca código: não existe `eval`, script, shader nem texto livre interpretado. O motor possui um **registro de opcodes**; cada opcode declara parâmetros, validação, execução, texto gerado e dicas para a IA. O Estúdio monta sua biblioteca a partir desse mesmo registro, então um efeito só aparece para autoria quando executa de verdade.

| Princípio | Consequência |
|---|---|
| Opcode desconhecido é erro de conteúdo. | A carta não é publicada nem entra em produção (G-056, ED-027). |
| Toda escolha tem dono explícito. | `chooser` nunca é deduzido da posição na mesa. |
| Toda duração é referência a turnos de participantes. | Não há segundos, frames ou contadores genéricos. |
| Efeitos contínuos são recalculados. | Nada contínuo é aplicado uma vez como alteração permanente de atributo. |
| Aleatoriedade só pelo `battleRng`. | Moedas e sorteios ocorrem antes da apresentação. |
| Saída nomeada antes do uso. | `outputId` precisa existir em bloco anterior; o validador rejeita referência para frente. |

Versões: o documento de regra de uma carta pode declarar `"effectsDsl": 1`. Ausência equivale a 1 nesta linha. Uma mudança incompatível do DSL cria `effects-dsl-v2` e um adaptador explícito; cartas publicadas nunca são reinterpretadas silenciosamente.

---

<a id="dsl-2"></a>

## 🧱 2. Blocos de efeito

Um **bloco** é a unidade ordenada de resolução.

```json
{
  "id": "heal-self",
  "timing": "POST_DAMAGE",
  "condition": null,
  "optional": false,
  "failurePolicy": "BEST_EFFORT",
  "operation": {
    "type": "HEAL_DAMAGE",
    "target": {"scope": "SELF"},
    "amount": 10
  }
}
```

| Campo | Obrigatório | Contrato |
|---|---|---|
| `id` | Sim | Único dentro da versão da carta; usado em logs, replays e testes. |
| `timing` | Sim | Momento de execução (tabela abaixo). |
| `condition` | Não | [Condição](#dsl-5) avaliada no momento do bloco; falsa = bloco ignorado sem erro. |
| `optional` | Não, padrão `false` | O controlador do efeito pode recusar no momento do bloco. |
| `failurePolicy` | Não | Padrão `BEST_EFFORT` em ataques/Habilidades e `REQUIRE_ANY` em `ON_PLAY` de Treinadores. |
| `operation` | Sim | Objeto com `type` igual a um opcode do [registro](#dsl-9). |

| `timing` | Onde é aceito | Quando executa |
|---|---|---|
| `PRE_DAMAGE` | Ataque | Depois de pagar custos e da moeda de Confusão; antes do dano principal. |
| `POST_DAMAGE` | Ataque | Depois do dano principal, antes do processamento de Nocautes do ataque. |
| `ON_PLAY` | Item, Apoiador, Fóssil | Ao jogar a carta da mão. |
| `ON_ACTIVATE` | Habilidade `ACTIVATED` | Ao usar a Habilidade. |
| `ON_TRIGGER` | Habilidade `TRIGGERED`, Ferramenta, Estádio | Quando o [gatilho](#dsl-7) casa. |
| `CONTINUOUS` | Habilidade `CONTINUOUS`, Ferramenta, Estádio | Enquanto a fonte for válida; só aceita opcodes contínuos. |
| `REPLACEMENT` | Habilidade `REPLACEMENT`, Ferramenta | Intercepta um evento antes de aplicá-lo. |

### 2.1. Política de falha

| `failurePolicy` | Ao declarar/jogar | Ao resolver |
|---|---|---|
| `REQUIRE_ANY` | Ilegal se o bloco não puder produzir **nenhum** efeito. | Resolve o possível. |
| `REQUIRE_ALL` | Ilegal se o efeito completo não for possível (ex.: exige dois alvos). | Resolve o possível se algo mudou entre declaração e resolução. |
| `BEST_EFFORT` | Nunca torna a ação ilegal. | Resolve o possível; zero alvos = bloco sem efeito. |

Regra geral (gameplay §14.4): um Treinador ou Habilidade cujo bloco obrigatório não produz efeito algum **não pode ser jogado/usado**; assim a carta nunca é desperdiçada. A verificação de uma busca usa o baralho real, mas a UI informa apenas “nenhum alvo possível”, sem revelar ordem.

---

<a id="dsl-3"></a>

## 🎯 3. Seletores e filtros

### 3.1. Seletor de Pokémon

```json
{
  "scope": "OWN_POKEMON",
  "filter": {"hasDamage": true},
  "pick": {"mode": "CHOOSE", "chooser": "CONTROLLER", "min": 1, "max": 1},
  "outputId": "healed"
}
```

| `scope` | Conjunto inicial |
|---|---|
| `SELF` | A entidade à qual o efeito pertence: atacante, dono da Habilidade ou Pokémon que segura a Ferramenta. |
| `OWN_ACTIVE` / `OPPONENT_ACTIVE` | Ativo do controlador / do adversário. |
| `OWN_BENCH` / `OPPONENT_BENCH` | Banco correspondente. |
| `OWN_POKEMON` / `OPPONENT_POKEMON` | Ativo + Banco do lado. |
| `ALL_POKEMON` | Todos os Pokémon em campo. |
| `EVENT_SOURCE` / `EVENT_TARGET` | Origem/alvo do evento que disparou o gatilho ou foi interceptado. |
| `OUTPUT` | Alvos guardados por um `outputId` anterior (`"ref": "id"`). |
| `DEFENDING` | **Só em efeitos de ataque.** O Pokémon Defensor: o Ativo adversário no momento da declaração do ataque (no ataque copiado por `COPY_ATTACK`, o Ativo adversário do momento da cópia). É **fixo nessa entidade**, não na posição: `MODIFY`/`RESTRICT_ACTION`/`PREVENT_*`/`SUPPRESS_ABILITIES` aplicados a ele ficam presos a ela e respeitam `removeOn` (ex.: `TARGET_LEAVES_ACTIVE`). Fora de jogo = conjunto vazio. Em Habilidades, Treinadores e efeitos atrasados é `SELECTOR_IMPOSSIBLE`. Texto: “o Pokémon Defensor”. |
| `TARGET` | O alvo do dano em cálculo: dentro de uma fórmula de dano avaliada **por alvo** (`damageFormula` do dano principal ou `amount` de `DEAL_DAMAGE`), cada alvo vê a si mesmo (ex.: Tapu Lele, “para cada Energia ligada a esse Pokémon”). Fora desse cálculo, é o alvo registrado na resolução: o Pokémon Defensor num ataque, o alvo de um efeito atrasado; vazio em Treinadores, Habilidades e gatilhos. Texto: “esse Pokémon”. |

“Controlador” é o jogador que controla a fonte do efeito. “Adversário” é o outro participante. Um Fóssil em campo conta como Pokémon para seletores, salvo `filter.excludeFossils: true`, e como **Pokémon Básico** em `filter.stages` (com os tipos de `fieldBehavior.types`).

Escopos de lado (`OWN_*`, `OPPONENT_*`, `ALL_POKEMON`) sem `pick` (ou com `pick: ALL`) alcançam **todos** os elegíveis: o texto gerado diz “cada um dos seus Pokémon”, “cada Pokémon no Banco do oponente” (efeitos um a um) ou “os seus Pokémon” (modificadores coletivos). Em opcodes contínuos (os 12 marcados com **C** na [§9](#dsl-9): `MODIFY`, `PREVENT_*`, `RESTRICT_ACTION`, `SUPPRESS_ABILITIES`, `ATTACK_COIN_GATE`, `COUNTER_DAMAGE`, `GRANT_RULE`, `SURVIVE_KNOCKOUT`, `REROLL_COINS`) esses escopos são **dinâmicos** (reavaliados a cada consulta); os demais (`SELF`, `DEFENDING`, `OUTPUT`, escolhas) são fixados nas entidades selecionadas.

| `pick.mode` | Contrato |
|---|---|
| `ALL` | Todos os elegíveis (padrão quando `pick` é omitido em escopos de um único Pokémon). |
| `CHOOSE` | `chooser` (`CONTROLLER` ou `OPPONENT`) escolhe entre `min` e `max` alvos distintos; gera decisão pendente. |
| `RANDOM` | `count` alvos distintos sorteados por `battleRng`. |

`PokemonFilter` aceita: `types`, `stages`, `ruleBoxes`, `deckLimitKeys`, `tags`, `hasDamage`, `hasCondition` (`true`/nome de condição), `hasTool`, `hasEnergy`, `positions` (`ACTIVE`/`BENCH`), `excludeSelf`, `excludeFossils` e os campos da tabela abaixo. Campos combinam por **E**; listas combinam por **OU**. Atributos de carta (Habilidades, ataques, `evolvesFrom`) são lidos da carta do topo da pilha.

| Campo | Casa quando |
|---|---|
| `hasAbility` | `true`: a carta do topo tem alguma Habilidade; `false`: não tem nenhuma. |
| `abilityIds` / `excludeAbilityIds` | Tem alguma Habilidade com um destes IDs / não tem nenhuma Habilidade com estes IDs (Unown GUARDA/PODER: “outro Unown com Habilidade diferente”). |
| `attackIds` | Tem algum ataque com um destes IDs (Monte de Filhotes). |
| `energyTypes` | Tem pelo menos uma Energia ligada de um destes tipos. |
| `evolvesFrom` | A carta do topo evolui de uma destas chaves (“Pokémon que evoluem de Eevee”); Fóssil nunca casa. |
| `evolvedThisTurn` | Evoluiu neste turno global (`lastEvolvedOnTurn`). |
| `movedToActiveThisTurn` | Está no Ativo e foi do Banco para o Ativo neste turno global (Recuo, troca por efeito ou promoção). |
| `damagedByAttackLastOpponentTurn` | Recebeu dano de ataque, estando no Ativo, no turno global anterior (o último turno do oponente). |
| `enteredPlayThisTurn` | Entrou em jogo neste turno global; `false` = já estava em jogo antes (Doce Raro). |

### 3.2. Seletor de cartas

```json
{"zone": "OWN_DECK", "filter": {"categories": ["POKEMON"], "stages": ["BASIC"]}, "count": 1, "mode": "RANDOM"}
```

`zone`: `OWN_HAND`, `OPPONENT_HAND`, `OWN_DECK`, `OPPONENT_DECK`, `OWN_DISCARD`, `OPPONENT_DISCARD`. `mode`: `CHOOSE` (controlador escolhe; em zona oculta do adversário vira `RANDOM`), `RANDOM`, `TOP` (topo do baralho). `CardFilter` aceita `categories`, `subtypes`, `stages`, `types`, `ruleBoxes`, `deckLimitKeys`, `tags`, `evolvesFromTarget` (cartas que evoluem do topo do alvo escolhido), `evolvesFrom` (Pokémon que evolui de uma destas chaves: “uma carta que evolui de Rockruff”), `attackIds` (Pokémon com algum destes ataques) e `excludeFossils`. Campos exclusivos de Pokémon (`stages`, `types`, `evolvesFrom*`, `attackIds`) nunca casam com Treinadores, e `subtypes` nunca casa com Pokémon.

Escolhas em zona oculta são privadas: o adversário recebe apenas quantidade e destino, salvo `reveal: true`.

---

<a id="dsl-4"></a>

## 🧮 4. Fórmulas

Fórmula é uma árvore de no máximo 32 nós e profundidade 6. Valores são inteiros; resultado final de dano/cura é limitado a `[0, 9990]`.

| `op` | Parâmetros | Valor |
|---|---|---|
| `CONST` | `value` (inteiro, pode ser negativo em operandos) | O próprio valor. |
| `ADD` / `MULTIPLY` / `MIN` / `MAX` | `operands` (1–8) | Soma, produto, mínimo, máximo. |
| `SUBTRACT` | `operands` (2) | Primeiro menos o segundo. |
| `CLAMP` | `operands` `[x, min, max]` | `min(max(x, min), max)`. |
| `COUNT_HEADS` / `COUNT_TAILS` | `reference` (`outputId` de `FLIP_COINS`) | Caras/coroas obtidas. |
| `COUNT_ATTACHED_ENERGIES` | `selector`, `energyType?` | Quantidade de anexos (objetos). |
| `COUNT_PROVIDED_ENERGY_UNITS` | `selector`, `energyType?` | Unidades fornecidas agora (com modificadores). |
| `COUNT_BENCH_POKEMON` | `side` (`OWN`/`OPPONENT`/`BOTH`) | Pokémon no Banco (não cartas da pilha). |
| `COUNT_POKEMON` | `selector` | Entidades que casam com o seletor. |
| `COUNT_CARDS` | `zone`, `filter?` | Cartas na zona. |
| `DAMAGE_ON_SOURCE` / `DAMAGE_ON_TARGET` | — | Dano acumulado (não HP restante) da fonte / do alvo atual. |
| `POINTS` | `side` | Pontos do lado. |
| `OUTPUT_COUNT` | `reference` | Quantidade de itens guardados por um `outputId`: moedas, Pokémon, cartas (`DISCARD_CARDS.outputId`) ou a contagem guardada por `SHUFFLE_HAND_INTO_DECK.outputId` (cartas que a mão tinha — Iono). |
| `REMAINING_HP` | `selector` | PS restantes (HP máximo efetivo − dano, piso 0) do primeiro Pokémon do seletor; 0 sem Pokémon. |
| `DISTINCT_ENERGY_TYPES` | `selector` | Quantos tipos diferentes de Energia estão ligados ao primeiro Pokémon do seletor. |
| `RETREAT_COST` | `selector` | Custo de Recuo efetivo atual do primeiro Pokémon do seletor (Fóssil = 0). |
| `OWN_TURN_NUMBER` | `side` (`OWN`/`OPPONENT`) | Número do turno próprio do jogador: 1 no primeiro turno dele (“não pode ser usada no seu primeiro turno” = `COMPARE(OWN_TURN_NUMBER, GT, 1)`). |
| `ATTACKS_USED` | `attackId`, `window` (`LAST_OWN_TURN`/`GAME`) | Quantas vezes Pokémon do controlador declararam o ataque `attackId`: no último turno próprio já jogado dele ou na partida inteira. O registro (`attackLog`) é feito na declaração; ataque copiado não conta. |
| `TOP_CARDS_MATCHING` | `count`, `filter?` | Quantas das `count` cartas do topo do baralho do controlador passam no filtro (sem revelar nem mover). |
| `EXTRA_ENERGY_UNITS` | `energyType?`, `selector?` (padrão `SELF`) | Unidades de Energia (do `energyType`, ou de qualquer tipo) ligadas ao atacante que **sobram depois de pagar o custo efetivo do ataque corrente**: requisitos específicos primeiro; o Incolor é pago antes com unidades que não são do `energyType`. Ex.: custo `{WATER: 2, COLORLESS: 1}` com 4 Água + 1 Fogo → 2 Água extras. Fora de um ataque não há custo a descontar. |
| `DAMAGE_DEALT_BY_ATTACK` | — | Dano efetivamente causado pelo dano principal do ataque corrente ao(s) alvo(s) (depois de Fraqueza, modificadores e prevenção). Lido em `POST_DAMAGE`; 0 antes do dano ou fora de ataque. |

O momento de leitura é o momento em que o bloco/dano principal é avaliado. `COUNT_HEADS` exige um `FLIP_COINS` anterior no mesmo ataque, normalmente `PRE_DAMAGE`. A fórmula do dano principal e o `amount` de `DEAL_DAMAGE` são avaliados **uma vez por alvo**: `DAMAGE_ON_TARGET` e o escopo `TARGET` (§3.1) referem-se ao alvo em cálculo.

---

<a id="dsl-5"></a>

## ❓ 5. Condições

| `op` | Parâmetros | Verdadeiro quando |
|---|---|---|
| `ALL` / `ANY` | `conditions` | Todas / alguma. |
| `NOT` | `condition` | A condição é falsa. |
| `COMPARE` | `left`, `cmp` (`EQ`,`NE`,`GT`,`GE`,`LT`,`LE`), `right` | Comparação de [fórmulas](#dsl-4). |
| `EXISTS` | `selector` | Ao menos um Pokémon casa (seleção não é feita). |
| `CARDS_EXIST` | `zone`, `filter?`, `count` | Há ao menos `count` cartas. |
| `SOURCE_POSITION` | `position` (`ACTIVE`/`BENCH`) | A fonte está na posição. |
| `HAS_CONDITION` | `selector`, `condition` (`ANY` ou nome) | Algum alvo possui a condição. |
| `IS_TURN_OF` | `side` | É turno do lado indicado. |
| `STADIUM_IN_PLAY` | — | Há um Estádio em jogo (de qualquer jogador). |
| `SUPPORTER_PLAYED_THIS_TURN` | — | É o turno do controlador e ele já jogou um Apoiador neste turno. |
| `KNOCKED_OUT_LAST_OPPONENT_TURN` | `filter?` (CardFilter da carta do topo) | Algum Pokémon do controlador foi Nocauteado com causa `ATTACK` (§7) durante o turno global anterior, o último turno do oponente. |
| `OUTPUT_CARDS_MATCH` | `reference`, `filter` | Alguma das cartas guardadas por `DISCARD_CARDS.outputId` (saída de cartas) passa no filtro (“se a carta descartada for um Pokémon …”). |

Condições não consomem RNG e não revelam informação oculta ao adversário.

---

<a id="dsl-6"></a>

## ⏳ 6. Durações e expiração

| `duration.kind` | Expira |
|---|---|
| `INSTANT` | Não deixa efeito persistente (padrão de opcodes não contínuos). |
| `THIS_TURN` | No fim do turno em que foi criado. |
| `NEXT_OPPONENT_TURN` | No fim do próximo turno próprio do adversário do controlador. |
| `NEXT_OWN_TURN` | No fim do próximo turno próprio do controlador. |
| `WHILE_SOURCE_IN_PLAY` | Quando a fonte sai de jogo, deixa de ser aplicável ou é suprimida. |

`removeOn` opcional: `TARGET_LEAVES_ACTIVE`, `TARGET_EVOLVES`, `TARGET_LEAVES_PLAY`, `SOURCE_LEAVES_ACTIVE`. Ao criar o efeito, o motor converte a duração em referência explícita `{ "playerId", "ownTurnNumber", "boundary": "END" }` e guarda no estado. Expirações rodam no ponto “Expirar …” do checkup (gameplay §16.3), depois dos efeitos de fim de turno.

---

<a id="dsl-7"></a>

## ⚡ 7. Gatilhos

```json
{
  "event": "ENERGY_ATTACHED",
  "filter": {"subject": "OPPONENT_POKEMON", "energySource": "ENERGY_ZONE", "attachmentMode": "MANUAL"}
}
```

| `event` | Filtros aceitos |
|---|---|
| `TURN_STARTED` / `TURN_ENDING` | `turnOf` (`OWN`/`OPPONENT`). |
| `POKEMON_ENTERED` | `subject`, `from` (`HAND`/`DECK`/`DISCARD`). |
| `POKEMON_EVOLVED` | `subject`. |
| `POKEMON_MOVED` | `subject`, `reason` (`RETREAT`/`SWITCH`/`PROMOTE`), `to` (`ACTIVE`/`BENCH`). |
| `ENERGY_ATTACHED` | `subject`, `energySource` (`ENERGY_ZONE`/`DISCARD`/`EFFECT`), `attachmentMode` (`MANUAL`/`CARD_EFFECT`), `energyType`. |
| `ATTACK_DECLARED` | `subject` (atacante). |
| `DAMAGE_APPLIED` | `subject`, `subjectRole` (`TARGET`/`SOURCE`), `damageCategory`, `minimum`, `turnOf` (jogador do turno corrente: `OPPONENT` = só dano causado no turno do oponente, como o Contra-ataque do Poliwrath). |
| `CONDITION_APPLIED` | `subject`, `condition`. |
| `POKEMON_KNOCKED_OUT` | `subject`, `subjectRole` (`TARGET` = o Nocauteado, padrão; `SOURCE` = o Pokémon cujo ataque causou o Nocaute), `cause` (`ATTACK`). Disparado no **anúncio** do Nocaute, com o Pokémon ainda em campo ([§13.3](#dsl-13)). |
| `TRAINER_PLAYED` | `turnOf`, `subtype`. |

`subject`: `SELF`, `OWN_POKEMON`, `OPPONENT_POKEMON`, `ANY_POKEMON`. Movimento de Energia entre Pokémon gera `ENERGY_MOVED`, que não casa `ENERGY_ATTACHED` (G-036). Energia ligada por `ATTACH_ENERGY` com origem `GENERATED` ou `ENERGY_ZONE_READY` sai “da sua Zona de Energia”: o evento traz `energySource: ENERGY_ZONE` (e `attachmentMode: CARD_EFFECT`); do descarte, `DISCARD`. O valor `EFFECT` continua aceito no filtro, mas nenhum opcode o emite.

**Causa do Nocaute** (`cause` do evento): `ATTACK` só quando o último dano recebido pelo Pokémon foi dano de categoria `ATTACK` (o ataque do oponente) **no turno global corrente**; dano de efeito dá `EFFECT`; Veneno e Queimadura, `CONDITION`; qualquer outro caminho — dano de ataque de um turno anterior somado a dano movido, PS perdidos ao remover uma Ferramenta, `KNOCK_OUT` num Pokémon que não recebeu dano neste turno, involução — dá `OTHER`. Só com `ATTACK` o evento traz `sourceEntityId`/`sourcePlayer` (o atacante), alcançáveis por `subjectRole: SOURCE` e pelo escopo `EVENT_SOURCE`.

**Gatilho de Ferramenta:** os blocos `ON_TRIGGER` de uma Ferramenta reagem a `trainerRules.toolTrigger`. Sem declaração, vale o gatilho padrão `{"event": "DAMAGE_APPLIED", "filter": {"subject": "SELF", "subjectRole": "TARGET", "damageCategory": "ATTACK", "turnOf": "OPPONENT"}}`: o portador recebe dano de ataque **no turno do oponente** — o dano que o ataque do próprio portador causa a ele mesmo não aciona (Capacete Rochoso contra o Golpe Sombrio do Mimikyu). Exemplos declarados: `TURN_ENDING` (“no fim de cada turno”), `TURN_ENDING` com `turnOf: OWN`, `POKEMON_KNOCKED_OUT` com `subject: SELF` e `cause: ATTACK` (Cabo Elétrico). `COUNTER_DAMAGE` cria, enquanto durar, um gatilho equivalente ao padrão no alvo (§9).

Gatilhos disparados durante uma resolução entram na fila **depois** do passo atômico corrente. Ordem entre gatilhos simultâneos: jogador do turno primeiro; dentro de um jogador, ordem estável por posição (Ativo, Banco 0–2) e depois por `id` do bloco; se a carta exigir escolha, o controlador escolhe a ordem. A ordem fica registrada no log/replay. Um gatilho não reage ao próprio evento que criou em cadeia além de **profundidade 8**; acima disso a resolução falha com `EFFECT_LOOP_DETECTED` e a carta é marcada como erro de conteúdo (gameplay §14.5).

---

<a id="dsl-8"></a>

## 💳 8. Custos adicionais e precondições

| `type` | Parâmetros | Pagamento |
|---|---|---|
| `DISCARD_ENERGY` | `from` (`SELF`), `energyType` (tipo ou `ANY`), `count` | Escolha de anexos concretos na declaração; descarte no commit. |
| `DISCARD_HAND_CARDS` | `count`, `filter?` | Escolha na declaração; descarte no commit. |

`preconditions` é uma lista de [condições](#dsl-5) verificadas na declaração/ativação. Custos são escolhidos antes do commit e podem ser cancelados até ele; depois do commit não há desfazer (gameplay §8.5). “Descarte para usar” é custo; “depois, descarte” é bloco `POST_DAMAGE`.

---

<a id="dsl-9"></a>

## 🧰 9. Registro de opcodes

Campos comuns omitidos: `target` é um [seletor de Pokémon](#dsl-3) (padrão indicado), `duration` segue a [§6](#dsl-6), `amount`/`count` aceitam inteiro ou [fórmula](#dsl-4). Coluna **C** indica se o opcode é aceito em `CONTINUOUS`/`REPLACEMENT`.

| Opcode | Parâmetros | Efeito | C |
|---|---|---|---|
| `FLIP_COINS` | `count` (1–20, inteiro ou fórmula) **ou** `untilTails: true`; `outputId` | Lança moedas justas; guarda caras/coroas e sequência. Sem teto secreto; proteção técnica de 1.000 lançamentos encerra com erro de conteúdo. Fórmula avaliada uma vez (“jogue uma moeda para cada …”); resultado 0 = nenhuma moeda. O resultado fica guardado na resolução: retomar uma decisão (ex.: relançar) não joga de novo. `FORCE_COIN` e `REROLL_COINS` agem sobre este opcode. | — |
| `DEAL_DAMAGE` | `target`, `amount`, `category` (`ATTACK` padrão em ataques, `EFFECT` em Habilidades/Treinadores), `applyWeakness` (padrão `false`), `ignoreDefenderModifiers` | Dano adicional ao principal, pelo pipeline da §13. `amount` é avaliado por alvo (escopo `TARGET`). | — |
| `HEAL_DAMAGE` | `target`, `amount` ou `"ALL"` | Remove dano acumulado; nunca aumenta HP máximo. Alvo sob `PREVENT_HEALING` não é curado. | — |
| `APPLY_CONDITION` | `target` (padrão `OPPONENT_ACTIVE`), `condition` (nome ou `"RANDOM"`), `poisonDamage?` | Aplica `POISONED`, `BURNED`, `ASLEEP`, `PARALYZED` ou `CONFUSED`; só afeta Ativos. `RANDOM`: uma Condição sorteada entre as que o alvo ainda não tem. `poisonDamage`: dano do Envenenamento deste efeito na Verificação (no lugar de 10; enquanto envenenado, vale o maior). Alvo sob `PREVENT_CONDITIONS` daquela Condição não é afetado. | — |
| `REMOVE_CONDITION` | `target`, `conditions` (lista, `"ALL"` ou `"RANDOM_ONE"`) | Remove condições sem curar dano. `RANDOM_ONE`: uma sorteada entre as que o alvo tem. | — |
| `DRAW_CARDS` | `player` (`OWN`/`OPPONENT`), `count` | Compra até `count`, respeitando mão 10 e baralho vazio. | — |
| `SEARCH_DECK` | `player` (`OWN`), `filter`, `count`, `mode` (`CHOOSE`/`RANDOM`), `destination` (`HAND`/`BENCH`), `reveal`, `shuffleAfter` (padrão `true`) | Busca no baralho próprio. Para `BENCH`, só Básicos e só com espaço. | — |
| `ATTACH_ENERGY` | `target`, `energyType` (tipo, `READY`, `RANDOM` ou `ZONE_RANDOM`), `energyTypes?`, `count` (inteiro 1–10 **ou fórmula**), `source` (`GENERATED`/`ENERGY_ZONE_READY`/`DISCARDED_ENERGY`), `consumesManualAttachment` (padrão `false`), `consumesReadyEnergy` (padrão `false`), `distribute?: true`, `perTarget?: true` | Liga Energia; origem registrada no evento (`ENERGY_ZONE` para `GENERATED`/`ENERGY_ZONE_READY`, `DISCARD` para o descarte — §7). Fórmula avaliada uma vez (ex.: `COUNT_HEADS`); resultado 0 = sem efeito e sem escolha. Sem `distribute`, todas as unidades vão para o mesmo alvo (o primeiro selecionado). Com `distribute: true`, **cada unidade** escolhe o próprio alvo entre os candidatos do seletor (`pick` CHOOSE 1 do controlador quando omitido/ALL; um mesmo Pokémon pode receber várias). `perTarget`: cada alvo escolhido recebe `count` unidades. `RANDOM`: cada unidade é de um dos 8 tipos, sorteado (do descarte: uma Energia descartada qualquer, sorteada); `ZONE_RANDOM`: um dos tipos da Zona do jogador. `energyTypes`: uma unidade de cada tipo listado, no lugar de `count`. Energia da Zona não chega a alvo sob `RESTRICT_ACTION RECEIVE_ZONE_ENERGY`. | — |
| `MOVE_ENERGY` | `from`, `to`, `energyType?`, `energyTypes?`, `count` (inteiro 1–10 ou `"ALL"`), `perTarget?: true` | Move anexos concretos; gera `ENERGY_MOVED`. `from` pode resolver para **várias origens** (`pick` ALL): a escolha é feita entre os anexos de todas; `"ALL"` move todos os elegíveis sem escolha. O destino nunca recebe de si mesmo. `energyTypes`: só Energias destes tipos. `perTarget`: uma unidade para cada destino escolhido (Cabo Elétrico: 1 Energia em cada um de 2 Pokémon no Banco). | — |
| `DISCARD_ENERGY` | `target`, `energyType?`, `energyTypes?`, `count` (inteiro, fórmula ou `"ALL"`), `chooser` (`CONTROLLER`/`OPPONENT`/`RANDOM`), `combined?: true` | Descarta anexos para as Energias descartadas do dono. `energyTypes`: uma de cada tipo listado (Explosão Elemental do Lugia ex). `combined`: um sorteio só entre as Energias de todos os alvos juntos (Redemoinho Furioso). | — |
| `SWITCH_ACTIVE` | `side` (`OWN`/`OPPONENT`), `chooser` (`CONTROLLER`/`OPPONENT`/`RANDOM`), `filter?` (PokemonFilter do Banco), `incoming?` (`SELF`) | Troca o Ativo pelo Banco escolhido; não é Recuo e não consome o Recuo. `filter` restringe quem pode entrar (ex.: `{"stages": ["BASIC"]}`; Fóssil conta como Básico). `incoming: SELF`: quem entra é o próprio Pokémon da Habilidade, que precisa estar no Banco (Solgaleo ex). | — |
| `EVOLVE` | `target`, `fromHand` (CardFilter), `skipStage`, `ignoreTurnRestrictions`, `from?` (`DECK`) | Evolução especial com requisitos próprios (gameplay §10.5). Da mão, só são alvos os Pokémon que alguma carta da mão consegue evoluir (com `skipStage`, um Estágio 2 cujo Estágio 1 evolui do Básico) e que não estão sob `RESTRICT_ACTION EVOLVE`: um Básico sem Estágio 2 correspondente não vira escolha (Doce Raro). `from: DECK`: evolui com uma carta aleatória do baralho do dono do alvo que evolui dele e embaralha esse baralho (Porygon2). | — |
| `MODIFY` | `stat`, `amount` (com sinal; inteiro ou fórmula), `target` (seletor dinâmico), `duration`, `energyType?`, `appliesTo?`, `exclusive?: true` | Modificador temporário ou contínuo (§14). `amount` em fórmula é reavaliado a cada consulta (Beastite: 10 × pontos). `exclusive`: efeitos iguais (mesmo `stat` e `energyType`) de cartas com o mesmo nome contam uma vez só (“não acumula”). | ✔ |
| `PREVENT_DAMAGE` | `target`, `categories`, `amount` ou `"ALL"`, `duration`, `charges?`, `attackerFilter?`, `coinFlip?: true` | Intercepta dano antes de aplicar; `charges` consumíveis. `attackerFilter`: só dano de atacantes que passem no filtro. `coinFlip`: a cada dano o dono do alvo joga uma moeda; cara = previne (tudo ou `amount`). | ✔ |
| `PREVENT_EFFECTS` | `target`, `fromSide` (`OPPONENT`), `duration` | Impede **todos** os efeitos (não dano) de ataques adversários — inclusive ataque copiado — sobre o alvo: o protegido sai dos candidatos de qualquer seletor de efeito (descartar Energia, condições, `RESTRICT_ACTION`, `MODIFY`, `PREVENT_*`, `SUPPRESS_ABILITIES`, devolver/embaralhar/descartar/Nocautear, mover Energia, remover Ferramenta, efeito atrasado) e não pode ser tirado do Ativo por `SWITCH_ACTIVE` de ataque. Um efeito contínuo dinâmico criado pelo ataque é fixado nos alvos não protegidos. Não barra o dano (use `PREVENT_DAMAGE`), Habilidades, Treinadores nem restrições só de jogador (`PLAY_ITEM`, `PLAY_SUPPORTER`, `MANUAL_ENERGY`). | ✔ |
| `RESTRICT_ACTION` | `target`, `actions` (`ATTACK`,`RETREAT`,`PLAY_ITEM`,`PLAY_SUPPORTER`,`USE_ABILITY`,`MANUAL_ENERGY`,`EVOLVE`,`RECEIVE_ZONE_ENERGY`), `duration`, `attackIds?` | Proíbe ações por duração definida. `EVOLVE`: o alvo não evolui por carta jogada da mão (ação de evoluir ou `EVOLVE` da mão — Aerodactyl ex). `RECEIVE_ZONE_ENERGY`: o alvo não recebe Energia da Zona, manual ou por efeito (Banette). `attackIds` com `ATTACK`: só esses ataques ficam proibidos. | ✔ |
| `SUPPRESS_ABILITIES` | `target`, `duration` | Habilidades do alvo deixam de contribuir (gameplay §13.8). | ✔ |
| `DISCARD_CARDS` | `zone` (`OWN_HAND`/`OPPONENT_HAND`/`OWN_DECK_TOP`/`OPPONENT_DECK_TOP`), `count`, `chooser` (`CONTROLLER`/`OPPONENT`/`RANDOM`), `filter?`, `upTo?: true`, `outputId?` | Descarta da mão ou do topo do baralho. `upTo`: o escolhedor descarta de 0 a `count`. `outputId` guarda as cartas descartadas (`OUTPUT_COUNT`, `OUTPUT_CARDS_MATCH`). | — |
| `RETURN_TO_HAND` | `target` | Devolve o Pokémon: topo e pilha para a mão (política de mão cheia gameplay §17.8); Energias para descartadas; Ferramenta para a mão ou descarte por espaço. | — |
| `SHUFFLE_INTO_DECK` | `target` | Pilha e Ferramenta embaralhadas no baralho; Energias para descartadas. | — |
| `DISCARD_POKEMON` | `target` | Pilha, Ferramenta e Energias ao descarte; **não** concede pontos (G-033). | — |
| `KNOCK_OUT` | `target` | Nocaute direto; concede pontos pelo pipeline de gameplay §17.2. | — |
| `PUT_ON_BENCH` | `from` (`HAND`/`DECK`/`DISCARD`), `filter`, `count`, `mode`, `side`, `chooser?` (`CONTROLLER`) | Coloca Básicos no Banco com espaço. `chooser: CONTROLLER`: quem jogou a carta escolhe mesmo no lado do oponente (Flauta Pokémon). | — |
| `RECOVER_FROM_DISCARD` | `filter`, `count`, `mode`, `destination` (`HAND`/`DECK`) | Recupera cartas do descarte próprio. | — |
| `LOOK_AT_TOP` | `player` (`OWN`/`OPPONENT`/`CHOOSE`), `count`, `reorder` | O controlador vê o topo e opcionalmente reordena; adversário vê só a contagem. `CHOOSE`: o controlador escolhe o baralho numa decisão `SELECT_MODE` (Unown CONFERIR). | — |
| `SHUFFLE_DECK` | `player` | Embaralha. | — |
| `REVEAL_HAND` | `player` | Revela a mão ao controlador até o fim da resolução. | — |
| `SHUFFLE_HAND_INTO_DECK` | `player` (`OWN`/`OPPONENT`), `outputId?` | O jogador embaralha a mão inteira no próprio baralho (Red Card = este + `DRAW_CARDS OPPONENT 3`). Evento `HAND_SHUFFLED_INTO_DECK` com `count` público e `cardIds` só para o dono (G-053), seguido de `DECK_SHUFFLED`. Mão vazia: só embaralha. `outputId` guarda quantas cartas a mão tinha (Iono: este + `DRAW_CARDS` com `OUTPUT_COUNT`, para cada jogador). | — |
| `SCHEDULE_DELAYED` | `target`, `at` (`END_OF_OPPONENT_NEXT_TURN`/`START_OF_OWN_NEXT_TURN`/`END_OF_THIS_TURN`), `operations`, `removeOn`, `bindTo?` (`SPOT`) | Agenda operações com alvo e validade; removível (gameplay §16.4). `bindTo: SPOT`: o efeito fica preso ao espaço (Ativo ou posição do Banco) do alvo escolhido e vale para o Pokémon que estiver ali na hora (Truque Floral). | — |
| `COPY_ATTACK` | `from` (seletor), `attackFilter?`, `requireEnergy` | Resolve o ataque copiado no contexto do copiador (gameplay §12.9). Com várias origens (`pick` ALL), a escolha lista os ataques de todas; o Pokémon Defensor do ataque copiado é o Ativo adversário do momento. | — |
| `CONDITIONAL` | `condition`, `then` (operações), `else?` | Ramo condicional sem efeitos ocultos. | — |
| `REMOVE_TOOL` | `target`, `destination` (`DISCARD`/`HAND`) | Remove a Ferramenta; recalcula HP e reavalia Nocaute. | — |
| `END_TURN` | — | Encerra o turno depois da resolução corrente. | — |
| `ATTACK_FAILS` | — | **Só em ataques.** O ataque corrente não faz nada: mesmo mecanismo da falha por Confusão — sem dano principal e os blocos seguintes do ataque não executam; evento `ATTACK_FAILED` com `reason: "EFFECT"`; o turno ainda acaba. Uso típico: `PRE_DAMAGE` com condição de coroa após `FLIP_COINS`. A notação de dano da carta mostra o dano base simples (“130”, não “130×”). | — |
| `MOVE_DAMAGE` | `from`, `to`, `amount` (inteiro ou `"ALL"`) | Move dano acumulado de cada origem para o destino (o primeiro de `to`); um Pokémon nunca move para si mesmo. Não é dano: sem Fraqueza, modificadores, prevenção nem `DAMAGE_APPLIED` (evento `DAMAGE_MOVED`) e não muda a causa do último dano (§7). | — |
| `SET_REMAINING_HP` | `target`, `mode` (`HALF_DOWN`/`VALUE`), `value?` | Ajusta o dano para deixar o alvo com os PS restantes indicados: `HALF_DOWN` = metade dos restantes, arredondada para baixo em múltiplo de 10; `VALUE` = `value`. Nunca aumenta os PS restantes (não cura). Evento `REMAINING_HP_SET`. | — |
| `DEVOLVE` | `target` | Involui: a carta de Evolução do topo volta para a mão do dono (mão cheia: descarte). Dano, Energias e Ferramenta ficam; saem as Condições Especiais e os efeitos com `TARGET_EVOLVES`. Básico: nada. Com HP menor, o dano pode Nocautear (§13.3). Evento `POKEMON_DEVOLVED`. | — |
| `RETURN_CARDS_TO_DECK` | `zone` (`OPPONENT_HAND`), `count`, `chooser` (`RANDOM`/`CONTROLLER`), `filter?` | Cartas da mão do oponente — sorteadas, ou escolhidas pelo controlador entre as que passam no filtro — voltam ao baralho dele, que é embaralhado. Evento `CARDS_RETURNED_TO_DECK`. | — |
| `CHANGE_ENERGY_TYPE` | `target` | Uma Energia ligada ao alvo, sorteada, passa a ser de um dos 8 tipos, sorteado (pode repetir o tipo). Evento `ENERGY_TYPE_CHANGED`. | — |
| `SET_NEXT_ENERGY` | `player` (`OWN`/`OPPONENT`) | A próxima Energia da Zona do jogador passa a ser de um dos 8 tipos, sorteado, mesmo fora dos tipos do deck. Sem Zona configurada, nada. | — |
| `REVEAL_TOP_TAKE` | `count`, `filter`, `rest` (`BOTTOM`/`SHUFFLE`) | Revela as `count` cartas do topo do próprio baralho: as que passam no filtro vão para a mão (até o limite de 10); as demais vão para o fundo, na ordem, ou são embaralhadas de volta. Evento `CARDS_REVEALED`. | — |
| `REVEAL_CARDS` | `zone` (`OPPONENT_DECK`/`OPPONENT_HAND`), `filter?` | Revela ao controlador as cartas daquela zona do oponente que passam no filtro, sem movê-las. | — |
| `SWAP_HAND_WITH_DECK` | — | O controlador escolhe um Pokémon da mão; ele vai para o baralho, um Pokémon sorteado do baralho vem para a mão e o baralho é embaralhado. Exige Pokémon na mão e no baralho. | — |
| `CHOOSE_ONE` | `options` (lista de listas de operações) | O controlador escolhe uma opção numa decisão `SELECT_MODE` (`MODE:0`, `MODE:1`…, com `labels` gerados do texto de cada opção); as operações da opção escolhida executam em seguida, em ordem, com `BEST_EFFORT` (Bolsa de Eevee). | — |
| `FORCE_COIN` | — | A primeira moeda da próxima jogada de `FLIP_COINS` do controlador neste turno (ataque, Habilidade ou Treinador) sai cara; com `untilTails`, a sequência continua depois dela. Não vale para moedas de regra (Confusão, `ATTACK_COIN_GATE`, prevenção com moeda, `SURVIVE_KNOCKOUT`) e expira no início do próximo turno (Will). | — |
| `COPY_TRAINER` | `excludeKeys` | Sorteia um Apoiador do baralho do oponente fora de `excludeKeys`, embaralha esse baralho e executa os blocos `ON_PLAY` dele como efeito desta carta (`BEST_EFFORT`; o controlador é quem jogou). Sem Apoiador elegível, nada. Evento `TRAINER_COPIED` (Penny). | — |
| `MOVE_ENERGY_FREELY` | — | Laço de decisões: o controlador escolhe uma Energia de um dos seus Pokémon ou “Terminar” (`SELECT_MODE`) e depois o destino (`SELECT_TARGETS`); os movimentos são aplicados juntos ao terminar (no máximo 20, e 2 por Energia). Gera `ENERGY_MOVED`. | — |
| `PREVENT_CONDITIONS` | `target`, `duration`, `conditions?` | O alvo não pode ser afetado pelas Condições listadas (todas, se omitido) e se recupera delas na checagem seguinte (`KO_CHECK`, §13.3) — Avental de Aço, Comfey. | ✔ |
| `PREVENT_HEALING` | `target`, `duration` | O alvo não pode ser curado: `HEAL_DAMAGE` não remove dano dele (Bloqueio de Cura do Claydol). | ✔ |
| `ATTACK_COIN_GATE` | `target`, `duration` | Quando o alvo for atacar, o jogador que ataca joga uma moeda depois da moeda de Confusão e antes dos blocos `PRE_DAMAGE`; coroa = o ataque não acontece (`ATTACK_FAILED` com `reason: "COIN_GATE"`) e o turno acaba. Vários efeitos não acumulam: uma moeda só (Cortina de Fumaça). | ✔ |
| `COUNTER_DAMAGE` | `target`, `duration`, `amount` | Enquanto durar, sempre que o alvo receber dano de ataque no turno do oponente, causa `amount` de dano de efeito ao Pokémon atacante (Espinhos Eriçados). | ✔ |
| `GRANT_RULE` | `target`, `duration`, `rule` (`EVOLVE_ANY_TURN`/`PREVIOUS_EVOLUTION_ATTACKS`/`EVOLVES_AS`), `evolvesAs?` | Regra de jogo concedida ao alvo enquanto durar (tabela de `rule` abaixo). | ✔ |
| `SURVIVE_KNOCKOUT` | `target`, `duration`, `remainingHp` | Quando dano de **ataque** (já com modificadores e prevenção) Nocautearia o alvo, o dono joga uma moeda; cara = o dano é reduzido para deixá-lo com `remainingHp` PS (Garra do Conkeldurr). Dano de efeito ou de Condição não joga moeda. | ✔ |
| `REROLL_COINS` | `target`, `duration` | Depois das moedas de um `FLIP_COINS` no ataque de um Pokémon alcançado, o dono dele pode relançá-las todas (decisão `CONFIRM_OPTIONAL`, `reason: "REROLL_COINS"`); vale o novo resultado. Uma vez por turno por jogador, mesmo com vários efeitos (Estrela da Vitória do Victini). | ✔ |

`MODIFY.stat`:

| `stat` | Efeito | Observação |
|---|---|---|
| `MAX_HP` | Soma ao HP máximo efetivo. | Remoção reavalia Nocaute (G-035). |
| `RETREAT_COST` | Soma ao custo de Recuo (piso 0). | — |
| `ATTACK_COST` | Soma unidades Incolores ao custo de ataques (piso 0 Incolor); com `energyType`, soma ao requisito daquele tipo (Cherubi: 1 Energia de Planta a menos). | `appliesTo.attackIds?` |
| `DAMAGE_DEALT` | Soma ao dano de ataque causado pelo alvo. | `appliesTo.opponentActiveOnly` padrão `true`; nunca afeta condições. `appliesTo.attackIds?` (só esses ataques) e `appliesTo.targetFilter?` (só dano a alvos que passem no filtro, ex.: Pokémon ex). |
| `DAMAGE_TAKEN` | Soma ao dano recebido pelo alvo (negativo = redução). | `appliesTo.damageCategory` padrão `ATTACK` (`EFFECT` ou `ANY`); `appliesTo.attackerFilter?` (só dano de atacantes que passem no filtro). |
| `ENERGY_PROVISION` | Cada anexo do `energyType` fornece `amount` unidades extras. | Não duplica anexos (G-014). |
| `KNOCKOUT_POINTS` | Soma aos pontos concedidos ao Nocautear o alvo (piso 1). | — |
| `POISON_DAMAGE` | Soma ao dano do Envenenamento do alvo na Verificação (Nihilego: +10). | Piso 0; ver §14. |

`GRANT_RULE.rule`:

| `rule` | Regra concedida ao alvo | Observação |
|---|---|---|
| `EVOLVE_ANY_TURN` | Pode evoluir no primeiro turno próprio do dono e no turno em que entrou em jogo. | O limite de uma evolução por turno continua (Evolução Impulsionada do Eevee). |
| `PREVIOUS_EVOLUTION_ATTACKS` | Pode usar os ataques das cartas de Pokémon abaixo do topo da pilha, pagando o custo de Energia de cada um. | A ação `ATTACK` informa a carta dona do ataque em `sourceCardId` (gameplay §12.10) — Luz da Memória, Recordação do Tempo do Celebi. |
| `EVOLVES_AS` | Aceita evoluções cujo `evolvesFrom` cite uma das chaves de `evolvesAs`, além da própria. | Eevee ex evolui como Eevee. |

### 9.1. Padrões de autoria (Genetic Apex)

Codificações canônicas dos textos recorrentes do set A1; o gerador de texto (§15) reconhece cada uma e produz a frase natural indicada.

| Texto da carta | Codificação | Texto gerado / notação |
|---|---|---|
| “Se …, este ataque causa N de dano a mais.” | Bloco com `condition` e `MODIFY DAMAGE_DEALT +N` em `SELF`, `THIS_TURN`, `PRE_DAMAGE` (somado antes da Fraqueza); ou `DEAL_DAMAGE` N no `OPPONENT_ACTIVE`/`DEFENDING`, categoria `ATTACK`, `POST_DAMAGE` (sem Fraqueza); ou `CONDITIONAL` com um desses. | “Se …, este ataque causa N de dano a mais.” · “base+” |
| “Jogue uma moeda. Se sair cara, N a mais.” | `FLIP_COINS 1` + `damageFormula: ADD(base, MULTIPLY(N, COUNT_HEADS))`, ou a forma por bloco acima com `COUNT_HEADS ≥ 1`. | “Jogue uma moeda. Se sair cara, este ataque causa N de dano a mais.” · “base+” |
| “N de dano para cada …” / “N a mais para cada …” | `MULTIPLY(N, contagem)` / `ADD(base, MULTIPLY(N, contagem))` com `COUNT_HEADS`, `COUNT_POKEMON` (seletor com filtro), `COUNT_BENCH_POKEMON`, `COUNT_ATTACHED_ENERGIES`… | “Este ataque causa N de dano para cada Pokémon do tipo Elétrico no seu Banco.” · “N×”/“base+” |
| “Se pelo menos K Energias {W} extras…” | Condição `COMPARE(EXTRA_ENERGY_UNITS energyType=WATER, GE, K)`. | “Se este Pokémon tiver pelo menos K Energias de Água extras ligadas, …” |
| “Se sair coroa, este ataque não faz nada.” | `FLIP_COINS 1` + `ATTACK_FAILS` em `PRE_DAMAGE` com `COUNT_TAILS ≥ 1`. | idem · dano base simples |
| “o Pokémon Defensor …” | Escopo `DEFENDING` + `removeOn: ["TARGET_LEAVES_ACTIVE"]`. | “Durante o próximo turno do oponente, o Pokémon Defensor não pode atacar.” |
| “1 dos Pokémon do oponente é escolhido aleatoriamente N vezes …” | N blocos idênticos `DEAL_DAMAGE` com `pick: {"mode": "RANDOM", "count": 1}`. | “1 dos Pokémon do oponente é escolhido aleatoriamente N vezes; para cada vez, cause X de dano a ele.” |
| “O oponente não pode usar Apoiadores …” | `RESTRICT_ACTION` `PLAY_SUPPORTER` em `OPPONENT_POKEMON` (`NEXT_OPPONENT_TURN` num ataque; `WHILE_SOURCE_IN_PLAY` numa Habilidade contínua). | “O oponente não pode jogar cartas de Apoiador da mão durante o próximo turno dele.” |
| “previna todo o dano e os efeitos de ataques feitos a este Pokémon” | `PREVENT_DAMAGE ALL [ATTACK]` + `PREVENT_EFFECTS` consecutivos com o mesmo alvo, duração e condição. | “… previna todo dano e efeito de ataques feitos a este Pokémon.” |
| Filtros por nome (“seu Muk ou Weezing no Ativo”) | `filter.deckLimitKeys`; o texto resolve os nomes pelo catálogo (`cardFace(def, printing, nameOf)`). | “o seu Muk ou Weezing no Ativo” |

### 9.2. Padrões de autoria (sets depois do Genetic Apex)

Codificações canônicas dos textos recorrentes de A1a…A4b, P-A e P-B (conteúdo 3.0.0). Os testes `dsl-pocket.test.ts` usam as definições reais dessas cartas.

| Texto da carta | Codificação | Texto gerado |
|---|---|---|
| Ferramenta só para um tipo (“O Pokémon {G} com esta carta recebe +30 PS.”) | Bloco `CONTINUOUS` com `target: {"scope": "SELF", "filter": {"types": ["GRASS"]}}` (Ultracriatura: `filter.tags: ["ULTRA_BEAST"]`). A Ferramenta pode ser ligada a qualquer Pokémon; noutro tipo o seletor fica vazio e o efeito não vale. | “O Pokémon do tipo Planta com esta carta recebe +30 PS.” |
| Ferramenta que reage no Ativo (“… estiver no Ativo e receber dano de um ataque do oponente, …”) | Blocos `ON_TRIGGER` com condição `SOURCE_POSITION ACTIVE` (só para um tipo: `ALL` com `EXISTS SELF {types}`), no gatilho padrão de Ferramenta (§7) ou em `toolTrigger` `POKEMON_KNOCKED_OUT` com `cause: ATTACK` (Cabo Elétrico). | “Se o Pokémon [do tipo X] com esta carta estiver no Ativo e receber dano de um ataque do oponente / for Nocauteado por dano de um ataque do oponente, …” |
| “… coloque-o na sua mão em vez de no descarte” (Cachecol de Resgate) | `trainerRules.onKnockedOut: "RETURN_TO_HAND"`, sem blocos. | Frase fixa (§15). |
| “Você só pode usar esta carta se …” | `trainerRules.playConditions` (validação: `CARD_PRECONDITION_FAILED`). Condição de jogabilidade (“só se houver algo a curar”) usa `ANY` e não é impressa. | “Você só pode usar esta carta se …” |
| “Você não pode usar esta carta no seu primeiro turno” (Doce Raro) | `playConditions: [COMPARE(OWN_TURN_NUMBER side=OWN, GT, 1)]` + `EVOLVE` com alvo `{"stages": ["BASIC"], "enteredPlayThisTurn": false}`, `fromHand` Estágio 2 e `skipStage: true`. | “Você não pode usar esta carta no seu primeiro turno.” |
| “Escolha 1: ① … ② …” | `CHOOSE_ONE` com uma lista de operações por opção. | “Escolha 1: (1) …; (2) …” |
| “Quantas vezes quiser durante o seu turno” | Habilidade `ACTIVATED` com `usageLimit: {"scope": "UNLIMITED", "count": 1}`. | “Quantas vezes quiser durante o seu turno, …” |
| “Se este Pokémon tiver dano, este ataque pode ser usado com {L}” | `alternativeCost` do ataque (§10). | “Se este Pokémon tiver dano, este ataque pode ser usado com 1 Energia de Elétrico.” |
| Iono (“cada jogador embaralha a mão no baralho e compra essa quantidade”) | `SHUFFLE_HAND_INTO_DECK` de cada lado com `outputId` + `DRAW_CARDS` com `OUTPUT_COUNT` de cada saída. | Uma frase por bloco. |
| Unown GUARDA/PODER (“funciona se você tiver outro Unown em jogo com Habilidade diferente”) | Habilidade `CONTINUOUS` com condição `EXISTS OWN_POKEMON {deckLimitKeys: [unown], hasAbility: true, excludeAbilityIds: [id próprio]}`. | “Se você tiver Unown com uma Habilidade diferente de GUARDA em jogo, …” |

---

<a id="dsl-10"></a>

## ⚔️ 10. Ataques

Campos de ataque no `dataVersion 2`:

| Campo | Contrato |
|---|---|
| `id`, `name` | ID estável na versão; nome 1–40 caracteres. |
| `energyCost` | Contadores por tipo de Energia gerável + `COLORLESS`; zero = “Sem custo de Energia”. |
| `baseDamage` / `damageFormula` | Alternativos: fixo usa `baseDamage` e `damageFormula: null`; fórmula usa `baseDamage: null`; sem dano direto usa `baseDamage: 0`. |
| `damageTarget` | Seletor do dano principal; padrão `{"scope": "OPPONENT_ACTIVE"}`. `null` quando não há dano direto. Fraqueza só se aplica automaticamente ao Ativo adversário. |
| `preconditions` / `additionalCosts` | [§8](#dsl-8). |
| `effects` | Blocos `PRE_DAMAGE`/`POST_DAMAGE`. |
| `endsTurn` | `true` para ataques normais; atacar encerra o turno. |
| `alternativeCost` | Opcional: `{ "condition", "energyCost" }`. Quando a [condição](#dsl-5) vale na declaração, o ataque também pode ser pago com `energyCost` (o motor aceita o que for pagável: o custo normal ou o alternativo). Texto: “Se …, este ataque pode ser usado com N Energia(s) de X.” |
| `ignoreDefenderEffects` | Opcional, `true`: o dano principal ignora os modificadores `DAMAGE_TAKEN` e as prevenções (`PREVENT_DAMAGE`, inclusive com moeda) do alvo; Fraqueza e modificadores do atacante valem (Punho de Chakra do Mega Medicham ex). Texto: “Efeitos no Pokémon Ativo do oponente não afetam este dano.” |
| `presentation` | Opcional: `presetId` (`ATTACK_STANDARD`/`ATTACK_SPECIAL`), `vfxProfile`, `soundCue`. Nunca altera regras. |

Ataque ao Banco (ex.: Pulso Preciso) usa `damageTarget` com escopo de Banco e `pick` — não um truque de `baseDamage: 0`.

Os ataques disponíveis são os da carta do topo. Com a regra concedida `PREVIOUS_EVOLUTION_ATTACKS` (`GRANT_RULE`, §9), também os das cartas de Pokémon abaixo dela na pilha; a ação `ATTACK` então informa `sourceCardId` (a carta dona do ataque), a resolução usa os dados daquela carta — custo, dano e blocos — e “este Pokémon” continua sendo a entidade atacante (gameplay §12.10). Sem `sourceCardId`, só os ataques do topo são aceitos.

---

<a id="dsl-11"></a>

## ✨ 11. Habilidades

```json
{
  "id": "zone-shock",
  "name": "Descarga de Zona",
  "kind": "TRIGGERED",
  "sourcePositions": ["ACTIVE", "BENCH"],
  "trigger": {"event": "ENERGY_ATTACHED", "filter": {"subject": "OPPONENT_POKEMON", "energySource": "ENERGY_ZONE", "attachmentMode": "MANUAL"}},
  "conditions": [],
  "costs": [],
  "usageLimit": {"scope": "PLAYER_TURN", "count": 1},
  "optional": false,
  "endsTurn": false,
  "effects": [
    {"id": "zap", "timing": "ON_TRIGGER", "operation": {"type": "DEAL_DAMAGE", "target": {"scope": "EVENT_TARGET"}, "amount": 10, "category": "EFFECT"}}
  ]
}
```

| Campo | Contrato |
|---|---|
| `kind` | `ACTIVATED` (botão “Usar”), `CONTINUOUS` (sem botão), `TRIGGERED` (reage a gatilho), `REPLACEMENT` (intercepta). |
| `sourcePositions` | Onde a fonte precisa estar: `ACTIVE`, `BENCH` ou ambos. |
| `trigger` | Obrigatório e exclusivo de `TRIGGERED`. |
| `conditions`, `costs` | Precondições e custos ([§5](#dsl-5), [§8](#dsl-8)). |
| `usageLimit` | `scope` ∈ `INSTANCE_TURN`, `NAME_TURN`, `PLAYER_TURN`, `INSTANCE_MATCH`, `PLAYER_MATCH`, `UNLIMITED`; `count` ≥ 1. Obrigatório em `ACTIVATED`. `UNLIMITED` = “quantas vezes quiser durante o seu turno” (Vaporeon, Dusknoir): sem contador; cada uso ainda precisa ser viável (gameplay §14.4) — o Dusknoir sem dano para mover não ativa. |
| `optional` | Em `TRIGGERED`, o controlador pode recusar. |
| `endsTurn` | Somente `ACTIVATED`; UI alerta antes de confirmar (gameplay §13.5). |
| `effects` | Blocos com timing compatível com `kind`. |

Marcadores de uso pertencem à instância de campo; voltar ao Banco não os zera (G-057). Uma nova entrada a partir da mão cria nova instância (gameplay §5.3). Supressão para a contribuição sem apagar marcadores.

---

<a id="dsl-12"></a>

## 🧑‍🏫 12. Treinadores, Ferramentas, Estádios e Fósseis

```json
{
  "subtype": "TOOL",
  "trainerRules": {
    "playConditions": [],
    "destinationAfterPlay": "ATTACHED_TOOL",
    "toolTarget": {}
  },
  "trainerEffects": [
    {"id": "hp", "timing": "CONTINUOUS", "operation": {"type": "MODIFY", "stat": "MAX_HP", "amount": 10, "target": {"scope": "SELF"}, "duration": {"kind": "WHILE_SOURCE_IN_PLAY"}}}
  ]
}
```

| `subtype` | `destinationAfterPlay` | Blocos aceitos | Limites do ruleset |
|---|---|---|---|
| `ITEM` | `DISCARD` | `ON_PLAY` | Sem limite genérico por turno. |
| `SUPPORTER` | `DISCARD` | `ON_PLAY` | 1 por turno, compartilhado entre nomes; moeda desfavorável não devolve o uso. |
| `TOOL` | `ATTACHED_TOOL` | `CONTINUOUS`, `ON_TRIGGER`, `REPLACEMENT` | 1 por Pokémon; `toolTarget` filtra quem pode receber. `SELF` = Pokémon que segura a Ferramenta. |
| `STADIUM` | `STADIUM_SLOT` | `CONTINUOUS`, `ON_TRIGGER` | 1 jogado por turno; nome igual ao em campo é ilegal; substituído vai ao descarte do dono. |
| `ITEM` com `fieldBehavior` (Fóssil) | `BENCH_AS_POKEMON` | `ON_PLAY` opcional | Ver abaixo. |

Campos de `trainerRules`:

| Campo | Contrato |
|---|---|
| `playConditions` | [Condições](#dsl-5) avaliadas ao jogar, no contexto do controlador; falsa = a carta não é jogável (`CARD_PRECONDITION_FAILED`) e fica na mão. Lusamine (o oponente tem ao menos 1 ponto), Muralha das Feras (o oponente não tem pontos), Lana (Araquanid em jogo), Lyra (Ativo com dano), Repelente (Ativo do oponente Básico), Doce Raro (não no primeiro turno). O texto gerado imprime só as que acrescentam informação (§15). |
| `destinationAfterPlay` | Tabela acima. |
| `toolTarget` | `PokemonFilter` de quem pode **receber** a Ferramenta (ligar fora do filtro é `INVALID_TARGET`). Diferente da restrição de tipo do efeito (§9.2), que deixa ligar e só não aplica o efeito. |
| `toolTrigger` | [Gatilho](#dsl-7) dos blocos `ON_TRIGGER` da Ferramenta. Ausente = gatilho padrão: o portador recebe dano de ataque no turno do oponente (§7). |
| `onKnockedOut` | `"RETURN_TO_HAND"`: se o portador for Nocauteado com causa `ATTACK`, a pilha vai para a mão do dono (mão cheia: descarte) em vez do descarte, as Energias vão para as descartadas e a Ferramenta, para o descarte; os pontos são concedidos normalmente (Cachecol de Resgate, [§13.3](#dsl-13)). |
| `fieldBehavior` | Fóssil (abaixo). |

Fóssil (gameplay §3.11):

```json
{"fieldBehavior": {"kind": "PLAY_AS_POKEMON", "hp": 40, "types": [], "retreatAllowed": false, "knockoutPoints": 1, "canAttack": false, "ownerMayDiscardDuringMainPhase": true}}
```

Entra num espaço vazio do Banco, conta como Pokémon em campo para a checagem de campo vazio, não ataca, não recua, não pode ser Ativo inicial e nunca satisfaz a garantia de Básico da mão inicial (G-004, ED-038). Treinadores não aceitam `stage`, `types`, `attacks`, `abilities`, `retreatCost`, `weakness` nem `ruleBox` diferente de `NONE`.

---

<a id="dsl-13"></a>

## 🔁 13. Ordem de resolução

### 13.1. Ataque

```text
1. Validar declaração (fase, Energia — custo normal ou `alternativeCost` —, precondições, restrições,
   condições de controle); `sourceCardId` escolhe a carta dona do ataque (§10).
2. Escolher e comprometer custos adicionais.
3. Moeda de Confusão, quando aplicável; coroa → ataque falha, efeitos não ocorrem, turno encerra.
3a. Moeda de ATTACK_COIN_GATE, se algum efeito alcança o atacante (uma moeda só); coroa → idem.
4. Blocos PRE_DAMAGE em ordem. Um ATTACK_FAILS executado tem o mesmo efeito da coroa da Confusão.
   As moedas de FLIP_COINS consideram FORCE_COIN e podem ser relançadas por REROLL_COINS.
5. Dano principal por alvo (fórmula avaliada por alvo — escopo TARGET):
   base/fórmula → modificadores DAMAGE_DEALT do atacante (só ao Ativo adversário)
   → Fraqueza (ADD valor ou MULTIPLY, só ao Ativo adversário)
   → modificadores DAMAGE_TAKEN do defensor → piso 0 → PREVENT_DAMAGE (sem moeda, depois com moeda)
   → SURVIVE_KNOCKOUT (só dano de ataque que Nocautearia) → aplicar.
   Com ignoreDefenderEffects, o dano principal pula os modificadores do defensor e as prevenções.
6. Blocos POST_DAMAGE em ordem. Gatilhos (DAMAGE_APPLIED da Ferramenta, COUNTER_DAMAGE, Habilidades)
   resolvem logo depois do passo que gerou o evento, antes do passo seguinte.
7. Nocautes em duas etapas (§13.3; gameplay §17.2): anúncio e reações, depois saída de campo e
   pontos; checagem terminal quando não restam Nocautes pendentes.
8. Promoções necessárias (escolhas simultâneas ocultas quando os dois lados precisam).
9. Encerrar turno se endsTurn.
```

Dano de `DEAL_DAMAGE` adicional segue o mesmo pipeline com `applyWeakness` e `category` declarados. Danos de um mesmo bloco multialvo formam um grupo simultâneo (G-034).

### 13.2. Passo atômico e estado

Cada opcode executa como passo atômico. Depois de cada passo o motor: (1) recalcula valores derivados, (2) enfileira os gatilhos dos eventos do passo, na frente da fila. Os Nocautes por HP efetivo são verificados pela tarefa `KO_CHECK` (§13.3) no fim de cada resolução (ataque, Treinador, Habilidade, gatilho, efeito atrasado), depois de cada ação instantânea e no checkup. Uma escolha pendente (`pick.mode = CHOOSE`, custos, ordem de gatilhos) suspende a resolução numa **continuação serializável** (`{ "cardRef", "blockPath", "step", "outputs" }`), nunca numa closure; recarregar a página retoma a mesma decisão (G-064). Moedas e sorteios já feitos ficam guardados na continuação: a retomada não consome RNG de novo.

Tipos de decisão pendente: `SETUP`, `PROMOTE`, `SELECT_TARGETS`, `SELECT_CARDS`, `SELECT_ENERGY`, `SELECT_ATTACK`, `CONFIRM_OPTIONAL` (blocos `optional`, relançar moedas), `ORDER_TOP` e `SELECT_MODE`. `SELECT_MODE` é a escolha entre opções nomeadas — `CHOOSE_ONE` (`MODE:0`, `MODE:1`…), o baralho de `LOOK_AT_TOP` com `player: CHOOSE` (`OWN`/`OPPONENT`) e o laço de `MOVE_ENERGY_FREELY` (uma Energia ou `DONE`) — e traz `labels`: o texto PT-BR de cada opção, que a interface mostra no lugar do identificador.

### 13.3. Nocaute em duas etapas

```text
KO_CHECK    Recuperar de Condições os protegidos por PREVENT_CONDITIONS.
            Grupo = Pokémon em campo com dano ≥ HP máximo efetivo ou marcados por KNOCK_OUT,
            fora os já anunciados (koPending).
            Para cada um: evento POKEMON_KNOCKED_OUT (causa §7, pontos previstos, atacante se ATTACK),
            ainda em campo. O grupo entra em koPending e KO_RESOLVE é agendado.
            Gatilhos do anúncio resolvem ANTES do KO_RESOLVE (com escolhas, se houver).
KO_RESOLVE  Para cada Pokémon do grupo: registrar no koLog do dono, sair de campo e encaminhar cartas
            (onKnockedOut RETURN_TO_HAND: pilha para a mão, Ferramenta ao descarte); depois conceder
            os pontos do grupo (POINTS_GRANTED).
            Enquanto houver grupo pendente, não há checagem terminal nem promoção.
```

Durante a janela entre o anúncio e a saída, o Nocauteado continua em campo para todos os efeitos: suas Energias podem ser movidas (Passimian ex, Cabo Elétrico), suas Habilidades e Ferramenta ainda contam, e o atacante é alcançável por `EVENT_SOURCE` (Pyukumuku, Cursola de Galar, Capacete Rochoso). Uma reação que Nocauteia outro Pokémon forma um grupo novo, anunciado e resolvido antes do grupo que a disparou; a checagem terminal só roda quando nenhum grupo está pendente, então dois jogadores que chegam à vitória na mesma cadeia empatam (gameplay §17.6).

---

<a id="dsl-14"></a>

## 📐 14. Modificadores contínuos e valores derivados

Efeitos ativos ficam numa lista `activeEffects` do estado: `{ effectId, sourceRef, opcode, params, controllerId, expiry }`. Valores derivados nunca são gravados como atributo:

```text
maxHp(entidade) = HP da carta do topo
                + Σ MODIFY MAX_HP aplicáveis (Ferramenta, Habilidades, Estádio, temporários)
retreatCost(entidade) = max(0, Recuo do topo + Σ MODIFY RETREAT_COST)
provided(entidade) = Σ por anexo (1 + Σ MODIFY ENERGY_PROVISION do tipo)
poisonDamage(entidade) = max(0, dano do efeito que envenenou (padrão 10) + Σ MODIFY POISON_DAMAGE)
```

Modificadores com `exclusive` contam uma vez por (nome da carta-fonte, `stat`, `energyType`); `amount` em fórmula é avaliado no contexto da fonte a cada consulta. Os outros contínuos não guardam números: `PREVENT_CONDITIONS`, `PREVENT_HEALING`, `GRANT_RULE`, `ATTACK_COIN_GATE`, `SURVIVE_KNOCKOUT` e `REROLL_COINS` são consultados quando a regra correspondente acontece (aplicar Condição, curar, evoluir/atacar, declarar ataque, aplicar dano, lançar moedas); `COUNTER_DAMAGE` vira um gatilho enquanto durar.

Fontes contínuas são reavaliadas a cada consulta. Uma fonte suprimida, removida ou fora de `sourcePositions` deixa de contribuir imediatamente; HP reduzido abaixo do dano acumulado causa Nocaute no próximo ponto de checagem do passo (G-035, ED-036).

---

<a id="dsl-15"></a>

## 🧾 15. Texto gerado

Cada opcode possui gerador de texto PT-BR determinístico (`describe`). O texto exibido na carta e no inspector é **gerado dos dados**; a descrição temática não cria regra. Exemplos:

| Dados | Texto |
|---|---|
| `HEAL_DAMAGE` SELF 10 em `POST_DAMAGE` | “Cure 10 de dano deste Pokémon.” |
| `FLIP_COINS` 2 + fórmula `40 × caras` | “Jogue 2 moedas. Este ataque causa 40 de dano para cada cara.” |
| `APPLY_CONDITION` BURNED com condição `COUNT_HEADS ≥ 1` (2 moedas) | “Se sair pelo menos 1 cara, o Pokémon Ativo do oponente fica Queimado.” |
| `FLIP_COINS` 1 + bônus 30 com `COUNT_HEADS ≥ 1` | “Jogue uma moeda. Se sair cara, este ataque causa 30 de dano a mais.” |
| `FLIP_COINS` 2 + bônus 80 com `COUNT_HEADS ≥ 2` | “Jogue 2 moedas. Se as duas saírem cara, este ataque causa 80 de dano a mais.” |
| `HEAL_DAMAGE` 20 em `OWN_POKEMON` sem `pick` | “Cure 20 de dano de cada um dos seus Pokémon.” |
| `RESTRICT_ACTION` `PLAY_SUPPORTER` em `OPPONENT_POKEMON`, `NEXT_OPPONENT_TURN` | “O oponente não pode jogar cartas de Apoiador da mão durante o próximo turno dele.” |
| `SEARCH_DECK` RANDOM 1 Pokémon {G} para a mão | “Coloque 1 Pokémon do tipo Planta aleatório do seu baralho na sua mão.” |
| `SWITCH_ACTIVE` OPPONENT, chooser OPPONENT | “Troque o Pokémon Ativo do oponente por um do Banco dele. O oponente escolhe.” |
| `CHOOSE_ONE` com duas opções (Bolsa de Eevee) | “Escolha 1: (1) durante este turno, os ataques dos seus Pokémon que evoluem de Eevee causam +10 de dano ao Pokémon Ativo do oponente; (2) cure 20 de dano de cada um dos seus Pokémon que evoluem de Eevee.” |
| Ferramenta, `MODIFY MAX_HP` em `SELF` com `filter.types: [GRASS]` | “Ligue esta carta a um dos seus Pokémon. Ele só pode ter 1 Ferramenta. O Pokémon do tipo Planta com esta carta recebe +30 PS.” |
| Ferramenta, gatilho padrão + `DEAL_DAMAGE` 20 em `EVENT_SOURCE` com condição “no Ativo” | “Se o Pokémon com esta carta estiver no Ativo e receber dano de um ataque do oponente, cause 20 de dano ao Pokémon atacante.” |
| `playConditions: [COMPARE(POINTS OPPONENT, GE, 1)]` (Lusamine) | “Você só pode usar esta carta se o oponente tiver pelo menos 1 ponto.” |
| Habilidade `ACTIVATED`, `UNLIMITED`, `MOVE_DAMAGE` ALL para `SELF` | “Quantas vezes quiser durante o seu turno, você pode mover todo o dano de um dos seus outros Pokémon com dano para este Pokémon.” |
| Duas `APPLY_CONDITION` no mesmo alvo com a mesma condição de bloco | “Jogue uma moeda. Se sair cara, o Pokémon Ativo do oponente fica Envenenado e Paralisado.” |
| `REMOVE_TOOL` sem condição em `PRE_DAMAGE` de ataque com dano | “Antes de causar dano, descarte a Ferramenta do Pokémon Ativo do oponente.” |
| Habilidade com custo `DISCARD_HAND_CARDS` 1 e `DRAW_CARDS` 1 | “Uma vez durante o seu turno, você pode descartar 1 carta da sua mão para comprar 1 carta.” |
| Habilidade `ATTACH_ENERGY` do descarte + `DEAL_DAMAGE` sem condição | “… você pode ligar 1 Energia de Fogo do seu descarte a este Pokémon. Se fizer isso, cause 20 de dano a ele.” |

Regras do gerador (`src/domain/cards/text.ts`): moeda única é “uma moeda” e a condição vira “Se sair cara/coroa”; todas as moedas iguais viram “Se as duas/todas saírem …”; tipos usam `TYPE_LABEL` (“do tipo Planta”, “Energia de Água”); filtros por `deckLimitKeys` são resolvidos para nomes pelo catálogo (`nameOf`), com o nome derivado da chave como reserva; “(sem Fraqueza)” só aparece quando todos os alvos possíveis estão no Banco; Habilidades ativadas viram uma frase (“Uma vez durante o seu turno, se este Pokémon estiver no Ativo, você pode trocar …”); blocos idênticos consecutivos são resumidos (“… N vezes”) e blocos consecutivos com a mesma condição compartilham a oração condicional.

Regras acrescentadas na revisão 3.3.0 (sets depois do Genetic Apex):

- **Nomes de outras cartas.** `catalogNames(fonte)` monta o resolvedor a partir do catálogo (ou da lista do editor): por `deckLimitKey` (nome da carta) e pelas chaves `attack:<id>` e `ability:<id>` (nome do primeiro ataque/Habilidade do catálogo com aquele ID). Ataques e Habilidades da própria carta vêm de `attackNames`/`abilityNames` (“este Pokémon não pode usar …”); sem catálogo, o ID formatado é a reserva. Assim “Se um dos seus Pokémon tiver usado Revezamento de Doces no seu último turno” sai com o nome traduzido.
- **Condições de jogo de Treinador.** Cada condição de `playConditions` vira uma frase antes do efeito: “Você só pode usar esta carta se …”; `COMPARE(OWN_TURN_NUMBER, GT, 1)` vira “Você não pode usar esta carta no seu primeiro turno.”. Não são impressas as condições de jogabilidade (`op: ANY`, ex.: “só se o seu Ativo tiver dano ou Condição”) nem um `EXISTS` que apenas repete o alvo do efeito (mesmo escopo e mesmos nomes/tipos/tags no filtro — Koga e o “seu Muk ou Weezing no Ativo”).
- **Ferramentas.** O texto começa com “Ligue esta carta a um dos seus Pokémon. Ele só pode ter 1 Ferramenta.”; `SELF` é “o Pokémon com esta carta”, com o tipo do filtro (“o Pokémon do tipo Metálico com esta carta”) ou “a Ultracriatura com esta carta”. Blocos `ON_TRIGGER` cuja condição comum é “no Ativo” (e, opcionalmente, o tipo) viram “Se o Pokémon [do tipo X] com esta carta estiver no Ativo e receber dano de um ataque do oponente, …” (gatilho padrão) ou “… e for Nocauteado por dano de um ataque do oponente, …” (`POKEMON_KNOCKED_OUT`); outros gatilhos usam a frase do evento (“No fim de cada turno, …”). `onKnockedOut` acrescenta “Se o Pokémon com esta carta for Nocauteado por dano de um ataque do oponente, coloque-o na sua mão em vez de no descarte.”.
- **Habilidades.** Ativadas começam com “Uma vez durante o seu turno”, “Uma vez por partida” (escopos `*_MATCH`) ou “Quantas vezes quiser durante o seu turno” (`UNLIMITED`); o custo de descarte da mão vira “você pode descartar N carta(s) da sua mão para …”; quando o segundo bloco `ON_ACTIVATE` não tem condição, a frase dele é consequência do uso e começa com “Se fizer isso, …”. Disparadas por Nocaute do próprio Pokémon no Ativo: “Se este Pokémon for Nocauteado no Ativo por um ataque do oponente, …”.
- **Ataques.** Precondições: “Você só pode usar este ataque se …”; `alternativeCost`: “Se …, este ataque pode ser usado com N Energia(s) de X.”; `REMOVE_TOOL` sem condição em `PRE_DAMAGE` de ataque com dano: “Antes de causar dano, …”; `ignoreDefenderEffects`: “Efeitos no Pokémon Ativo do oponente não afetam este dano.”.
- **Agrupamentos.** Duas `APPLY_CONDITION` seguidas no mesmo alvo (e com a mesma condição de bloco) viram “fica Envenenado e Paralisado”; dois `MODIFY` seguidos com mesmo alvo e duração viram uma frase (“… causam +20 de dano … e ele recebe …”); `DEAL_DAMAGE` aleatório repetido N vezes vira “1 dos Pokémon do oponente é escolhido aleatoriamente N vezes; para cada vez, cause X de dano a ele.”.
- **Energia.** Energia gerada por efeito é “da sua Zona de Energia” (coerente com o evento, §7); do descarte, “das suas Energias descartadas”; sorteada, “de tipo aleatório” ou “aleatória(s)”.

### 15.1. Formas compactas

O parágrafo de cada ataque e Habilidade (`attackText`, `abilityText`) usa a forma completa. Só quando ela não cabe no limite do template — **3 linhas** de **50 caracteres** médios, no mesmo modelo de quebra gulosa por palavras do `textfit.ts` (`src/domain/cards/wrap.ts`: `BODY_CHARS_PER_LINE`, `PARAGRAPH_MAX_LINES`) — o gerador aplica, **em ordem e só enquanto o parágrafo ainda estoura**, as formas curtas equivalentes abaixo (`COMPACT` + `fitParagraph`). A forma completa continua sendo a de referência; uma carta que cabe nunca recebe a forma curta. O texto de Treinador não é compactado (limite próprio de 6 linhas).

| Forma completa | Forma compacta |
|---|---|
| “feitos a este Pokémon” | “neste Pokémon” |
| “ da sua Zona de Energia” | “ da Zona de Energia” |
| “, se este Pokémon estiver no Ativo/Banco,” | “, com este Pokémon no Ativo/Banco,” |
| “Se um Pokémon do oponente for Nocauteado por dano de um ataque deste Pokémon,” (início) | “Se este Pokémon Nocautear um Pokémon do oponente com um ataque,” |
| “ e ele/este Pokémon recebe N de dano a menos de ataques” | “ e ele recebe −N de dano de ataques” |
| “de um dos seus Pokémon do tipo X no Banco” | “de um Pokémon do tipo X do seu Banco” |
| “para o seu Pokémon Ativo” | “para o seu Ativo” |
| “este Pokémon … deste Pokémon ” | “este Pokémon … dele ” |
| “evolua este Pokémon” | “evolua-o” |
| “a este Pokémon … a este Pokémon.” | “a este Pokémon … a ele.” |
| “das suas Energias descartadas” | “do seu descarte” |
| “ele não é Nocauteado e fica com N PS restantes” | “ele fica com N PS restantes em vez disso” |
| “durante o próximo turno do oponente, previna todo dano e efeito de ataques neste Pokémon” | “este Pokémon não é afetado por ataques no próximo turno do oponente” |

O compositor da carta usa o mesmo texto; overflow bloqueia publicação (ED-044). O `content:build` mede cada parágrafo de ataque, Habilidade e Treinador com o mesmo modelo (`textfit.ts`: 3 linhas por ataque/Habilidade, 6 no Treinador) e falha o build com `CARD_TEXT_OVERFLOW`. O conteúdo 3.0.0 — Genetic Apex, Promo-A e todos os sets seguintes — cabe inteiro no template; `sets.test.ts` exige, por set, nenhum overflow e nenhum resto de texto em inglês.

---

<a id="dsl-16"></a>

## 🚫 16. Validação e erros

| Código | Nível (editor §24) | Causa |
|---|---|---|
| `UNKNOWN_OPCODE` | Execução | `type` fora do registro. |
| `PARAM_INVALID` | Estrutura | Parâmetro ausente, tipo ou faixa inválidos. |
| `TIMING_NOT_ALLOWED` | Execução | Timing incompatível com o contexto (ex.: `PRE_DAMAGE` em Treinador). |
| `NOT_CONTINUOUS_OPCODE` | Execução | Opcode sem marca **C** em `CONTINUOUS`/`REPLACEMENT`. |
| `FORMULA_REFERENCE_MISSING` | Execução | `reference`/`OUTPUT` sem `outputId` anterior; `OUTPUT_CARDS_MATCH` cuja referência não guarda cartas (só `DISCARD_CARDS.outputId` guarda). |
| `OUTPUT_ID_DUPLICATE` | Estrutura | Dois blocos com o mesmo `outputId`. |
| `FORMULA_TOO_COMPLEX` | Execução | Mais de 32 nós ou profundidade > 6. |
| `TRIGGER_MISSING` / `TRIGGER_NOT_ALLOWED` | Execução | `TRIGGERED` sem gatilho; gatilho em outro `kind`. |
| `USAGE_LIMIT_REQUIRED` | Regras | `ACTIVATED` sem `usageLimit`. |
| `DURATION_REQUIRED` | Execução | Modificador temporário sem `duration`. |
| `CHOOSER_REQUIRED` | Execução | `CHOOSE` sem `chooser`. |
| `SELECTOR_IMPOSSIBLE` | Execução | `EVENT_SOURCE`/`EVENT_TARGET` fora de gatilho, substituição ou efeito atrasado; `DEFENDING` fora dos efeitos de um ataque (inclusive dentro de `SCHEDULE_DELAYED`). |
| `ATTACK_ONLY_OPERATION` | Execução | `ATTACK_FAILS` fora dos efeitos de um ataque. |
| `TRAINER_FIELD_INVALID` | Regras | Treinador com estágio, tipos, ataques ou ruleBox. |
| `EFFECT_LOOP_DETECTED` | Execução (runtime) | Cadeia de gatilhos acima da profundidade 8. |

Uma carta de produção com qualquer erro de Estrutura, Execução ou Regras não entra no build (campanha §20.5).

---

<a id="dsl-17"></a>

## 📚 17. Exemplos do catálogo inicial

Kit de Reparo (Item):

```json
{"id": "heal", "timing": "ON_PLAY", "failurePolicy": "REQUIRE_ANY", "operation": {"type": "HEAL_DAMAGE", "target": {"scope": "OWN_POKEMON", "filter": {"hasDamage": true}, "pick": {"mode": "CHOOSE", "chooser": "CONTROLLER", "min": 1, "max": 1}}, "amount": 20}}
```

Rastreador (Item):

```json
{"id": "track", "timing": "ON_PLAY", "failurePolicy": "REQUIRE_ANY", "operation": {"type": "SEARCH_DECK", "player": "OWN", "filter": {"categories": ["POKEMON"], "stages": ["BASIC"], "excludeFossils": true}, "count": 1, "mode": "RANDOM", "destination": "HAND", "reveal": true, "shuffleAfter": true}}
```

Mentoria (Apoiador):

```json
{"id": "boost", "timing": "ON_PLAY", "operation": {"type": "MODIFY", "stat": "DAMAGE_DEALT", "amount": 10, "target": {"scope": "OWN_POKEMON"}, "duration": {"kind": "THIS_TURN"}, "appliesTo": {"opponentActiveOnly": true, "damageCategory": "ATTACK"}}}
```

Ataque com moedas e Queimadura condicional:

```json
{
  "id": "ember-rain", "name": "Chuva de Brasas",
  "energyCost": {"FIRE": 2, "COLORLESS": 1},
  "baseDamage": null,
  "damageFormula": {"op": "MULTIPLY", "operands": [{"op": "CONST", "value": 40}, {"op": "COUNT_HEADS", "reference": "attackCoins"}]},
  "damageTarget": {"scope": "OPPONENT_ACTIVE"},
  "preconditions": [], "additionalCosts": [],
  "effects": [
    {"id": "coins", "timing": "PRE_DAMAGE", "operation": {"type": "FLIP_COINS", "count": 2, "outputId": "attackCoins"}},
    {"id": "burn", "timing": "POST_DAMAGE", "condition": {"op": "COMPARE", "left": {"op": "COUNT_HEADS", "reference": "attackCoins"}, "cmp": "GE", "right": {"op": "CONST", "value": 1}}, "operation": {"type": "APPLY_CONDITION", "target": {"scope": "OPPONENT_ACTIVE"}, "condition": "BURNED"}}
  ],
  "endsTurn": true
}
```

Bolsa de Eevee (Item, A3b — `CHOOSE_ONE`):

```json
{"id": "choose", "timing": "ON_PLAY", "failurePolicy": "BEST_EFFORT", "operation": {"type": "CHOOSE_ONE", "options": [[{"type": "MODIFY", "stat": "DAMAGE_DEALT", "amount": 10, "target": {"scope": "OWN_POKEMON", "filter": {"evolvesFrom": ["eevee"]}}, "duration": {"kind": "THIS_TURN"}, "appliesTo": {"opponentActiveOnly": true, "damageCategory": "ATTACK"}}], [{"type": "HEAL_DAMAGE", "target": {"scope": "OWN_POKEMON", "filter": {"evolvesFrom": ["eevee"]}, "pick": {"mode": "ALL"}}, "amount": 20}]]}}
```

Cabo Elétrico (Ferramenta, A3a — `toolTrigger` de Nocaute e `perTarget`):

```json
{
  "subtype": "TOOL",
  "trainerRules": {
    "playConditions": [],
    "destinationAfterPlay": "ATTACHED_TOOL",
    "toolTrigger": {"event": "POKEMON_KNOCKED_OUT", "filter": {"subject": "SELF", "cause": "ATTACK"}}
  },
  "trainerEffects": [
    {"id": "cord", "timing": "ON_TRIGGER", "condition": {"op": "ALL", "conditions": [{"op": "SOURCE_POSITION", "position": "ACTIVE"}, {"op": "EXISTS", "selector": {"scope": "SELF", "filter": {"types": ["LIGHTNING"]}}}]}, "operation": {"type": "MOVE_ENERGY", "from": {"scope": "SELF"}, "to": {"scope": "OWN_BENCH", "pick": {"mode": "CHOOSE", "chooser": "CONTROLLER", "min": 2, "max": 2}}, "energyType": "LIGHTNING", "count": 2, "perTarget": true}}
  ]
}
```

---

<a id="dsl-18"></a>

## ✅ 18. Critérios de aceite

| ID | Cenário | Resultado esperado |
|---|---|---|
| FX-001 | Opcode fora do registro | Carta recusada no build e no Estúdio. |
| FX-002 | `COUNT_HEADS` sem `FLIP_COINS` anterior | `FORMULA_REFERENCE_MISSING`. |
| FX-003 | Item `REQUIRE_ANY` sem alvo possível | Não jogável; carta permanece na mão. |
| FX-004 | `BEST_EFFORT` sem alvo | Ataque resolve; bloco sem efeito. |
| FX-005 | `CHOOSE` com `chooser: OPPONENT` | Decisão pertence ao adversário (ED-025, G-043). |
| FX-006 | Duração `NEXT_OPPONENT_TURN` | Expira no fim do próximo turno próprio do adversário, independente de pausa/telas. |
| FX-007 | Ferramenta de HP removida com dano ≥ novo máximo | Nocaute reavaliado (G-035). |
| FX-008 | `ENERGY_MOVED` | Não dispara gatilho de `ENERGY_ATTACHED` (G-036). |
| FX-009 | Cadeia de gatilhos > 8 | `EFFECT_LOOP_DETECTED`, partida preservada. |
| FX-010 | Continuação serializada | Recarregar no meio de uma escolha restaura a mesma decisão. |
| FX-011 | Texto gerado | Mesmo dado produz sempre o mesmo texto PT-BR. |
| FX-012 | `DISCARD_POKEMON` | Não concede pontos (G-033). |
| FX-013 | Efeito no `DEFENDING` e o Defensor recua | O efeito fica na entidade defensora (não na posição) e some com `TARGET_LEAVES_ACTIVE`; o novo Ativo não é afetado; ataque copiado tem Defensor. |
| FX-014 | `EXTRA_ENERGY_UNITS` com custo `{W2, C1}` | 4 Água → 1 extra; 5 Água → 2; 4 Água + 1 Fogo → 2 (o Fogo paga o Incolor). |
| FX-015 | `ATTACK_FAILS` executado | Sem dano principal, sem blocos seguintes, `ATTACK_FAILED` (`EFFECT`), turno encerra; notação mostra o dano base simples. |
| FX-016 | `ATTACH_ENERGY` com `count` fórmula e `distribute` | Resultado 0 não pede escolha; com `distribute`, uma escolha por unidade entre os candidatos do seletor. |
| FX-017 | Ataque adversário contra alvo com `PREVENT_EFFECTS` | Descarte de Energia, condição, restrição, modificador e troca não ocorrem; dano segue `PREVENT_DAMAGE`; restrição só de jogador continua. |
| FX-018 | `DAMAGE_DEALT_BY_ATTACK` em `POST_DAMAGE` | Igual ao dano efetivo do dano principal (com Fraqueza e prevenção). |
| FX-019 | `SWITCH_ACTIVE` com `filter` | Só candidatos do Banco que casam com o filtro; Fóssil conta como Básico. |
| FX-020 | `MOVE_ENERGY` com `count: "ALL"` e várias origens | Todos os anexos elegíveis de todas as origens vão para o destino, sem escolha. |
| FX-021 | `SHUFFLE_HAND_INTO_DECK` | Mão inteira ao baralho, embaralhado; o adversário do dono vê só a quantidade. |
| FX-022 | `DEFENDING`/`ATTACK_FAILS` fora de ataque | `SELECTOR_IMPOSSIBLE` / `ATTACK_ONLY_OPERATION` no Estúdio e no content-build. |
| FX-023 | Texto gerado dos padrões da §9.1 | Frases naturais da §15, cada parágrafo dentro do limite de linhas do template. |
| FX-024 | `deck-limit-key-v2` | “Nidoran♀” → `nidoran-f`, “Nidoran♂” → `nidoran-m`; nomes sem ♀/♂ mantêm a chave da v1. |
| FX-025 | Nocaute por ataque com reação no Ativo (Pyukumuku) | `POKEMON_KNOCKED_OUT` é anunciado com o Pokémon ainda em campo; a reação causa dano ao atacante antes de `POINTS_GRANTED`; o ponto vai para quem atacou. No Banco, a reação não dispara. |
| FX-026 | Reação que Nocauteia o atacante (Pyukumuku; Cursola de Galar com cara) | Os dois saem de campo, cada jogador pontua uma vez (causas `ATTACK` e `EFFECT`) e os dois promovem; se os dois chegam a 3 pontos na mesma cadeia, empate `SIMULTANEOUS`. Com coroa, só o Nocauteado sai. |
| FX-027 | Reação com escolha (Passimian ex) | O dono escolhe o destino das Energias antes de o Nocauteado sair de campo e dos pontos; a promoção vem depois. |
| FX-028 | Causa do Nocaute | Dano movido (Acerola) sobre dano de ataque de turno anterior, PS perdidos (Guzma descarta a Capa de Folha) e Nocaute por efeito sobre dano antigo não são causa `ATTACK`: sem reação de “Nocauteado por dano de um ataque” nem Cachecol de Resgate. |
| FX-029 | `onKnockedOut: RETURN_TO_HAND` (Cachecol de Resgate) | Nocaute por ataque: pilha na mão, Ferramenta ao descarte, Energias às descartadas e ponto concedido; Nocaute por Veneno: tudo ao descarte. |
| FX-030 | Gatilho padrão de Ferramenta (Capacete Rochoso) | Dano de ataque do oponente ao portador no Ativo revida 20, mesmo com o portador Nocauteado; o dano que o próprio ataque do portador causa a ele e o portador no Banco não revidam. |
| FX-031 | Ferramenta restrita por tipo (Capa de Folha, Avental de Aço, Bote Inflável, Cabo Elétrico) | O efeito só vale com portador do tipo indicado; o Avental de Aço recupera o portador {M} das Condições e impede novas; o Cabo Elétrico passa 2 Energias {L}, 1 para cada um de 2 Pokémon no Banco. |
| FX-032 | Doce Raro (`EVOLVE` com `skipStage`) | Básico → Estágio 2 com o dano preservado; recusado (`CARD_PRECONDITION_FAILED`) no primeiro turno, em Básico que entrou neste turno e só com Estágio 1 na mão; só Básicos com Estágio 2 correspondente na mão são alvos, sem escolha inútil. |
| FX-033 | `SURVIVE_KNOCKOUT` (Conkeldurr) | Dano de ataque que Nocautearia: cara deixa com 10 PS, coroa Nocauteia; dano que não Nocauteia e dano de Veneno não jogam moeda. |
| FX-034 | `CHOOSE_ONE` (Bolsa de Eevee) | Decisão `SELECT_MODE` do controlador com opções `MODE:0`/`MODE:1` e `labels`; só a opção escolhida resolve. |
| FX-035 | `GRANT_RULE PREVIOUS_EVOLUTION_ATTACKS` (Luz da Memória; Habilidade do Celebi no Banco) | `ATTACK` com `sourceCardId` usa o ataque da carta de baixo e aparece nas ações legais; sem a regra, `INVALID_TARGET`; o custo de Energia daquele ataque continua exigido. |
| FX-036 | `playConditions` (Lusamine, Muralha das Feras, Lana, Lyra, Repelente) | Condição falsa → `CARD_PRECONDITION_FAILED` e a carta fica na mão; verdadeira → o efeito resolve (Repelente: o oponente escolhe o novo Ativo). |
| FX-037 | Iono (`SHUFFLE_HAND_INTO_DECK` com `outputId` + `OUTPUT_COUNT`) | Cada mão volta embaralhada ao baralho e o jogador compra a mesma quantidade; nenhuma carta some; mão vazia compra 0. |
| FX-038 | `REROLL_COINS`, `FORCE_COIN` e `COPY_TRAINER` (Victini, Will, Penny) | Relançar (`CONFIRM_OPTIONAL`) só no ataque de Pokémon {R}, valendo o novo resultado (recusar mantém o original); Will força a primeira cara uma vez; Penny executa o Apoiador sorteado do baralho do oponente, ou nada sem Apoiador elegível. |
| FX-039 | Unown GUARDA/PODER (`excludeAbilityIds`) | O efeito só vale com outro Unown em jogo com Habilidade diferente; sozinho ou com outro de mesma Habilidade, não. |
| FX-040 | `COUNTER_DAMAGE`, `MOVE_DAMAGE` (`UNLIMITED`), `DEVOLVE`, `PREVENT_HEALING`, `ATTACK_COIN_GATE` | Revide de 30 só durante o próximo turno do oponente; o Dusknoir move dano enquanto houver dano a mover e depois não é ativável; involução devolve o topo à mão (Nocaute se o dano passa do HP do Básico; Básico: nada); ninguém é curado com o Claydol em jogo; Cortina de Fumaça com coroa: `ATTACK_FAILED` `COIN_GATE`, com cara o ataque acontece. |
| FX-041 | Texto gerado dos sets depois do Genetic Apex (§9.2, §15) | Toda carta de A1a…A4b, P-A e P-B cabe no template, sem `CARD_TEXT_OVERFLOW` nem resto em inglês; a forma compacta só aparece quando a completa estouraria; condições de jogo de jogabilidade ou implícitas no alvo não são impressas. |

Estes critérios entram na matriz de rastreabilidade como prefixo `FX`. `FX-025`…`FX-040` são fixados por `src/domain/battle/dsl-pocket.test.ts` (63 casos com as definições reais das cartas) e `FX-041` por `src/content/source/pocket/sets.test.ts`.

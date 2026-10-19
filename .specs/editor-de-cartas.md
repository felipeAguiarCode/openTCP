# 🛠️ Editor de cartas — autoria, regras, arte e prévia Three.js

> **Versão:** 3.2.0 · **Data:** 14 de outubro de 2026  
> **Destino:** editor local integrado ao jogo; navegador 16:9, HTML/CSS + Three.js, persistência SQLite.  
> **Nome de interface:** **Estúdio de Cartas**  
> **Status:** especificação de implementação. Não inclui editor executável nem artes de produção.  
> **Complementos:** [gameplay.md](gameplay.md) · [efeitos-dsl.md](efeitos-dsl.md) · [persistencia-sqlite.md](persistencia-sqlite.md) · [interface-16x9.md](interface-16x9.md) · [runtime-offline-threejs.md](runtime-offline-threejs.md) · [campanha.md](campanha.md)
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — campo claro, paleta e animações na linguagem do TCG Pocket; os conceitos escuros anteriores não são referência.

## 🧭 Sumário

**Leitura visual obrigatória:** [direção Pocket](direcao-visual-pocket.md) · [referências identificadas](referencias-visuais.md).

- [🎯 1. Objetivo e escopo](#editor-1)
- [🧭 2. Identidade funcional não é aparência](#editor-2)
- [🗂️ 3. Biblioteca do Estúdio](#editor-3)
- [🧷 4. Rotas e contexto](#editor-4)
- [📐 5. Layout 16:9](#editor-5)
- [🆕 6. Criar uma carta](#editor-6)
- [🪪 7. Identidade e campos gerais](#editor-7)
- [🐣 8. Estágio, evolução, tipos e atributos](#editor-8)
- [✴️ 9. Configurar ex e Mega ex](#editor-9)
- [⚔️ 10. Lista e anatomia dos ataques](#editor-10)
- [⚡ 11. Editor de custo de Energia](#editor-11)
- [🧮 12. Dano fixo e fórmulas](#editor-12)
- [🧩 13. Construtor visual de efeitos](#editor-13)
- [🧰 14. Biblioteca de efeitos publicáveis](#editor-14)
- [💳 15. Custos adicionais e legalidade](#editor-15)
- [✨ 16. Editor de Habilidades](#editor-16)
- [🧑‍🏫 17. Editor de Treinadores](#editor-17)
- [🖼️ 18. Importação e troca de arte](#editor-18)
- [🖌️ 19. Moldura, tipografia e composição](#editor-19)
- [💎 20. Normal, holográfico, foil e cromado](#editor-20)
- [🎭 21. Máscara de foil](#editor-21)
- [🧊 22. Prévia Three.js em tempo real](#editor-22)
- [🎞️ 23. Prévia de animações e flairs](#editor-23)
- [🧪 24. Validação em quatro níveis](#editor-24)
- [🔬 25. Laboratório funcional](#editor-25)
- [⚖️ 26. Balanceamento e análise](#editor-26)
- [📜 27. Salvar, revisar e publicar](#editor-27)
- [🎮 28. Usar as cartas no jogo](#editor-28)
- [📦 29. Importar e exportar cartas](#editor-29)
- [🗄️ 30. Contrato com SQLite](#editor-30)
- [⌨️ 31. Interação e acessibilidade](#editor-31)
- [🧯 32. Estados de erro e casos extremos](#editor-32)
- [🧾 33. Exemplo de criação ponta a ponta](#editor-33)
- [✅ 34. Critérios de aceite](#editor-34)
- [🛠️ 35. Fatias de implementação](#editor-35)
- [📚 36. Referências e limites](#editor-36)

<a id="editor-1"></a>

## 🎯 1. Objetivo e escopo

Permitir que o usuário crie cartas jogáveis, configure suas regras, importe arte, escolha acabamento, teste o funcionamento e publique no catálogo autoral local **sem editar código**.

O editor não é apenas uma ferramenta de desenhar uma imagem. Uma carta publicada deve possuir uma definição funcional executável pelo mesmo motor usado nos duelos.

Operações principais:

```text
Criar do zero ou usar modelo
→ configurar identidade e regras
→ montar ataques e Habilidades
→ importar arte e configurar impressão
→ visualizar carta em Three.js
→ validar
→ testar no laboratório
→ publicar localmente
→ usar em treino ou campanha personalizada
→ exportar pacote autoral
```

O editor de cartas cria conteúdo. O editor de decks escolhe cartas existentes. A oficina de playmats configura acessórios. Essas três ferramentas compartilham UI e armazenamento, mas não são a mesma tela.

### 1.1. O que entra na primeira entrega

Pokémon Básico/Estágio 1/Estágio 2; regra comum/ex/Mega ex; Item, Apoiador, Ferramenta e Estádio; ataques, Habilidades, Energia, condições, arte importada, impressão normal/holográfica/foil/cromada, variantes, prévia 3D, testes e publicação versionada.

Modelos imersivos podem ser associados somente a cenas locais já registradas e homologadas. Criar um editor de modelagem 3D, rigging ou animação de criaturas não é requisito.

Não haverá geração de arte por serviço remoto, chat online, conta de criador, marketplace ou upload automático.

<a id="editor-2"></a>

## 🧭 2. Identidade funcional não é aparência

A tela deve ensinar a distinção sem obrigar o usuário a estudar o banco.

| Camada | Exemplos | Efeito de uma mudança |
|---|---|---|
| Regras | HP, ataques, Habilidades, evolução, regra ex. | Nova versão funcional ou nova definição. |
| Impressão | Arte, moldura, foil, raridade, idioma e recorte. | Nova impressão da mesma versão funcional. |
| Uso em deck | Verso uniforme, moeda, flair permitido. | Alteração de preset/deck. |
| Preferência pessoal | Movimento reduzido, brilho de conforto. | Só muda apresentação local. |

Exemplo:

```text
Braseiro normal e Braseiro foil:
mesmas regras, mesmo limite de nome, dano idêntico.

Braseiro e Braseiro ex:
definições funcionais distintas, risco de pontos distinto.

Braseiro arte A e Braseiro arte B:
mesmas regras, impressões diferentes.
```

O checkbox “ex” NÃO marca raridade, NÃO liga foil e NÃO adiciona dano automaticamente. Escolher foil NÃO transforma a carta em ex.

<a id="editor-3"></a>

## 🗂️ 3. Biblioteca do Estúdio

Entrada permanente no menu: **Criar → Estúdio de Cartas**. O editor é recurso de usuário, não um console escondido de desenvolvimento.

Abas: **Meus projetos**, **Publicadas**, **Modelos**, **Catálogo base** e **Arquivadas**.

A biblioteca mostra nome, miniatura, categoria, tipos, regra especial, acabamento da impressão selecionada, revisão, situação de validação e data de alteração. A situação de validação vem do `validation_summary_json` persistido na revisão head (seção 27); a biblioteca não revalida cada projeto para listá-lo. Busca e filtros usam `search_key` e não exigem renderizar todas as cartas em 3D.

Ações: criar, abrir, duplicar, criar variante visual, criar nova versão, testar, publicar, exportar e arquivar. Cada ação de criação abre um projeto com um modo explícito (seção 6.1).

Catálogo base é somente leitura. “Editar como cópia” cria um projeto CUSTOM no modo `FORK`, com referência de origem. Nunca altera diretamente uma carta base em todos os saves.

Um projeto incompleto pode não ter arte, mas deve apresentar nome provisório e estado “Rascunho”. Não confundir rascunho salvo com carta já disponível para duelos.

<a id="editor-4"></a>

## 🧷 4. Rotas e contexto

| ID | Rota local | Uso |
|---|---|---|
| S43 | `#/card-studio` | Biblioteca de projetos e publicações. |
| S44 | `#/card-studio/projects/:projectId` | Editor principal. |
| S45 | `#/card-studio/projects/:projectId/tests` | Laboratório e cenários. |
| S46 | `#/card-studio/import` | Inspeção/importação de pacote. |
| S47 | `#/card-studio/releases/:definitionId/:version` | Release imutável e suas impressões. |

A edição vinda do catálogo retorna à mesma busca. A variante aberta do editor de decks retorna ao mesmo deck, sem aplicar nada automaticamente.

Guardar `returnContext`, aba, grupo selecionado, rolagem e câmera de inspeção preferida. Não guardar na URL bytes de imagens, documento inteiro, SQL, seeds ou saldos.

“Voltar” com mudanças oferece salvar, manter rascunho recuperável ou descartar somente alterações não confirmadas. Publicação e concessão de inventário não fazem parte de Undo/Redo.

<a id="editor-5"></a>

## 📐 5. Layout 16:9

O Estúdio usa três áreas: **estrutura**, **formulário** e **prévia**. O usuário deve conseguir alterar um ataque e ver imediatamente sua representação na carta.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Estúdio   Braseiro ex      Rascunho salvo    [Testar] [Publicar]         │
├───────────────┬───────────────────────────────┬──────────────────────────┤
│ ESTRUTURA     │ CONFIGURAÇÃO                  │ PRÉVIA THREE.JS          │
│ Identidade    │ Nome / categoria / tipo       │                          │
│ Evolução      │ HP / regra ex / fraqueza       │      Carta com volume    │
│ Ataques       │                               │      Frente e verso      │
│  • Ataque 1   │ Ataque selecionado            │                          │
│  • Ataque 2   │ Custo, dano, efeitos e alvos   │ [Frente] [Virar] [Mesa]   │
│ Habilidades   │                               ├──────────────────────────┤
│ Arte          │ Campos condicionais           │ ERROS / AVISOS / TESTES  │
│ Acabamento    │ Ajuda e preview textual       │ Texto efetivo de regras  │
│ Publicação    │                               │                          │
├───────────────┴───────────────────────────────┴──────────────────────────┤
│ [Desfazer] [Refazer]     Revisão 12     [Salvar rascunho] [Validar tudo]   │
└──────────────────────────────────────────────────────────────────────────┘
```

Referência de áreas em 1920 × 1080, após recolher a navegação global:

| Região | X | Y | Largura | Altura |
|---|---:|---:|---:|---:|
| Cabeçalho | 96 | 88 | 1800 | 64 |
| Árvore de estrutura | 96 | 176 | 256 | 760 |
| Formulário | 368 | 176 | 680 | 760 |
| Prévia + relatório | 1072 | 176 | 824 | 760 |
| Barra inferior | 96 | 960 | 1800 | 72 |

O formulário rola internamente. Publicar e Salvar permanecem acessíveis. A prévia pode usar a parte superior e o relatório a inferior; não colocar mensagens críticas atrás do canvas.

Em 1280 × 720, estrutura vira seletor/aba; manter formulário de aproximadamente 640 px e prévia de 528 px, com intervalo de 16 px dentro de área útil de 1184 px. Quando o espaço não comportar os mínimos, alternar abas Formulário/Prévia; não reduzir corpo para 9 px.

### 5.1. Aparência do Estúdio

O Estúdio usa o mesmo shell claro de [pocket-light-v1](direcao-visual-pocket.md): fundo azul quase branco, painéis brancos, separadores azul-cinza e botões arredondados azul/ciano. A seleção de campo tem azul mais forte e texto escuro; erro usa texto e ícone, não um brilho vermelho sobre toda a carta.

A prévia é uma vitrine clara com fundo azul/lavanda e sombra suave, sem pedestal de ferro, brasas, sala escura ou iluminação laranja cinematográfica. O destaque de uma carta Fogo pertence à arte, não ao tema de todos os controles.

Não acrescentar “Gerar (IA)” online por causa das imagens conceituais antigas. Importar é operação local. Normal/foil é seletor de impressão; ex é seletor de regras; raridade é outro campo.

---

<a id="editor-6"></a>

## 🆕 6. Criar uma carta

Assistente inicial:

```text
Escolher categoria
→ escolher modelo
→ informar nome-base
→ selecionar perfil de criação
→ criar projeto
```

Modelos:

| Modelo | Estado inicial |
|---|---|
| Pokémon Básico | 70 HP, regra NONE, um ataque simples, sem evolução. |
| Estágio 1 | 100 HP, compatibilidade de evolução obrigatória. |
| Estágio 2 | 130 HP, compatibilidade obrigatória. |
| Pokémon ex | Regra EX, dois pontos; restante é configurável. |
| Mega ex | Regra MEGA_EX, três pontos; estágio escolhido explicitamente. |
| Item | Efeito de ação e descarte; sem HP. |
| Apoiador | Limite normal de uso herdado do ruleset. |
| Ferramenta | Efeito persistente ligado a Pokémon. |
| Estádio | Efeito compartilhado e substituição pelas regras do jogo. |
| Fóssil (avançado) | Item com `fieldBehavior` e destino `BENCH_AS_POKEMON` (seção 17). |

Valores são sugestões autorais, não valores obrigatórios nem defaults oficiais. O modelo não publica sozinho e não marca testes como aprovados.

### 6.1. Modos de projeto

Todo projeto tem um modo persistido em `editor_projects.mode` (e repetido em `draft_json.mode`). O modo decide o alvo da publicação e quais campos ficam bloqueados:

| Modo | Origem | Alvo publicado | Bloqueios |
|---|---|---|---|
| `NEW_DEFINITION` | Nenhuma (modelo ou em branco). | Nova definição CUSTOM, versão 1. | Nenhum. |
| `NEW_VERSION` | Versão publicada da própria definição. | Mesmo `definitionId`, versão = última publicada + 1. | `definitionId` e categoria; regras e impressões editáveis. |
| `VARIANT` | Versão publicada (`source_version` fixa). | Novas impressões da mesma `definitionId + version`. | **Todas as regras**; só impressões (arte, template, acabamento, raridade, conjunto) são editáveis. |
| `FORK` | Qualquer versão publicada, inclusive BASE. | Novo `definitionId` CUSTOM, versão 1, com `source_definition_id`/`source_version` registrados. | Nenhum; a origem fica só como referência. |

Duplicar como nova carta usa `FORK` (novos IDs, referência de origem). Criar variante usa `VARIANT`. Corrigir uma carta publicada usa `NEW_VERSION`. O modo não muda durante a vida do projeto; mudar de intenção cria outro projeto.

<a id="editor-7"></a>

## 🪪 7. Identidade e campos gerais

| Campo | Controle | Validação / efeito |
|---|---|---|
| Nome-base | Input, 1–50 caracteres | Persistido em `baseName`; nunca inclui o sufixo ex. |
| Nome exibido | Prévia calculada, não editável | `name` derivado: `NONE` → nome-base; `EX` → nome-base + “ ex”; `MEGA_EX` → “Mega ” + nome-base + “ ex”. |
| ID funcional | Gerado, copiável | Não editável livremente após publicação. |
| Categoria | Dropdown | Pokémon ou Treinador; mudança destrutiva exige confirmação. |
| Subtipo de Treinador | Dropdown condicional | Item, Apoiador, Ferramenta ou Estádio. |
| Idioma da impressão | Dropdown | PT-BR inicial; não muda IDs de regra. |
| Descrição temática | Textarea | `flavorText`; sem efeito mecânico. |
| Etiquetas | Seletor de lista | `tags`; não cria regras por dedução e nunca contém ex. |
| Conjunto autoral | Seletor | `setId` das impressões (padrão em `authoring.setId` do rascunho); organização e elegibilidade do conteúdo personalizado. |
| Notas de autoria | Textarea privada | `authoring.notes`; não aparece na carta durante batalha. |

O nome não é usado como seletor de mesh nem ID de banco. `deckLimitKey` = `deck-limit-key-v2(name)` ([persistência §9](persistencia-sqlite.md#sqlite-9)): “♀” → “ f” e “♂” → “ m”, depois NFD, remoção de diacríticos, minúsculas, cada caractere fora de `[a-z0-9]` vira “-”, hífens repetidos colapsados e aparados. Ex.: “Braseiro ex” → `braseiro-ex`; “Nidoran♀” → `nidoran-f` e “Nidoran♂” → `nidoran-m` (não colidem). A UI mostra o agrupamento de limite e a busca usa `search-key-v1(name)`.

Duas cartas com o mesmo nome de regra não podem burlar o limite de duas cópias por terem IDs diferentes. Alterar o nome cria uma escolha de design; o relatório destaca possíveis clones e avisa sobre balanceamento, sem afirmar proteção contra modificação deliberada de um jogo local.

Texto inserido pelo usuário é renderizado como texto. Não aceitar HTML executável, eventos inline ou Markdown que injete URLs/script no template.

<a id="editor-8"></a>

## 🐣 8. Estágio, evolução, tipos e atributos

| Campo | Contrato |
|---|---|
| Estágio | BASIC, STAGE_1 ou STAGE_2. Mega não cria um quarto estágio. |
| Evolui de | Seleção de chave de compatibilidade; nomes exibidos como apoio. |
| Tipo | Até dois tipos no schema; segunda seleção só é publicável se o ruleset suportar. |
| HP base | Inteiro de 10 a 9990, múltiplo de 10 no template inicial. |
| Fraqueza | Modo simples: tipo + `operation: ADD` + `value` 20 (padrão). `MULTIPLY` é suportado pelo motor ([DSL §13.1](efeitos-dsl.md#dsl-13)) e só aparece no toggle **avançado**, com aviso de balanceamento; nunca é o padrão. |
| Recuo | Inteiro de 0 a 10 unidades de custo Incolor. |
| Regra especial | NONE, EX ou MEGA_EX. |
| Pontos por Nocaute | Exibição derivada de regra: 1, 2 ou 3. |

Limites acima são guardas de autoria, não afirmação de limites do jogo oficial. Um HP muito alto pode ser legal no laboratório e receber aviso forte de balanceamento.

Estágio BASIC não exige origem de evolução. Estágios superiores precisam de origem ou de um mecanismo de entrada especial explicitamente suportado.

Mostrar árvore de compatibilidade e avisar se não existe nenhuma carta de origem no pacote selecionado. Detectar ciclo evolutivo acidental. Não assumir que qualquer carta de estágio anterior é compatível.

Separar tipo do Pokémon de custo do ataque. Um Pokémon Dragão pode exigir Água e Elétrico, e Incolor no custo aceita fornecimento de qualquer tipo.

<a id="editor-9"></a>

## ✴️ 9. Configurar ex e Mega ex

A seção mostra um seletor com descrição:

```text
Comum:
Ao ser Nocauteado, normalmente entrega 1 ponto.

ex:
Ao ser Nocauteado, normalmente entrega 2 pontos.

Mega ex:
Ao ser Nocauteado, normalmente entrega 3 pontos.
O estágio e a evolução continuam definidos acima.
```

No modo simples pode existir toggle “Carta ex”, acompanhado de um seletor avançado Mega ex. Ambos editam o mesmo campo `ruleBox`; não existem booleanos conflitantes.

Ao ativar ex em rascunho ainda não publicado:

```text
Alterar ruleBox
→ recalcular knockoutPoints
→ derivar de novo name (a partir de baseName) e deckLimitKey
→ atualizar moldura/caixa de regra sugerida
→ invalidar testes funcionais anteriores
→ mostrar aviso sobre risco de pontos
```

Não aumentar HP, dano, custo ou raridade automaticamente. O usuário configura esses atributos.

Em carta publicada, alterar NONE para EX cria um projeto `FORK` (nova definição funcional), pois nome, chave de limite e pontos mudam. Não converter a impressão normal de todas as cópias já possuídas. EX para MEGA_EX também exige nova identidade, análise de evolução e testes.

Treinadores não podem receber regra ex neste ruleset. O controle fica ausente, não um botão que apenas muda a moldura.

<a id="editor-10"></a>

## ⚔️ 10. Lista e anatomia dos ataques

Permitir adicionar, duplicar, remover e reordenar ataques. O template clássico recomenda até dois; o editor suporta até quatro para conteúdo customizado, desde que o layout permaneça legível. Publicação bloqueia overflow; nunca reduz texto indefinidamente.

Cada ataque possui ID estável dentro da versão da carta. Os campos seguem [DSL §10](efeitos-dsl.md#dsl-10):

| Campo | Função |
|---|---|
| Nome (`name`) | Rótulo de 1–40 caracteres. |
| Custo de Energia (`energyCost`) | Contadores por tipo + Incolor. |
| Dano (`baseDamage` / `damageFormula`) | Fixo, fórmula ou nenhum dano direto. |
| Notação impressa | Gerada a partir da fórmula: valor, + ou × quando apropriado. |
| Condições de uso (`preconditions`) | Pré-condições verificadas antes da declaração. |
| Custos adicionais (`additionalCosts`) | Descarte/seleção paga para executar. |
| Alvo de dano principal (`damageTarget`) | Seletor; padrão `{"scope": "OPPONENT_ACTIVE"}`; `null` quando não há dano direto. Dano ao Banco usa escopo de Banco com `pick`, nunca truque de dano 0. Fraqueza só se aplica automaticamente ao Ativo adversário. |
| Efeitos (`effects`) | Lista ordenada de blocos `PRE_DAMAGE`/`POST_DAMAGE` com seletor. |
| Consequência (`endsTurn`) | `true` em ataques normais: atacar encerra o turno. |
| Apresentação (`presentation`) | Opcional: `presetId` (`ATTACK_STANDARD`/`ATTACK_SPECIAL`), `vfxProfile`, `soundCue`. Nunca altera regras. |
| Explicação | Texto funcional gerado, separado de descrição temática. |

Ao selecionar o ataque na árvore, o formulário mostra **custo → dano → efeitos → prévia de texto → teste isolado**.

O ataque deve ser jogável pelo mesmo comando do duelo. Não criar um botão especial de editor que aplique dano sem validar Energia.

<a id="editor-11"></a>

## ⚡ 11. Editor de custo de Energia

Cada tipo tem ícone, nome e controles +/−. Exibir total, requisitos específicos e Incolores separadamente.

Exemplo:

```text
Fogo: 1
Incolor: 1
Custo apresentado: [Fogo] [Incolor]
```

Esse requisito é diferente de “duas Energias de Fogo”. O usuário pode testar combinações e visualizar quais satisfazem o custo.

Ataque sem custo: todos os contadores zero, rótulo explícito “Sem custo de Energia”. Não inserir silenciosamente uma Energia Incolor para “corrigir”.

A Energia normalmente permanece ligada após atacar. “Descartar Energia” pertence aos custos adicionais ou efeitos, não ao campo de custo básico.

Guardas iniciais: 0–10 por tipo e total até 20 no conteúdo customizado; o ruleset pode impor limites menores. Tipos não geráveis pela Zona não são automaticamente ilegais, pois podem existir fontes por efeito.

Energia Dragão e Energia Incolor não são objetos gerados pelo modelo atual. O editor não pode criá-los apenas porque existem tipos de Pokémon com esses nomes.

<a id="editor-12"></a>

## 🧮 12. Dano fixo e fórmulas

Modo simples: valor inteiro não negativo. Dano zero é válido para ataque de suporte.

Modo fórmula: construtor visual de expressões tipadas. Os operadores são exatamente os de [DSL §4](efeitos-dsl.md#dsl-4):

```text
CONST
ADD / SUBTRACT / MULTIPLY
MIN / MAX
CLAMP
COUNT_HEADS / COUNT_TAILS
COUNT_ATTACHED_ENERGIES
COUNT_PROVIDED_ENERGY_UNITS
COUNT_BENCH_POKEMON
COUNT_POKEMON
COUNT_CARDS
DAMAGE_ON_SOURCE
DAMAGE_ON_TARGET
POINTS
OUTPUT_COUNT
```

Diferenciar número de anexos de unidades de Energia fornecidas. Diferenciar dano acumulado de HP restante. Cada variável mostra quem é fonte/alvo (`selector` tipado) e o momento em que é lida.

Não aceitar texto como `eval("30 + ...")`. A fórmula é uma árvore de dados com no máximo 32 nós e profundidade 6; o resultado de dano é limitado a 0–9990.

Contrato de dados: `baseDamage` e `damageFormula` são alternativas. Dano fixo usa `baseDamage` numérico e `damageFormula:null`. Fórmula usa `baseDamage:null`. Um ataque sem dano usa `baseDamage:0`. Não aplicar os dois e dobrar o resultado.

Moedas usadas pela fórmula são resolvidas em efeitos PRE_DAMAGE com `outputId`. O validador rejeita variável inexistente ou usada antes de ser criada.

Amostra conceitual:

```json
{
  "baseDamage": null,
  "damageFormula": {
    "op": "MULTIPLY",
    "operands": [
      {"op": "CONST", "value": 40},
      {"op": "COUNT_HEADS", "reference": "attackCoins"}
    ]
  }
}
```

Fraqueza e modificadores não são digitados dentro de toda fórmula. O motor aplica seu pipeline depois do dano-base calculado, salvo operação explícita que mande ignorar parte dele.

<a id="editor-13"></a>

## 🧩 13. Construtor visual de efeitos

Cada bloco apresenta **quando**, **o quê**, **em quem**, **quanto**, **quem escolhe** e **duração**. O construtor edita blocos da [DSL §2](efeitos-dsl.md#dsl-2) e é gerado a partir do registro normativo de opcodes de [efeitos-dsl.md](efeitos-dsl.md#dsl-9): cada opcode fornece parâmetros, validação, texto gerado e dicas de IA; o Estúdio não mantém uma lista própria.

Exemplo de sequência:

```text
Antes do dano:
Lançar 2 moedas → guardar como “attackCoins”

Dano principal:
40 × quantidade de caras

Após o dano:
Se houve pelo menos 1 cara → aplicar Queimadura ao Ativo adversário
```

Campos de cada bloco:

| Campo | Dado da DSL | Exemplos |
|---|---|---|
| Momento | `timing` | `PRE_DAMAGE`, `POST_DAMAGE` (ataque); `ON_PLAY` (Item/Apoiador/Fóssil); `ON_ACTIVATE`, `ON_TRIGGER`, `CONTINUOUS`, `REPLACEMENT` (Habilidades, Ferramentas, Estádios). |
| Operação | `operation.type` | Cura, compra, condição, mover Energia, troca — sempre um opcode da [DSL §9](efeitos-dsl.md#dsl-9). |
| Controlador da escolha | `pick.chooser` | `CONTROLLER` ou `OPPONENT`. |
| Seletor | `target` / `zone` + `filter` | Próprio Ativo, Banco rival, Pokémon de tipo específico ([DSL §3](efeitos-dsl.md#dsl-3)). |
| Cardinalidade | `pick.mode`, `min`, `max`, `count` | Exatamente 1, até 2, todos os elegíveis, sorteio. |
| Obrigatório | `optional` | Sim ou opcional. |
| Quantidade | `amount` / `count` | Inteiro ou fórmula permitida. |
| Precondição local | `condition` | Somente quando a [condição](efeitos-dsl.md#dsl-5) for verdadeira. |
| Duração | `duration` | `INSTANT`, `THIS_TURN`, `NEXT_OPPONENT_TURN`, `NEXT_OWN_TURN`, `WHILE_SOURCE_IN_PLAY` ([DSL §6](efeitos-dsl.md#dsl-6)). |
| Falha parcial | `failurePolicy` | `REQUIRE_ANY`, `REQUIRE_ALL` ou `BEST_EFFORT`. |
| Saída nomeada | `outputId` | “attackCoins”, usado depois por fórmulas e condições. |

Arrastar reordena blocos quando a dependência permitir. Alternativas por teclado permitem subir/descer. Referências quebradas bloqueiam publicação.

A UI deve marcar efeito não implementado como **não disponível para publicação**, sem fingir execução aproximada. Texto livre não desbloqueia novos opcodes.

<a id="editor-14"></a>

## 🧰 14. Biblioteca de efeitos publicáveis

A biblioteca é construída a partir do registro normativo de [efeitos-dsl.md](efeitos-dsl.md): a lista de opcodes publicáveis é exatamente a tabela da [DSL §9](efeitos-dsl.md#dsl-9). As famílias abaixo apenas agrupam esses opcodes para navegação.

| Família | Opcodes (DSL §9) | Exemplos configuráveis | Atenção obrigatória |
|---|---|---|---|
| Moedas | `FLIP_COINS` | Lançar N moedas ou até sair coroa; guardar em `outputId`. | Sorteio só pelo `battleRng`, antes da apresentação. |
| Compra | `DRAW_CARDS` | Comprar N; comprar até N na mão. | Limite de mão e baralho vazio. |
| Busca | `SEARCH_DECK`, `LOOK_AT_TOP`, `RECOVER_FROM_DISCARD` | Selecionar Básico no deck; sortear carta filtrada; ver/reordenar o topo; recuperar do descarte. | Informação revelada, shuffle e ausência de alvo. |
| Dano | `DEAL_DAMAGE` | Ativo, Banco, múltiplos alvos, próprio Pokémon. | Categoria, Fraqueza e grupo simultâneo. |
| Cura | `HEAL_DAMAGE` | Curar N ou todo dano em alvo elegível. | Não aumentar HP base. |
| Condições | `APPLY_CONDITION`, `REMOVE_CONDITION` | Veneno, Queimadura, Sono, Paralisia, Confusão. | Exclusividade, expiração e eventos de checkup. |
| Energia | `ATTACH_ENERGY`, `MOVE_ENERGY`, `DISCARD_ENERGY` | Ligar da Zona, recuperar, mover, descartar. | Origem e consumo ou não da ligação manual. |
| Troca | `SWITCH_ACTIVE` | Trocar Ativo; obrigar rival a escolher substituto. | Não confundir com Recuo. |
| Evolução | `EVOLVE` | Evolução especial compatível. | Restrições e preservação de dano. |
| Modificadores | `MODIFY` | Dano, custo, HP, Recuo, fornecimento de Energia, pontos. | Fonte, alcance e remoção. |
| Proteção | `PREVENT_DAMAGE`, `PREVENT_EFFECTS` | Prevenir dano ou efeitos de ataques adversários. | Não tratar como invulnerabilidade universal. |
| Controle | `RESTRICT_ACTION`, `SUPPRESS_ABILITIES`, `END_TURN` | Impedir ataque, Recuo ou uso de categoria; suprimir Habilidades; encerrar o turno. | Duração precisa e fontes simultâneas. |
| Campo | `PUT_ON_BENCH`, `RETURN_TO_HAND`, `SHUFFLE_INTO_DECK`, `DISCARD_POKEMON`, `KNOCK_OUT`, `REMOVE_TOOL` | Colocar, devolver, embaralhar, descartar, Nocautear, remover Ferramenta. | Destino de pilha e anexos; pontuação diferente. |
| Mão e baralho | `DISCARD_CARDS`, `SHUFFLE_DECK`, `REVEAL_HAND` | Descartar da mão/topo, embaralhar, revelar mão. | Privacidade e escolha aleatória em zona oculta. |
| Fluxo | `CONDITIONAL`, `SCHEDULE_DELAYED` | Ramo condicional; efeito atrasado para o próximo turno. | Sem efeitos ocultos; validade e remoção do atrasado. |
| Cópia | `COPY_ATTACK` | Copiar ataque de referência elegível. | Dependência versionada e contexto do atacante. |

Não manter uma lista visual de 80 efeitos quando só 5 executam: um opcode ausente do registro não aparece para autoria, e um opcode desconhecido num documento importado bloqueia a publicação (`UNKNOWN_OPCODE`).

Templates iniciais de ataque: dano simples; dano + condição; dano por moeda; dano + descarte; dano ao Banco; compra sem dano; cura; aceleração de Energia; troca após ataque.

Cada template gera a mesma estrutura editável, sem lógica escondida específica pelo nome do ataque.

<a id="editor-15"></a>

## 💳 15. Custos adicionais e legalidade

Usar painel próprio **“Para usar este ataque”** para custos e outro **“Depois que o ataque acontece”** para efeitos.

Exemplo:

```text
Custo adicional:
Descarte 1 carta da sua mão.

Efeito posterior:
Descarte 1 Energia de Fogo deste Pokémon.
```

O primeiro pode impedir declarar o ataque se não puder ser pago. O segundo segue a política de resolução do efeito. A interface deve explicar essa diferença.

Alvos e custos escolhidos antes do commit podem ser cancelados. Depois de informação revelada ou custo comprometido, cancelamento só acontece se a regra permitir.

Testar interação com Confusão, ausência de alvo, mão cheia, proteção, mudança de custo e efeitos que encerram o turno.

<a id="editor-16"></a>

## ✨ 16. Editor de Habilidades

Tipos: **ativada**, **contínua**, **disparada**, **prevenção/substituição**. O formulário muda com o tipo. Os campos são exatamente os de [DSL §11](efeitos-dsl.md#dsl-11):

| Campo | Configuração |
|---|---|
| `id` e `name` | Identidade técnica estável e rótulo exibido (1–40 caracteres). |
| `kind` | `ACTIVATED` (botão “Usar”), `CONTINUOUS` (sem botão), `TRIGGERED` (reage a gatilho) ou `REPLACEMENT` (intercepta um evento). |
| `sourcePositions` | `ACTIVE`, `BENCH` ou ambos; fora dessas posições a Habilidade não contribui nem dispara. |
| `trigger` | Obrigatório e exclusivo de `TRIGGERED`: `event` + `filter` da [DSL §7](efeitos-dsl.md#dsl-7) (entrada, evolução, ligação de Energia, dano, condição, Nocaute, início/fim de turno etc.). |
| `conditions` | Precondições da [DSL §5](efeitos-dsl.md#dsl-5): tipo, posição, condição especial, comparações. |
| `costs` | Custos adicionais da [DSL §8](efeitos-dsl.md#dsl-8), validados antes de ativar. |
| `usageLimit` | `scope` (`INSTANCE_TURN`, `NAME_TURN`, `PLAYER_TURN`, `INSTANCE_MATCH`, `PLAYER_MATCH`) + `count`; obrigatório em `ACTIVATED`. |
| `optional` | Em `TRIGGERED`, o controlador pode recusar. |
| `endsTurn` | Somente em `ACTIVATED`; a UI alerta antes de confirmar. |
| `effects` | Blocos do mesmo catálogo com timing compatível: `ON_ACTIVATE`, `CONTINUOUS`, `ON_TRIGGER` ou `REPLACEMENT`. |

O alcance (próprio Pokémon, aliados, adversários, campo) é o `target` de cada bloco. Remoção e supressão não são campos: a contribuição termina quando a fonte sai, evolui, deixa `sourcePositions`, é suprimida ou a duração acaba, conforme o motor ([DSL §14](efeitos-dsl.md#dsl-14)); marcadores de uso pertencem à instância de campo.

Uma Habilidade contínua não gera botão “Usar” durante o duelo. Um gatilho não é executado clicando na ilustração.

A UI de “uma vez por turno” exige escolher o escopo. Mostrar exemplo com duas cópias no Banco para explicar se ambas podem usar.

Prevenção consome ou não uma carga conforme seus dados. A prévia mostra o evento interceptado e como o motor continua depois dele.

Limite inicial de quatro Habilidades por carta customizada, sujeito a layout e suporte de motor. Cartas simples deveriam usar menos; limite de autor não é recomendação de balanceamento.

<a id="editor-17"></a>

## 🧑‍🏫 17. Editor de Treinadores

Trocar categoria para TRAINER remove da impressão os atributos exclusivos de Pokémon depois de confirmação. O rascunho anterior continua acessível pelo histórico. Treinadores não aceitam `stage`, `types`, `attacks`, `abilities`, `retreatCost`, `weakness` nem `ruleBox` diferente de `NONE` (`TRAINER_FIELD_INVALID`).

O formulário de Treinador edita `subtype`, `trainerRules` e `trainerEffects`, conforme [DSL §12](efeitos-dsl.md#dsl-12):

| Campo de `trainerRules` | Contrato |
|---|---|
| `playConditions` | Condições da [DSL §5](efeitos-dsl.md#dsl-5) verificadas ao jogar. |
| `destinationAfterPlay` | `DISCARD` (Item, Apoiador), `ATTACHED_TOOL` (Ferramenta), `STADIUM_SLOT` (Estádio) ou `BENCH_AS_POKEMON` (Fóssil). |
| `toolTarget` | Só em Ferramenta: filtro de Pokémon que pode recebê-la. |
| `fieldBehavior` | Só em Fóssil: `kind: PLAY_AS_POKEMON`, `hp`, `types`, `retreatAllowed: false`, `knockoutPoints: 1`, `canAttack: false`, `ownerMayDiscardDuringMainPhase`. |

**Item:** condições de uso, alvos, custos adicionais e sequência de blocos `ON_PLAY`; descarte após resolver.

**Apoiador:** mesmo construtor, com indicador do limite normal por turno herdado do ruleset. O criador não edita o limite global para “99” dentro de uma carta simples.

**Ferramenta:** `toolTarget`, blocos `CONTINUOUS`/`ON_TRIGGER`/`REPLACEMENT`, aumento de HP (`MODIFY MAX_HP`), remoção e destino. Testar perda do bônus de HP com dano acumulado.

**Estádio:** efeito compartilhado (`CONTINUOUS`/`ON_TRIGGER`), dono da carta, substituição e restrição de nome. Prévia da mesa deve distinguir carta de Estádio de playmat decorativo.

Fóssil é template avançado: `subtype` Item com `fieldBehavior` e destino `BENCH_AS_POKEMON`. Ter HP não o transforma em Básico elegível para a mão inicial. Só publicar quando o motor executar todas as exceções.

<a id="editor-18"></a>

## 🖼️ 18. Importação e troca de arte

Fontes: arquivo local do usuário ou asset já registrado no catálogo local. Não exigir URL nem usar imagem remota como dependência permanente.

| Referência de arte | Uso | Persistência |
|---|---|---|
| `artAssetId` | Arte importada pelo usuário. | SHA-256 do master normalizado, BLOB imutável em `assets`; repetido no binding `ART_MASTER`. Trocar a arte cria outra impressão. |
| `artKey` | Arte BUNDLED do catálogo base (chave lógica do pacote). | Resolvida por `dist/manifest.json`; pode ser trocada numa nova versão do pacote sem mudar `printingId` ([persistência §8.2](persistencia-sqlite.md#sqlite-8)). |
| nenhuma (`artMode: TEMPLATE_ONLY`) | Carta ainda sem arte. | `artKey` e `artAssetId` nulos; template + nome + dados com placeholder tipado. |

Uma impressão usa exatamente uma das três situações; o schema recusa `artKey` e `artAssetId` juntos.

Aceitar PNG, JPEG e WebP estáticos. Rejeitar SVG com conteúdo ativo, GIF/APNG/WebP animados nesta versão, executáveis disfarçados e imagens acima dos limites. Validar assinatura e dimensões antes da decodificação integral.

Limites propostos: até 10 MiB por entrada, no máximo 4096 px por eixo e 16.777.216 pixels. Normalizar orientação e remover metadados não necessários. A spec de runtime mantém o pipeline comum de importação.

Modos (`artMode`):

| Modo | Comportamento |
|---|---|
| `ART_WINDOW` — Ilustração em janela | Imagem ocupa área da arte; moldura/regras são compostas pelo template. |
| `FULL_ART` — Arte completa | Imagem se estende; áreas de texto recebem proteção de leitura. |
| `FULL_PRINTING` — Impressão completa | Arquivo já contém a carta visual; regras continuam configuradas separadamente. A face (prévia do editor, coleção, mesa 2D, carta 3D, exportação PNG) mostra **só a imagem**: moldura, nome, PS, ataques, rodapé e símbolo de raridade do template não são desenhados por cima. Enquanto a imagem carrega, ou se falhar, a face usa o template normal. O rótulo acessível continua vindo dos dados da carta. |
| `TEMPLATE_ONLY` — Sem arte | Template + nome + dados; a janela de arte mostra placeholder tipado (cor e padrão do tipo, ícone da categoria). Publicável. |

Em “Impressão completa”, o editor não interpreta texto da imagem como regras. Mostrar aviso e exigir revisão de correspondência. Não prometer OCR ou extração automática fiel.

Controles (`crop` + `artTransform`): recorte normalizado; `scale` 0,25–4; `offsetX`/`offsetY` −1 a 1; `rotationDegrees` −15° a 15°; `mirrorIllustration` (espelha a **ilustração apenas**); `exposure` −1 a 1; e restabelecer. Nunca espelhar a carta inteira com textos.

Retenha master normalizado e parâmetros de crop. Recorte é não destrutivo; exportar deve permitir reedição sem exigir o arquivo original.

<a id="editor-19"></a>

## 🖌️ 19. Moldura, tipografia e composição

Templates são definidos pelo jogo, não HTML/CSS ou shaders arbitrários importados. A família visual padrão é `pocket-light-card-v1`, descrita na [direção de arte](direcao-visual-pocket.md#visual-06): proporção 5:7, borda prata/cinza-claro fina, cabeçalho limpo, campos de regra claros e cor elemental localizada. O template completo deve lembrar uma carta colecionável japonesa, não uma carta de RPG de fantasia sombria.

Registro de templates (`templateId` da impressão):

| `templateId` | Uso | Compatibilidade |
|---|---|---|
| `pocket-light-card-v1/pokemon-classic` | Pokémon com janela de arte bem definida. | `POKEMON` com `ruleBox` `NONE`. |
| `pocket-light-card-v1/pokemon-ex` | Pokémon ex/Mega ex com caixa de regra. | `POKEMON` com `ruleBox` `EX` ou `MEGA_EX`. |
| `pocket-light-card-v1/pokemon-full-art` | Ilustração ampliada / arte completa. | `POKEMON` com qualquer `ruleBox`; a caixa de regra aparece quando `ruleBox` ≠ `NONE`. |
| `pocket-light-card-v1/trainer` | Item, Apoiador, Ferramenta e Estádio. | `TRAINER` sem `fieldBehavior`. |
| `pocket-light-card-v1/fossil` | Fóssil. | `TRAINER` Item com `fieldBehavior`. |

IDs antigos dos exemplos 3.1 (como `pokemon-stage1-ex-classic-v1`) deixaram de existir. A face da carta é composta com a **fonte OFL empacotada** com o jogo, nunca com fontes do sistema, para que a textura composta seja idêntica em todos os sistemas operacionais.

### 19.1. Estrutura da frente

```text
Estágio e indicação de evolução
Nome + marca ex quando aplicável
HP e símbolo de tipo no canto superior
Janela de arte ou arte completa
Habilidade(s), quando existentes
Ataque(s), custo de Energia e dano
Fraqueza +20 por padrão / Recuo
Caixa de regra ex, quando existente
Número (collectorNumber), conjunto (setId) e crédito de arte (artist)
Borda física clara
```

Não adicionar custo universal em um círculo no canto superior esquerdo, categoria “Magia”, Resistência −30 ou Fraqueza ×2 por herança das imagens conceituais. O formulário e o template só exibem campos de fato pertencentes à definição e ao ruleset.

Coordenadas são normalizadas em relação à carta, não em relação ao canvas inteiro. Nome, HP, custo, dano e regra especial devem permanecer legíveis e fora de máscaras de brilho agressivas. Dados funcionais também ficam disponíveis em HTML no inspector.

### 19.2. Perfis de composição

| Perfil | `templateId` | Tratamento |
|---|---|---|
| Clássico | `…/pokemon-classic` | Janela de arte bem definida; moldura prateada clara e corpo levemente tingido pelo tipo. |
| Clássico ex | `…/pokemon-ex` | Igual ao clássico, com marca ex no nome e caixa de regra. |
| Ilustração ampliada / arte completa | `…/pokemon-full-art` | Arte ocupa mais espaço, mantendo contraste protegido atrás dos textos; a regra ex vem da definição, não da extensão da arte. |
| Treinador | `…/trainer` | Campo claro, identificação de subtipo, ilustração e efeito; sem campos de HP/ataque incompatíveis. |
| Fóssil | `…/fossil` | Treinador com HP de campo destacado e aviso “não é Básico”. |

Modelos autorais podem variar, mas o catálogo base desta revisão não adota molduras de ferro negro, gravuras medievais, chamas permanentes ou texto dourado sobre preto. “Prata” significa impressão/material, não bloom branco apagando as letras.

### 19.3. Estilo de ilustração

Aceitar variedade coerente com a referência: traço limpo e pintura suave, ilustração naturalista estilizada, aquarela, cenas narrativas e render estilizado de coleção. Cores devem ser vivas, com personagem legível e expressão reconhecível. Uma carta pode ter fundo escuro por composição; isso não torna a UI escura.

O importador não converte automaticamente fotografia ou arte sombria em ilustração Pocket. Ele pode avisar sobre contraste, corte e resolução; a correção artística é uma etapa de produção. Nunca recolorir destrutivamente a imagem original nem prometer avaliação automática de direitos.

### 19.4. Texto e publicação

Fonte mínima e caixa de texto são validadas. Se não couber: avisar, sugerir redação mais curta aprovada, outro template ou menos ataques; não recortar linhas silenciosamente.

Textos de efeitos são gerados a partir dos dados. Não escrever “cause 200” quando a operação causa 20. Descrição temática não cria regra de jogo.

Novas composições são novos `templateId` e novas impressões. Preservar as impressões publicadas e o template antigo necessário aos replays; a adoção visual não é UPDATE destrutivo de uma publicação. `setId`, `collectorNumber` e `artist` pertencem à impressão: normal e foil podem ter números distintos.

---

<a id="editor-20"></a>

## 💎 20. Normal, holográfico, foil e cromado

Todos são perfis de **impressão**, independentes da regra ex.

| Acabamento (`finish`) | Aparência esperada | Campos específicos |
|---|---|---|
| NORMAL | Impressão estável, superfície suave, sem iridescência. | `roughness`, borda e reflexo discreto; `intensity` obrigatoriamente 0. |
| HOLOGRAPHIC | Brilho localizado na arte e máscara definida. | `intensity`, padrão e máscara. |
| FOIL | Variação iridescente por ângulo em áreas permitidas. | `foilPalette`, `patternAngleDegrees`, `patternScale`, `tiltResponse`. |
| CHROME | Regiões metálicas selecionadas e borda cromada. | `metalness`, `roughness`, máscara e `chromeEnvironment`. |

O dropdown é exclusivo para o perfil principal; configurações secundárias podem modular borda/área. Não persistir quatro flags independentes que permitam NORMAL e FOIL simultaneamente.

Presets iniciais (`finishSettings.presetId`):

| `presetId` | Nome na UI | Acabamento típico |
|---|---|---|
| `normal-matte` | Normal fosco | NORMAL |
| `holo-soft-art` | Holo suave na arte | HOLOGRAPHIC |
| `foil-diagonal` | Foil diagonal discreto | FOIL |
| `foil-spectral` | Foil espectral | FOIL |
| `chrome-border` | Cromado de borda | CHROME |

Parâmetros de autoria limitados ([schema de impressão](schemas/card-printing.schema.json)):

| Parâmetro | Campo | Intervalo proposto | Observação |
|---|---|---|---|
| Intensidade de acabamento | `intensity` | 0–1 | Valor zero não altera regras; `NORMAL` exige 0. |
| Metalness | `metalness` | 0–1 | Apenas na camada/material pertinente. |
| Roughness | `roughness` | 0,05–1 | Evitar espelho sem leitura. |
| Ângulo do padrão | `patternAngleDegrees` | −180° a 180° | Transformação visual. |
| Escala do padrão | `patternScale` | 0,25–8 | Valores extremos geram aviso de aliasing. |
| Velocidade ambiente | `ambientSpeed` | 0–0,25 | Zero mantém resposta à inclinação sem movimento automático. |
| Normal strength | `normalStrength` | 0–1 | Mapa de dados, não imagem de cor. |
| Brilho emissivo | `emissive` | 0–0,25 | Limitado às áreas permitidas. |
| Resposta à inclinação | `tiltResponse` | 0–1 | Quanto o brilho acompanha o ângulo. |
| Paleta do foil | `foilPalette` | `SPECTRAL`, `PASTEL`, `SILVER`, `GOLD` | Usada por FOIL/HOLOGRAPHIC; ignorada nos demais. |
| Ambiente do cromado | `chromeEnvironment` | `STUDIO_LIGHT`, `TABLE_LIGHT`, `NEUTRAL` | Usado por CHROME; ignorado nos demais. |
| Máscara | `maskMode` | `ART_WINDOW`, `IMPORTED`, `PAINTED` | `IMPORTED`/`PAINTED` exigem `foilMaskAssetId` (seção 21). |
| Proteção de texto | `protectText` | sempre `true` | Não desligável. |

São limites autorais iniciais sujeitos a QA, não parâmetros extraídos do aplicativo original.

Raridade tem seletor separado. Mudar COMMON para ULTRA não modifica chance de pacotes automaticamente: probabilidades pertencem às tabelas de produto.

### 20.1. Acabamento na paleta Pocket

Normal mantém a impressão clara e estável. Holográfico/foil respondem ao ângulo com brilho localizado e reflexo espectral suave, sem trilha de fogo ou borda neon permanente. Cromado é uma extensão autoral permitida, não a afirmação de uma categoria oficial com esse nome.

Nenhum acabamento modifica o verso informacional de uma carta oculta, gera som de raridade numa compra adversária ou aciona automaticamente um cut-in em cada movimento. Os materiais e seus limites seguem [runtime](runtime-offline-threejs.md#runtime-15) e [direção visual](direcao-visual-pocket.md#visual-07).

---

<a id="editor-21"></a>

## 🎭 21. Máscara de foil

Três modos (`finishSettings.maskMode`):

```text
ART_WINDOW   Somente área da ilustração
IMPORTED     Máscara local importada (foilMaskAssetId obrigatório)
PAINTED      Máscara pintada no editor (foilMaskAssetId obrigatório; rascunho em authoring.maskPaint)
```

Máscara é imagem de dados em escala de cinza. Branco permite acabamento; preto bloqueia; tons intermediários reduzem a contribuição. Não tratá-la como sRGB de arte.

Ferramentas de pintura: pincel, borracha, tamanho, dureza, desfazer/refazer, limpar, preencher região de arte e mostrar sobreposição. Um Canvas 2D auxiliar pode pintar a máscara; Three.js representa o material final.

Independentemente da máscara, aplicar uma máscara de proteção de texto do template. A região do nome, HP, custos, regras e caixa ex não pode receber intensidade que destrua leitura.

Na troca de arte, oferecer manter máscara quando alinhamento continua válido ou reiniciar/reprojetar com confirmação. Não reaproveitar silenciosamente uma máscara que cobre a nova legenda.

Salvar máscara e parâmetros no rascunho; publicação associa um asset imutável. Modificar uma máscara compartilhada cria outro hash; não muda todas as impressões.

<a id="editor-22"></a>

## 🧊 22. Prévia Three.js em tempo real

Usar o mesmo CardVisual, compositor e perfis de material do jogo. Não manter um shader exclusivo de editor que fique bonito na prévia, mas seja diferente na batalha.

Subcenas: **inspeção**, **mão**, **campo**, **revelação** e **comparação**. Todas reutilizam o renderer compartilhado; não criar um contexto WebGL por variante.

Controles:

```text
Frente / verso
Arrastar para inclinar
Restabelecer câmera
Luz de estúdio / mesa / ambiente neutro
Rotação automática opcional
Normal / baixo / alto perfil de qualidade
Zoom limitado
Movimento reduzido
Comparar com versão anterior
```

O material da arte usa sua codificação de cor corretamente; máscaras/normal/roughness são mapas de dados. Three.js documenta essa distinção e o tratamento de saída de cor. [ED01] [ED02]

Mudar slider usa parâmetros visuais transitórios e debounce de gravação. Não reabrir o banco ou recompilar todas as cartas a cada frame.

Renderização da frente de alta resolução é atualizada após mudanças relevantes, com cache por hash do template/regras/aparência. Liberar textura e ImageBitmap substituídos; não acumular centenas de impressões temporárias na GPU.

Uma falha de GPU não perde o formulário. Mostrar prévia 2D temporária e preservar edição, gravação e relatórios.

### 22.1. Cena de referência obrigatória

O preset inicial de inspeção usa fundo azul-claro/lavanda, luz difusa neutra e frente sem alteração cinematográfica de cor. “Mesa” usa o campo claro real; “Revelação” usa a saída de uma pilha de pacote, não um giro obrigatório em cada carta.

A prévia “Ataque” usa cut-in da carta com faixa do tipo, fundo temporariamente atenuado e retorno ao campo. Não invoca um modelo de monstro e não escurece o Estúdio inteiro. A vista “Mão adversária” deve mostrar somente verso uniforme, sem foil ou áudio que revele a impressão.

A referência de teste Braseiro ex preserva os dados do exemplo: 140 HP, Estágio 1, Fraqueza Água +20, Recuo 2, ataques definidos no JSON. As imagens conceituais de 180 HP com Resistência não constituem fonte de regras.

---

<a id="editor-23"></a>

## 🎞️ 23. Prévia de animações e flairs

Painel **“Ver no jogo”** aciona presets já definidos em [interface-16x9.md](interface-16x9.md#interface-motion-timing):

```text
Comprar da pilha para a mão
Revelar carta própria
Revelar carta pública do adversário
Entrar no Banco
Evoluir
Mostrar ataque e impacto
Ativar Habilidade
Receber dano e ser Nocauteado
Revelar em pacote
```

A prévia não altera inventário, não consome pacote e não concede campanha. Um selo “Demonstração visual” fica visível.

Aparência foil pode aparecer quando a frente é autorizada. Não pode vazar na compra oculta do adversário por brilho de borda, padrão ou som. O preview inclui um teste explícito “Carta oculta do NPC”.

Flair é ID de preset local. Não importar JavaScript, shader livre ou código de partículas. Criar preset novo é desenvolvimento do motor de apresentação, não editar a regra de uma carta.

Tempo dos ataques e moedas segue o diretor de animação; configurar uma carta não altera o período de decisão do jogo nem o resultado da moeda.

<a id="editor-24"></a>

## 🧪 24. Validação em quatro níveis

| Nível | Exemplo | Bloqueia publicação? |
|---|---|---|
| Estrutura | Campo ausente, enum inválido, ID repetido. | Sim. |
| Execução | Opcode desconhecido, variável sem origem, seletor impossível. | Sim. |
| Regras | EX com um ponto; Treinador com estágio; evolução cíclica. | Sim. |
| Design e apresentação | Carta muito forte, arte baixa resolução, máscara agressiva. | Aviso, exceto ilegibilidade/overflow crítico. |

Mostre erros agrupados por aba e links “Ir para o campo”. Não exibir apenas `validation failed`.

Exemplos:

```text
ATTACK_ENERGY_INVALID
“O custo contém um tipo de Energia que este motor não reconhece.”

FORMULA_REFERENCE_MISSING
“A fórmula usa attackCoins, mas nenhuma etapa anterior produz esse resultado.”

RULE_BOX_POINTS_MISMATCH
“Uma carta ex entrega dois pontos nesta ruleset.”

CARD_TEXT_OVERFLOW
“O segundo ataque não cabe no template selecionado.”

ASSET_MISSING
“A máscara de foil referenciada não está no armazenamento local.”

UNSUPPORTED_EFFECT
“Este efeito ainda não pode ser publicado nesta versão do motor.”
```

Os códigos de erro do DSL ([DSL §16](efeitos-dsl.md#dsl-16), como `UNKNOWN_OPCODE` e `TRAINER_FIELD_INVALID`) entram nesses níveis conforme a tabela de lá.

Validação incremental verifica campos alterados; validação completa roda antes de publicar. Cada revisão salva grava seu resumo em `editor_revisions.validation_summary_json` (seção 27). Alterar regras invalida testes funcionais pelo `rulesHash`. Alterar só acabamento invalida a revisão visual, não todos os testes de combate.

<a id="editor-25"></a>

## 🔬 25. Laboratório funcional

O laboratório usa o mesmo motor de regras, com cenário explícito e sem recompensas.

Configurações: estado inicial, cartas em mão/campo, Energias, dano, condições, turno, outro deck, sequência de RNG e efeitos ativos.

Cenários-padrão para cada carta:

| Teste | O que verifica |
|---|---|
| Uso mínimo legal | A ação funciona quando todos os requisitos estão presentes. |
| Energia insuficiente | Não executa nem consome recursos. |
| Recuo / troca | Custos e limites não se confundem. |
| Dano com Fraqueza/redução | Pipeline de dano e categorias corretos. |
| Alvo ausente | Não trava a resolução. |
| Mão cheia / deck vazio | Política de overflow e compra aplicada. |
| Condição impeditiva | Sono/Paralisia/Confusão respeitados. |
| Nocaute | Pontos corretos, inclusive EX e MEGA_EX. |
| Habilidade duplicada | Escopo de uso e aura corretos. |
| Persistência | Salvar/retomar produz mesmo resultado. |

Moedas de teste podem ser forçadas como fixture, com rótulo visível. Não reusar esse RNG na campanha normal.

Cenários do autor ficam em `draft_json.testScenarios` ([schema do rascunho](schemas/editor-draft.schema.json)):

```json
{
  "id": "coin-2",
  "kind": "ATTACK",
  "attackId": "ember-rain",
  "fixture": "default",
  "forcedCoins": ["HEADS", "HEADS"],
  "expect": {"baseDamage": 80}
}
```

| Campo | Contrato |
|---|---|
| `id` | Único no rascunho. |
| `kind` | `ATTACK`, `ABILITY`, `TRAINER`, `KNOCKOUT` ou `PERSISTENCE`; `attackId`/`abilityId` quando pertinente. |
| `fixture` | ID de fixture de laboratório ou `default`. |
| `forcedCoins` | Sequência `HEADS`/`TAILS` consumida pelas moedas do cenário, no lugar do `battleRng`. |
| `expect` | Asserções opcionais: `baseDamage`, `finalDamage`, `knockout`, `pointsGranted`, `legal`, `errorCode`. |

Cada execução (`RUN_CARD_TEST`) grava uma linha em `card_test_runs` ligada ao projeto e a uma revisão salva (o laboratório força o autosave antes de executar), com `runner_version`, `rules_hash` (SHA-256 do JCS das regras testadas), `scenario_json`, `result_json` e `outcome` (`PASS`, `FAIL`, `ERROR`). A aprovação vale só enquanto o `rules_hash` do rascunho for o mesmo; o resultado de teste nunca é editado (append-only). Os cenários salvos no rascunho são os testes obrigatórios da publicação (persistência §18); como `version` faz parte das regras, o laboratório executa com a versão-alvo da próxima publicação.

Duelos de laboratório com rascunhos **não publicados** são efêmeros: rodam em memória com o mesmo motor, não criam tentativa, não gravam eventos e não sobrevivem a recarregar, porque decks e tentativas persistidos exigem impressões publicadas ([persistência §16](persistencia-sqlite.md#sqlite-16)). A UI identifica “Laboratório — não salvo”. Duelos LAB com cartas já publicadas persistem normalmente, sem progressão.

Relatório: cenário, versão do motor, rulesHash, ação, eventos, estado esperado/obtido e diferenças. “Passou” significa que aquele cenário passou, não prova de balanceamento global.

Teste de ataques pode rodar sem renderização; depois há prévia visual dos mesmos eventos. Ação de prévia não chama novamente o ataque no estado já finalizado.

<a id="editor-26"></a>

## ⚖️ 26. Balanceamento e análise

Indicadores úteis: HP, custo por ataque, dano possível/médio sob hipóteses explícitas, pontos entregues, dependência de moeda, número de efeitos e consistência de Energia.

Não mostrar “força 97%” sem modelo definido. Relatório deve dizer como estimou dano médio e quais modificadores ignorou.

Para duas moedas justas e dano 40 por cara, a análise pode apresentar 0/40/80 com probabilidades 25%/50%/25% e valor esperado 40. Isso é cálculo do template, não probabilidade de vitória.

Comparação usa cartas do catálogo local com métricas equivalentes. Sinalizar combinações como ataque sem custo com dano extremo, aura sem restrição ou repetição que cresce sem limite.

Balanceamento é aviso para autoria customizada; execução inválida é erro. Um modo local criativo pode permitir cartas deliberadamente fortes, sem deixá-las alterar silenciosamente a campanha padrão.

<a id="editor-27"></a>

## 📜 27. Salvar, revisar e publicar

Estados de projeto:

```text
DRAFT
→ validar
→ testar
→ pronto para publicar
→ publicar revisão imutável
→ continuar em novo rascunho
```

“Pronto para publicar” é uma condição calculada de validação, não precisa ser um status persistido separado. O projeto continua DRAFT ou ARCHIVED; publicações vivem em registros próprios.

Revisões do rascunho (`editor_revisions`, [persistência §19](persistencia-sqlite.md#sqlite-19)):

| `kind` | Quando é criada |
|---|---|
| `AUTO` | Autosave por debounce (800 ms). |
| `MANUAL` | “Salvar rascunho” ou Ctrl/Cmd + S. |
| `PUBLISHED` | Pela publicação, como cópia imutável do rascunho publicado. |

Cada revisão guarda `draft_json` no formato [editor-draft.schema.json](schemas/editor-draft.schema.json) (`draftFormat 1`: modo, alvo, regras, impressões, autoria e cenários; sem estado de UI como aba, seção ou câmera) e `validation_summary_json` com o resumo da validação daquela revisão (`errors`, `warnings` e, opcionalmente, contagens por nível). É desse resumo que a biblioteca tira a situação exibida (seção 3).

Retenção: mantêm-se todas as revisões `MANUAL` e `PUBLISHED`, a head, as referenciadas por testes ou publicações e as **20 `AUTO` mais recentes**; as `AUTO` mais antigas são podadas depois de um autosave bem-sucedido. O histórico “Comparar com versão anterior” oferece apenas revisões retidas. Autosave não cria operação econômica nem altera a revisão do perfil.

A publicação mostra resumo:

```text
Modo: nova definição, nova versão, variante ou fork
Nome-base, nome derivado e chave de limite
HP, ataques, Habilidades e regra ex
Impressões que serão criadas
Assets incluídos
Testes executados
Perfis/modos onde poderá ser usada
```

Botões separados: **Salvar rascunho**, **Publicar**, **Publicar e adicionar ao perfil de criação**.

Uma nova versão não substitui automaticamente cartas de decks existentes. A UI oferece “Comparar e atualizar este deck”, com confirmação e validação.

Versão publicada não recebe UPDATE. Corrigir um erro funcional cria nova versão (`NEW_VERSION`); corrigir apenas arte cria nova impressão (`VARIANT`). Arquivar (projeto, versão ou impressão, via `catalog_archive_marks`) retira da biblioteca padrão de novas escolhas, sem quebrar replays/coleções.

<a id="editor-28"></a>

## 🎮 28. Usar as cartas no jogo

Três escopos de perfil:

| Perfil | Cartas autorais | Recompensas e progressão |
|---|---|---|
| STANDARD | Somente impressões admitidas pelo catálogo base. Variantes autorais usam CUSTOM nesta revisão. | Campanha original preservada. |
| CUSTOM | Cartas publicadas explicitamente adicionadas ao perfil. | Campanha personalizada separada e identificada. |
| LAB | Cartas publicadas do catálogo de teste; rascunhos só em duelos efêmeros do laboratório (seção 25). | Sem recompensas persistentes de campanha (`progression_eligible = 0`). |

O usuário pode criar um perfil CUSTOM novo ou clonar conscientemente um perfil STANDARD. A cópia preserva um ponto de partida, mas os saldos e progressos não retornam ao original.

Para a primeira publicação autoral, a tela oferece criar automaticamente um perfil de criação **após confirmação**, sem exigir abandonar o atual.

“Adicionar 2 cópias” é concessão local auditável a CUSTOM (comando `GRANT_CUSTOM_COPIES`) com a chave de concessão `custom-grant:{printingId}:{grantBatchId}` ([persistência §13](persistencia-sqlite.md#sqlite-13)): repetir o mesmo clique após falha reutiliza o `grantBatchId` e não duplica cópias. Não consome pacotes, não cria compras reais e não modifica a economia STANDARD. A quantidade é configurável, com padrão 2.

Treino pode montar um deck temporário com cartas autorais publicadas sem mexer na coleção. Um rascunho só é utilizável em duelo efêmero de laboratório, com validação estrutural, sem persistência; campanha personalizada exige publicação.

Uma carta normal e sua impressão foil continuam compartilhando limite. Duas versões funcionais da mesma definição não podem coexistir em um deck confirmado desta revisão; o usuário escolhe qual versão usar.

<a id="editor-29"></a>

## 📦 29. Importar e exportar cartas

Formatos:

```text
.card.json (formatVersion 1)
  {"format": "card-campaign-card", "formatVersion": 1, rules, printings, assetRefs}
  Regras + impressões completas; assetRefs só com sha256/bytes/mediaType.
  Não contém bytes de mídia.
  Útil para revisão técnica, não portátil sozinho quando usa arte própria.

.cardpack.zip (formatVersion 1)
  manifest.json
  cards/<definitionId>/<version>.json
  printings/<printingId>.json
  assets/<sha256>.<ext>
  tests/<testId>.json
```

Importar não tem comando próprio: cada carta nova ou nova versão do arquivo passa por um projeto local e é publicada com um `PUBLISH_CARD` (mesmas validações e testes obrigatórios da seção 27); conteúdo idêntico já existente (mesmo ID + hash) não gera escrita, e mesmo ID com hash diferente vira conflito resolvido por fork. Os testes do pacote viram relatório, não `card_test_runs`.

Exportar PNG gera somente imagem de apresentação; não é uma carta jogável importável. O menu deve diferenciar **Exportar imagem**, **Exportar dados** (`.card.json`) e **Exportar pacote completo** (`.cardpack.zip`).

O `manifest.json` do pacote registra `format: "card-campaign-cardpack"`, `formatVersion: 1`, versões de motor, ruleset e `effectsDsl`, a lista `cards` (`definitionId`, `version`, `rulesHash`), `printings` (`printingId`, `appearanceHash`), `assets` (`sha256`, `bytes`, `mediaType`) e `tests`. O contrato completo e os exemplos estão em [persistência §24](persistencia-sqlite.md#sqlite-24). Hashes de documentos usam JCS + SHA-256. Modelos/sons empacotados já existentes podem ser referenciados; o importador explica os ausentes.

Testes incluídos num pacote importado **não** viram linhas de `card_test_runs`: são reexecutados ou exibidos como relatório anexado à importação. `card_test_runs` pertence apenas a projetos locais.

Importação:

```text
Selecionar arquivo
→ validar estrutura/limites
→ verificar conteúdo sem executar
→ comparar IDs, versões e hashes
→ mostrar novas cartas, variantes e conflitos
→ escolher manter / importar como cópia / cancelar
→ validar e testar conteúdo
→ confirmar transação
```

Mesmo ID/versão e mesmo hash: reutilizar sem duplicar. Mesmo ID/versão e hash diferente: conflito; nunca sobrescrever. “Importar como cópia” remapeia IDs e todas as referências internas.

Rejeitar SQL, JavaScript, HTML ativo, URLs remotas, caminhos absolutos, `..`, links simbólicos, entradas duplicadas, ZIP aninhado e expansão acima do limite. Assets declarados precisam corresponder aos bytes; nome do arquivo não prova o hash.

<a id="editor-30"></a>

## 🗄️ 30. Contrato com SQLite

Mapeamento direto:

| Ação | Persistência |
|---|---|
| Novo projeto | `editor_projects` com `mode` e alvo (`target_definition_id`, origem quando houver) + primeira revisão. |
| Autosave / Salvar rascunho | `editor_revisions` (`kind` AUTO/MANUAL, `draft_json`, `validation_summary_json`) + `editor_asset_refs` + CAS em `head_revision`; sem `operations`. |
| Upload de arte/máscara | `assets` BLOB e relações do rascunho. |
| Testar | `card_test_runs`, cenário e resultado ligados ao `rules_hash` (JCS SHA-256). |
| Publicar | `card_definitions` (primeira versão, com `owner_profile_id`) + `card_versions` + `card_publications` (projeto, revisão, operação, perfil) + `card_catalog_heads` + `card_dependencies` + `card_printings` + `printing_assets` + `assets` (BLOBs novos) + `editor_revisions` PUBLISHED + recibo em `operations`. |
| Nova variante | `card_printings` + `printing_assets` (+ `assets`) da mesma definição/versão, recibo em `operations`; sem nova regra. |
| Adicionar cópias | `inventory`, `inventory_entries`, `reward_grants` (`custom-grant:…`) e `operations` em perfil permitido. |
| Criar deck | `decks`, `deck_versions` e `deck_entries`. |
| Arquivar | `editor_projects.status = 'ARCHIVED'` ou `catalog_archive_marks` (versão/impressão); nunca apagar versão usada. |

Assets são preparados fora da transação. A confirmação da publicação é atômica ([persistência §18](persistencia-sqlite.md#sqlite-18)). Em falha, o usuário continua com rascunho salvo, nunca com metade de uma carta publicada.

O arquivo [persistencia-sqlite.md](persistencia-sqlite.md) é a autoridade de banco. Não criar um IndexedDB paralelo do editor.

<a id="editor-31"></a>

## ⌨️ 31. Interação e acessibilidade

Mouse, teclado e toque devem executar as mesmas ações. Rótulos dos custos incluem texto; não usar apenas ícone de Energia.

Atalhos quando o editor tem foco:

| Atalho | Ação |
|---|---|
| Ctrl/Cmd + S | Salvar rascunho e impedir o diálogo padrão do navegador somente neste contexto. |
| Ctrl/Cmd + Z | Desfazer alteração editável. |
| Ctrl/Cmd + Shift + Z | Refazer. |
| Escape | Fechar painel/modal reversível; não publicar nem excluir. |
| Tab / Shift + Tab | Navegar pelos controles. |
| Enter | Confirmar o controle em foco, não uma publicação global inadvertida. |

Textareas preservam o comportamento esperado de entrada. Arrastar bloco possui alternativa “Mover para cima/baixo”. Máscara possui alternativa por regiões/predefinições quando pintura fina não é viável.

Prévia 3D não é requisito para ler ataques. Todo texto funcional existe em HTML. Movimento reduzido desliga rotação contínua e trajetórias amplas sem ocultar configurações de foil.

<a id="editor-32"></a>

## 🧯 32. Estados de erro e casos extremos

| Situação | Resposta |
|---|---|
| Arte ausente | Placeholder tipado e aviso; projeto editável. Publicação permitida só com `artMode: TEMPLATE_ONLY`; nos demais modos, bloqueada até haver arte. |
| Imagem excessiva | Recusar antes de consumir memória indevida. |
| Máscara inválida | Mostrar problema e manter máscara anterior. |
| Texto grande | Indicar região em overflow e sugerir correção. |
| Carta sem ataque | Pode ser válida como suporte; exigir confirmação/aviso, não inventar ataque. |
| Treinador com ex | Erro de regras, não ajuste silencioso. |
| Opcode indisponível | Impedir publicação; preservar rascunho. |
| Save falhou | Manter delta local e opção de exportar rascunho. |
| Outra aba ativa | Não abrir segundo writer; orientar retorno. |
| Versão base ausente | Projeto abre em recuperação; publicação exige resolver dependência. |
| Conflito de importação | Comparação e fork explícito. |
| GPU perdida | Preview 2D; campos e dados continuam presentes. |
| Queda após publicar | Consultar recibo e recuperar a release já criada. |
| Reiniciar teste | Restaura fixture do laboratório; não reembolsa nem altera campanha. |

Trocar categoria, remover um ataque referenciado por efeito de cópia ou excluir uma mídia usada deve apresentar dependências, não apagar silenciosamente.

<a id="editor-33"></a>

## 🧾 33. Exemplo de criação ponta a ponta

Criar **Braseiro ex**:

```text
1. Modelo Pokémon ex, Estágio 1; projeto no modo NEW_DEFINITION.
2. Nome-base “Braseiro” (baseName); definir evolução a partir de Faísca (evolvesFrom ["faisca"]).
3. Tipo Fogo; 140 HP; Fraqueza Água +20 (ADD); Recuo 2.
4. Regra EX → 2 pontos por Nocaute; nome exibido derivado “Braseiro ex”,
   deckLimitKey “braseiro-ex”.
5. Ataque “Golpe de Brasa”: 1 Fogo + 1 Incolor; 50 de dano ao Ativo adversário.
6. Ataque “Chuva de Brasas”: 2 Fogo + 1 Incolor; 2 moedas (FLIP_COINS → attackCoins);
   dano 40 por cara, conforme fórmula.
7. Importar ilustração local (artMode ART_WINDOW, artAssetId) e recortar sem afetar o texto.
8. Criar impressão normal: template pocket-light-card-v1/pokemon-ex, preset normal-matte,
   conjunto custom-lab, número 001.
9. Criar segunda impressão FOIL (foil-diagonal) com máscara apenas na arte, número 001F.
10. Validar e testar Energia, moedas (0/1/2 caras), Fraqueza, Nocaute e retomada.
11. Publicar definição funcional e duas impressões.
12. Adicionar explicitamente 2 cópias ao perfil CUSTOM escolhido.
13. Montar deck, respeitando 2 cópias somadas pelo mesmo nome.
```

A segunda impressão não duplica a definição de ataques. Em uma partida, escolher normal ou foil não muda o dano esperado.

Os exemplos [de definição](examples/card-definition.example.json), [de impressões](examples/card-printings.example.json) e [de projeto](examples/editor-project.example.json) ilustram essa organização. Os schemas estruturais de [definição](schemas/card-definition.schema.json), [impressão](schemas/card-printing.schema.json) e [rascunho](schemas/editor-draft.schema.json) complementam o contrato, sem substituir o registro semântico de opcodes de [efeitos-dsl.md](efeitos-dsl.md). IDs de artes não significam que uma imagem final de Pokémon tenha sido fornecida.

<a id="editor-34"></a>

## ✅ 34. Critérios de aceite
| ID | Cenário | Resultado esperado |
|---|---|---|
| ED-001 | Criar Pokémon | Gera projeto editável com ID estável e sem publicação automática. |
| ED-002 | Catálogo base | Abre em leitura; editar cria cópia autoral (projeto `FORK` com origem registrada). |
| ED-003 | Rascunho salvo | Reabrir preserva campos, arte, máscara, revisão e situação de validação persistida. |
| ED-004 | Nova variante | Projeto `VARIANT` mantém definição/versão, bloqueia regras e cria impressão nova. |
| ED-005 | Ativar ex | Atualiza ruleBox, nome derivado de `baseName`, chave e dois pontos, sem aumentar dano. |
| ED-006 | Desativar ex em rascunho | Recalcula regra e pontos sem mudar foil por consequência. |
| ED-007 | Mega ex | Usa três pontos; não cria Estágio 3 automaticamente. |
| ED-008 | Treinador ex | Bloqueia configuração incompatível. |
| ED-009 | Nome repetido | Agrupamento por chave mantém limite de duas cópias. |
| ED-010 | ID publicado | Não é alterado por renomear uma miniatura. |
| ED-011 | Evolução inválida | Aponta origem ausente/cíclica; não aceita qualquer carta. |
| ED-012 | Tipo e Energia | Permanecem campos independentes. |
| ED-013 | Segundo tipo sem suporte | Bloqueia publicação, mantendo rascunho. |
| ED-014 | HP inválido | Rejeita negativo, fração e valores fora da guarda. |
| ED-015 | Adicionar ataque | Configura nome, custo, dano e efeito executável. |
| ED-016 | Duplicar ataque | Cria ID novo e remapeia referências locais necessárias. |
| ED-017 | Reordenar ataque | Mantém identidade e atualiza composição sem mudar custo. |
| ED-018 | Ataque sem Energia | Não insere Incolor automaticamente. |
| ED-019 | Custo Incolor | Teste permite fornecimento de outro tipo. |
| ED-020 | Energia ao atacar | Permanece ligada salvo descarte configurado. |
| ED-021 | Custo versus efeito | Editor mostra diferença e laboratório valida ambos. |
| ED-022 | Fórmula | Não duplica dano fixo e dano calculado. |
| ED-023 | Referência de moeda | Bloqueia variável inexistente/usada antes da produção. |
| ED-024 | Duas moedas | Fixture 0/1/2 caras produz 0/40/80 no exemplo. |
| ED-025 | Alvo escolhido pelo rival | Seletor não entrega decisão ao criador do efeito. |
| ED-026 | Efeito sem alvo | Resolve política declarada sem travar. |
| ED-027 | Opcode desconhecido | Não publica como aproximação silenciosa. |
| ED-028 | Código arbitrário | Não executa JS/SQL/shader digitado num campo. |
| ED-029 | Condições | Respeita exclusividade e duração definida no gameplay. |
| ED-030 | Habilidade ativada | Possui ação, custo, alvo e limite. |
| ED-031 | Habilidade contínua | Não cria botão fictício de usar. |
| ED-032 | Habilidade disparada | Filtra origem/evento e usa escopo correto. |
| ED-033 | Duas cópias de Habilidade | Limite por instância/nome/jogador funciona como configurado. |
| ED-034 | Habilidade encerra turno | Aviso aparece e motor encerra após resolver. |
| ED-035 | Item/Apoiador | Uso e descarte respeitam limite global pertinente. |
| ED-036 | Ferramenta HP | Remoção recalcula HP e Nocaute sem cura indevida. |
| ED-037 | Estádio | Não é confundido com playmat. |
| ED-038 | Fóssil | Não vira Básico inicial só por possuir HP. |
| ED-039 | Arte local válida | Importa, normaliza e salva sem rede. |
| ED-040 | Imagem inválida/animada | Recusa sem destruir a arte anterior. |
| ED-041 | Recorte | É reversível e respeita dimensões reais. |
| ED-042 | Espelhamento | Afeta só ilustração, nunca texto/HP. |
| ED-043 | Impressão completa | A imagem não é interpretada automaticamente como regra. |
| ED-044 | Overflow de texto | Bloqueia publicação de carta ilegível. |
| ED-045 | NORMAL | Não ativa iridescência por regra ex. |
| ED-046 | FOIL | Muda material, não ataques, pontos ou raridade automaticamente. |
| ED-047 | Raridade | Não altera tabela de probabilidade por simples troca de dropdown. |
| ED-048 | Máscara | Branco/preto controla efeito e proteção de texto permanece. |
| ED-049 | Arte trocada com máscara | Pede decisão sobre alinhamento anterior. |
| ED-050 | Máscara compartilhada | Editar cria outro asset/hash, sem alterar outras cartas. |
| ED-051 | Prévia Three.js | Usa o mesmo compositor/material da batalha. |
| ED-052 | Múltiplas prévias | Usa renderer compartilhado, sem canvas WebGL por carta. |
| ED-053 | Carta oculta | Não revela identidade por frente, som, brilho ou flair. |
| ED-054 | Prévia de ataque | Não aplica novamente efeito ou concede recompensa. |
| ED-055 | GPU perdida | Preserva formulário e gravação, usando recuperação visual. |
| ED-056 | Teste inválido pelo hash | Alteração funcional invalida aprovação anterior. |
| ED-057 | Publicação | Mostra diff e grava regra/impressões atomicamente. |
| ED-058 | Falha após publicação | Reabre release do recibo, sem duplicar. |
| ED-059 | Mudança em carta publicada | Cria versão/fork; replays antigos não mudam. |
| ED-060 | Concessão customizada | Cópias entram apenas no perfil CUSTOM/LAB autorizado. |
| ED-061 | Deck normal + foil | Soma cópias pela mesma chave de nome. |
| ED-062 | Campanha personalizada | Pode usar cartas autorais sem alterar perfil STANDARD. |
| ED-063 | Exportar PNG | É apresentado como imagem, não pacote jogável. |
| ED-064 | Pacote autoral | Inclui definições, impressões e assets, sem carteira/progresso. |
| ED-065 | Conflito de pacote | Mesmo ID/versão com hash distinto exige fork/cancelar. |
| ED-066 | Undo/Redo | Afeta rascunho, não desfaz compra/publicação/resultado. |
| ED-067 | Atalho Salvar | Grava revisão `MANUAL` sem abrir diálogo padrão indevido. |
| ED-068 | Teclado e toque | Permitem editar custos, mover efeitos e publicar sem hover obrigatório. |
| ED-069 | Layout 720p | Campos e ações permanecem legíveis, sem três colunas esmagadas. |
| ED-070 | Movimento reduzido | Mantém configuração de acabamento com animação reduzida. |

<a id="editor-35"></a>

## 🛠️ 35. Fatias de implementação

**Fatia A — uma carta funcional:** formulário de Pokémon Básico, um ataque fixo, arte local, impressão normal, save SQLite, validação e laboratório.

**Fatia B — variações reais:** ex, evolução, dois ataques, moedas, condições, publicação imutável e impressões normal/foil.

**Fatia C — famílias completas:** Habilidades, Itens, Apoiadores, Ferramentas, Estádios, seletores, custos e testes de interação.

**Fatia D — autoria e apresentação:** máscara pintada, comparação de versões, cromado, prévias de animação, import/export e campanha personalizada.

A primeira fatia só passa quando a carta criada pelo formulário aparece no catálogo autoral, é selecionável num deck de teste, usa as regras configuradas e volta intacta após reabrir a aplicação.

<a id="editor-36"></a>

## 📚 36. Referências e limites

A interface, limites de campos e fluxo de autoria são decisões do projeto. “Igual à experiência Pocket” refere-se à apresentação do card game já especificada; não pressupõe a existência de um editor oficial de cartas.

**[ED01] Three.js — gerenciamento de cor**
```text
https://threejs.org/manual/pages/color-management.html
```

**[ED02] Three.js — textura, colorSpace e propriedades**
```text
https://threejs.org/docs/pages/Texture.html
```

As regras gerais são definidas pelo [gameplay.md](gameplay.md) e as operações de efeito pelo registro de [efeitos-dsl.md](efeitos-dsl.md). Novas regras ou opcodes exigem alteração versionada do motor e testes; o editor não deve interpretar texto livre durante uma batalha.

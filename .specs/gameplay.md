# 🎮 Gameplay — campanha local e Three.js

> **Versão:** 3.2.0 · **Revisão:** 14 de outubro de 2026  
> **Escopo:** single-player, local, offline-first, campanha permanente e apresentação tridimensional.  
> **Substitui:** revisão 2.1 para os pontos alterados; mantém gameplay e apresentação existentes.
> **Complementos:** [campanha.md](campanha.md) · [interface-16x9.md](interface-16x9.md) · [runtime-offline-threejs.md](runtime-offline-threejs.md) · [efeitos-dsl.md](efeitos-dsl.md)  
> **Estado:** requisitos para implementação; não é software executável.
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — campo claro, paleta e animações na linguagem do TCG Pocket; os conceitos escuros anteriores não são referência.

> **Revisão 3.0:** SQLite substitui a persistência anterior. Autoria de cartas usa o Estúdio local, com regras e impressões versionadas. Detalhes normativos em [persistencia-sqlite.md](persistencia-sqlite.md) e [editor-de-cartas.md](editor-de-cartas.md). O escopo offline, a campanha e as animações/playmats da revisão 2.1 permanecem.

> **Revisão 3.2:** fecha lacunas de regra — primeiro jogador por moeda, algoritmo da Zona de Energia, piso de dano, alcance e remoção de condições especiais, promoções simultâneas, máquina de estados completa, RNG normativo `rng-v1`, efeitos impossíveis, `evolvesFrom` e Fósseis — e corrige ex/Mega para `ruleBox`. A forma executável dos efeitos está em [efeitos-dsl.md](efeitos-dsl.md).

> **Revisão 3.3.0 (em preparação; conteúdo 3.0.0, sets depois do Genetic Apex):** Nocaute em duas etapas, com as reações resolvidas enquanto o Pokémon ainda está em campo e a saída e os pontos depois (seção 17.2); “Nocauteado por dano de um ataque” só com dano de ataque do próprio turno; gatilho padrão de Ferramenta só no turno do oponente (seção 3.9); ataques de evoluções anteriores por regra concedida (seção 12.10); pacotes de 4 a 6 cartas e ordem de consumo do RNG nos pacotes por símbolo (seção 20.2).

---

## 🧭 Sumário

**Leitura visual obrigatória:** [direção Pocket](direcao-visual-pocket.md) · [referências identificadas](referencias-visuais.md).


- [📖 0. Contrato da versão local](#gameplay-00)
- [🎯 1. Experiência central e ciclos offline](#gameplay-01)
- [🧩 2. Contrato de uma partida](#gameplay-02)
- [🃏 3. Famílias e tipos de cartas](#gameplay-03)
- [🔎 4. Anatomia e identidade de uma carta](#gameplay-04)
- [🗺️ 5. Campo, zonas e informação](#gameplay-05)
- [🧱 6. Construção e validação de decks](#gameplay-06)
- [🎲 7. Preparação e mão inicial](#gameplay-07)
- [🔄 8. Turnos e ações](#gameplay-08)
- [⚡ 9. Energia](#gameplay-09)
- [🐣 10. Colocação e evolução](#gameplay-10)
- [🔀 11. Recuo, troca e promoção](#gameplay-11)
- [⚔️ 12. Ataques e resolução de dano](#gameplay-12)
- [✨ 13. Habilidades](#gameplay-13)
- [🧪 14. Biblioteca de efeitos](#gameplay-14)
- [☠️ 15. Condições especiais](#gameplay-15)
- [⏱️ 16. Fim de turno e efeitos atrasados](#gameplay-16)
- [🏁 17. Nocaute, pontos, vitória e casos extremos](#gameplay-17)
- [🎮 18. Exemplo completo de abertura](#gameplay-18)
- [🎁 19. Coleção permanente e recursos locais](#gameplay-19)
- [📦 20. Pacotes ganhos jogando e transações](#gameplay-20)
- [💎 21. Cartas tridimensionais e raridades](#gameplay-21)
- [🌟 22. Descobertas da campanha](#gameplay-22)
- [🏪 23. Empório, adversários e substituição do social](#gameplay-23)
- [🏆 24. Campanha, desafios e progressão permanente](#gameplay-24)
- [🤖 25. IA local, dificuldade e justiça](#gameplay-25)
- [🖥️ 26. Contrato do gameplay com Three.js](#gameplay-26)
- [🏗️ 27. Arquitetura funcional exclusivamente local](#gameplay-27)
- [🗃️ 28. Esquemas de dados de referência](#gameplay-28)
- [🧾 29. Autosave, checkpoints, exportação e integridade](#gameplay-29)
- [🚨 30. Erros e mensagens funcionais](#gameplay-30)
- [✅ 31. Matriz de testes de aceitação](#gameplay-31)
- [🛠️ 32. Implementação por fatias jogáveis](#gameplay-32)
- [📌 33. Decisões fechadas e parâmetros a calibrar](#gameplay-33)
- [📚 34. Referências herdadas e documentação técnica](#gameplay-34)
- [🧭 35. Diretriz final](#gameplay-35)

---

<a id="gameplay-00"></a>

## 📖 0. Contrato da versão local

Esta versão **substitui integralmente a v1**. Não é um modo degradado de um serviço online: o produto é um jogo **single-player, local, offline-first, com campanha permanente**, apresentado em 16:9 e com **Three.js obrigatório na experiência visual principal**.

### 0.1. Escopo fechado

| Tema | Decisão normativa |
|---|---|
| Execução | Navegador no próprio computador; distribuição com todos os arquivos necessários. |
| Internet durante o jogo | Não é necessária, nem para o primeiro uso de um pacote já instalado. |
| Participantes de um duelo | Um humano local e um controlador de IA local. |
| Conta | Perfil local, sem cadastro, senha, autenticação ou sincronização. |
| Conteúdo principal | Campanha autoral permanente, com prólogo, capítulos e final. |
| Renderização | Three.js para mesa, cartas físicas, pacotes, mapa e prévias espaciais. |
| Interface legível | HTML/CSS para textos, listas, formulários, HUD e controles acessíveis. |
| Persistência | SQLite, recibos e checkpoints; exportação/importação manual de saves. |
| Economia | Recompensas de jogo; sem pagamento, anúncio, espera de 12 horas ou energia de entrada. |
| Backend remoto | Não existe no escopo. Um servidor estático de loopback apenas entrega arquivos locais. |
| Multiplayer | Fora do escopo, inclusive sala privada, LAN e hot-seat. |
| Evolução futura | Ampliação da campanha e conteúdo local; não pressupõe uma fase online. |

A preparação de dependências na máquina de desenvolvimento pode usar internet. Isso **não** autoriza o executável distribuído a procurar bibliotecas, arte, áudio ou fontes na rede. A distinção entre `localhost`, PWA e `file://` está em `runtime-offline-threejs.md`.

### 0.2. Documentos canônicos

| Documento | Autoridade |
|---|---|
| `gameplay.md` | Cartas, combate, ações, economia funcional e integração com campanha. |
| `campanha.md` | Conteúdo autoral, grafo de progressão, dificuldades, objetivos e recompensas. |
| `interface-16x9.md` | Menus, navegação, composição visual, interação e estados de tela. |
| `runtime-offline-threejs.md` | Execução local, distribuição, recursos, workers, renderizador e testes técnicos. Não decide gravação. |
| `persistencia-sqlite.md` | Banco, transações, saves, backup e restore; autoridade de gravação. |
| `efeitos-dsl.md` | Linguagem de efeitos: blocos, seletores, fórmulas, gatilhos, `failurePolicy` e registro de opcodes. |
| `editor-de-cartas.md` | Autoria, validação e publicação de cartas e impressões. |
| `direcao-visual-pocket.md` | Aparência: paleta, campo, câmera, arte, materiais e animações. |
| `README.md` | Ordem de leitura, escopo e etapas de implementação. |

O motor decide a legalidade. A campanha decide conteúdo e desbloqueios. Three.js apresenta eventos: não calcula o resultado de cartas ou moedas. `efeitos-dsl.md` define a forma dos dados de efeito; a semântica das regras continua neste documento.

### 0.3. Regras herdadas versus decisões próprias

Os trechos **[CO]** e as referências **[Rxx]** foram preservados da especificação v1 como documentação de origem. **Não constituem uma nova auditoria do aplicativo oficial nesta revisão.** Todas as regras adotadas tornam-se o contrato versionado do nosso jogo inspirado; sua execução não consulta fontes externas.

**[RB]** identifica regra-base herdada. **[DP]** identifica decisão própria. **[PV]** só indica diferença que exigiria homologação para alegar uma reprodução estrita do Pocket: não é autorização para o programador improvisar. Onde houver [DP/PV], a decisão descrita é a que deve ser implementada.

A campanha, seus personagens, seus nomes de locais e suas recompensas são propostas autorais, não funcionalidades atribuídas à campanha oficial do Pocket.

### 0.4. Termos e propriedade dos dados

**DEVE** é obrigatório; **NÃO DEVE** é proibido; **PODE** é opcional. “Adversário” significa NPC/IA local. “Autoridade” significa a camada de domínio local, não um servidor remoto.

Turno global e turno próprio são contadores diferentes. Pontos vencem um duelo; medalhas e objetivos registram campanha; Créditos compram conteúdo no Empório. Nenhum deles aumenta secretamente HP ou dano.

Código próprio segue funções e módulos, sem classes de domínio. Classes fornecidas por Three.js podem ser instanciadas normalmente: a preferência funcional não impede usar a API da biblioteca.

### 0.5. Identidade e conteúdo

Pokémon TCG Pocket permanece a referência de estudo. O pacote não fornece imagens oficiais, música, modelos de criaturas ou um catálogo completo. Conteúdo de produção deve ser incluído localmente, com autoria/origem registradas. Uma carta de exemplo não equivale a um asset pronto.

---

<a id="gameplay-01"></a>

## 🎯 1. Experiência central e ciclos offline

### 1.1. Promessa de jogo

Abrir o jogo, retomar uma jornada, preparar o deck, enfrentar um oponente com identidade, conquistar novas cartas e avançar no mapa. A coleção serve à campanha; a campanha dá contexto à coleção.

```text
INICIAR / CONTINUAR
→ MAPA 3D DA CAMPANHA
→ ESCOLHER ENCONTRO
→ LER BRIEFING E OBJETIVOS
→ PREPARAR DECK
→ DUELO CONTRA IA
→ RESULTADO E RECOMPENSA LOCAL
→ MELHORAR COLEÇÃO / DECK
→ PRÓXIMO ENCONTRO
```

Ciclos complementares: abrir pacotes conquistados, concluir objetivos opcionais, disputar revanche, resolver puzzles, testar decks sem recompensa e organizar expositores locais.

### 1.2. O que muda em relação à versão anterior

| Removido | Substituição local |
|---|---|
| Casual, ranqueada e matchmaking | Campanha, Arena de Revanche e treino contra IA. |
| Temporadas e eventos por calendário | Capítulos e desafios permanentes liberados por progresso. |
| Espera para pacote | Pacotes ganhos em encontros ou comprados com Créditos de jogo. |
| Amigos, convites e vitrine pública | Caderno de adversários e galeria pessoal. |
| Troca entre jogadores | Aquisição dirigida no Empório; sem negociação entre contas. |
| Escolha baseada em pacote de pessoa real | Descoberta: escolha de uma entre três cartas explicitamente oferecidas. |
| Login e sincronização | Perfil local, saves, backups exportáveis e recuperação. |
| Desconexão com derrota | Pausa e retomada do último checkpoint confirmado. |

Não manter botões desses serviços com “em breve”. Eles não são dependências adiadas.

### 1.3. Limites do formato

A mesa continua sendo um jogo de cartas por turnos. A profundidade 3D não introduz distância de ataque, colisão tática, movimentação de personagem, mira ou vantagem por ângulo.

Nenhum progresso externo ao duelo altera suas regras secretamente. As criaturas não ganham níveis ou atributos por experiência. Cosméticos não aumentam poder.

### 1.4. Salvamento faz parte do ciclo

Ao concluir uma ação relevante, confirmar estado e recibo antes de apresentar o resultado como definitivo. Fechar durante uma animação retoma os mesmos acontecimentos; não concede outro sorteio.

Uma partida ativa suspensa ocupa o único slot de duelo daquele perfil. O jogador pode consultar a coleção e preparar outro deck, mas precisa retomar ou abandonar explicitamente o duelo antes de iniciar outro.

---

<a id="gameplay-02"></a>

## 🧩 2. Contrato de uma partida

### 2.1. Parâmetros

**[CO]** A documentação oficial confirma baralho de 20 cartas, no máximo duas com o mesmo nome, pelo menos um Básico e objetivo de três pontos. Também confirma a derrota quando o único Pokémon em campo é Nocauteado. [R02]

| Parâmetro | Valor adotado |
|---|---:|
| Jogadores | 2 |
| Cartas no baralho | 20 |
| Cópias por chave de nome | 2 |
| Básicos mínimos elegíveis | 1 |
| Mão inicial | 5 |
| Básico garantido na mão inicial | Sim |
| Limite da mão | 10 |
| Posição Ativa por jogador | 1 |
| Espaços de Banco por jogador | 3 |
| Compra normal por turno | 1 |
| Ligações manuais de Energia por turno | 1 |
| Apoiadores por turno | 1 |
| Recuos normais por turno | 1 |
| Estádios jogados por turno | 1 |
| Pontos para vencer | 3 |
| Cartas de Prêmio | Não utilizadas |
| Cartas de Energia no baralho | Não utilizadas |
| Derrota automática por baralho vazio | Não |

### 2.2. Configuração versionada

```json
{
  "rulesetId": "local-campaign-v2",
  "rngAlgorithm": "rng-v1",
  "deckSize": 20,
  "maxCopiesPerDeckName": 2,
  "minimumBasicPokemon": 1,
  "openingHandSize": 5,
  "maximumHandSize": 10,
  "activeSlots": 1,
  "benchSlots": 3,
  "pointsToWin": 3,
  "normalDrawPerTurn": 1,
  "manualEnergyAttachmentsPerTurn": 1,
  "energyZoneTypes": ["GRASS", "FIRE", "WATER", "LIGHTNING", "PSYCHIC", "FIGHTING", "DARKNESS", "METAL"],
  "maxConfiguredEnergyTypes": 3,
  "energyGenerationWeights": "UNIFORM",
  "supporterPlaysPerTurn": 1,
  "normalRetreatsPerTurn": 1,
  "stadiumPlaysPerTurn": 1,
  "firstPlayerOpeningEnergy": false,
  "firstPersonalTurnEvolution": false,
  "deckOutLosesGame": false,
  "simultaneousTerminalPolicy": "DRAW",
  "maximumGlobalTurns": 60,
  "decisionTimeLimitSeconds": null,
  "pauseAllowed": true
}
```

A campanha usa tempo de decisão ilimitado e pausa real. Duelos normais sempre usam `maximumGlobalTurns: 60`. Um puzzle pode fixar, na fixture, um limite menor expresso em turnos próprios do humano, exibido antes de iniciar (seção 17.11; [campanha §13.5](campanha.md#campanha-13)). O perfil do encontro define o conteúdo permitido; não codificar capítulos no núcleo do combate.

### 2.3. Valores que não se somam implicitamente

A regra especial de um Pokémon é um único campo, `ruleBox` (`NONE`, `EX` ou `MEGA_EX`), nunca uma combinação de etiquetas. Uma Mega Evolução ex usa `ruleBox: MEGA_EX` e vale três pontos; não se somam os dois pontos de ex aos três de Mega. A recompensa é o campo resolvido `knockoutPoints`, coerente com `ruleBox` (seção 4.6).

Um modificador explícito pode alterar o valor. A raridade visual nunca determina esse campo.

---

<a id="gameplay-03"></a>

## 🃏 3. Famílias e tipos de cartas

### 3.1. Taxonomia

```text
Carta
├── Pokémon
│   ├── Básico
│   ├── Estágio 1
│   └── Estágio 2
└── Treinador
    ├── Item
    ├── Apoiador
    ├── Ferramenta Pokémon
    └── Estádio
```

**[CO]** Pokémon e Treinadores formam as grandes famílias apresentadas no material oficial. Estádios foram adicionados posteriormente e precisam ser contemplados no catálogo. [R03] [R06]

Estágio, regra especial, raridade, arte e acabamento são eixos independentes.

### 3.2. Pokémon Básico

Pode entrar diretamente no campo durante a preparação ou como colocação normal no Banco, quando permitido.

Básico não significa fraco. Um Básico pode ter muitos HP, Habilidades fortes ou a regra ex.

A elegibilidade inicial deve ser um atributo mecânico validado. Não deduzir “Básico” pelo nome da criatura.

### 3.3. Evoluções

Estágio 1 e Estágio 2 possuem compatibilidade com a carta de origem. A evolução normal usa a carta correspondente que já está em campo.

O catálogo deve definir a compatibilidade, incluindo exceções. Não aceitar qualquer Estágio 1 sobre qualquer Básico.

**[DP]** `evolvesFrom` lista as `deckLimitKey` das cartas de origem elegíveis e é comparado com a carta do **topo** da pilha de origem. Exemplo: Braseiro declara `evolvesFrom: ["faisca"]`; uma carta que evolui tanto de Braseiro quanto de Braseiro ex declara `["braseiro", "braseiro-ex"]`. Nome exibido, idioma e impressão não participam da comparação.

### 3.4. Pokémon ex

A regra-base concede dois pontos ao adversário quando um Pokémon ex é Nocauteado. Sua identificação vem de `ruleBox` e aparece no texto visual de regras.

```text
ruleBox: EX
knockoutPoints: 2
```

Ser ex não substitui o estágio evolutivo. `tags` não identificam ex nem Mega (seção 3.6).

### 3.5. Mega Evolução ex

**[CO]** O Nocaute de uma Mega Evolução ex concede três pontos. O exemplo oficial de Mega Blaziken ex evolui de Combusken, não de Blaziken. [R05]

```text
ruleBox: MEGA_EX
knockoutPoints: 3
```

Não criar automaticamente um “Estágio 3”. A cadeia é definida pela carta.

### 3.6. Pokémon bebê e outras etiquetas

“Bebê”, “lendário” e etiquetas temáticas não criam regras automáticas de recompensa, Energia ou evolução.

**[CO]** O exemplo oficial de Cleffa em uma estratégia de Mega Absol ex é um Básico de um ponto com ataque sem exigência de Energia. [R16]

Uma etiqueta só afeta o combate quando uma operação explicitamente a consulta. `tags` são apenas rótulos temáticos: `EX` e `MEGA` não são etiquetas válidas, porque a regra especial vem somente de `ruleBox`.

### 3.7. Item

Executa uma ação e normalmente vai ao descarte.

Pode curar, buscar, recuperar, alterar custos, manipular cartas ou realizar outra operação definida. Não existe um limite genérico de um Item por turno.

Deve declarar precondições, custos, alvos, ordem dos efeitos e destino após resolução.

### 3.8. Apoiador

Pode ter efeitos de compra, busca, troca, dano adicional, Energia ou controle. O limite normal é um Apoiador por turno, compartilhado entre todos os nomes.

Um resultado de moeda desfavorável não devolve o uso do Apoiador.

### 3.9. Ferramenta

Fica ligada a um Pokémon e produz efeitos enquanto aplicável. O limite normal é uma Ferramenta por Pokémon.

Não permitir substituir livremente uma Ferramenta só porque o jogador selecionou outra. Uma remoção precisa de efeito ou regra correspondente.

O motor deve reavaliar HP máximo, custos, proteções e gatilhos quando uma Ferramenta entra ou sai.

**[DP]** Gatilho de Ferramenta: os efeitos disparados de uma Ferramenta reagem ao gatilho que ela declara (`trainerRules.toolTrigger`, [efeitos-dsl.md §12](efeitos-dsl.md#dsl-12)). Sem declaração, o gatilho padrão é “o portador recebe dano de ataque **durante o turno do oponente**”: dano de ataque de um Pokémon do oponente. O dano que o ataque do próprio portador causa a ele mesmo não aciona a Ferramenta (Capacete Rochoso contra o Golpe Sombrio do Mimikyu). As cartas que dizem “se estiver no Ativo” trazem essa condição nos próprios efeitos: no Banco, o Capacete Rochoso não revida.

**[DP]** Ferramenta de um tipo (“o Pokémon {G} com esta carta …”): pode ser ligada a qualquer Pokémon, mas o efeito só vale enquanto o portador for do tipo indicado (Capa de Folha, Avental de Aço, Bote Inflável, Cabo Elétrico). Restrição de **quem pode receber** a Ferramenta é outra coisa (`toolTarget`) e torna a ligação ilegal.

**[DP]** Cachecol de Resgate (`onKnockedOut`): se o portador for Nocauteado por dano de um ataque do oponente (causa `ATTACK`, seção 17.2), a pilha vai para a mão do dono em vez do descarte (mão cheia: seção 17.8); as Energias vão para as descartadas e a Ferramenta, para o descarte. O oponente pontua normalmente. Nocaute por Condição, efeito ou perda de HP segue para o descarte.

### 3.10. Estádio

Há uma posição compartilhada de Estádio. Jogar outro Estádio substitui o anterior; o anterior retorna ao descarte de seu proprietário. Não se joga normalmente um Estádio de mesmo nome do que já está em campo.

O limite de uso é por jogador e turno, não uma vez por partida. “Compartilhado” não implica benefício igual para ambos.

### 3.11. Fósseis

Um Fóssil pode ser um Item com comportamento especial ao ocupar o campo. Deve manter separadas sua categoria original e sua representação em jogo.

**[DP]** Representação: Treinador de subtipo `ITEM` com o objeto `fieldBehavior` — `kind: "PLAY_AS_POKEMON"`, `hp` próprio, `types: []` (sem tipo), `retreatAllowed: false` e `knockoutPoints: 1`. O objeto completo e sua validação estão em [efeitos-dsl.md](efeitos-dsl.md#dsl-12).

- É jogado da mão, na fase principal do dono, para um espaço vazio do Banco.
- Em campo, conta como Pokémon em jogo para as verificações de campo vazio (seção 17.5); pode receber dano e ser Nocauteado, concedendo 1 ponto.
- Não ataca e não recua. Sem tipo, nunca recebe Fraqueza.
- Não pode ser colocado na preparação, portanto nunca é Ativo inicial; pode chegar ao Ativo por promoção ou troca por efeito.
- Seu dono pode descartá-lo durante a própria fase principal, conforme a operação do próprio Fóssil. Descartar não é Nocaute e não concede pontos (seção 17.3).
- Uma evolução pode declarar a `deckLimitKey` do Fóssil em `evolvesFrom` (seção 3.3).

Fósseis não satisfazem a garantia inicial de Básico da regra-base nem o mínimo de Básicos do deck. Ter HP impresso não basta para ser elegível na preparação.

### 3.12. Cartas de múltiplos tipos

**[DP]** Usar `types` como lista desde a primeira versão. Habilitar efetivamente cartas de tipo duplo apenas quando suas interações estiverem definidas e testadas.

Não deduzir multiplicação de Fraquezas nem criar Energia híbrida por consequência automática. Este documento não estabelece uma data de disponibilidade de um catálogo oficial de tipos duplos.

---

<a id="gameplay-04"></a>

## 🔎 4. Anatomia e identidade de uma carta

### 4.1. Dados funcionais

Uma carta de Pokémon deve representar nome, estágio, compatibilidade de evolução, tipos, HP base, ataques, Habilidades, Fraqueza, Recuo, pontos de Nocaute, etiquetas e texto de regras.

Uma carta de Treinador deve representar subtipo, restrições, custos, alvos, efeitos e persistência.

### 4.2. Dados editoriais e visuais

Expansão, número, idioma, artista, arte, acabamento, raridade, moldura e animação pertencem à impressão ou à apresentação, não à instância de batalha.

### 4.3. Identidades separadas

| Entidade | Responsabilidade |
|---|---|
| `CardDefinition` | Regras funcionais da carta. |
| `CardPrinting` | Edição, arte, raridade e variante. |
| `OwnedCard` | Exemplar ou saldo de exemplares no inventário. |
| `BattleCardInstance` | Uma carta específica naquela partida. |
| `PokemonEntity` | A criatura em campo, com pilha evolutiva e anexos. |

Uma pilha evolutiva tem várias cartas, mas ocupa um único espaço de campo.

### 4.4. Chave de limite

Usar `deckLimitKey`, independente do idioma e da URL da imagem.

Artes alternativas do mesmo nome não contornam o limite de duas cópias. Nomes distintos, incluindo a distinção entre uma versão com ex e uma sem ex, podem corresponder a chaves diferentes. [R02]

### 4.5. Versões imutáveis

Mudanças no catálogo não podem alterar retroativamente partidas em andamento e replays. Uma partida referencia versões fixas das definições e do conjunto de regras.

---


### 4.6. Modelo autoral e versões na revisão 3.0

O Estúdio usa `dataVersion:2`. `ruleBox` é a fonte de regra especial: `NONE`, `EX` ou `MEGA_EX`; `isEx` é calculado. `knockoutPoints` deve corresponder a 1/2/3 nesta ruleset. `tags` nunca representam ex ou Mega: o validador rejeita `EX`/`MEGA` em `tags` para não criar duas fontes de verdade.

Campos de ataque preservam `baseDamage`, acrescentando `damageFormula` como alternativa e momentos explícitos nos blocos `effects`. Versões antigas são normalizadas pelo adaptador de conteúdo sem mudar seus resultados. O motor nunca interpreta o texto livre da carta.

Regras publicadas são imutáveis; arte/acabamento criam impressões. Uma edição ex de carta comum é nova identidade funcional, não skin. Detalhes de autoria e validação: [editor-de-cartas.md](editor-de-cartas.md).

### 4.7. Uso de cartas autorais

STANDARD preserva o catálogo permitido da campanha. CUSTOM permite publicações autorais com progresso separado. LAB permite cenários de teste sem recompensas. O usuário pode criar/clonar explicitamente um perfil CUSTOM; o conteúdo não é proibido de jogar, mas não altera o histórico STANDARD silenciosamente.

Uma definição não pode aparecer em duas versões funcionais diferentes no mesmo deck confirmado. Verso/foil não contornam o limite de nome. Publicar não altera decks ou snapshots já existentes.

---

<a id="gameplay-05"></a>

## 🗺️ 5. Campo, zonas e informação

### 5.1. Organização

```text
                      ADVERSÁRIO
             Banco 1 | Banco 2 | Banco 3
                        Ativo

                  Estádio compartilhado

                        Ativo
             Banco 1 | Banco 2 | Banco 3
                        VOCÊ
```

Cada jogador também possui mão, baralho, descarte, Zona de Energia, energias descartadas e contadores de turno.

### 5.2. Visibilidade proposta

| Dado | Visibilidade |
|---|---|
| Pokémon em campo, dano, anexos e condições | Pública. |
| Estádio | Pública. |
| Descarte de cartas | Pública e inspecionável. |
| Quantidade de cartas nas mãos | Pública. |
| Identidade da mão adversária | Oculta, salvo revelação. |
| Ordem dos baralhos | Oculta. |
| Próxima Energia apresentada pela regra | Visível conforme o perfil definido. |
| Escolhas simultâneas ainda não reveladas | Ocultas. |
| Estado aleatório e sementes internas | Privados para a política de decisão da IA; armazenados no save para recuperação. |

O motor local produz uma visão para o humano e outra para a IA. A IA não recebe a mão humana nem a ordem futura dos baralhos. O save local contém o estado completo; não há promessa de sigilo contra o proprietário do dispositivo ou ferramentas de desenvolvimento.

### 5.3. Zona e entidade

Mover um Pokémon muda sua posição; não cria automaticamente uma nova criatura. Evoluir muda a carta de topo e a pilha, mas preserva os componentes definidos pela regra.

Reentrar a partir da mão pode criar uma nova identidade de campo, conforme a operação. Registrar essa diferença para limites de Habilidades.

### 5.4. Banco não é passividade total

Uma Habilidade pode funcionar no Banco ou exigir a posição Ativa. O texto estruturado define o alcance.

Também é possível receber efeitos e danos específicos no Banco. Não considerar essas posições imunes por padrão.

---

<a id="gameplay-06"></a>

## 🧱 6. Construção e validação de decks

### 6.1. Validação obrigatória

O validador deve conferir tamanho, limite de nome, Básicos elegíveis, inventário, formato, versão de catálogo, Energia configurada e suporte de todas as operações das cartas.

Decks incompletos podem ser salvos como rascunho, mas não iniciar um duelo normal.

### 6.2. Validade e estratégia

Um deck válido pode ser estrategicamente inconsistente. Avisos de estratégia não devem virar proibições sem justificativa de regras.

Exemplos de avisos:

```text
Evoluções sem cadeia convencional.
Ataque com Energia que a Zona não produz.
Poucos Básicos para a abertura.
Muitos alvos de dois ou três pontos.
Plano dependente de múltiplas peças.
```

Um ataque pode permanecer utilizável por meio de efeitos de cartas mesmo sem Energia correspondente configurada na Zona.

### 6.3. Disponibilidade de cartas

Salvar as mesmas cartas em vários decks não consome exemplares. A disponibilidade é verificada por deck e pelo perfil local. O duelo usa um snapshot imutável e não disputa posse de cartas com outros saves.

Esta versão não possui venda nem destruição de cartas. Uma importação de lista pode conter cartas ainda não obtidas; explicar ausências sem conceder exemplares ou apagar a lista.

### 6.4. Snapshot de entrada

Antes de uma partida, salvar a lista exata de impressões, definições, quantidades, energias e versão. Alterar o deck no editor não altera esse snapshot.

Desafios que exigem uma expansão ou raridade devem consultar as impressões realmente utilizadas, não apenas os nomes funcionais. A FAQ oficial confirma essa distinção para objetivos por expansão e por raridade. [R11] [R12]

### 6.5. Auto-build e decks de apoio

**[DP]** Auto-build propõe uma lista válida com cartas disponíveis, explica substituições e exige aprovação. Decks de apoio são listas locais emprestadas, utilizáveis sem contador de usos nem espera. Não concedem as cartas à coleção. A campanha não pode ficar impossível por falta de sorte em pacotes.

---

<a id="gameplay-07"></a>

## 🎲 7. Preparação e mão inicial

### 7.1. Fluxo

```text
VALIDAR DECKS
→ FIXAR VERSÕES
→ CRIAR PARTIDA
→ DETERMINAR PRIMEIRO JOGADOR
→ SORTEAR PRÉVIAS DE ENERGIA
→ GERAR MÃOS
→ ESCOLHER ATIVOS
→ PREPARAR BANCOS
→ CONFIRMAR OS DOIS LADOS
→ REVELAR CAMPO
→ PRIMEIRO TURNO
```

A seleção humana não é revelada à IA antes de ambas as preparações estarem comprometidas. O bot prepara seu campo pela visão permitida, sem esperar a escolha humana para obter vantagem.

**[DP]** O primeiro jogador é decidido por uma moeda justa de `battleRng` durante a preparação: cara, começa o humano; coroa, começa o NPC. O resultado gera `COIN_RESOLVED` com motivo `FIRST_PLAYER`, apresentado na introdução da mesa antes da escolha de Ativos. Tutoriais e puzzles definem o primeiro jogador na fixture e não lançam essa moeda.

**[DP]** Ordem de consumo de `battleRng` na preparação: moeda do primeiro jogador; prévia de Energia do primeiro jogador e depois do segundo (seção 9.3); embaralhamento e mão do primeiro jogador e depois do segundo (seção 7.2). Alterar essa ordem muda replays e exige novo `rulesetId`.

### 7.2. Distribuição inicial

A regra-base usa cinco cartas com pelo menos um Básico elegível.

**[PV]** Não afirmar conhecer o algoritmo interno do Pocket para essa garantia.

**[DP]** Para esta implementação: embaralhar uniformemente, examinar cinco cartas e aceitar apenas mãos que contenham Básico. Repetir o sorteio quando necessário; cada repetição é um novo embaralhamento completo do baralho com `battleRng` (seção 27.3). O baralho já foi validado, portanto existe ao menos um resultado possível.

Uma implementação otimizada pode amostrar diretamente a distribuição condicionada, desde que seja matematicamente equivalente.

Escolher obrigatoriamente um Básico e depois quatro cartas não é automaticamente equivalente.

### 7.3. Colocação inicial

Selecionar um Básico para o Ativo é obrigatório. Colocar Básicos no Banco é opcional, até três.

Evoluções e Treinadores — inclusive Fósseis — não podem ser colocados como Ativos iniciais nem no Banco durante a preparação.

### 7.4. Confirmações e abandono

Não existe prazo de preparação na campanha. O humano pode ler, pausar e reorganizar antes de confirmar. Abandono é uma ação explícita; minimizar ou fechar não equivale a desistir.

---

<a id="gameplay-08"></a>

## 🔄 8. Turnos e ações

### 8.1. Contadores

Guardar `globalTurnNumber` e o contador de turnos próprios de cada jogador.

```text
Global 1: A, primeiro turno próprio.
Global 2: B, primeiro turno próprio.
Global 3: A, segundo turno próprio.
Global 4: B, segundo turno próprio.
```

### 8.2. Máquina de estados

```text
SETUP
→ TURN_START
→ DRAW
→ ENERGY_ZONE_UPDATE
→ MAIN_ACTIONS
→ ATTACK_RESOLUTION ou END_REQUEST
→ END_OF_TURN_EFFECTS
→ BETWEEN_TURNS_CHECKUP
→ TERMINAL_CHECK
→ NEXT_PLAYER
→ TURN_START …

Depois de cada grupo de Nocautes: verificação terminal → TERMINAL ou PROMOTION
Em qualquer fase: AWAITING_DECISION até a decisão pendente ser respondida
```

| Estado | Contrato |
|---|---|
| `SETUP` | Escolha oculta de Ativo e Banco pelos dois lados (seção 7); termina ao revelar o campo. |
| `AWAITING_DECISION` | Decisão pendente de qualquer participante (alvo, busca, custo, ordem, troca). Pode ocorrer dentro de qualquer fase e retorna à continuação registrada. |
| `PROMOTION` | Substituição do Ativo após Nocaute (seção 11.3); escolhas simultâneas e ocultas quando os dois lados precisam promover. |
| `TERMINAL` | Partida encerrada; nenhum comando de jogo é aceito. |

**[DP]** A verificação terminal roda depois de **cada** grupo de Nocautes — na resolução de ataque, em efeitos da fase principal e no checkup —, não apenas em `TERMINAL_CHECK`; com Nocautes em duas etapas, ela espera a saída de campo do último grupo pendente da cadeia (seção 17.2). Com resultado terminal, a partida vai a `TERMINAL` sem solicitar promoções. `TERMINAL_CHECK` também aplica o limite de turnos (seção 17.11).

### 8.3. Primeiro jogador

A regra-base permite compra normal, Básicos no Banco e Treinadores, mas não a geração normal de Energia no primeiro turno do primeiro jogador.

Nenhum dos jogadores pode evoluir normalmente em seu primeiro turno próprio.

**[CO]** Ataques sem custo podem ser usados pelo primeiro jogador em seu primeiro turno. Não existe uma proibição absoluta de atacar nessa abertura. [R04]

| Ação | Primeiro jogador na abertura | Segundo jogador na abertura |
|---|---|---|
| Compra normal | Sim | Sim |
| Energia normal da Zona | Não | Sim |
| Básicos no Banco | Sim | Sim |
| Apoiador | Sim, até o limite | Sim, até o limite |
| Evolução normal | Não | Não |
| Ataque | Se legal | Se legal |

### 8.4. Fase principal

O jogador pode intercalar ações permitidas: colocar Básicos, evoluir, ligar Energia, usar Itens, usar Apoiador, ligar Ferramenta, jogar Estádio, ativar Habilidades e recuar.

Não existe uma ordem compulsória de “Energia antes de Treinador”. O motor retorna ações legais para o estado atual.

### 8.5. Encerramento

Atacar normalmente encerra o turno. Passar também. Algumas Habilidades ou efeitos encerram o turno após sua resolução.

Uma ação que já revelou informação aleatória não pode ser desfeita para testar outro resultado.

### 8.6. Ações durante o turno adversário

O jogador não recebe uma janela universal de “interromper” com cartas da mão. Não introduzir pilha de respostas de outro card game.

Ele pode precisar responder a escolhas impostas por efeitos ou substituir um Ativo. Isso é uma decisão específica, não a posse da fase principal.

### 8.7. Pausa em fronteira lógica

Pausa é um estado da sessão, não uma ação de carta. Se uma ação já estiver sendo resolvida, terminar a unidade atômica ou persistir sua decisão pendente, e então suspender. A IA não inicia outra ação enquanto a sessão estiver pausada.

Animações de compra, ataque, moeda e Nocaute usam os eventos confirmados. Tempo de quadro, foco da janela e rotação da câmera não alteram turnos nem RNG.


---

<a id="gameplay-09"></a>

## ⚡ 9. Energia

### 9.1. Tipos e custo

Tipos de Pokémon e tipos de Energia são conceitos relacionados, mas distintos.

A regra-base admite tipos Planta, Fogo, Água, Elétrico, Psíquico, Lutador, Noturno, Metálico, Dragão e Incolor para cartas. Energia Incolor não é um objeto gerado: é um requisito que aceita fornecimento de qualquer tipo. Dragão também não exige automaticamente um recurso chamado Energia Dragão.

### 9.2. Zona configurada

A regra-base permite selecionar até três tipos geráveis. Tipos diferentes podem causar variação na consistência de ataques.

**[DP]** Tipos configuráveis (`energyZoneTypes`): `GRASS`, `FIRE`, `WATER`, `LIGHTNING`, `PSYCHIC`, `FIGHTING`, `DARKNESS` e `METAL`. Dragão e Incolor não são geráveis. Cada deck configura de 1 a 3 tipos distintos (`maxConfiguredEnergyTypes`). Os tipos configurados têm pesos iguais (`energyGenerationWeights: "UNIFORM"`): cada geração sorteia um deles com probabilidade 1/n, independente das anteriores. Um deck com um único tipo sempre gera esse tipo. Não afirmar que essa distribuição é o algoritmo interno oficial.

A UI deve separar configuração automática de configuração manual e evitar mudar silenciosamente as Energias ao editar o deck.

### 9.3. Energia pronta e próxima

```text
configuredEnergyTypes
readyEnergy
nextEnergyPreview
manualAttachmentUsedThisTurn
```

**[DP]** Algoritmo da Zona. `draw()` é um sorteio uniforme em `configuredEnergyTypes` com `battleRng` (seção 27.3).

```text
Preparação, depois da moeda do primeiro jogador:
  primeiro jogador: nextEnergyPreview ← draw()
  segundo jogador:  nextEnergyPreview ← draw()
  readyEnergy de ambos ← vazio

ENERGY_ZONE_UPDATE do jogador do turno:
  se é o primeiro turno próprio do primeiro jogador:
    nada é gerado; a prévia permanece
  senão, se readyEnergy está vazio:
    readyEnergy ← nextEnergyPreview
    nextEnergyPreview ← draw()
  senão (Energia pronta não usada no turno anterior):
    nada muda; o slot não acumula
```

O slot pronto tem capacidade de uma Energia e não forma uma reserva crescente. A ligação manual (seção 9.4), ou um efeito que declare consumir a Energia pronta, esvazia `readyEnergy`. Nada é sorteado para a Zona fora de `ENERGY_ZONE_UPDATE`.

A previsão exibida deve corresponder ao sorteio real já comprometido. Nunca sortear uma aparência e entregar outra.

### 9.4. Ligação manual

Consome a Energia pronta e a permissão manual do turno. Pode ter como alvo um Pokémon próprio elegível, Ativo ou no Banco.

Ligações produzidas por cartas devem indicar se consomem esses recursos. Não presumir que qualquer ligação gasta a permissão manual.

### 9.5. Origem da Energia

Registrar Zona, descarte, movimento entre Pokémon ou outra origem autorizada.

**[CO]** A FAQ diferencia ligar da Zona de recuperar do descarte ou mover entre Pokémon ao explicar o gatilho de Jolteon ex. [R04]

### 9.6. Ataque não gasta automaticamente

Energia normalmente habilita o ataque e permanece ligada. Um descarte só ocorre se a regra de custo ou o efeito mandar.

```text
Custo: 1 Fogo + 1 Incolor
Anexos: 1 Fogo + 1 Água
Resultado: ataque habilitado; anexos preservados salvo outro texto.
```

### 9.7. Fornecimento versus anexos

Uma Energia pode fornecer mais unidades por um modificador. Não duplicar fisicamente o anexo.

```text
Anexos: identidades e tipos realmente ligados.
Fornecimento efetivo: unidades que esses anexos fornecem agora.
```

A perda de uma aura recalcula fornecimento. Não remove a Energia original.

### 9.8. Avaliação de custos

Calcular fornecimento efetivo, aplicar modificadores de custo, satisfazer requisitos específicos e depois Incolores, sem reutilizar a mesma unidade.

Custos adicionais de descarte devem consultar anexos concretos. Descartar um anexo que fornece duas unidades não significa descartar dois objetos.

### 9.9. Energia descartada

Manter um registro próprio para permitir efeitos de recuperação. Ela não entra no baralho como carta de Energia.

A interface pode agrupar quantidades por tipo, mas o motor deve preservar identidades quando uma operação precisar distinguir objetos.

---

<a id="gameplay-10"></a>

## 🐣 10. Colocação e evolução

### 10.1. Colocar Básico

Validar carta na mão, categoria elegível, espaço livre e restrições em vigor. Retirar da mão, criar entidade em campo, registrar entrada e disparar eventos.

Não permitir exceder o Banco temporariamente. Não permitir descartar livremente um Pokémon do Banco para abrir espaço.

### 10.2. Evolução normal

Exigir:

- Carta compatível na mão.
- Pokémon de origem elegível.
- Não ser o primeiro turno próprio.
- Origem não colocada neste turno.
- Linha não evoluída normalmente neste turno.
- Ausência de proibição aplicável.

Guardar `enteredPlayOnTurn`, `lastEvolvedOnTurn` e compatibilidade.

### 10.3. Dano preservado

```text
HP restante = HP máximo efetivo − dano acumulado
```

Exemplo:

```text
Antes: 70 HP máximos, 40 de dano, 30 restantes.
Depois: 120 HP máximos, 40 de dano, 80 restantes.
```

Não preservar “30 HP restantes” como se a evolução não aumentasse a capacidade.

### 10.4. Componentes preservados e removidos

Preservar pilha anterior, Energia, Ferramenta e dano conforme a operação. Evoluir remove todas as condições especiais (seção 15.8) e os efeitos marcados como removíveis por evolução.

Não somar ataques de todos os estágios. A carta atual define os ataques disponíveis, salvo efeito específico — a regra concedida de ataques das evoluções anteriores (seção 12.10).

### 10.5. Exceções

Cartas podem pular estágios ou alterar regras de evolução. **[CO]** Rare Candy aparece em estratégia oficial permitindo alcançar a evolução correspondente a partir do Básico. [R05]

Implementar uma operação de evolução especial com requisitos próprios; não relaxar a regra global para todas as cartas.

**[DP]** Doce Raro (A3): não pode ser jogado no primeiro turno próprio; escolhe um dos seus Básicos que **já estava em jogo** antes deste turno e que um Estágio 2 da mão consegue evoluir (pulando o Estágio 1); Básicos sem Estágio 2 correspondente na mão não são oferecidos e, sem alvo válido, a carta não é jogável (seção 14.4). O dano é preservado (seção 10.3). Exceções por regra concedida a um Pokémon: evoluir no primeiro turno ou no turno em que entrou em jogo (Evolução Impulsionada do Eevee) e evoluir “como” outra chave (Eevee ex evolui como Eevee); a proibição “não pode evoluir” (Aerodactyl ex) bloqueia a evolução normal e a especial da mão ([efeitos-dsl.md §9](efeitos-dsl.md#dsl-9)).

### 10.6. Remoção ou devolução da pilha

Uma operação precisa dizer quais cartas da pilha mudam de zona e o destino de anexos. Devolver a criatura não deve gerar cópias nem perder silenciosamente as cartas sob a evolução.

---

<a id="gameplay-11"></a>

## 🔀 11. Recuo, troca e promoção

### 11.1. Recuo normal

Requer Ativo, opção no Banco, permissão de Recuo disponível, ausência de impedimento e pagamento do custo efetivo.

O jogador seleciona Energias concretas para descarte quando houver escolha relevante. Mesmo com custo zero, o Recuo normal consome seu limite.

Sono e Paralisia impedem o Recuo normal. Confusão não impede (seção 15.6).

### 11.2. Troca por efeito

Não chamar automaticamente a função de Recuo. A operação declara custo, limites, condições, seletor, alvos e quem escolhe.

Um efeito pode obrigar o adversário a escolher o substituto. O jogador que jogou a carta não ganha essa escolha por padrão.

### 11.3. Promoção após Nocaute

É uma decisão obrigatória quando o Ativo sai por Nocaute e a partida ainda precisa continuar. Não cobra o custo de Recuo.

Enquanto houver essa decisão, bloquear ações comuns incompatíveis.

**[DP]** Se os dois Ativos saem no mesmo grupo de Nocautes e a partida continua, as duas promoções são escolhas simultâneas e ocultas, como na preparação: cada lado escolhe sem ver a escolha do outro — a IA decide pela própria observação, sem a escolha humana —, as escolhas são comprometidas e depois reveladas juntas. Se só um lado precisa promover, apenas ele escolhe.

### 11.4. Efeitos ao voltar para o Banco

Separar efeitos removíveis por saída do Ativo de auras contínuas, histórico de uso e marcas de partida. Condições especiais sempre saem com o Pokémon que deixa o Ativo (seção 15.8).

**[CO]** A FAQ explica que Buzzwole ex pode remover a restrição aplicada por seu ataque ao voltar ao Banco. [R04]

Não zerar genericamente todo o objeto do Pokémon.

---

<a id="gameplay-12"></a>

## ⚔️ 12. Ataques e resolução de dano

### 12.1. Definição de ataque

Um ataque contém identificador, nome, custo de Energia, condições, custos adicionais, seletor de alvos, fórmula, efeitos e consequência sobre o turno.

O catálogo deve distinguir custos de efeitos. “Descarte para usar” é diferente de “depois, descarte”.

### 12.2. Declaração

A camada de entrada envia ao motor local intenção e escolhas, nunca dano final, moeda ou pontos.

Validar partida ativa, jogador autorizado, fase, decisões, origem, ataque atual, Energia, condições, alvos e custos adicionais.

**[DP]** O ataque é identificado por `attackId` e, quando não pertence à carta do topo, pela carta da pilha que o possui (`sourceCardId`, seção 12.10). A Energia aceita é o custo efetivo do ataque ou, quando a condição dele vale, o custo alternativo declarado na carta (“se este Pokémon tiver dano, este ataque pode ser usado com {L}”).

### 12.3. Pipeline

```text
Validar declaração
→ Comprometer escolhas e custos pertinentes
→ Verificar condições pré-ataque
→ Resolver efeitos anteriores ao dano
→ Calcular dano por alvo
→ Aplicar eventos
→ Resolver efeitos posteriores
→ Processar Nocautes no ponto de resolução
→ Resolver consequências e término do turno
```

A posição exata de um custo ou efeito depende de sua definição. Não colocar todo descarte sempre antes ou sempre depois do dano.

**[DP]** “Verificar condições pré-ataque” lança, nesta ordem, a moeda de Confusão (seção 15.6) e, se algum efeito do tipo “quando este Pokémon for atacar, jogue uma moeda” alcança o atacante (Cortina de Fumaça), uma única moeda de bloqueio, mesmo com vários efeitos. Coroa em qualquer uma: o ataque não acontece e o turno acaba. A ordem completa por opcode está em [efeitos-dsl.md §13.1](efeitos-dsl.md#dsl-13).

### 12.4. Ordem do dano

**[CO]** A ordem oficial é dano do ataque, efeitos sobre o atacante, Fraqueza e efeitos sobre o defensor. [R07]

A regra-base usa +20 como comportamento usual de Fraqueza, mas o operador pode ser modificado. A FAQ apresenta um exemplo com multiplicação: `50 × 2 − 20 = 80`. [R07]

Exemplo hipotético do projeto:

```text
Base 60 + bônus 10 + Fraqueza 20 − redução 20 = 70
```

**[DP]** Ordem por alvo e piso:

```text
Dano-base ou fórmula
→ modificadores do atacante
→ Fraqueza (somente se o alvo recebe Fraqueza)
→ modificadores do defensor
→ piso 0
→ prevenção ou substituição (seção 13.4)
→ aplicar
```

O dano final nunca é negativo e nunca cura: `Base 20 − redução 30 = 0`, não −10. Alvos no Banco não recebem Fraqueza, salvo quando a operação declarar o contrário (seção 12.6). Um resultado 0 registra sua decomposição, mas gatilhos que exigem dano recebido só disparam com valor maior que zero.

Exibir uma decomposição quando o jogador inspeciona o resultado.

### 12.5. Categorias de dano

Distinguir ataque, Habilidade, condição especial, reação, alteração de HP e Nocaute direto por efeito.

Proteção contra dano de ataques não equivale a invulnerabilidade. **[CO]** A documentação de Mimikyu ex destaca interações com ataques que ignoram efeitos e com desativação de Habilidades. [R10]

### 12.6. Múltiplos alvos

Cada evento informa origem, alvo, categoria, valor, aplicação de Fraqueza, modificadores e grupo de resolução.

Dano no Banco não recebe Fraqueza automaticamente. O comportamento deve ser indicado pela operação.

Não declarar vitória depois do primeiro alvo sem terminar um conjunto que deva ser simultâneo.

### 12.7. Moedas

A fonte de aleatoriedade resolve antes da animação.

```text
2 moedas; 40 por cara:
0 caras = 0 dano, probabilidade 25%.
1 cara = 40 dano, probabilidade 50%.
2 caras = 80 dano, probabilidade 25%.
```

Esses números pressupõem moedas justas e independentes. Não sortear os três danos uniformemente.

### 12.8. Repetição até coroa

Executar uma sequência de sorteios até a condição de parada. A apresentação pode abreviar uma animação longa, mas não impor um teto secreto que altere probabilidades.

O motor deve possuir proteção técnica contra loops causados por bugs; essa proteção encerra com erro controlado, não inventa um resultado de batalha.

### 12.9. Ataques copiados

Preservar contexto: quem é atacante, quem é adversário, qual custo habilita a cópia, qual texto é copiado e a que entidade “este Pokémon” se refere.

Copiar um ataque não transfere controle da carta original.

### 12.10. Ataques de evoluções anteriores

**[DP]** Um Pokémon evoluído só usa os ataques da carta do topo, salvo regra concedida por efeito contínuo (`GRANT_RULE` `PREVIOUS_EVOLUTION_ATTACKS`): Luz da Memória (Ferramenta, no próprio portador) ou a Habilidade do Celebi (P-B), que alcança os seus Pokémon evoluídos enquanto ele estiver em jogo, inclusive no Banco. Com a regra:

- As ações legais incluem os ataques de cada carta de Pokémon **abaixo** do topo da pilha, um por carta e ataque.
- O comando `ATTACK` informa a carta dona do ataque em `sourceCardId`. Sem `sourceCardId`, só os ataques do topo são aceitos; um `sourceCardId` de carta abaixo do topo sem a regra, ou de carta fora da pilha, é `INVALID_TARGET`.
- O ataque é resolvido com os dados daquela carta — custo, dano, efeitos e nome —, mas o atacante continua sendo a entidade em campo, com tipo, Fraqueza do alvo, modificadores e Ferramenta atuais. O custo de Energia do ataque anterior continua exigido.

A regra só existe enquanto a fonte vale: tirar a Ferramenta ou o Celebi de jogo remove as opções.

---

<a id="gameplay-13"></a>

## ✨ 13. Habilidades

### 13.1. Ativadas

O jogador escolhe usar. Definir momento, zona da fonte, condições, custos, alvos, limite e encerramento de turno.

### 13.2. Contínuas

Enquanto válidas, alteram HP, fornecimento, custo, dano ou permissões. Recalcular quando a fonte ou a condição muda.

Não aplicar uma vez como alteração permanente de atributos.

### 13.3. Disparadas

Respondem a eventos como entrada, evolução, ligação de Energia, dano, troca, início ou fim de turno e Nocaute.

A assinatura do evento deve carregar a causa, não apenas o resultado visual.

### 13.4. Prevenção e substituição

Intervêm antes de um evento ser aplicado. Declarar o que é prevenido, se a proteção é consumida e em que momento.

Uma prevenção pode ser ignorada ou suspensa por outro efeito, conforme o catálogo.

### 13.5. Encerramento de turno

Uma Habilidade pode resolver seus efeitos e encerrar o turno. Essa consequência precisa estar explícita no texto e no motor.

A UI deve alertar antes de confirmar, sem fazer parecer que o jogador ainda poderá atacar depois.

### 13.6. Escopos de uso

```text
Por instância e turno.
Por nome de Habilidade e turno.
Por jogador e turno.
Por instância e partida.
Por jogador e partida.
Enquanto uma carga específica não tiver sido consumida.
Sem limite durante o turno (“quantas vezes quiser”).
```

Não usar um booleano genérico para todos os casos. **[DP]** “Quantas vezes quiser durante o seu turno” (escopo `UNLIMITED`, Vaporeon, Dusknoir) não conta usos, mas cada uso ainda precisa produzir efeito (seção 14.4): o Dusknoir sem dano para mover não pode ativar.

### 13.7. Histórico

Guardar a carta atual no momento do evento, entidade, turno, origem, destino e causa.

**[CO]** O exemplo oficial de Scizor diferencia sua movimentação naquele turno de uma promoção no turno adversário e da movimentação de Scyther seguida de evolução. [R04]

### 13.8. Supressão

Uma Habilidade desativada deixa de contribuir enquanto a supressão for aplicável. Não apagar dados de uso nem resolver retroativamente todos os gatilhos que aconteceram enquanto estava desativada.

A reativação deve disparar apenas eventos previstos, nunca “compensar” efeitos perdidos por iniciativa da interface.

---

<a id="gameplay-14"></a>

## 🧪 14. Biblioteca de efeitos

Esta é a linguagem funcional proposta, não uma afirmação de que cada combinação exista no catálogo oficial. A forma executável — blocos, seletores, fórmulas, condições, durações, gatilhos e os 54 opcodes — é normativa em [efeitos-dsl.md](efeitos-dsl.md); a tabela abaixo apenas agrupa as famílias.

| Família | Operações |
|---|---|
| Dano | Fixo, fórmula, moedas, Energia, dano acumulado, múltiplos alvos. |
| Cura | Remover dano limitado, total ou de grupo elegível. |
| Condições | Aplicar, remover, substituir, prevenir. |
| Energia | Gerar, ligar, mover, descartar, recuperar, modificar fornecimento. |
| Compra | Comprar N, comprar até N, comprar condicionalmente. |
| Busca | Escolha manual ou aleatória com filtro. |
| Mão | Revelar, descartar, devolver, embaralhar, substituir. |
| Baralho | Embaralhar, consultar topo, reorganizar, remover. |
| Campo | Colocar, trocar, devolver, descartar, Nocautear. |
| Evolução | Evoluir, pular estágio autorizado, modificar compatibilidade. |
| Custos | Aumentar, reduzir, substituir. |
| Defesa | Reduzir, prevenir, ignorar efeitos, suprimir Habilidade. |
| Controle | Impedir ações por duração definida. |
| Temporização | Imediato, contínuo, atrasado, início/fim de turno. |
| Cópia | Resolver efeito ou ataque sob contexto explícito. |
| Pontuação | Determinar ou modificar recompensa por Nocaute. |

### 14.1. Estrutura comum

Cada operação deve declarar precondições, seletor, controlador da escolha, cardinalidade, opcionalidade, custo, efeito, política de falha parcial e duração. Os campos correspondentes são `condition`, `target`/`pick` (`chooser`, `min`, `max`), `optional`, `additionalCosts`, `operation`, `failurePolicy` e `duration` ([DSL §2–§8](efeitos-dsl.md#dsl-2)).

### 14.2. Busca

Definir quem escolhe, filtro, quantidade, aleatoriedade, revelação, embaralhamento e comportamento sem resultados.

Não mostrar ao adversário opções que pertencem a uma busca secreta.

**[DP]** A precondição de uma busca obrigatória usa o baralho real: sem carta elegível, a carta que contém a busca não é jogável (seção 14.4). A interface informa apenas “nenhum alvo possível”, sem revelar a ordem do baralho; o jogador já conhece a própria lista.

### 14.3. Fórmulas

Distinguir quantidade de anexos de unidades fornecidas. Distinguir HP restante de dano acumulado. Distinguir tamanho do Banco de quantidade total de cartas nas pilhas.

### 14.4. Falha parcial

Uma ação que exige custo impossível é ilegal. Uma ação legal pode resolver somente a parte possível do efeito quando sua política permitir.

**[DP]** Um Treinador ou Habilidade cujo efeito obrigatório não pode produzir efeito algum não é jogável: a precondição falha e a carta nunca é gasta sem efeito. Exemplos: busca sem carta elegível no baralho, cura sem alvo com dano, compra com mão cheia ou baralho vazio. Quando o efeito é parcialmente possível, resolver o possível conforme sua `failurePolicy` ([efeitos-dsl.md](efeitos-dsl.md#dsl-2)).

```text
PRECONDITION
ADDITIONAL_COST
MANDATORY_EFFECT
OPTIONAL_EFFECT
```

### 14.5. Laços e prioridades

Limitar tecnicamente a profundidade de resolução e detectar ciclos não encerráveis. Registrar erro de conteúdo e invalidar a carta no catálogo de produção se sua definição produzir um loop.

Não permitir que a camada visual escolha arbitrariamente a ordem de gatilhos que altera o resultado.

---

<a id="gameplay-15"></a>

## ☠️ 15. Condições especiais

### 15.1. Tabela da regra-base

| Condição | Comportamento | Recuperação normal |
|---|---|---|
| Envenenado | 10 de dano por verificação entre turnos. | Sem moeda automática. |
| Queimado | 20 de dano por verificação. | Moeda após o dano; cara remove. |
| Adormecido | Não ataca nem faz Recuo normal. | Moeda em todo checkup; cara remove. |
| Paralisado | Não ataca nem faz Recuo normal. | Expira após o turno pertinente do afetado. |
| Confuso | Moeda ao tentar atacar; coroa faz falhar. Pode recuar e usar Habilidades. | Sem cura automática por essa moeda. |

**[DP]** Condições especiais existem apenas no Pokémon Ativo. Um Pokémon no Banco não pode recebê-las, salvo operação que declare isso explicitamente — e nenhuma operação desta ruleset o faz. Aplicar condição a um alvo que não é o Ativo não produz efeito.

### 15.2. Veneno

Persiste até ser removido por operação válida. Reaplicar não cria duas condições separadas.

Alterações no dano de Veneno são modificadores, não múltiplas cópias do estado.

**[DP]** O dano de Veneno na verificação é 10, salvo quando o efeito que envenenou declara outro valor (ex.: 20); enquanto o Pokémon continua Envenenado, vale o maior valor já aplicado, e ele volta a 10 quando o Veneno sai. Efeitos contínuos podem somar a esse dano (Nihilego: +10). Um Pokémon protegido contra Condições Especiais não pode ser envenenado e, ao ganhar a proteção, recupera-se das que tinha (Avental de Aço, Comfey).

### 15.3. Queimadura

Aplicar o dano antes de verificar sua recuperação. A moeda não desfaz dano já aplicado.

### 15.4. Sono

Não bloquear todas as ações do jogador. Itens, preparação do Banco e outras ações podem continuar legais.

**[DP]** Enquanto Adormecido, o Pokémon lança uma moeda em **todo** checkup, inclusive no que encerra o turno em que adormeceu; cara remove o Sono.

### 15.5. Paralisia

Vincular expiração ao turno do jogador afetado. **[DP]** A Paralisia expira no primeiro checkup que encerra um turno do dono do Pokémon iniciado depois da aplicação.

```text
A paralisa B → B joga sob restrição → expiração no momento definido após esse turno.
```

Não curar ao fim do turno de A que aplicou a condição.

### 15.6. Confusão

A regra-base do projeto não aplica os 30 de dano a si do TCG físico. Em coroa, o ataque falha e o turno é encerrado conforme a regra.

Separar a moeda de Confusão das moedas do próprio ataque. Um ataque que falhou por Confusão não realiza normalmente seus efeitos.

**[DP]** Confusão afeta somente a tentativa de atacar. Um Pokémon Confuso pode fazer Recuo normal e usar Habilidades.

### 15.7. Acúmulo

Veneno e Queimadura são estados independentes. Sono, Paralisia e Confusão são mutuamente exclusivos.

```json
{
  "poisoned": true,
  "burned": false,
  "controlCondition": "ASLEEP"
}
```

### 15.8. Remoção

**[DP]** Evoluir, regredir (devolver a carta do topo da pilha) ou deixar a posição Ativa — por Recuo, troca por efeito, ida ao Banco, retorno à mão ou ao baralho — remove **todas** as condições especiais do Pokémon. Efeitos específicos também removem condições conforme a operação. Remover condição não cura dano já causado.

Manter operações separadas: `REMOVE_CONDITION` e `HEAL_DAMAGE`.

### 15.9. Ordem no checkup

**[DP]** Processar primeiro o Ativo do jogador cujo turno termina e depois o Ativo do outro jogador. Em cada Pokémon:

```text
1. Dano de Veneno.
2. Dano de Queimadura.
3. Moeda de recuperação de Queimadura.
4. Moeda de Sono.
5. Expiração de Paralisia (seção 15.5).
```

Não lançar moedas de recuperação para um Pokémon cujo dano já alcançou o HP máximo efetivo: ele será Nocauteado no grupo do checkup. Os Nocautes dos dois lados formam um único grupo, processado depois que os dois Ativos foram verificados (seção 16.3).

---

<a id="gameplay-16"></a>

## ⏱️ 16. Fim de turno e efeitos atrasados

### 16.1. Momentos diferentes

Separar efeitos de fim de turno, verificação de condições, expiração, Nocautes, substituição e início do próximo turno.

Um único bloco que altera tudo sem eventos intermediários dificulta a correção.

### 16.2. Prioridade dos jogadores

**[CO]** Quando os dois lados possuem efeitos de fim de turno, os do jogador cujo turno termina são aplicados primeiro. [R08]

**[DP]** Dentro de um grupo, usar uma ordem estável declarada; solicitar escolha quando a carta ou a regra exigir. Registrar a ordem no replay.

### 16.3. Checkup adotado

**[DP/PV]** Para a primeira versão, adotar a seguinte sequência explícita e homologá-la antes de afirmar reprodução estrita:

```text
Efeitos de fim de turno do jogador atual.
Efeitos de fim de turno do outro jogador.
Expirar efeitos temporários cuja duração termina neste turno.
Condições do Ativo do jogador atual, na ordem da seção 15.9.
Condições do Ativo do outro jogador, na mesma ordem.
Processar Nocautes do grupo de checkup.
Avaliar término da partida.
Solicitar substituições necessárias (seção 11.3).
Preparar o turno seguinte.
```

O dano já causado não é cancelado por recuperação posterior. Conteúdo que exija outra temporização deve fornecer uma regra explícita, não alterar a sequência em silêncio.

### 16.4. Efeitos atrasados

Guardar fonte, alvo, criação, condição de validade, ponto de execução e eventos de remoção.

**[CO]** A FAQ de Mismagius mostra um dano atrasado que deixa de ocorrer quando o Pokémon afetado volta ao Banco. [R09]

Um registro “causar 90 depois” sem alvo e duração é insuficiente.

### 16.5. Duração sem ambiguidade

Representar “até o final do próximo turno do adversário” por referências a turnos e participantes, não por segundos nem por um contador genérico decrementado em qualquer troca de tela.

---

<a id="gameplay-17"></a>

## 🏁 17. Nocaute, pontos, vitória e casos extremos

### 17.1. Condição de Nocaute

Reavaliar quando dano acumulado alcança HP máximo efetivo, quando HP máximo muda ou quando um efeito causa Nocaute diretamente.

Não depender de uma animação completar para descobrir que o Pokémon saiu de jogo.

### 17.2. Pipeline proposto

**[DP]** Nocaute em duas etapas (revisão 3.3.0):

```text
Etapa 1 — anúncio (KO_CHECK)
  Identificar o grupo de Nocautes: dano ≥ HP máximo efetivo ou Nocaute direto por efeito,
  fora os Pokémon já anunciados e ainda pendentes.
  Registrar um evento por Pokémon, com causa, fonte (atacante, se a causa é ataque) e pontos previstos.
  Os Pokémon do grupo continuam em campo.
  Resolver as reações disparadas pelo anúncio, com as escolhas que pedirem.
  Um Nocaute causado por essas reações forma outro grupo, anunciado do mesmo jeito.

Etapa 2 — saída (KO_RESOLVE)
  Remover as entidades do grupo e encaminhar cartas/anexos (Cachecol de Resgate: pilha para a mão).
  Atribuir os pontos do grupo uma única vez.

Com todos os grupos resolvidos:
  Avaliar condições terminais.
  Solicitar substituições se a partida continuar.
```

As reações acontecem com o Nocauteado ainda em campo: suas Energias, Ferramenta e Habilidades continuam valendo e o atacante pode ser alvo. Exemplos: Pyukumuku causa 50 de dano ao atacante, Cursola de Galar joga uma moeda para Nocauteá-lo, Passimian ex move as Energias {F} para o Banco (o dono escolhe antes de o Nocauteado sair), o Cabo Elétrico passa 2 Energias {L} ao Banco. Só depois o Nocauteado sai de campo e o oponente pontua.

Um grupo criado por uma reação é resolvido **antes** do grupo que a disparou, e nenhum dos dois pede verificação terminal ou promoção enquanto houver grupo pendente. Se a reação Nocauteia o atacante, os dois saem de campo, cada jogador marca seus pontos e, se a partida continua, os dois promovem (seção 11.3); se os dois chegam à vitória, é empate (seção 17.6).

**[DP]** Causa do Nocaute: é a do **último dano** recebido pelo Pokémon, e só conta se esse dano veio no turno global corrente.

| Causa | Quando |
|---|---|
| `ATTACK` | Último dano foi dano de ataque (categoria `ATTACK`, em geral do Pokémon Ativo do oponente), neste turno. |
| `EFFECT` | Último dano foi dano de efeito (Habilidade, Treinador, reação), neste turno. |
| `CONDITION` | Último dano foi Veneno ou Queimadura, neste turno. |
| `OTHER` | Qualquer outro caminho: dano de ataque de um turno anterior somado a dano movido (Acerola), HP perdido ao remover uma Ferramenta (Guzma descartando a Capa de Folha), Nocaute direto ou involução sem dano novo neste turno. |

Efeitos que dizem “Nocauteado por dano de um ataque” — reações, Cabo Elétrico, Cachecol de Resgate, “se algum Pokémon seu foi Nocauteado por dano de ataque no último turno do oponente” — exigem a causa `ATTACK`. Nocaute direto e descarte por efeito continuam distintos (seção 17.3).

Efeitos disparados pela saída devem conseguir consultar o contexto anterior preservado no evento.

### 17.3. Nocaute não é descarte

**[CO]** Descartar um Pokémon por efeito não concede pontos automaticamente; a FAQ usa Klefki como exemplo. [R04]

Operações diferentes:

```text
KNOCK_OUT          concede pontos pelo pipeline de Nocaute
DISCARD_POKEMON    vai ao descarte; não concede pontos
RETURN_TO_HAND     devolve pilha à mão (política de mão cheia §17.8)
SHUFFLE_INTO_DECK  embaralha pilha no baralho
```

Os nomes são os opcodes do [registro do DSL](efeitos-dsl.md#dsl-9).

### 17.4. Pontuação

Usar `knockoutPoints` resolvido. Valores-base: comum 1, ex 2 e Mega ex 3.

A vitória por pontos usa `points >= pointsToWin`. Não exigir chegar exatamente a três.

### 17.5. Ausência de Pokémon

Se um jogador fica sem Pokémon em campo no ponto válido de verificação, aplicar a condição terminal correspondente. Não confundir Banco vazio com campo vazio quando ainda existe Ativo. Um Fóssil em campo conta como Pokémon (seção 3.11).

### 17.6. Simultaneidade

**[DP/PV]** Resolver primeiro o grupo simultâneo inteiro. Se apenas um jogador satisfaz vitória, ele vence. Se ambos satisfazem condições terminais no mesmo checkpoint, declarar empate nesta versão inspirada.

Essa é uma política própria, não uma tabela oficial completa de desempates do Pocket. Se a partida continua e os dois lados precisam promover, as escolhas são simultâneas e ocultas (seção 11.3).

**[DP]** O “grupo simultâneo” inclui a cadeia de Nocautes encadeados por reações (seção 17.2): a verificação terminal só roda depois que o último grupo pendente saiu de campo e pontuou. Exemplo: com 2 pontos cada, A Nocauteia o Pyukumuku de B e a reação Nocauteia o atacante de A; os dois chegam a 3 pontos no mesmo checkpoint e a partida termina empatada.

### 17.7. Baralho vazio

Na regra-base, comprar de um baralho vazio não causa derrota automática. A compra simplesmente não obtém carta.

Não criar reciclagem automática do descarte.

### 17.8. Mão cheia

**[DP/PV]** Política adotada para o projeto:

- Compra: obter apenas o que cabe; cartas não compradas permanecem no baralho.
- Retorno de carta única: se obrigatório e sem espaço, a carta vai ao descarte do proprietário.
- Retorno de pilha: priorizar topo e depois cartas inferiores; excedentes vão ao descarte.
- A operação deve informar destinos de Energia e Ferramenta separadamente.
- Efeitos que exigem acomodação integral podem declarar essa precondição em vez de retorno parcial.

Essas políticas tornam a versão implementável, mas precisam de validação adicional para equivalência estrita ao Pocket. A interface deve exibir aviso antes de uma ação voluntária com perda previsível por excesso.

### 17.9. Remoção de aumento de HP

Exemplo:

```text
HP base: 100
Bônus: +20
Dano: 110
Restante: 10

Remover bônus → HP máximo 100 → dano 110 → reavaliar Nocaute.
```

### 17.10. Desistência

Requer confirmação explícita do jogador. Encerra conforme o perfil do modo, registra resultado e não devolve aleatoriamente recursos já consumidos.

### 17.11. Pausa, turnos máximos e abandono

**[DP]** Sem limite de segundos por decisão. Em todos os duelos normais desta campanha, ao terminar o turno global 60, concluir o checkup e as condições normais de vitória; se ninguém venceu, registrar empate por limite de turnos. Esse limite é do projeto, não uma afirmação sobre o Pocket.

Puzzles podem fixar um limite menor, expresso em turnos próprios do humano e informado antes de começar. Pausa não aumenta turnos. A medição de duração considera apenas tempo ativo e é estatística, nunca requisito oculto de progressão.

Fechar, minimizar ou trocar de aba solicita suspensão em checkpoint seguro. Não há derrota por desconexão. Desistir registra derrota sem recompensa repetível e sem perda da coleção.

### 17.12. Determinismo da retomada

Uma decisão obrigatória continua pendente depois de carregar o save. Resultados de moeda já comprometidos não são sorteados novamente. Efeitos visuais pendentes podem ser abreviados ao retomar, mas os eventos de regras são preservados.

---

<a id="gameplay-18"></a>

## 🎮 18. Exemplo completo de abertura

As cartas abaixo são fictícias, vêm do catálogo inicial da campanha ([campanha §3.3](campanha.md#campanha-03)) e servem somente para testar a sequência.

```text
A: Faísca, Básico Fogo, 70 HP; ataque de 20 por 1 Energia; fraca a Água +20.
Evolução: Braseiro, Fogo, 110 HP; ataque de 40 por 1 Energia; fraco a Água +20.

B: Broto, Básico Planta, 90 HP; ataques de 20 por 1 Energia e 50 por 2; fraco a Fogo +20.
Ambos possuem reserva no Banco.
```

### Turno global 1 — A

A venceu a moeda de primeiro jogador. Compra uma carta. Não recebe a Energia normal inicial. Pode preparar o Banco e usar Treinadores permitidos. Não consegue pagar seu ataque e passa.

### Turno global 2 — B

Compra, recebe e liga uma Energia. Ataca por 20; Faísca é fraca a Água, não a Planta, então não há Fraqueza. Faísca fica com 20 de dano e 50 HP restantes.

### Turno global 3 — A

Compra e recebe Energia. Evolui Faísca, que estava em campo desde a preparação. Braseiro mantém 20 de dano e possui 90 HP restantes. Liga Energia e ataca Broto: 40 + Fraqueza 20 = 60. Broto fica com 60 de dano e 30 HP restantes.

### Turno global 4 — B

Compra, recebe e liga a segunda Energia. Ataca por 50, sem Fraqueza. Braseiro passa a ter 70 de dano e 40 HP restantes.

### Turno global 5 — A

Compra e recebe Energia. A Energia ligada no turno 3 continua em Braseiro, que ataca de novo: 40 + Fraqueza 20 = 60 contra 30 HP restantes. Broto é Nocauteado, A marca 1 ponto e B promove um Pokémon do Banco.

### Lições verificadas

Evoluir preserva dano, atacar não descarta Energia automaticamente, a Fraqueza soma +20 apenas quando o tipo do atacante corresponde à Fraqueza do alvo, a abertura do primeiro jogador é assimétrica e preparar o Banco cria alternativas.

O exemplo usa somente a Fraqueza padrão do catálogo inicial. Não utiliza outros modificadores nem condições, para manter a verificação isolada.

---

<a id="gameplay-19"></a>

## 🎁 19. Coleção permanente e recursos locais

### 19.1. Inventário por perfil

A coleção pertence ao perfil local. Guardar impressões, quantidades, favoritas, variantes vistas, origem de aquisição, cosméticos e histórico. A soma histórica de cartas obtidas não substitui o saldo atual.

Um novo perfil recebe os três decks iniciais completos descritos em `campanha.md`, com um pool compartilhado suficiente para usar qualquer um deles. As mesmas cartas neutras não precisam ser concedidas três vezes.

### 19.2. Repetidas e proteção do acervo

Nesta versão, cartas recebidas permanecem na coleção. Não há venda, fusão destrutiva, desgaste, perda por derrota nem consumo ao montar decks. Repetidas ficam registradas, inclusive acima de duas cópias; o limite de duas continua sendo apenas uma regra de construção por nome.

A oficina vende aquisições dirigidas com Créditos. Não exige destruir uma carta para obter outra. Isso simplifica a campanha e evita bloquear um deck inicial por uma escolha irreversível.

### 19.3. Recursos da economia

| Recurso | Uso | Origem | Recuperação por tempo |
|---|---|---|---|
| Créditos | Pacotes, cartas dirigidas e cosméticos no Empório. | Vitórias elegíveis e objetivos. | Não. |
| Pacotes fechados | Abrir o produto correspondente. | Marcos, primeira vitória e Empório. | Não. |
| Medalhas de capítulo | Registrar vitória de chefe e desbloqueios. | Chefes. | Não são gastas. |
| Objetivos concluídos | Domínio do encontro. | Critérios de batalha. | Não são moeda. |

Não criar gemas premium, energia de campanha, selos de login ou passe pago. Energia de combate não sai da carteira.

### 19.4. Fichários e expositores

São composições locais que referenciam cartas possuídas. Não criam novas cópias. Exportar uma imagem da composição não concede cartas a outro save.

Three.js apresenta cartas com espessura, sleeves, pedestais e páginas de fichário. As quantidades continuam vindo do inventário e são mostradas em HTML. A galeria usa miniaturas leves; não cria centenas de contextos WebGL.

### 19.5. Separação de campanhas

Cada perfil tem sua própria campanha e coleção. Um novo jogo cria outro perfil ou exige confirmação explícita de substituição com backup. Não mesclar saldos de saves automaticamente.

---

<a id="gameplay-20"></a>

## 📦 20. Pacotes ganhos jogando e transações

### 20.1. Aquisição sem relógio

Pacotes são recompensas concretas. O jogador pode abrir todos os que possui, sem esperar. O Empório vende pacotes com Créditos obtidos no jogo. Não há relógio remoto, anúncios ou cobrança monetária.

Cada produto tem conjunto de elegibilidade versionado e tabelas por posição; pools, pesos e taxas constam em [campanha.md §16](campanha.md#campanha-16). Dois modelos convivem:

| Modelo | Produtos | Cartas por pacote | Sorteio |
|---|---|---|---|
| Legado por categoria | Os três pacotes do Genetic Apex (A1) | 5 | Categoria por posição e impressão ponderada do pool da categoria; probabilidades próprias do projeto. **Inalterado.** |
| Por símbolo | Sets depois do A1 (A1a…A4b) e os pacotes promocionais (P-A, P-B) | 4 a 6 | Símbolo de raridade por posição e impressão uniforme do pool do símbolo, com as taxas do Pocket; pacote raro e 6ª carta. |

**[DP]** No modelo por símbolo, um pacote normal tem **5** cartas; o **Deluxe Pack ex (A4b) tem 4** (a última sempre ◊◊◊◊); nos pacotes de **A4 e A4a**, uma **6ª carta** (um dos bebês ◊◊◊ ou o ☆) vem em **8,330%** dos pacotes normais. O pacote raro (0,050% dos pacotes, todas as cartas ☆ ou acima) existe em todos os pacotes de booster por símbolo, não nos promocionais. O pacote tutorial tem conteúdo fixo (campanha §16.4).

### 20.2. Abertura determinística

```text
Selecionar pacote possuído
→ Criar operationId
→ Ler saldo, versão e cursor de RNG econômico
→ Preparar resultado determinístico
→ Validar novamente versões dentro da transação local
→ Consumir 1 pacote
→ Creditar as impressões sorteadas (4 a 6, seção 20.1)
→ Avançar RNG
→ Gravar recibo e revisão do perfil
→ Aguardar conclusão da transação
→ Mostrar abertura Three.js
```

O sorteio é calculado por função pura antes da transação; esta verifica se a revisão lida ainda vale. Não manter uma transação SQLite aberta esperando animação, arquivo ou cálculo assíncrono.

**[DP]** Ordem de consumo do `economyRng` (`rng-v1`, seção 27.3) num pacote **por símbolo**. Chances e pesos são inteiros sobre `TIER_SCALE = 100000` (milésimos de ponto percentual):

```text
1. Pacote raro (só se o produto declara rarePack):
     r = uniformInt(100000); se r < 50 (0,050%) → pacote raro:
       U = impressões do pool com símbolo ☆, ☆☆, ☆☆☆, ✵, ✵✵, ♛ (nessa ordem; dentro do
           símbolo, na ordem do pool, isto é, do número de coleção)
       para cada posição 1…cardsPerPack: uniformInt(|U|) — repetidas permitidas.
       Fim: sem sorteio por posição e sem 6ª carta.
2. Senão, para cada posição em ordem crescente:
     símbolo = sorteio ponderado (uniformInt(Σ pesos)) entre os símbolos de peso positivo,
               na ordem ◊, ◊◊, ◊◊◊, ◊◊◊◊, ☆, ☆☆, ☆☆☆, ✵, ✵✵, ♛, PROMO;
     impressão = uniformInt(|pool do símbolo|).
3. Por fim, 6ª carta (só se o produto declara bonusSlot):
     r = uniformInt(100000); se r < 8330 → símbolo pelos pesos da carta extra
     (◊◊◊ 87100, ☆ 12900) e impressão uniforme do pool de bebês; sempre a última carta.
```

Um produto sem pacote raro (promocional) não consome o sorteio do passo 1; sem carta extra, não consome o do passo 3. O recibo guarda as impressões, o símbolo de cada uma e as marcas `rarePack` e `bonus`. Os três pacotes do Genetic Apex mantêm o modelo legado: para cada posição, `weightedPick` da categoria e depois `weightedPick` da impressão pelos pesos do pool, sem pacote raro nem 6ª carta.

### 20.3. Falhas e retomada

Antes do commit, nenhuma carta ou custo é confirmado. Depois do commit, o recibo é a fonte de verdade. Atualizar a página, pular a animação ou perder o contexto WebGL não refaz o sorteio.

`openingId` identifica uma abertura existente. “Rever abertura” não consome outro pacote nem credita cartas novamente. Uma animação interrompida pode ir diretamente ao resumo das cartas do pacote.

### 20.4. Relação com o 3D

O pacote possui volume, costura superior, verso e faces. O gesto de rasgar controla o progresso da animação, não a raridade. Um botão executa a mesma sequência para teclado e acessibilidade.

As cartas saem de uma pilha 3D, viram com quaternion e revelam materiais normais, holográficos ou cromados. Os rótulos “Nova”, quantidade e regras pertencem à interface semântica.

### 20.5. Transparência

Mostrar custo em Créditos ou quantidade de pacotes a consumir, conteúdo possível e probabilidades por slot. No pacote por símbolo, a tabela de taxas mostra o total e o valor por carta de cada símbolo por grupo de posições (“1ª–3ª”, “4ª”, “5ª”), a coluna da 6ª carta e a chance do pacote raro; a chance exibida por impressão soma pacote normal, pacote raro e carta extra. Carta exibida na capa não é garantia, salvo definição explícita.

A primeira abertura guiada é um produto de tutorial com resultado fixo, identificado como tal. Ele não é apresentado como uma amostra aleatória do produto normal.

---

<a id="gameplay-21"></a>

## 💎 21. Cartas tridimensionais e raridades

### 21.1. Independência mecânica

Raridade de obtenção, arte, acabamento e regra de batalha são eixos distintos. A mesma carta em acabamento normal e cromado resolve os mesmos efeitos.

| Acabamento | Contrato visual em Three.js |
|---|---|
| Normal | Malha fina com frente, verso e lateral; arte sem distorção. |
| Holográfico | Máscara de brilho na arte/borda, reflexo dependente da vista. |
| Foil | Camada iridescente discreta, sem cobrir o texto. |
| Arte completa | Outra textura frontal e máscara; não outra geometria de regra. |
| Arte alternativa | Outra impressão ligada à definição funcional correta. |
| Shiny | Variante de arte e material, sem bônus mecânico. |
| Cromado | Moldura metálica com ambiente local; texto protegido contra reflexo. |
| Imersivo | Cena local opcional de diorama, com entrada/saída e fallback. |

“Cromado” é uma categoria própria do projeto, não uma alegação sobre nomenclatura oficial.

### 21.2. Padrão do objeto carta

Proporção visual 5:7. Unidade-base proposta: largura 1, altura 1,4, espessura 0,012. Estas medidas são de cena, não dimensões físicas oficiais. Detalhes técnicos e eixos estão em `runtime-offline-threejs.md`.

Frente e verso não podem se inverter ao espelhar um transform. Manter orientação UV explícita. A pilha de evolução não cresce ilimitadamente em altura visual: representar camadas suficientes para comunicar o estado.

### 21.3. Relação com cada contexto

Coleção: miniaturas HTML e inspector 3D compartilhado. Deck: prévia espacial e sleeve escolhido. Batalha: cartas em malhas reais na mesa. Pacote: revelação em palco dedicado. Campanha: cartas-chave e recompensas em pedestais locais.

Não é obrigatório criar um modelo 3D de cada criatura. Cartas e ambientes tridimensionais são obrigatórios; monstros animados saindo de cada carta são expansão opcional, com orçamento próprio.

### 21.4. Redução de qualidade e acessibilidade

Mesmo em perfil Baixo, manter geometria simples de cartas e câmera. Desligar reflexos complexos, partículas e pós-processamento antes de abandonar o 3D.

Sem WebGL2 ou em falha irrecuperável, entrar em apresentação 2D de recuperação que permite continuar o jogo. Isso não substitui o requisito do caminho principal 3D.


### 21.5. Acessórios de batalha: contrato cosmético

A aparência do deck reúne **playmat, verso uniforme, moeda e flairs de entrada**. Material holográfico da impressão, flair de entrada e efeito do ataque são eixos independentes. Uma mesma carta funcional pode usar outra impressão ou flair sem alterar seu poder.

O playmat é a ilustração da superfície da mesa; o cenário tridimensional pertence ao encontro; a carta de Estádio pertence às regras. Nenhum dos três deve ser implementado como se fosse o mesmo objeto.

A oficina completa está em [interface-16x9.md](interface-16x9.md#interface-personalizacao). Presets, posse e importação local estão em [runtime-offline-threejs.md](runtime-offline-threejs.md#runtime-cosmetics-schema).

### 21.6. Propriedade, desbloqueio e aplicação

Cosméticos são entitlements permanentes e reutilizáveis. Aplicar o mesmo tapete a vários decks não o consome. O catálogo, o pré-requisito, o preço e a fonte do desbloqueio são dados de campanha/economia; a cena não concede itens ao terminar uma animação.

Aparência explícita do deck prevalece sobre a padrão do perfil; sem configuração, usar neutra. Validar posse ao salvar e resolver um snapshot visual ao criar a tentativa. Alterações posteriores não mudam aquela tentativa; modos de conforto podem neutralizar o visual sem reescrever o snapshot.

Trocar um verso aplica-o às vinte cartas daquele baralho, inclusive cartas funcionais com artes ou flairs diferentes. Não marcar pelo verso a posição de um ex, de uma evolução ou de qualquer carta estratégica.

### 21.7. Playmat exibido e Estádio

A apresentação padrão usa um único tapete completo, selecionado pelo proprietário do turno em `TURN_STARTED`. O final de turno e o checkup ainda pertencem ao turno que está terminando. Uma escolha do NPC durante o turno humano não troca o tapete.

As alternativas `PLAYER_FIXED` e `NEUTRAL` são preferências de visualização. Elas não alteram quem joga, o dono da escolha pendente ou efeitos de cartas. Jogar/substituir um Estádio nunca equipa um playmat.

### 21.8. Economia sem impacto na progressão obrigatória

Neutro e Academia estão disponíveis gratuitamente. Os seis tapetes de capítulo ficam à venda por 500 Créditos após o chefe correspondente, conforme a economia existente. O tapete do circuito final é uma concessão única por concluir F00-D03.

Essas concessões não substituem cartas-chave, pacotes ou Créditos já previstos. A coleção não é destruída para obter flair. Nenhum cosmético é requisito para vencer, abrir um capítulo ou usar uma carta.

---

<a id="gameplay-22"></a>

## 🌟 22. Descobertas da campanha

A Escolha Misteriosa social sai do produto. Seu equivalente autoral é **Descoberta**, um nó permanente de recompensa dirigida.

### 22.1. Funcionamento

Ao desbloquear um nó de Descoberta, mostrar três cartas reveladas e suas regras. O jogador escolhe uma. As opções não são contas reais nem pacotes de outros jogadores.

```text
Desbloquear nó
→ Ver três ofertas fixadas pela definição
→ Inspecionar em 3D
→ Selecionar
→ Confirmar a impressão
→ Creditar uma cópia e concluir o nó na mesma transação
→ Atualizar mapa e coleção
```

A escolha é explícita, sem moeda, sem carta escondida e sem custo de entrada. As opções são fixas por nó, não mudam com recarregamento.

### 22.2. Persistência

`choiceNodeId` e `selectedPrintingId` geram um recibo único, com chave de concessão `discovery:{campaignId}:{nodeId}` (seção 24.5). Depois de confirmar, o nó permanece concluído. Reabrir apresenta a escolha feita.

As alternativas não escolhidas ficam disponíveis no Empório **permanentemente** a partir da confirmação da Descoberta, como cartas dirigidas; itens do Empório não expiram (seção 23.1). A escolha favorece a descoberta, não cria uma carta necessária permanentemente perdida.

### 22.3. Apresentação

Três pedestais e cartas frontais; hover ou foco eleva uma delas. No modo compacto, usar uma carta central e seletores laterais HTML. Sempre exibir “Você receberá 1 destas 3 cartas”, não “Receber todas”.

---

<a id="gameplay-23"></a>

## 🏪 23. Empório, adversários e substituição do social

### 23.1. Empório funcional

É uma loja interna do jogo com Créditos, não uma loja demonstrativa esperando pagamento real. Categorias: pacotes de capítulo, cartas dirigidas, sleeves, moedas e tapetes.

Itens não expiram e estoques funcionais não giram com a data. Capítulos desbloqueiam catálogo adicional. Cartas-chave para o caminho principal também têm obtenção garantida por progresso ou deck de apoio.

### 23.2. Compra atômica

Validar item e desbloqueio, conferir saldo, debitar Créditos, conceder item, gerar recibo e confirmar tudo na mesma transação local. Um duplo clique não compra duas vezes a menos que sejam duas confirmações distintas.

A prévia 3D de um tapete ou sleeve não efetiva compra. Aplicar cosmético é outra operação, sem alterar regras.

### 23.3. Sem negociação entre perfis

Não há amigos, convites, troca P2P, ofertas pendentes, presença ou chat. Exportar/importar decks compartilha somente uma lista: nunca transfere inventário.

O Caderno de Adversários mostra personagens locais, encontro de origem, estilo de deck, dicas desbloqueadas e recordes do perfil. Identificar todos como personagens controlados por IA.

### 23.4. Coleção pessoal

Fichários e expositores têm somente visibilidade local. Não implementar seletores “público/amigos” que não possuem serviço correspondente. Exportação manual de imagem ou arquivo é permitida e não depende de rede.

---

<a id="gameplay-24"></a>

## 🏆 24. Campanha, desafios e progressão permanente

O conteúdo completo está em `campanha.md`. Os números abaixo são **metas autorais de escopo**, não conteúdo implementado nem descrição de um modo oficial.

### 24.1. Estrutura planejada

Prólogo com 6 tutoriais, 6 capítulos com 6 nós cada e final com 3 duelos: **45 nós**. Destes, **39 são batalhas ou puzzles de batalha** e **6 são Descobertas**. A rota principal exige 27 vitórias, contando os seis tutoriais; não exige concluir os objetivos opcionais.

### 24.2. Modos disponíveis

| Modo | Progresso | Recompensa |
|---|---|---|
| Campanha | Avança história, capítulos e medalhas. | Primeira vitória, objetivos e recompensas elegíveis. |
| Puzzle tático | Resolve cenário preparado. | Prêmio único de conclusão e objetivos definidos. |
| Arena de Revanche | Registro local de vitórias, sem desbloquear chefes não vencidos. | Créditos repetíveis por vitória. |
| Treino de deck | Sem progresso de campanha. | Nenhuma. |
| Tutorial repetido | Aprendizado, sem repetir prêmio inicial. | Nenhuma adicional. |
| Laboratório | Estado alterável, separado do perfil normal. | Nenhuma. |

Não existem temporada, ranking global ou eventos com prazo. Dificuldades História, Padrão e Especialista alteram políticas de IA e/ou listas publicadas, nunca resultados de moeda.

### 24.3. Objetivos

Cada batalha normal pode ter três objetivos: vencer, executar uma estratégia, cumprir uma restrição opcional. Registrar cada um por ID. Objetivos opcionais concluídos em vitórias diferentes acumulam por união; não precisam ocorrer todos numa única tentativa.

Um objetivo declara `requiresVictory`, condição de entrada quando existir, contador de turno próprio/global, elegibilidade de decks de apoio e definição exata do evento observado.

Objetivos opcionais incompatíveis geram aviso, não bloqueio de entrada. Requisitos obrigatórios precisam ser satisfazíveis com recursos já garantidos antes do encontro.

### 24.4. Desbloqueios

Pré-requisitos são um grafo acíclico validado. Concluir um chefe libera o próximo capítulo. Trilha visual e coordenadas do mapa não determinam dependência.

Derrota não perde cartas nem cobra recurso. Uma tentativa reiniciada cria outro `attemptId`; retomar uma tentativa mantém o mesmo RNG. Não há prêmio por repetir indefinidamente uma tentativa idêntica carregada.

### 24.5. Recompensas e fechamento

Após um resultado terminal, uma única transação finaliza a partida, avalia objetivos, concede recompensas e registra nós liberados. Não depender de clicar na tela de vitória para receber a primeira recompensa.

Prêmio que exige escolher uma carta registra o direito ao prêmio no resultado; a carta é creditada depois, numa operação de escolha única e retomável. A concessão não pode depender de escolher antes de fechar a tela.

Recompensas apresentadas como “Recebidas” já foram creditadas. O botão final chama-se “Continuar”, não “Resgatar” uma segunda vez.

**[DP]** Cada concessão tem uma chave de idempotência única dentro do perfil. O perfil é coluna da concessão, não parte da chave; a versão de conteúdo nunca entra na chave, portanto atualizar a campanha não repete uma primeira vitória já concedida.

| Concessão | Chave |
|---|---|
| Onboarding do perfil | `onboarding:{campaignId}` |
| Primeira conclusão de nó | `first-clear:{campaignId}:{nodeId}` |
| Objetivo opcional | `objective:{campaignId}:{objectiveId}` |
| Descoberta | `discovery:{campaignId}:{nodeId}` |
| Abertura de pacote | `opening:{openingId}` |
| Cosmético de marco | `cosmetic:{milestoneId}:{cosmeticId}` |
| Concessão local CUSTOM | `custom-grant:{printingId}:{grantBatchId}` |

Tabela normativa e unicidade no banco: [persistência §13](persistencia-sqlite.md#sqlite-13).

### 24.6. Estados

```text
LOCKED → AVAILABLE → IN_PROGRESS → CLEARED → MASTERED
```

A sequência acima descreve a experiência de primeira conclusão. `IN_PROGRESS` é um marcador de tentativa separado do progresso histórico. `CLEARED` registra vitória/conclusão; `MASTERED` registra todos os objetivos aplicáveis. Repetir não apaga o estado anterior. Uma derrota encerra a tentativa e deixa o nó disponível ou concluído, conforme seu histórico.

### 24.7. Mapa Three.js

Cada capítulo é um pequeno diorama com nós selecionáveis. A posição influencia apenas navegação. Botão HTML “Ver lista” oferece exatamente os mesmos encontros, desbloqueios e ações sem depender de câmera.

---

<a id="gameplay-25"></a>

## 🤖 25. IA local, dificuldade e justiça

### 25.1. Sem serviços externos

A IA é um algoritmo local, não uma chamada a LLM, API ou modelo em nuvem. Executá-la em Web Worker para não competir com a interação e a renderização Three.js.

A política recebe sua própria mão, informações públicas, contagens permitidas e memória do que foi revelado. Não recebe a mão do humano, cartas futuras, semente de combate nem o save completo.

### 25.2. Contrato

```text
getObservation(fullState, npcId)
→ enumerateLegalCandidates(observation)
→ chooseAction(observation, policyConfig, independentAiRng)
→ validateAction(fullState, action)
→ applyAction(fullState, action, battleRng)
```

O enumerador usa somente dados que a IA pode conhecer. A validação final usa o estado real. Simulações internas usam amostras hipotéticas das informações ocultas, não a ordem verdadeira do baralho.

### 25.3. Dificuldades

| Perfil | Comportamento |
|---|---|
| História | Heurística curta, tolerância a escolhas subótimas, dicas disponíveis ao humano. |
| Padrão | Sequências de ações, risco de pontos e planejamento de evolução. |
| Especialista | Busca mais ampla, amostragem de estados plausíveis e gestão de recursos. |

**Agressividade (conteúdo 3.5.0, decisão do autor de 18/10/2026).** Em todas as dificuldades o adversário joga para atacar; a dificuldade muda a qualidade das escolhas, não a vontade de atacar. Peso `aggression` do perfil ([campanha §14.1](campanha.md#campanha-14)):

- **Ritmo do ataque:** a linha que termina num ataque que afetou o adversário (dano, Nocaute ou Condição nova no Ativo) ganha um bônus proporcional ao dano pelo HP e pelos pontos em jogo. Ataque que não afeta o adversário não ganha nada.
- **Ativo ocioso:** terminar o turno com um Ativo que não ataca nem com a próxima Energia custa pontos de avaliação.
- **Recuo com propósito:** com ataque disponível, recuar para um Pokémon que não ataca neste turno fica fora da busca, salvo quando o Nocaute do Ativo entregaria a partida. Quem recua e encerra sem atacar paga uma penalidade; recuar para atacar com o substituto continua livre.
- **Ameaça de troca:** a avaliação conta o reserva que o adversário traz pelo Recuo no turno dele. Nocautear um Ativo fraco não parece pior só por promover o atacante forte do Banco.
- **História:** o passo único compara uma jogada que tira o ataque do turno com o melhor ataque, não com encerrar o turno.
- **Erro tolerado (História e Padrão):** nunca é passivo — o sorteio não escolhe encerrar o turno nem recuar no lugar da melhor ação.

Evoluir o Ativo para um estágio que ainda não paga o ataque continua sendo decisão da avaliação (ex.: um Básico prestes a cair evolui para sobreviver).

No caminho principal, escolher História continua concedendo desbloqueios e cartas essenciais. Especialista adiciona recordes e objetivos opcionais, não conteúdo necessário para continuar.

Mudanças de dificuldade valem para a próxima tentativa. O snapshot não muda no meio do duelo.

### 25.4. Orçamento reproduzível

Usar orçamento determinístico de candidatos/nós para decisões reproduzíveis. Tempo de parede é apenas watchdog contra travamento. A política retorna a melhor ação legal conhecida se atingir o orçamento.

Registrar a ação escolhida; ao retomar, não recalcular uma ação da IA já confirmada. Resultados atrasados de jobs com revisão antiga são descartados.

### 25.5. Pausa

Ao pausar, invalidar o job atual por `jobId`/revisão ou suspender sua aplicação. Um worker não pode executar uma ação depois de o humano já ter saído para o menu.

Uma política de fallback sempre deve conseguir passar, escolher um alvo obrigatório ou realizar outra ação legal quando existir. Ausência de ação válida durante uma decisão obrigatória é erro de conteúdo, não vitória gratuita do bot.

### 25.6. Chefes e scripts

Identidade de chefe vem do deck, de suas prioridades e de regras do cenário anunciadas no briefing. Sem compra secreta da carta perfeita, HP escondido ou moeda manipulada.

Scripts determinísticos são permitidos nos puzzles e tutoriais identificados como cenários preparados. Não fingir que são sorteios normais.

### 25.7. Auto-battle

Adiado como extensão local, permitida apenas em treino e Arena mediante implementação e política explícita de elegibilidade. Nesta versão, a campanha é manual. Não inserir um botão sem controlador real nem usar autoplay para concluir objetivos da campanha.

---

<a id="gameplay-26"></a>

## 🖥️ 26. Contrato do gameplay com Three.js

### 26.1. Responsabilidades

| Camada | Decide |
|---|---|
| Motor | Cartas legais, alvos, custos, dano, sorteios, turnos e resultado. |
| Campanha | Encontro, premiação e desbloqueios. |
| Persistência | Revisão confirmada, recibo e checkpoint recuperável. |
| Three.js | Geometria, materiais, câmera, luz, projeção e animação. |
| HTML/CSS | Menus, texto de regras, filtros, botões, diálogos e acessibilidade. |

Não importar Three.js em `domain/` ou `campaign/`. Malhas carregam apenas IDs para associação; não são entidades de regras.

### 26.2. Eventos visuais

| Evento do motor | Apresentação 3D |
|---|---|
| `CARD_DRAWN` | Mover representação do topo do deck até a mão autorizada. |
| `POKEMON_ENTERED` | Assentar a carta no slot escolhido. |
| `POKEMON_EVOLVED` | Deslizar nova carta sobre a pilha, preservando anexos visuais. |
| `ENERGY_ATTACHED` | Mover ficha até o Pokémon; atualizar contador. |
| `ATTACK_DECLARED` | Realçar origem e alvo; impulso curto da carta. |
| `COIN_RESOLVED` | Mostrar rotação até a face já decidida. |
| `DAMAGE_APPLIED` | Pulso no alvo e número HTML associado. |
| `POKEMON_KNOCKED_OUT` | Encaminhar pilha e anexos aos destinos lógicos corretos. |
| `MATCH_ENDED` | Enquadrar mesa e abrir resumo; sem crédito adicional. |
| `CAMPAIGN_NODE_UNLOCKED` | Revelar conexão e marcador no diorama. |

Nome de evento é contrato proposto. Seu payload deve indicar identidades, versão e grupo de resolução.

### 26.3. Animação atrasada

O renderizador pode estar representando eventos já comprometidos. Bloquear comandos incompatíveis até apresentar ou pular a sequência e reconciliar com o estado confirmado.

Pular altera apenas `presentationCursor`. Nunca chamar `applyAction` outra vez para acelerar. Em perda de contexto, reconstruir a cena a partir do último estado; não desfazer a batalha.

### 26.4. Seleção

Raycast encontra o ID visual; o motor confirma se ele é um alvo legal. Arrastar a carta sobre a posição adversária não autoriza jogá-la ali. Alternativa por clique/teclado usa o mesmo comando.

### 26.5. Fora do combate

Todos os módulos adotam a mesma separação: a rotação do pacote, a seleção de um nó no mapa ou a prévia 3D do deck não podem alterar posse, desbloqueio ou saldo sem uma ação de domínio confirmada.


### 26.6. Comprar, revelar, adquirir e jogar não são o mesmo evento

`CARD_DRAWN` move uma carta do baralho para a mão durante o duelo. `CARD_REVEALED` altera temporariamente a informação visível. `POKEMON_ENTERED` confirma a entrada em campo. `PACK_OPENING_COMMITTED` concede cartas à coleção fora da batalha.

A cena nunca cria uma carta adicional por executar uma dessas animações. Mão cheia ou baralho vazio não produzem um evento fictício de compra. Uma busca e uma compra podem terminar na mesma zona, mas seus efeitos, ordem e informação revelada são os definidos pelo motor.

### 26.7. Privacidade das apresentações

Compra adversária mostra apenas verso uniforme, quantidade e movimento neutro. A frente, a raridade, o áudio especial e o flair só podem aparecer depois de um evento que torne a identidade pública.

Uma prévia de ataque usa informações autorizadas e apresenta incerteza antes de moedas. O renderer não recebe resultados futuros para sugerir um valor definitivo. Após embaralhamento, não manter marcadores que permitam rastrear uma carta oculta.

### 26.8. Lotes, pausa e resumo terminal

Publicar eventos confirmados agrupados, com sequência, versão, identidades visíveis e barreira de decisão. O diretor de animações representa o lote; o motor não espera uma colisão gráfica para aplicar dano.

Pular a apresentação ou alternar velocidade não reexecuta ações, não muda streams aleatórios e não elimina escolhas obrigatórias. Movimento reduzido troca a coreografia, não o resultado. Ao pausar, suspender o consumo visual e os novos comandos da IA nos pontos seguros definidos pelo runtime.

Nocautes simultâneos e efeitos reativos são apresentados como parte do grupo resolvido. `MATCH_ENDED` só leva ao resultado depois de todas as consequências pertinentes. O recibo de recompensa não é um callback de “animação de vitória concluída”.

### 26.9. Inspeção e oficina sem efeitos de jogo

Abrir inspector, girar uma carta, experimentar um tapete ou testar um ataque em fixture visual não consome Apoiador, Energia, Créditos ou recompensa. A oficina usa fixtures isoladas, não aplica ataques de demonstração na tentativa suspensa.

Replays e retomadas não repetem o som de desbloqueio para conceder novamente um acessório. Um evento visual de entrada pode ser visto outra vez num replay, sem se tornar uma nova entrada do ponto de vista das regras.

### 26.10. Direção visual 3.1 sem alteração de regras

O campo, a paleta e a arte passam a seguir [Pocket Light](direcao-visual-pocket.md), incluindo compra curta, cut-in de ataque, pontos em três discos e revelação de pacote por pilha. Isso não modifica `local-campaign-v2`.

Os conceitos escuros gerados anteriormente não fornecem regras: não importar cartas de Energia para o baralho, mana de invocação, Resistência genérica, cinco espaços de criatura ou contadores acima do deck de 20.

Eventos públicos/privados continuam filtrados. Raridade, ex, foil, flair e playmat são eixos diferentes. Uma imagem com “Turno do oponente” não justifica habilitar ataque humano.

---

<a id="gameplay-27"></a>

## 🏗️ 27. Arquitetura funcional exclusivamente local

### 27.1. Fluxo

```text
HTML / entrada Three.js
→ Controlador local de comandos
→ Motor puro + serviços de campanha/economia
→ Transação SQLite
→ Estado confirmado + recibos
→ Projeções para humano e IA
→ Eventos de apresentação
→ Three.js + HUD HTML
```

Não há autenticação, WebSocket, matchmaking ou backend. O servidor estático local não executa regras e não armazena a coleção.

### 27.2. Funções centrais

```text
getLegalActions(state, playerId)
validateAction(state, action)
applyAction(state, action, randomSource)
getPlayerView(state, playerId)
checkTerminalState(state)
evaluateObjectives(matchSnapshot, events, objectiveDefinitions)
computeUnlocks(campaignProgress, campaignDefinition)
prepareRewardTransaction(result, profileSnapshot)
buildPresentationEvents(domainEvents, viewerId)
```

### 27.3. Determinismo e RNG

Separar fluxos de RNG de batalha, economia, IA e decoração. Mover o mouse, gerar partículas ou abrir o mapa não consome aleatoriedade de pacotes.

**[DP]** Algoritmo normativo `rng-v1` (campo `rngAlgorithm` do ruleset). Toda aritmética é em `uint32`, módulo 2^32.

| Aspecto | Contrato |
|---|---|
| Gerador | xoshiro128** de 32 bits; estado de quatro `uint32` `[s0, s1, s2, s3]`. |
| Semeadura | Semente `uint32`; quatro chamadas sucessivas de SplitMix32 preenchem `s0`…`s3`, nessa ordem. O estado resultante nunca é todo zero. |
| Inteiro uniforme `[0, n)` | Rejeição sobre `uint32`: `limite = 2^32 − (2^32 mod n)`; sortear `v` até `v < limite`; devolver `v mod n`. Sem viés de módulo. Sempre consome ao menos um `uint32`, inclusive com `n = 1`. |
| Moeda | Próximo `uint32 < 2^31` → cara; senão, coroa. |
| Embaralhar | Fisher–Yates do último índice até 1: `j = uniformInt(i + 1)`; trocar as posições `i` e `j`. |
| Sorteio ponderado | Pesos inteiros positivos na ordem declarada; `r = uniformInt(pesoTotal)`; escolher o primeiro item cujo peso acumulado é maior que `r`. |
| Serialização | `{"algorithm":"rng-v1","state":[u32,u32,u32,u32],"draws":n}`; `draws` conta os `uint32` consumidos desde a semeadura. |

```text
splitmix32(x):           // x é o estado do SplitMix32, iniciado com a semente
  x ← x + 0x9E3779B9
  z ← x
  z ← (z XOR (z >>> 16)) × 0x85EBCA6B
  z ← (z XOR (z >>> 13)) × 0xC2B2AE35
  devolver z XOR (z >>> 16)

next():                  // xoshiro128**
  resultado ← rotl(s1 × 5, 7) × 9
  t ← s1 << 9
  s2 ← s2 XOR s0;  s3 ← s3 XOR s1
  s1 ← s1 XOR s2;  s0 ← s0 XOR s3
  s2 ← s2 XOR t
  s3 ← rotl(s3, 11)
  devolver resultado
```

| Stream | Escopo | Semente |
|---|---|---|
| `seedRng` | Perfil; só gera sementes. | `crypto.getRandomValues` na criação do perfil. |
| `economyRng` | Perfil; pacotes e concessões aleatórias. | `crypto.getRandomValues` na criação do perfil. |
| `battleRng` | Tentativa; moedas, embaralhamentos, buscas aleatórias e Zona de Energia. | Próximo `uint32` de `seedRng` ao criar a tentativa, gravado nela. |
| `aiRng` | Tentativa; desempates e amostras da IA. | `uint32` seguinte de `seedRng`, gravado na tentativa. |
| `visualRng` | Apresentação; nunca é fonte de verdade. | Livre; fixa apenas em testes visuais. |

Cada stream tem estado próprio; consumir um nunca avança outro. Tutoriais e puzzles declaram suas sementes na fixture. Persistir o estado serializado de cada stream funcional na mesma transação da operação que o consumiu. Resultados já confirmados permanecem iguais ao recarregar. Exportar um save permite ao proprietário inspecionar dados locais; não prometer anti-cheat inviolável.

### 27.4. Serialização das ações

Por perfil, somente uma operação de escrita em voo. Cada comando usa `actionId` e `expectedStateVersion`. Comando repetido retorna o recibo conhecido. Revisão divergente exige recarregar o estado local antes de tentar outra ação.

### 27.5. Decisões pendentes

Guardar tipo, controlador, opções elegíveis ou descrição regenerável, cardinalidade, contexto de efeito e continuação. Sem timeouts normais na campanha.

### 27.6. Catálogo

Cartas e efeitos são dados estruturados. Não usar `eval`, geração remota ou interpretação de texto por IA durante o jogo. Opcode desconhecido bloqueia a definição com erro de conteúdo.

### 27.7. Referência técnica

A persistência SQLite, transações, schema e migrações estão em [persistencia-sqlite.md](persistencia-sqlite.md). Web Worker, distribuição local, perdas de contexto e renderer estão em `runtime-offline-threejs.md`. Estes são requisitos do produto final, não simplificações provisórias do protótipo.

---

<a id="gameplay-28"></a>

## 🗃️ 28. Esquemas de dados de referência

### 28.1. Carta fictícia

```json
{
  "dataVersion": 2,
  "effectsDsl": 1,
  "id": "card-braseiro-001",
  "version": 1,
  "baseName": "Braseiro",
  "name": "Braseiro",
  "deckLimitKey": "braseiro",
  "category": "POKEMON",
  "stage": "STAGE_1",
  "evolvesFrom": [
    "faisca"
  ],
  "types": [
    "FIRE"
  ],
  "baseHp": 110,
  "retreatCost": 1,
  "weakness": {
    "type": "WATER",
    "operation": "ADD",
    "value": 20
  },
  "ruleBox": "NONE",
  "knockoutPoints": 1,
  "tags": [],
  "attacks": [
    {
      "id": "flame-strike",
      "name": "Golpe de Chama",
      "energyCost": {
        "FIRE": 1
      },
      "baseDamage": 40,
      "damageFormula": null,
      "damageTarget": {
        "scope": "OPPONENT_ACTIVE"
      },
      "preconditions": [],
      "additionalCosts": [],
      "effects": [],
      "endsTurn": true
    }
  ],
  "abilities": []
}
```

O schema estrutural é [card-definition.schema.json](schemas/card-definition.schema.json); `name` é derivado de `baseName` + `ruleBox` e `deckLimitKey` usa o algoritmo `deck-limit-key-v2` ([persistência §9](persistencia-sqlite.md#sqlite-9); “Nidoran♀” e “Nidoran♂” têm chaves distintas).

### 28.2. Entidade de campo

```json
{
  "instanceId": "pokemon-a-01",
  "ownerId": "player-a",
  "controllerId": "player-a",
  "position": "ACTIVE",
  "evolutionStack": ["battle-card-004", "battle-card-012"],
  "damage": 30,
  "attachedEnergyIds": ["energy-001", "energy-003"],
  "attachedToolId": null,
  "conditions": {
    "poisoned": false,
    "burned": false,
    "controlCondition": null
  },
  "enteredPlayOnTurn": 0,
  "lastEvolvedOnTurn": 3,
  "temporaryEffectIds": [],
  "usageMarkers": []
}
```

### 28.3. Comando

```json
{
  "actionId": "action-0182",
  "matchId": "match-0041",
  "expectedStateVersion": 27,
  "type": "ATTACK",
  "payload": {
    "pokemonInstanceId": "pokemon-a-01",
    "attackId": "flame-strike",
    "targets": ["pokemon-b-01"]
  }
}
```

O controlador local associa o comando ao perfil e participante ativos. Não existe sessão autenticada remota. A IA não pode enviar comandos pelo humano.

Um ataque de evolução anterior (seção 12.10) acrescenta ao comando a carta dona do ataque (`sourceCardId`, no motor). A decisão de escolha entre opções nomeadas (`SELECT_MODE`) traz também o texto de cada opção (`labels`), gerado do DSL ([efeitos-dsl.md §13.2](efeitos-dsl.md#dsl-13)).

### 28.4. Decisão

```json
{
  "decisionId": "decision-009",
  "type": "SELECT_POKEMON",
  "playerId": "player-b",
  "reason": "REPLACE_KNOCKED_OUT_ACTIVE",
  "minimumSelections": 1,
  "maximumSelections": 1,
  "eligibleTargets": ["pokemon-b-02", "pokemon-b-03"]
}
```

### 28.5. Operações

Blocos de efeito no formato do [DSL](efeitos-dsl.md#dsl-2):

```json
{
  "id": "bench-hit",
  "timing": "POST_DAMAGE",
  "failurePolicy": "BEST_EFFORT",
  "operation": {
    "type": "DEAL_DAMAGE",
    "target": {
      "scope": "OPPONENT_BENCH",
      "pick": {
        "mode": "CHOOSE",
        "chooser": "CONTROLLER",
        "min": 1,
        "max": 1
      }
    },
    "amount": 20,
    "category": "ATTACK",
    "applyWeakness": false
  }
}
```

```json
{
  "id": "zone-boost",
  "timing": "ON_PLAY",
  "failurePolicy": "REQUIRE_ANY",
  "operation": {
    "type": "ATTACH_ENERGY",
    "target": {
      "scope": "OWN_POKEMON",
      "filter": {
        "types": [
          "PSYCHIC"
        ]
      },
      "pick": {
        "mode": "CHOOSE",
        "chooser": "CONTROLLER",
        "min": 1,
        "max": 1
      }
    },
    "energyType": "PSYCHIC",
    "count": 1,
    "source": "GENERATED",
    "consumesManualAttachment": false,
    "consumesReadyEnergy": false
  }
}
```

### 28.6. Estado da partida

Incluir ID, versão, ruleset, catálogo, fase, turno, jogadores, zonas, Estádio, fila de efeitos, decisões, marcadores de uso, aleatoriedade, relógios, eventos e resultado.

Não guardar um `currentHp` autoritativo independente do dano e HP máximo efetivo.

### 28.7. Metadados locais da tentativa

```json
{
  "attemptId": "attempt-c02-e06-003",
  "profileId": "profile-001",
  "campaignId": "circuito-dos-arquivos-v1",
  "nodeId": "C02-E06",
  "difficulty": "STANDARD",
  "rulesetId": "local-campaign-v2",
  "catalogVersion": "base-1.0.0",
  "campaignVersion": "1.0.0",
  "npcDeckId": "npc-c02-boss-standard",
  "aiPolicyVersion": "policy-1",
  "status": "SUSPENDED",
  "stateVersion": 27,
  "pendingDecisionId": "decision-009",
  "rewardStatus": "NOT_TERMINAL",
  "activePlayMilliseconds": 148000
}
```

Este é um fragmento de esquema; o save completo inclui snapshots, RNG, recibos e estado das zonas. Não é uma fixture de partida executável.

### 28.8. Vínculo visual sem regra embutida

```json
{
  "printingId": "print-braseiro-holo-001",
  "cardDefinitionId": "card-braseiro-001",
  "cardDefinitionVersion": 1,
  "appearanceVersion": 1,
  "finish": "HOLOGRAPHIC",
  "rarity": "UNCOMMON",
  "language": "pt-BR",
  "templateId": "pocket-light-card-v1/pokemon-classic",
  "setId": "base",
  "collectorNumber": "002",
  "artist": null,
  "artMode": "TEMPLATE_ONLY",
  "artKey": null,
  "artAssetId": null,
  "crop": {
    "x": 0,
    "y": 0,
    "width": 1,
    "height": 1
  },
  "artTransform": {
    "scale": 1,
    "offsetX": 0,
    "offsetY": 0,
    "rotationDegrees": 0,
    "mirrorIllustration": false,
    "exposure": 0
  },
  "finishSettings": {
    "presetId": "holo-soft-art",
    "intensity": 0.45,
    "roughness": 0.4,
    "metalness": 0.2,
    "maskMode": "ART_WINDOW",
    "protectText": true
  },
  "variant": {
    "shiny": false,
    "immersiveSceneId": null
  },
  "assetBindings": []
}
```

`TEMPLATE_ONLY` é a impressão sem ilustração: moldura, nome e dados compostos pelo template, com placeholder tipado na janela de arte. Quando a arte do catálogo base for produzida, a impressão referencia um `artKey` lógico resolvido pelo `dist/manifest.json`; arte importada pelo usuário usa `artAssetId` (BLOB SHA-256). Schema: [card-printing.schema.json](schemas/card-printing.schema.json). Uma impressão não pode conter código de shader arbitrário nem endereço remoto.


---

<a id="gameplay-29"></a>

## 🧾 29. Autosave, checkpoints, exportação e integridade

### 29.1. O que fica salvo

Perfil, coleção, carteira, decks confirmados e rascunhos, campanha, preferências, histórico de recibos, tentativa ativa, decisões pendentes e estado de RNG. Transformações de câmera e animações não são fontes de verdade.

### 29.2. Pontos de salvamento

Salvar ao criar perfil, confirmar deck, iniciar tentativa, confirmar preparação, resolver cada ação ou fronteira com decisão pendente, pausar, concluir encontro, abrir pacote e comprar item.

O indicador “Salvo” só aparece após conclusão da transação. `beforeunload` não é a estratégia principal de salvamento. O navegador pode encerrar sem permitir uma última escrita.

### 29.3. Pausar e sair

Concluir uma unidade atômica que já iniciou, salvar checkpoint e colocar sessão em `SUSPENDED`. Uma decisão obrigatória permanece nela. Abrir menu pausa bot e simulação; efeitos visuais podem parar ou saltar ao estado estável.

Ao voltar, reconstruir cena e HUD; não repetir ganhos nem sortear outra mão. Sem penalidade por tempo ausente.

### 29.4. Backups


Exportar banco completo `.sqlite3` ou perfil portátil `.campaign-profile.zip` formato 4, com dependências versionadas e mídia importada. Nota histórica: não há conversor de saves JSON formatos 2/3, porque nenhuma implementação 2.x existiu; não há saves legados a importar nesta linha.

Importação valida tudo em staging. Perfil portátil cria um perfil novo por padrão; backup completo da instalação exige confirmação especial. Não misturar saldos nem confiar em SQL de arquivo externo. Ver [persistência](persistencia-sqlite.md#sqlite-23).

### 29.5. Limites reais

Armazenamento do navegador pode ser removido pelo usuário, sofrer restrição de quota ou ser temporário em navegação privada. Persistência solicitada não é garantia absoluta. O pacote técnico define diagnóstico e exportação manual; não promete recuperar dados apagados sem backup.

### 29.6. Duas abas


Uma única aba/Storage Worker é proprietária do banco de toda a origem. A segunda aba não abre outra conexão “só para ler”; apresenta aviso. Revisões por perfil e tentativa continuam obrigatórias. Ver [concorrência SQLite](persistencia-sqlite.md#sqlite-20).

### 29.7. Invariantes

```text
Cada carta de batalha ocupa uma única zona.
Cada energia pertence a um único local.
Cada nó registra suas recompensas únicas uma vez.
Cada ação confirmada tem no máximo um recibo.
Cada tentativa tem no máximo um resultado terminal.
A mesma conclusão não credita carteira duas vezes.
A IA nunca aplica comando por outro participante.
Uma migração malsucedida não apaga o save anterior.
Trocar aparência 3D não altera regras, inventário ou campanha.
```

### 29.8. Atualizações locais

Atualizar somente em ponto seguro, mantendo versões de conteúdo exigidas por tentativas/replays existentes. Não abrir a rede para “corrigir” um asset ausente. Uma atualização é um novo pacote local instalado conscientemente.

---

<a id="gameplay-30"></a>

## 🚨 30. Erros e mensagens funcionais

| Código | Mensagem sugerida |
|---|---|
| `DECK_SIZE_INVALID` | O deck precisa conter exatamente 20 cartas. |
| `DECK_COPY_LIMIT_EXCEEDED` | O limite para este nome de carta foi excedido. |
| `DECK_REQUIRES_BASIC` | Inclua pelo menos um Básico elegível. |
| `CARD_NOT_OWNED` | Você não possui cópias suficientes desta carta. |
| `CARD_EFFECT_UNSUPPORTED` | Esta carta ainda não está disponível neste modo. |
| `NOT_YOUR_TURN` | Aguarde seu turno. |
| `PENDING_DECISION` | Conclua a escolha atual antes de outra ação. |
| `INVALID_TARGET` | Este alvo não pode receber esse efeito. |
| `INSUFFICIENT_ENERGY` | A Energia atual não atende ao custo. |
| `EVOLUTION_TOO_EARLY` | Este Pokémon ainda não pode evoluir. |
| `BENCH_FULL` | Seu Banco já possui três Pokémon. |
| `SUPPORTER_ALREADY_USED` | Você já usou um Apoiador neste turno. |
| `RETREAT_ALREADY_USED` | Você já recuou normalmente neste turno. |
| `SPECIAL_CONDITION_BLOCKS_ACTION` | A condição atual impede esta ação. |
| `STATE_VERSION_MISMATCH` | O estado mudou; atualizando a partida. |
| `MATCH_ALREADY_FINISHED` | Esta partida já foi encerrada. |
| `TRANSACTION_ALREADY_PROCESSED` | A operação já foi concluída; recuperando resultado. |

Erro de gravação e ação ilegal devem ter tratamentos diferentes. Não culpar o jogador por falha de armazenamento, arquivo ausente ou GPU.

| Código local | Mensagem sugerida |
|---|---|
| `SAVE_WRITE_FAILED` | Não foi possível salvar. O progresso não está confirmado. |
| `STORAGE_FULL` | Falta espaço local. Exporte seu save antes de liberar recursos. |
| `PROFILE_LOCKED` | Este perfil está aberto para edição em outra aba. |
| `SAVE_VERSION_UNSUPPORTED` | Este save exige uma versão compatível do jogo. |
| `CONTENT_BUNDLE_MISSING` | Um arquivo do pacote local está ausente ou inválido. |
| `ACTIVE_ATTEMPT_EXISTS` | Retome ou abandone a tentativa atual antes de iniciar outra. |
| `NODE_LOCKED` | Conclua o requisito indicado para acessar este encontro. |
| `REWARD_ALREADY_GRANTED` | Recompensa já recebida; exibindo o recibo. |
| `GPU_CONTEXT_LOST` | Renderização interrompida. A partida está preservada. |
| `AI_JOB_STALE` | Decisão antiga da IA descartada; retomando o estado atual. |
| `INSUFFICIENT_CREDITS` | Créditos insuficientes para esta compra. |
| `EFFECT_LOOP_DETECTED` | Uma carta produziu uma cadeia de efeitos sem fim; a partida foi preservada e o conteúdo será marcado como inválido. |
| `INTERNAL_INTEGRITY_ERROR` | Erro interno de integridade; nada foi alterado. Gere o diagnóstico local. |


---

<a id="gameplay-31"></a>

## ✅ 31. Matriz de testes de aceitação

| ID | Cenário | Resultado esperado |
|---|---|---|
| G-001 | Deck de 19 ou 21 cartas | Bloqueia entrada normal. |
| G-002 | Três cópias do mesmo nome com artes distintas | Bloqueia. |
| G-003 | Deck sem Básico elegível | Bloqueia. |
| G-004 | Apenas Fósseis como abertura | Não satisfaz Básico. |
| G-005 | Milhares de mãos válidas sorteadas | Todas possuem Básico. |
| G-006 | Primeiro jogador na abertura | Sem Energia normal. |
| G-007 | Ataque sem custo na abertura | Permitido quando legal. |
| G-008 | Primeiro turno próprio do segundo jogador | Evolução normal bloqueada. |
| G-009 | Básico colocado neste turno | Não evolui normalmente. |
| G-010 | Evolução com dano | Dano preservado. |
| G-011 | Duas evoluções normais da mesma linha no turno | Bloqueia segunda. |
| G-012 | Ataque comum | Energia permanece. |
| G-013 | Custo Incolor com outro tipo | Aceita. |
| G-014 | Fornecimento duplicado por aura | Não duplica anexos. |
| G-015 | Aura de Energia removida | Recalcula custo. |
| G-016 | Segunda ligação manual | Bloqueia. |
| G-017 | Ligação extra por efeito | Não consome manual sem instrução. |
| G-018 | Segundo Apoiador | Bloqueia. |
| G-019 | Segundo Recuo normal | Bloqueia. |
| G-020 | Recuo gratuito | Consome uso normal. |
| G-021 | Troca por efeito | Não cobra Recuo indevido. |
| G-022 | Banco cheio | Bloqueia colocação. |
| G-023 | Adormecido | Ataque e Recuo normal bloqueados. |
| G-024 | Paralisado | Respeita duração do afetado. |
| G-025 | Confusão com coroa | Ataque falha, sem dano físico importado. |
| G-026 | Veneno reaplicado | Não acumula cópia. |
| G-027 | Sono depois de Confusão | Substitui condição exclusiva. |
| G-028 | Veneno com Sono | Coexistem. |
| G-029 | Queimadura com recuperação | Dano permanece. |
| G-030 | ex Nocauteado | Pontuação correta. |
| G-031 | Mega ex Nocauteada | Três pontos, não cinco. |
| G-032 | Pontuação ultrapassa três | Vitória. |
| G-033 | Descarte por efeito | Não concede ponto automaticamente. |
| G-034 | Dano próprio e adversário simultâneos | Resolve conjunto antes do resultado. |
| G-035 | Remover bônus de HP | Reavalia Nocaute. |
| G-036 | Mover Energia entre Pokémon | Não dispara ligação da Zona. |
| G-037 | Estádio com mesmo nome | Uso normal bloqueado. |
| G-038 | Estádio substituído | Desativa antigo e ativa novo. |
| G-039 | Efeito atrasado removível, alvo recua | Não executa depois. |
| G-040 | Histórico de Scizor | Considera carta e momento corretos. |
| G-041 | Compra sem baralho | Não perde automaticamente. |
| G-042 | Mão cheia | Aplica política declarada. |
| G-043 | Escolha do adversário no turno atual | Só ele pode responder. |
| G-044 | Comando duplicado | Uma execução. |
| G-045 | Versão incorreta | Ressincroniza sem ação indevida. |
| G-046 | Queda após pacote | Recupera mesmas cartas. |
| G-047 | Compra no Empório interrompida | Carteira e inventário confirmados juntos ou não alterados. |
| G-048 | Resgate duplicado | Um crédito. |
| G-049 | Carta de expansão errada em objetivo | Não conta. |
| G-050 | Replay com mesmos dados | Mesmo resultado. |
| G-051 | UI envia dano arbitrário | Motor local ignora e calcula pelas regras. |
| G-052 | Bot tenta ação ilegal | Rejeita pelo mesmo validador. |
| G-053 | Payload entregue à IA | Não contém mão humana, ordem futura nem semente de batalha. |
| G-054 | Redução de animações | Não altera resultado. |
| G-055 | Evolução mantém Ferramenta | Estado consistente. |
| G-056 | Carta com opcode desconhecido | Não entra em produção. |
| G-057 | Uso de Habilidade e volta ao Banco | Não reseta uso indevido. |
| G-058 | Partida já encerrada | Rejeita novo ataque. |
| G-059 | Cancelar prévia do Empório | Não debita Créditos nem concede item. |
| G-060 | Atualização de catálogo no meio da partida | Usa snapshot original. |

Além de exemplos, executar testes de conservação de cartas, invariantes, distribuição probabilística, fuzzing de ações legais e partidas completas automatizadas.

### 31.1. Aceitação offline e campanha

| ID | Cenário | Resultado esperado |
|---|---|---|
| G-061 | Pacote instalado, internet desconectada, perfil novo | Tutorial e partida completos. |
| G-062 | Relógio do sistema adiantado | Sem pacotes, créditos ou desbloqueios automáticos. |
| G-063 | Pausa durante turno da IA | Nenhuma ação aplicada enquanto suspenso. |
| G-064 | Recarregar com escolha obrigatória | Mesma decisão restaurada. |
| G-065 | Reabrir após moeda | Mesmo resultado confirmado. |
| G-066 | Derrota em chefe | Sem perda de coleção, sem custo de nova tentativa. |
| G-067 | Objetivo opcional incompatível | Batalha válida continua acessível. |
| G-068 | Objetivos em vitórias diferentes | União de objetivos, sem prêmio duplicado. |
| G-069 | Descoberta reaberta | Mesma escolha, sem nova concessão. |
| G-070 | Duas abas tentam abrir um pacote | Uma concessão por operação confirmada. |
| G-071 | Falha ao gravar resultado final | Não mostrar crédito definitivo nem perder tentativa recuperável. |
| G-072 | Importar lista de deck | Não aumenta inventário. |
| G-073 | Importar save inválido | Perfil atual permanece íntegro. |
| G-074 | Mesmas ações em apresentação 2D e 3D | Mesmo hash final de regras. |
| G-075 | Partículas e câmera usadas intensamente | Não alteram RNG de batalha/economia. |
| G-076 | Perda de contexto WebGL | Checkpoint preservado, recuperação ou fallback. |
| G-077 | Especialista | IA melhor, sem HP ou moedas secretamente alterados. |
| G-078 | Capítulo novo nunca visitado | Assets já presentes no pacote; joga sem internet. |
| G-079 | Final concluído | Pós-jogo liberado; coleção preservada. |
| G-080 | Restart versus resume | Restart cria tentativa; resume conserva tentativa e RNG. |



### 🧪 Critérios adicionais da revisão 2.1

| ID | Verificação | Critério |
|---|---|---|
| G-081 | Acessório e regras | Trocar playmat, sleeve ou flair preserva ações legais, dano, distribuição e resultado para o mesmo estado/RNG. |
| G-082 | Playmat e turno | A escolha pendente do outro participante não muda o dono do turno nem dispara TURN_STARTED. |
| G-083 | Compra sem carta | Mão cheia/baralho vazio não emitem compra fictícia para justificar animação. |
| G-084 | Compra adversária | A projeção do evento contém somente dados públicos, sem frente, raridade ou flair identificável. |
| G-085 | Lote pulado | Avançar visualmente não chama applyAction nem consome RNG; mantém a próxima decisão. |
| G-086 | Estádio e superfície | Jogar Estádio muda efeitos de regras sem equipar playmat ou modificar preset. |
| G-087 | Snapshot cosmético | Editar preset durante suspensão só afeta nova tentativa; modo neutro não reescreve snapshot. |
| G-088 | Prévia da oficina | Fixtures de entrada/ataque não concedem cartas, pontos, moedas ou progresso ao perfil. |
| G-089 | IA agressiva | Em toda dificuldade, com ataque disponível o NPC ataca: recua para quem não ataca só para não entregar a vitória e o erro tolerado nunca encerra o turno nem recua; com o catálogo real, ao menos 88% dos turnos do NPC com ataque legal terminam em ataque. |

São critérios planejados de implementação, não resultados de execução de uma aplicação neste pacote.

---

<a id="gameplay-32"></a>

## 🛠️ 32. Implementação por fatias jogáveis

| Etapa | Entrega obrigatória | Gate |
|---|---|---|
| 1 | Motor puro, catálogo mínimo, save versionado e renderer Three.js mínimo. | Duelo com carta 3D real, sem rede, reproduzível por testes. |
| 2 | Perfil local, três decks iniciais, prólogo e recuperação. | Criar save, concluir tutorial, fechar e retomar. |
| 3 | Mapa 3D e um capítulo com seis nós. | Caminho completo: briefing → editor → IA → recompensa → próximo nó. |
| 4 | Pacotes 3D, coleção, Empório e objetivos. | Economia local consistente e aquisição dirigida. |
| 5 | Todos os 45 nós da campanha planejada, Arena e dificuldades. | Grafo alcançável, conteúdo válido e progressão sem sorte obrigatória. |
| 6 | Acabamentos, ambientes e acessibilidade. | Holográfico/cromado legíveis; 720p e perfil Baixo funcionais. |
| 7 | Auditoria offline, exportação/importação, perda de contexto e migração. | Instalação limpa funciona sem internet; nenhum dado perdido nos testes especificados. |

Não adiar todo o 3D para o final: a primeira fatia visual já deve usar Three.js. Em paralelo, o núcleo permanece testável sem canvas.

Não construir primeiro infraestrutura online “para depois desligar”. Conta remota, API de cartas, matchmaking e telemetria estão fora do backlog desta versão.

---

<a id="gameplay-33"></a>

## 📌 33. Decisões fechadas e parâmetros a calibrar

| Tema | Contrato |
|---|---|
| Primeiro jogador | Moeda justa de `battleRng`; fixture em tutoriais e puzzles (seção 7.1). |
| Básico inicial | Distribuição condicionada por rejeição, conforme seção 7. |
| Energia | Oito tipos geráveis, 1–3 por deck, pesos iguais e algoritmo da seção 9.3. |
| Dano | Ordem da seção 12.4 com piso 0; nunca cura. |
| Condições | Só no Ativo; saem ao evoluir ou deixar o Ativo (seção 15). |
| Vitória simultânea | Empate no mesmo checkpoint, inclusive na cadeia de Nocautes por reação (seção 17.6). |
| Nocaute | Duas etapas: anúncio e reações com o Pokémon em campo, depois saída e pontos; “por dano de um ataque” só com dano de ataque do turno corrente (seção 17.2). |
| Ferramenta | Gatilho padrão só com dano de ataque no turno do oponente; restrição de tipo limita o efeito, não a ligação (seção 3.9). |
| Ataques anteriores | Só por regra concedida; o comando informa `sourceCardId` (seção 12.10). |
| Pacotes | Legado A1 por categoria (5 cartas); por símbolo nos sets seguintes (4 a 6 cartas), com pacote raro e 6ª carta na ordem de RNG da seção 20.2. |
| Promoções simultâneas | Escolhas ocultas reveladas juntas (seção 11.3). |
| Mão cheia | Políticas próprias da seção 17.8. |
| Checkup | Sequência própria das seções 15.9 e 16.3. |
| Efeito impossível | Treinador ou Habilidade não jogável; nunca gasto sem efeito (seção 14.4). |
| RNG | `rng-v1`, streams separados e serializáveis (seção 27.3). |
| Decisões | Sem relógio de segundos; pausa real. |
| Limite normal | 60 turnos globais, resolvendo vitória antes de empate por limite. |
| Campanha | Permanente, prólogo + seis capítulos + final; 45 nós planejados. |
| Entrada | Gratuita; derrotas não consomem recursos. |
| Aquisição | Cartas-chave garantidas, pacotes e Empório sem calendário. |
| Online | Fora do escopo, sem rota futura implícita. |
| Renderizador | Three.js no caminho principal, HTML semântico sobreposto. |
| Recursos | Todos locais, sem CDN ou asset remoto em runtime. |
| Saves | SQLite e exportação manual; sem promessa de nuvem. |
| Anti-cheat | Não é objetivo impedir o dono do dispositivo de editar o próprio save. |

Metas de recompensa, dificuldade e desempenho precisam de testes de balanceamento e hardware. Alterações nesses números devem versionar conteúdo; não modificar silenciosamente uma tentativa ativa.

Pontos [PV] preservam a honestidade da comparação com Pocket. O agente implementador deve seguir a decisão própria escrita, não bloquear a criação da campanha esperando uma arbitragem externa.

---

<a id="gameplay-34"></a>

## 📚 34. Referências herdadas e documentação técnica

Referências trazidas da v1 para rastrear a origem das regras [CO]. A consulta originalmente registrada foi em 14 de outubro de 2026; esta revisão não reauditou cada página de Pokémon. Social, troca, temporadas e temporizadores eventualmente descritos nessas fontes NÃO integram o escopo local desta versão. A especificação própria prevalece.

As fontes técnicas de Three.js e APIs do navegador consultadas nesta revisão estão em `runtime-offline-threejs.md`. Nenhuma fonte precisa ser acessada para executar o jogo.

### [R01] Visão geral do produto — Pokémon
```text
https://www.pokemon.com/us/pokemon-video-games/pokemon-trading-card-game-pocket
```

### [R02] Construção de decks — Pokémon
```text
https://www.pokemon.com/us/features/learn-how-to-build-a-deck-in-pokemon-tcg-pocket
```

### [R03] Funcionamento de batalhas — site oficial
```text
https://www.pokemontcgpocket.com/tc/howtoplay/battle/
```

### [R04] Battle Rules FAQ — Pokémon Support
```text
https://support.pokemon.com/hc/en-us/articles/38906248102292-Pok%C3%A9mon-TCG-Pocket-Battle-Rules-FAQ
```

### [R05] Mega Blaziken ex: evolução e três pontos — Pokémon
```text
https://www.pokemon.com/us/features/pokemon-tcg-pocket-mega-blaziken-ex-deck-list-strategy
```

### [R06] Introdução de Estádios em Fantastical Parade — Pokémon
```text
https://www.pokemon.com/us/news/get-ready-to-march-on-with-fantastical-parade-in-pokemon-tcg-pocket
```

### [R07] Ordem do cálculo de dano — FAQ detalhada
```text
https://app-ptcgpt.pokemon-support.com/hc/en-us/articles/57286049312665-How-do-I-calculate-damage-for-Pok%C3%A9mon-that-have-Weakness-or-effects-applied
```

### [R08] Ordem de efeitos de fim de turno — FAQ detalhada
```text
https://app-ptcgpt.pokemon-support.com/hc/en-us/articles/57285887108377-If-both-players-have-cards-in-play-with-effects-that-happen-at-the-end-of-each-turn-in-what-order-are-the-effects-applied
```

### [R09] Mismagius e remoção de efeito atrasado — FAQ detalhada
```text
https://app-ptcgpt.pokemon-support.com/hc/en-us/articles/57281623683481-Why-didn-t-my-opponent-s-Pok%C3%A9mon-take-damage-from-Mismagius-s-Cursed-Prose-after-it-retreated-to-the-Bench
```

### [R10] Mimikyu ex e prevenção de dano — Pokémon Support
```text
https://app-ptcgp.pokemon-support.com/hc/en-us/articles/54676569546393-Why-didn-t-Mimikyu-ex-s-Disguise-Ability-prevent-damage-from-an-attack
```

### [R11] Objetivo com cartas de uma expansão — Pokémon Support
```text
https://app-ptcgp.pokemon-support.com/hc/en-us/articles/60478010749209-The-Battle-Task-Win-this-battle-with-X-or-more-XXX-cards-included-in-your-deck-cannot-be-completed
```

### [R12] Objetivo por raridade — Pokémon Support
```text
https://app-ptcgp.pokemon-support.com/hc/en-us/articles/39763773102361-The-Battle-Task-Win-this-battle-using-a-deck-where-all-the-Pok%C3%A9mon-cards-are-of-and-or-rarity-cannot-be-completed
```

### [R13] Gameplay FAQ — Pokémon Support
```text
https://support.pokemon.com/hc/en-us/articles/30330309361172-Pok%C3%A9mon-TCG-Pocket-Gameplay-FAQ
```

### [R14] Coleção, pacotes e Escolha Misteriosa — site oficial
```text
https://www.pokemontcgpocket.com/ja/howtoplay/card/
```

### [R15] Acesso às regras oficiais e à FAQ detalhada — Pokémon Support
```text
https://app-ptcgp.pokemon-support.com/hc/en-us/articles/61745874022553-I-want-to-know-more-about-the-battle-rules
```

### [R16] Mega Absol ex e Cleffa — Pokémon
```text
https://www.pokemon.com/us/features/pokemon-tcg-pocket-mega-absol-ex-deck-list-strategy
```

### [R17] Trading FAQ — Pokémon Support
```text
https://support.pokemon.com/hc/en-us/articles/34322874608660-Pok%C3%A9mon-TCG-Pocket-Trading-FAQ
```

---

<a id="gameplay-35"></a>

## 🧭 35. Diretriz final

> Implementar um jogo de cartas single-player local, com campanha permanente e apresentação Three.js real desde a primeira fatia visual. Motor, campanha e persistência são independentes do renderizador. Salvar ações, sorteios e recompensas antes de apresentá-los como definitivos. Não usar rede, CDN, autenticação, calendário de serviço ou IA em nuvem. A coleção progride jogando; fechar a janela não equivale a perder a partida.

Esta entrega é uma **especificação**, não um jogo executável. Os exemplos de dados não substituem catálogo, artes, modelos, testes implementados ou validação de balanceamento. Ler com os três documentos complementares.

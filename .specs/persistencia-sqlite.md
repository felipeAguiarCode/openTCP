# 🗄️ Persistência em SQLite — dados, versões, transações e recuperação

> **Versão documental:** 3.2.0 · **Data:** 14 de outubro de 2026  
> **Escopo:** single-player local, offline-first, navegador 16:9, Three.js e editor de cartas.  
> **Schema SQLite inicial:** `1` (47 tabelas) · **Arquivo lógico:** `/card-campaign/main.sqlite3`  
> **Substitui:** IndexedDB como persistência principal descrita nas specs 2.0/2.1 (nunca implementada; ver seção 22).  
> **Complementos:** [gameplay.md](gameplay.md) · [efeitos-dsl.md](efeitos-dsl.md) · [interface-16x9.md](interface-16x9.md) · [campanha.md](campanha.md) · [runtime-offline-threejs.md](runtime-offline-threejs.md) · [editor-de-cartas.md](editor-de-cartas.md)  
> **Entrega:** contrato de implementação, DDL de referência, gerador de fixture e testes nativos. O jogo e o worker WASM não estão implementados neste pacote; não existem saves reais a converter.
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — campo claro, paleta e animações na linguagem do TCG Pocket; os conceitos escuros anteriores não são referência.

## 🧭 Sumário

**Leitura visual obrigatória:** [direção Pocket](direcao-visual-pocket.md) · [referências identificadas](referencias-visuais.md).

- [🎯 1. Decisão de arquitetura](#sqlite-1)
- [📦 2. Instalação, capacidade e primeiro uso](#sqlite-2)
- [📁 3. Onde o banco existe](#sqlite-3)
- [🔑 4. Conexão e política de escrita](#sqlite-4)
- [🧬 5. Versões que não devem ser confundidas](#sqlite-5)
- [🗺️ 6. Modelo conceitual](#sqlite-6)
- [🧱 7. Inventário de tabelas](#sqlite-7)
- [🪪 8. IDs, tipos e limites](#sqlite-8)
- [🃏 9. Persistir regras, ex, arte e foil](#sqlite-9)
- [🖼️ 10. Imagens e assets: BLOB ou arquivo](#sqlite-10)
- [🛡️ 11. Referências e retenção](#sqlite-11)
- [🔁 12. Transação de comando](#sqlite-12)
- [🧾 13. Idempotência, chaves de concessão e comandos](#sqlite-13)
- [💰 14. Carteira, inventário e ledgers](#sqlite-14)
- [🃟 15. Decks e revisões](#sqlite-15)
- [⏸️ 16. Duelo, checkpoint e replay](#sqlite-16)
- [🏆 17. Resultado e campanha](#sqlite-17)
- [🎨 18. Transação de publicação do editor](#sqlite-18)
- [💾 19. Autosave de editor](#sqlite-19)
- [🔒 20. Múltiplas abas, perfis e workers](#sqlite-20)
- [🧰 21. Migrações SQL e catálogo](#sqlite-21)
- [🔄 22. Conversão de IndexedDB legado (não aplicável)](#sqlite-22)
- [📤 23. Backup completo do banco](#sqlite-23)
- [📥 24. Exportação de perfil e pacotes de cartas](#sqlite-24)
- [🧯 25. Restaurar sem destruir o estado atual](#sqlite-25)
- [🩺 26. Erros, integridade e recuperação](#sqlite-26)
- [⚡ 27. Consultas, índices e desempenho](#sqlite-27)
- [🧪 28. O que o banco garante e o que não garante](#sqlite-28)
- [✅ 29. Critérios de aceite](#sqlite-29)
- [🛠️ 30. Ordem de implementação](#sqlite-30)
- [📚 31. Referências técnicas](#sqlite-31)

<a id="sqlite-1"></a>

## 🎯 1. Decisão de arquitetura

**SQLite será a fonte persistente de verdade.** Ele não será um cache secundário de um save autoritativo em IndexedDB, nem um arquivo reconstruído ocasionalmente a partir de `localStorage`.

Para preservar a plataforma já escolhida, o caminho principal é **SQLite oficial compilado para WebAssembly, executado em um Dedicated Worker, persistindo pelo VFS `opfs` no armazenamento privado da origem do navegador**. A documentação oficial apresenta essa integração e suas exigências de worker e cabeçalhos de isolamento. [SQ01]

O launcher continua servindo arquivos estáticos em `http://localhost:4173`. Não surge um servidor de contas, autenticação, sincronização ou API remota. O processo estático **não abre nem modifica o banco**.

```text
Interface HTML + Three.js
        ↓ comandos tipados
Aplicação / motor de regras
        ↓ candidato validado + revisões esperadas
Storage Worker
        ↓ SQL parametrizado
SQLite WASM / VFS opfs
        ↓ arquivos persistentes da origem
Banco main.sqlite3 + journal gerenciado pelo SQLite
```

O worker de banco é diferente do worker de IA. O bot recebe observações autorizadas, não uma conexão SQL. Código próprio usa funções e dados; classes fornecidas por SQLite/Three.js podem ser instanciadas pelos adaptadores.

**Alternativa futura:** um shell desktop pode implementar o mesmo repositório com SQLite nativo. Isso exige homologação própria, não muda automaticamente o alvo para Electron e não cria dois bancos ativos.

<a id="sqlite-2"></a>

## 📦 2. Instalação, capacidade e primeiro uso

O pacote offline DEVE incluir o JavaScript, o WASM e os workers auxiliares exigidos pela distribuição SQLite escolhida. Fixar uma release estável exata e seus hashes no manifesto; não usar `latest`, CDN ou carregamento remoto de módulos.

O servidor estático precisa entregar o documento e os recursos relevantes com:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Content-Type: application/wasm
```

`Content-Type: application/wasm` aplica-se ao arquivo WASM, não a todas as respostas. HTML, JS e imagens mantêm seus MIME corretos. Os dois cabeçalhos de isolamento são uma exigência do VFS `opfs` escolhido, não uma propriedade universal de todos os VFS SQLite. [SQ01]

Boot obrigatório:

```text
Validar origem e contexto seguro
→ verificar Worker, WebAssembly, OPFS, SharedArrayBuffer e Web Locks
→ confirmar crossOriginIsolated
→ adquirir lock exclusivo do banco
→ iniciar Storage Worker
→ carregar SQLite local e testar VFS opfs
→ abrir banco existente ou inicializar banco novo
→ verificar application_id, schema, capabilities e integridade mínima
→ migrar quando permitido
→ selecionar perfil
```

Testar capacidade real, não apenas nome/versão do navegador. O build homologado deve suportar as funções JSON utilizadas, tabelas STRICT e colunas geradas. Registrar `sqlite_version()` e opções de compilação no diagnóstico.

Ausência de OPFS ou isolamento: bloquear abertura de campanha persistente com instrução local útil. Um laboratório explicitamente volátil pode existir, mas nunca usar banco em memória fingindo “Salvo”. Não fazer fallback automático para IndexedDB.

<a id="sqlite-3"></a>

## 📁 3. Onde o banco existe

`/card-campaign/main.sqlite3` é um caminho lógico dentro do OPFS da origem. **Não é um arquivo criado ao lado de `index.html` na pasta extraída.** OPFS não expõe os arquivos como documentos comuns do usuário; sua persistência depende da origem e das políticas do navegador. [SQ02]

A origem canônica permanece `http://localhost:4173`. Porta, hostname, protocolo e perfil do navegador diferentes podem levar a outro armazenamento. Não mudar automaticamente para `127.0.0.1` ou outra porta.

Diretórios conceituais:

```text
Pacote instalado, somente leitura:
  dist/manifest.json       chave lógica → caminho, media type, bytes e sha256
  dist/vendor/sqlite/      runtime, WASM e workers locais
  dist/content/            catálogo/campanha versionados
  dist/assets/             artes e modelos distribuídos

Armazenamento privado da origem:
  /card-campaign/main.sqlite3
  arquivos auxiliares do SQLite (journal gerenciado pelo VFS)
  /card-campaign/staging/<importId>.sqlite3   restauração em validação (seção 25)
  /card-campaign/backups/main-<timestamp>.sqlite3   banco anterior a uma substituição
  /card-campaign/cache/    miniaturas e derivados regeneráveis (fora do banco)
  arquivos temporários de exportação, com limpeza controlada

Arquivos escolhidos pelo usuário:
  backup completo .sqlite3
  exportação de perfil .campaign-profile.zip
  pacote autoral .cardpack.zip
```

Não copiar, renomear ou excluir journal manualmente. O adaptador entrega essas tarefas ao SQLite/VFS; a única troca de arquivo principal permitida é a da seção 25, com a conexão fechada. Limpar texturas de GPU ou `/card-campaign/cache/` não toca no banco.

<a id="sqlite-4"></a>

## 🔑 4. Conexão e política de escrita

Apenas **uma conexão persistente ao banco principal**, em um worker proprietário, atende jogo e editor. Consultas de listagem também passam por esse worker.

Configuração proposta, conferida por leitura após aplicação:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = DELETE;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 1500;
```

A escolha `DELETE` é deliberada para o alvo browser com escritor único. Não copiar uma recomendação genérica de `WAL + NORMAL`. WAL no ambiente WASM/OPFS possui restrições próprias e não oferece automaticamente a concorrência do SQLite nativo. [SQ01] [SQ03]

`FULL` e commit confirmado reduzem riscos, mas não são promessa de imunidade a perda física de armazenamento. O comportamento final depende também do navegador/VFS/dispositivo.

Ativar chaves estrangeiras **em cada conexão**, antes de transações; não confiar no padrão de uma ferramenta externa. `foreign_keys` e `journal_mode` não mudam dentro de uma transação aberta, por isso os quatro PRAGMAs são aplicados e lidos de volta logo após abrir a conexão, antes de qualquer migração (seção 21). Usar prepared statements com bind de valores. A interface envia comandos de domínio e nunca texto SQL. [SQ04]

`busy_timeout` não autoriza repetir mutações cegamente. Se houver resposta perdida, consultar o `command_id` antes de tentar de novo.

<a id="sqlite-5"></a>

## 🧬 5. Versões que não devem ser confundidas

| Identificador | Exemplo | O que versiona |
|---|---|---|
| Documento | `3.2.0` | Este conjunto de especificações. |
| SQLite runtime | Release fixada no manifesto | Biblioteca efetivamente distribuída. |
| `PRAGMA user_version` | `1` | Schema SQL do banco desta linha. |
| `application_id` | `1128354372` | Marca de identificação desta aplicação. |
| Ruleset | `local-campaign-v2` | Regras gerais de combate preservadas; nome do conjunto de regras, não versão documental. |
| `dataVersion` da carta | `2` | Forma dos dados e expressão explícita de ex. |
| Effect DSL | `effects-dsl-v1` (`effectsDsl: 1`) | Linguagem de efeitos de [efeitos-dsl.md](efeitos-dsl.md). |
| RNG | `rng-v1` | Gerador, semeadura e serialização dos streams ([gameplay §27.3](gameplay.md#gameplay-27)). |
| Chave de limite | `deck-limit-key-v2` | Normalização de `name` → `deckLimitKey` (seção 9); v1 + pré-normalização de “♀”/“♂”. |
| Chave de busca | `search-key-v1` | Normalização de `name` → `card_versions.search_key` (seção 9). |
| Versão funcional | `definitionId + version` | Ataques, HP, Habilidades e demais regras da carta. |
| Impressão | `printingId` imutável, `appearanceVersion 1` | Arte, acabamento, layout e vínculo a uma versão funcional. |
| Revisão de projeto | `projectId + revision` | Rascunho do editor. |
| Rascunho do editor | `draftFormat 1` | Forma de `editor_revisions.draft_json` ([schema](schemas/editor-draft.schema.json)). |
| Conteúdo | ID + versão + hash | Campanha, conjunto e catálogo instalado. |
| Perfil portátil `.campaign-profile.zip` | `formatVersion 4` | Formato de intercâmbio de um perfil, diferente do schema SQL (seção 24). |
| Pacote autoral `.cardpack.zip` | `formatVersion 1` | Conteúdo autoral reutilizável, sem progresso (seção 24). |
| Carta avulsa `.card.json` | `formatVersion 1` | Regras + impressões + referências de assets, sem bytes (seção 24). |
| Manifesto de backup | `formatVersion 1` | Arquivo acompanhante do backup `.sqlite3` (seção 23). |

Não existe schema IndexedDB a converter nesta linha (seção 22). O primeiro banco SQLite inicia em schema 1; a numeração de migrações SQL não continua rótulos de documentação ou formatos anteriores. O `4` do perfil portátil apenas evita colisão com rótulos antigos e não implica leitor dos formatos 2/3.

<a id="sqlite-6"></a>

## 🗺️ 6. Modelo conceitual

```text
CardDefinition 1 ── N CardVersion 1 ── N CardPrinting
  (dono CUSTOM)          │                  │
                         │                  N ── N Asset (projeção dos bindings)
                         │                  │
                         └─ Publication     ├─ Inventory por perfil
                            (projeto,       ├─ DeckEntry de uma revisão
                             revisão,       └─ BinderSlot / CollectionMark
                             operação)
CatalogArchiveMark ── retira versão/impressão de novas seleções

EditorProject (modo, alvo) 1 ── N EditorRevision (AUTO/MANUAL/PUBLISHED) ── Asset
       └─ TestRuns                    └─ Publicação cria versão e/ou impressões

Profile ── Wallet / Inventory / Deck / CampaignProgress / Settings / Binder
   └─ Attempt ── Events / Checkpoints / Replay
   └─ Operations ── Ledger / RewardGrants / PendingRewards / Receipts
   └─ CosmeticPreset ── Asset / aparência de perfil ou deck
   └─ ProfileImport (origem de um perfil importado)
```

Dados relacionais de identidade, posse, quantidade, versão, origem e relacionamentos ficam em tabelas. Efeitos e snapshots de estrutura variável ficam em JSON validado dentro de colunas TEXT. **Não guardar todo o jogo em uma única coluna JSON.**

O JSON de regras de uma versão é a fonte canônica dos seus ataques e Habilidades. Colunas geradas como nome, categoria e regra ex facilitam filtros sem criar outra cópia editável desses campos. O SQLite permite indexar colunas geradas e consultar JSON; isso não substitui validar o significado dos efeitos. [SQ05] [SQ06]

<a id="sqlite-7"></a>

## 🧱 7. Inventário de tabelas

O DDL em [database/schema-v1.sql](database/schema-v1.sql) contém as **47 tabelas**, índices, restrições e triggers de referência. É DDL puro: não contém `BEGIN`, `COMMIT` nem `PRAGMA`; transação e marcadores pertencem ao runner de migração (seção 21).

| Grupo | Tabelas | Responsabilidade |
|---|---|---|
| Infraestrutura | `schema_migrations`, `app_meta` | Migrações, configuração da instalação e marcas de versão (seção 7.1). |
| Perfis | `profiles`, `settings` | Identidade local, tipo de progressão, revisão, época de escrita, RNG e preferências (seção 7.1). |
| Pacotes | `content_packages`, `package_cards` | Manifestos e impressões elegíveis por pacote de conteúdo. |
| Assets | `assets` | Bytes importados (BLOB) ou registro opcional de integridade de arquivo empacotado; identidade = SHA-256 dos bytes. |
| Regras | `card_definitions`, `card_versions`, `card_dependencies` | Identidade (com perfil dono em CUSTOM), regras imutáveis, chave de busca e dependências explícitas. |
| Publicação | `card_publications`, `card_catalog_heads` | Validação, vínculo com projeto/revisão/operação e versão sugerida para novas seleções. |
| Impressões | `card_printings`, `printing_assets` | Arte, conjunto, raridade, acabamento e projeção dos bindings de assets. |
| Catálogo | `catalog_archive_marks` | Arquivamento de versão/impressão sem tocar linhas imutáveis. |
| Autoria | `editor_projects`, `editor_revisions`, `editor_asset_refs`, `card_test_runs` | Projetos com modo e alvo, revisões AUTO/MANUAL/PUBLISHED, mídia vinculada e relatórios de teste. |
| Coleção | `inventory`, `inventory_entries` | Saldo de cópias e sua movimentação auditável. |
| Coleção pessoal | `binders`, `binder_slots`, `collection_marks` | Fichários/vitrines, posições e marcas favorita/desejo/vista; não criam cópias. |
| Recursos | `wallets`, `wallet_entries` | Créditos (`CREDITS`) e pacotes possuídos (`PACK:{productId}`) com histórico de débitos e créditos. |
| Integridade econômica | `operations`, `reward_grants`, `pending_rewards` | Idempotência, prêmio único e escolha de recompensa pendente. |
| Decks | `decks`, `deck_versions`, `deck_entries` | Deck estável, revisões e uma entrada por exemplar selecionado. |
| Campanha | `campaign_progress` | Uma linha por perfil/campanha/nó; a versão do conteúdo é coluna, não chave. |
| Duelo | `attempts`, `battle_events`, `battle_checkpoints` | Estado corrente confirmado, histórico e checkpoints. |
| Retenção | `attempt_card_refs`, `attempt_asset_refs`, `replays` | Recursos exigidos para retomada e replay. |
| Cosméticos | `cosmetic_entitlements`, `cosmetic_presets`, `cosmetic_asset_refs` | Posse com origem e data, presets imutáveis por revisão. |
| Oficina | `appearance_drafts`, `appearance_draft_assets` | Rascunhos de playmat e assets ainda não aplicados. |
| Aplicação visual | `profile_appearance`, `deck_appearance` | Preset padrão, herança e override por deck. |
| Importação | `profile_imports` | Importações de perfil formato 4 e de backup; fingerprint não único (seção 22). |

Não há tabelas de login remoto, partidas online, cartões de pagamento, chat ou sincronização. Catálogos auxiliares de cosméticos e nós podem continuar em arquivos locais versionados; suas referências são validadas na camada de domínio.

### 7.1. Chaves de `settings` e `app_meta`

`settings` guarda preferências **por perfil** (`profile_id`, `setting_key`, `value_json`). Só as chaves abaixo são válidas nesta linha: a aplicação recusa chave desconhecida na escrita e ignora, com registro em diagnóstico, chave desconhecida lida de um banco mais novo. Ausência de linha = valor padrão.

| `setting_key` | Valor JSON | Padrão | Uso |
|---|---|---|---|
| `favoriteDeckId` | `deckId` do perfil ou `null` | `null` | Deck favorito exibido na Home e sugerido nas seleções. |
| `deckCovers` | objeto `{ deckId: printingId }` | `{}` | Capa escolhida da caixa de cada deck (biblioteca, ficha, Home, seleções). Carta que saiu do deck volta à capa automática. Só apresentação. |
| `receipts.lastSeenRevision` | inteiro ≥ 0 | `0` | Maior `committed_revision` já vista na tela de recibos; recibos acima dela aparecem como novos. |
| `ui.textScale` | número de 1,0 a 1,5 | `1.0` | Multiplicador do tamanho de texto da UI. |
| `ui.motion` | `NORMAL`, `FAST`, `INSTANT` ou `REDUCED` | `NORMAL` | Velocidade/forma das animações (Normal, Rápida, Instantânea, Movimento reduzido). |
| `ui.reducedMotion` | booleano | preferência do sistema no primeiro uso | `true` força a forma reduzida das animações em qualquer velocidade. |
| `graphics.quality` | `LOW`, `MEDIUM` ou `HIGH` | perfil detectado pelo runtime | Perfil de qualidade gráfica. |
| `graphics.playmatDisplayMode` | `TURN_OWNER`, `PLAYER_FIXED` ou `NEUTRAL` | `TURN_OWNER` | Exibição do playmat na mesa. |
| `audio.music` | número de 0 a 1 | `0.8` | Volume do grupo música. |
| `audio.sfx` | número de 0 a 1 | `0.8` | Volume dos efeitos de jogo. |
| `audio.ui` | número de 0 a 1 | `0.8` | Volume dos sons de interface. |
| `battle.layoutPreset` | `FOCUS_TABLE` ou `TACTICAL_PANELS` | `FOCUS_TABLE` | Layout da batalha. |
| `assist.hints` | booleano | `true` | Dicas de ações legais. |

Preferências não alteram regras, RNG, dificuldade nem snapshots de tentativas já criadas; aplicam-se imediatamente à apresentação. Gravar preferência é o comando `SAVE_SETTINGS` (seção 13.1).

`app_meta` guarda dados **da instalação** (`key`, `value_json`):

| `key` | Valor JSON | Uso |
|---|---|---|
| `installationId` | string (UUID gerado no banco novo) | Identidade local da instalação para diagnóstico e manifestos; nunca enviada a serviço algum. |
| `contentPackages` | lista `{packageId, version, contentHash}` | Pacotes de conteúdo ativos; cada item aponta para uma linha de `content_packages`. Alterado na mesma transação que instala o pacote. |
| `lastQuickCheckAt` | string ISO 8601 UTC | Último `quick_check` bem-sucedido; controla a frequência no boot (seção 26). |
| `appVersion` | string semver | Versão da aplicação que gravou por último; diagnóstico e manifesto de backup. |
| `writerEpochCounter` | inteiro ≥ 0 | Contador monotônico de épocas de escrita. Cada vez que o Storage Worker assume o banco ou ativa um perfil, incrementa o contador e grava o novo valor em `profiles.writer_epoch` do perfil ativo, na mesma transação. Comandos com `writerEpoch` antigo falham no CAS (seção 12). |

JSON de RNG: `profiles.economy_rng_json` guarda `{"economyRng": {...}, "seedRng": {...}}` e `attempts.rng_json` guarda `{"battleRng": {...}, "aiRng": {...}}`; cada valor é o estado serializado `rng-v1` `{"algorithm": "rng-v1", "state": [u32, u32, u32, u32], "draws": n}` ([gameplay §27.3](gameplay.md#gameplay-27)). `visualRng` nunca é persistido.

<a id="sqlite-8"></a>

## 🪪 8. IDs, tipos e limites

IDs estáveis são TEXT, criados por gerador local confiável. Não usar nome traduzido, posição da linha ou URL como identidade. `deckLimitKey` é outra chave: serve à regra de limite por nome.

Saldos e quantidades usam INTEGER, nunca ponto flutuante. Valores que cruzam JS/WASM devem respeitar inteiros seguros ou usar adaptação explícita para BigInt. Os limites do DDL são limites defensivos do produto, não limites máximos da biblioteca.

Timestamps usam texto UTC ISO 8601 gerado pela aplicação. Servem para histórico e ordenação auxiliar, não para conceder recompensa diária ou detectar concorrência. Revisões e sequências crescentes são a autoridade de ordem.

Tabelas STRICT restringem tipos armazenados; valores coercíveis ainda podem ser convertidos pelo SQLite. Por isso, o validador da aplicação também exige os tipos corretos antes do bind. [SQ07]

Hashes SHA-256 usam 64 caracteres hexadecimais minúsculos. O DDL confere comprimento; aplicação confere alfabeto e recalcula o conteúdo. `CHECK(json_valid(...))` valida sintaxe JSON, não os campos de um ataque.

### 8.1. Hash de documentos JSON

Todo hash de documento JSON — `card_versions.rules_hash`, `card_printings.appearance_hash`, `operations.payload_hash`, `battle_checkpoints.snapshot_hash`, `content_packages.content_hash`, `card_test_runs.rules_hash` e hashes de manifestos — é:

```text
hash(documento) = hex_minúsculo(SHA-256(UTF-8(JCS(documento))))
JCS = canonicalização RFC 8785: chaves ordenadas por unidades UTF-16, sem espaços,
      números na serialização ECMAScript (1.0 → 1, 0.0 → 0), strings com escape mínimo
```

Não usar `JSON.stringify` com ordem de inserção, `json.dumps` de outra linguagem nem o texto gravado como forma canônica: o hash é calculado sobre o documento interpretado, portanto reformatar o texto não muda o hash. Documentos imutáveis publicados são gravados já na forma JCS. Números de documentos com hash são inteiros ou decimais finitos; `NaN`/`Infinity` são recusados.

A fixture [seed-demo.sql](database/seed-demo.sql) é gerada por [build_seed.py](database/build_seed.py) com essa regra e nunca é editada à mão; [test_schema.py](database/test_schema.py) recalcula `rules_hash` e `appearance_hash` e falha se o arquivo divergir do gerador.

### 8.2. Identidade de assets

| Origem | Referência no documento | Resolução | Regra |
|---|---|---|---|
| Arte/máscara importada pelo usuário | `artAssetId`, `foilMaskAssetId`, `assetBindings[].assetId` | Linha `assets` BLOB | `asset_id` = SHA-256 dos bytes exatos; imutável. |
| Conteúdo empacotado (BUNDLED) | `artKey` / `assetKey` lógico (ex.: `art:base:faisca`) | `dist/manifest.json`: chave lógica → caminho, media type, bytes, sha256 | O manifesto é a fonte de resolução; uma linha `assets` BUNDLED é registro opcional de integridade. |

- Mesmos bytes têm sempre o mesmo `asset_id`; bytes diferentes têm outro. Não existe “nova identidade para corrigir metadados”: `assets` não recebe UPDATE (trigger `assets_no_update`).
- Metadados mutáveis de apresentação — recorte, transformação, máscara escolhida, crédito, papel — vivem nos documentos e relações que referenciam o asset (aparência, rascunho, preset), **nunca** em `assets`. `assets.metadata_json` guarda apenas fatos derivados dos próprios bytes (por exemplo, dimensões e espaço de cor detectados).
- Impressões do catálogo base podem referenciar arte por `artKey` (BUNDLED, substituível numa nova versão do pacote sem mudar `printingId` nem `appearance_hash`, pois a aparência guarda a chave e não os bytes) ou usar `artMode: TEMPLATE_ONLY` (moldura + nome + dados, com placeholder tipado). Trocar a arte de um `artKey` é atualização de conteúdo (nova versão do pacote e do manifesto), não UPDATE de `card_printings`. Dar arte empacotada a uma impressão BASE que não tinha (ou mudar a chave) altera a aparência: a instalação da **versão nova** do pacote aceita a diferença quando ela está só em `artMode`, `artKey`, `crop` e `artTransform`, sem `artAssetId` nem `assetBindings` nos dois lados; a linha imutável da primeira instalação é mantida e a apresentação de impressões empacotadas usa a aparência do pacote ativo. Qualquer outra diferença continua sendo conflito (DB-047).
- Arte importada usa `artAssetId` (BLOB sha256, imutável) repetido no binding `ART_MASTER`. Trocar a arte importada cria outra impressão.

<a id="sqlite-9"></a>

## 🃏 9. Persistir regras, ex, arte e foil

Exemplo de identidade:

```text
def-braseiro / versão 1
  ├── print-braseiro-normal-a
  ├── print-braseiro-foil-a
  └── print-braseiro-normal-arte-b

def-braseiro-ex / versão 1
  ├── print-braseiro-ex-normal-a
  └── print-braseiro-ex-foil-a
```

As três primeiras impressões possuem exatamente a mesma mecânica. Tornar a carta ex cria uma alteração funcional; não é uma propriedade do material de renderização.

Contrato de campos de regras ([schema de definição](schemas/card-definition.schema.json)):

| Dado | Fonte persistida | Regra |
|---|---|---|
| `baseName` | `rules_json` (coluna gerada `base_name`) | Entrada do autor, 1–50 caracteres, sem sufixo ex. |
| `name` | `rules_json` (coluna gerada `display_name`) | **Derivado**: `NONE` → `baseName`; `EX` → `baseName + " ex"`; `MEGA_EX` → `"Mega " + baseName + " ex"`. Divergência é erro de validação. |
| `deckLimitKey` | `rules_json` (coluna gerada `deck_limit_key`) | `deck-limit-key-v2(name)`. |
| `search_key` | Coluna `card_versions.search_key` (fora do JSON) | `search-key-v1(name)`, gravada na publicação. |
| HP, tipo, evolução, ataques, Habilidades, Treinador | `card_versions.rules_json` | Imutável após publicação; efeitos seguem [efeitos-dsl.md](efeitos-dsl.md). |
| `ruleBox` | Regras | `NONE`, `EX`, `MEGA_EX`. |
| `knockoutPoints` | Regras, validado contra `ruleBox` | 1 / 2 / 3 para Pokémon desta ruleset (CHECK do DDL). |

Algoritmos versionados:

```text
deck-limit-key-v2(name):
  0. pré-normalizar os símbolos de gênero: "♀" → " f", "♂" → " m"
  1. normalizar em NFD
  2. remover marcas diacríticas (categoria Unicode Mn)
  3. converter para minúsculas, sem depender de locale
  4. substituir cada caractere fora de [a-z0-9] por "-"
  5. colapsar "-" repetidos e remover "-" do início e do fim
  resultado vazio ou com mais de 100 caracteres = erro de validação
  "Braseiro ex" → "braseiro-ex" · "Faísca" → "faisca" · "Mega Braseiro ex" → "mega-braseiro-ex"
  "Nidoran♀" → "nidoran-f" · "Nidoran♂" → "nidoran-m" (na v1 os dois colidiam em "nidoran")

  A v2 só difere da v1 (passos 1–5) em nomes com ♀/♂. Nenhuma carta publicada até a v2 tinha esses símbolos,
  por isso nenhuma chave gravada muda e não há migração.

search-key-v1(name):
  1. normalizar em NFD
  2. remover marcas diacríticas (categoria Unicode Mn)
  3. converter para minúsculas, sem depender de locale
  4. colapsar espaços em branco consecutivos em um espaço e aparar as pontas
  "Braseiro ex" → "braseiro ex" · "Faísca" → "faisca"
```

A busca aplica `search-key-v1` também ao texto digitado. Mudar um algoritmo cria `-v2` e uma migração que recalcula as colunas derivadas; versões publicadas não são reinterpretadas silenciosamente.

Contrato de campos de impressão ([schema de impressão](schemas/card-printing.schema.json), `appearanceVersion 1`):

| Dado | Fonte persistida | Regra |
|---|---|---|
| Vínculo | `printingId`, `cardDefinitionId`, `cardDefinitionVersion` | CHECKs do DDL conferem o JSON contra as colunas. |
| Conjunto e número | `setId` (coluna gerada `set_id`), `collectorNumber` | Por impressão; normal e foil podem ter números distintos (`001`, `001F`). |
| Crédito | `artist` | Texto ou `null`; não muda regras. |
| Template | `templateId` | Registro `pocket-light-card-v1/*` ([editor §19](editor-de-cartas.md#editor-19)). |
| Arte | `artMode`, `artKey` **ou** `artAssetId`, `crop`, `artTransform` | `TEMPLATE_ONLY` exige ambos nulos; demais modos exigem exatamente um (seção 8.2). |
| Acabamento | `finish` + `finishSettings` (`presetId` e parâmetros) | `NORMAL`, `HOLOGRAPHIC`, `FOIL`, `CHROME`; `NORMAL` exige `intensity` 0; máscara `IMPORTED`/`PAINTED` exige `foilMaskAssetId`. |
| Variante | `variant.shiny`, `variant.immersiveSceneId` | Apresentação; não muda regras. |
| Raridade de aquisição | `rarity` | Independente de ex e acabamento. |
| Assets | `assetBindings` + `printing_assets` | `printing_assets` é a projeção dos bindings (seção 11). |
| Flair de entrada escolhido | `deck_entries.entry_flair_id` | Só por cópia de deck (seção 15); não reescreve o funcionamento da carta. |

`isEx` é uma propriedade calculada para UI: `ruleBox` igual a `EX` ou `MEGA_EX`. Não manter um checkbox booleano persistido que possa discordar da regra de pontos.

`tags` nunca contém `EX`/`MEGA_EX`: ex é exclusivamente `ruleBox`, e as tags representam outras características. Não manter duas fontes independentes de verdade.

### 9.1. Revisão visual 3.1

A mudança para [pocket-light-v1](direcao-visual-pocket.md) não exigiu tabela nova: schema SQLite continua 1 e dados funcionais de carta continuam 2. As correções 3.2.0 do próprio DDL v1 estão na seção 21. `settings`, snapshots e documentos de aparência guardam IDs/versionamentos já previstos.

Mudanças de aparência declarada (template, acabamento, recorte, arte importada) recebem novo `printingId` e hash; não atualizar registros publicados de `card_printings`. A única troca visual sem novo `printingId` é a arte BUNDLED referenciada por `artKey` (seção 8.2). Cosméticos mantêm entitlement estável, com nova `definitionVersion` quando sua arte muda. Não cobrar novamente uma aquisição existente.

Snapshots de duelo preservam a aparência resolvida. Preferências de conforto podem reduzir movimento e brilho sem modificar regras ou fontes de RNG. Os masters de imagens importadas não são sobrescritos para aplicar uma paleta.

A fixture SQL de um pixel é preservada como teste de persistência, não como modelo de arte. Ela não deve ser mostrada como ilustração aprovada na interface final.

---

<a id="sqlite-10"></a>

## 🖼️ 10. Imagens e assets: BLOB ou arquivo

**Decisão desta versão:** artes importadas e seus masters normalizados ficam como BLOB no SQLite. Assim, a confirmação de um rascunho/impressão e seus bytes pode ser atômica.

Assets distribuídos com o jogo permanecem em arquivos do pacote e são resolvidos por chave lógica via `dist/manifest.json` (seção 8.2). Uma linha `assets` com `storage_kind = BUNDLED`, caminho lógico relativo e hash esperado é opcional e serve só como registro de integridade; os bytes não são duplicados no banco.

Não armazenar imagem em base64 dentro de JSON. Não armazenar `blob:` URL, caminho absoluto original, objeto Texture, ImageBitmap ou handle de arquivo como se fossem dados portáteis.

Pipeline de importação:

```text
Ler arquivo do usuário
→ validar assinatura, MIME, dimensões e limites
→ decodificar e normalizar fora da transação
→ gerar master e máscara quando necessários (miniatura = cache fora do banco)
→ calcular SHA-256 dos bytes efetivos
→ preparar documento e relações
→ BEGIN IMMEDIATE
→ inserir assets ausentes por hash
→ gravar revisão e referências
→ COMMIT
→ gerar Object URLs para apresentação
```

Se o hash já existe, conferir tamanho e bytes esperados antes de reutilizar. Uma colisão ou divergência não deve substituir o asset existente. O hash identifica bytes; recorte e composição são parâmetros separados, gravados no documento que usa o asset.

Os limites de imagem do editor estão na sua spec. BLOB simplifica atomicidade, mas aumenta o banco e o custo de exportação; o orçamento de armazenamento precisa ser monitorado. Não prometer armazenamento ilimitado.

<a id="sqlite-11"></a>

## 🛡️ 11. Referências e retenção

Uma versão/impressão publicada não é editada no lugar nem apagada pela ação comum “Excluir”. O usuário arquiva o conteúdo para retirá-lo das novas seleções.

Arquivar (comando `ARCHIVE_ENTITY`, seção 13.1):

| Alvo | Persistência |
|---|---|
| Versão funcional | Linha `catalog_archive_marks` com `entity_kind = 'VERSION'`, `entity_id = definitionId`, `entity_version = version`. |
| Impressão | Linha `catalog_archive_marks` com `entity_kind = 'PRINTING'`, `entity_id = printingId`, `entity_version = 0`. |
| Definição inteira | `card_definitions.archived = 1`. |
| Projeto do editor | `editor_projects.status = 'ARCHIVED'`. |
| Deck, fichário, perfil | Coluna `archived` da própria linha. |

As linhas imutáveis de `card_versions`/`card_printings` nunca mudam. A marca vale para a instalação; `catalog_archive_marks.profile_id` registra quem arquivou (nulo para ações do sistema). Desarquivar remove a marca. Itens arquivados continuam válidos em coleções, decks já confirmados, tentativas e replays; só deixam de ser oferecidos em novas seleções.

Retenção obrigatória cobre coleção, versões de decks, projetos/revisões retidos (seção 19), snapshots de tentativa, replay, presets aplicados e rascunhos da oficina. Relações de assets devem ser geradas e conferidas na mesma transação que o documento que as declara.

`printing_assets` é a projeção de `appearance_json.assetBindings`; não é uma segunda lista livre. O trigger `printing_assets_declared_only` recusa (`PRINTING_ASSET_NOT_DECLARED`) qualquer par (papel, asset) que não esteja nos bindings da impressão, e UPDATE/DELETE são recusados (`PRINTING_ASSETS_APPEND_ONLY`). Assim não há como acrescentar/trocar assets de uma impressão já publicada por um endpoint separado. Papéis válidos: `ART_MASTER`, `FRONT_COMPOSITE`, `FOIL_MASK`, `NORMAL_MAP`, `ROUGHNESS_MAP`, `BACK_DEFAULT`, `IMMERSIVE_SCENE`.

Miniatura **não** é papel de `printing_assets`: é cache derivado e regenerável, guardado fora do banco (`/card-campaign/cache/`), chaveado pelo hash do master e dos parâmetros de composição. “Limpar cache” remove apenas esses derivados e recursos de GPU. Não apaga o master de uma arte importada, a máscara autoral ou o JSON de edição.

Nesta primeira linha, a coleta física de versões publicadas não é uma funcionalidade de usuário. Redução futura exige análise completa de dependências e migração dedicada. A ação normal de perfil nesta linha é **Arquivar perfil**, preservando recibos/replays; ela não promete remover seus bytes. “Apagar todos os dados locais” é outra ação: exige confirmação, oportunidade de backup, fechamento de handles e remoção explícita do armazenamento da aplicação. Não tentar burlar triggers com DELETEs parciais.

Revisões AUTO antigas do editor são podadas pela política da seção 19; checkpoints antigos podem ser reduzidos conforme retenção publicada, mantendo a tentativa retomável e o replay reproduzível pelos eventos.

<a id="sqlite-12"></a>

## 🔁 12. Transação de comando

Fluxo obrigatório de mutação:

```text
1. Receber envelope tipado e validar limites.
2. Consultar commandId já concluído.
3. Ler estado e revisões.
4. Preparar candidato, carregar assets e executar testes necessários fora da transação.
5. BEGIN IMMEDIATE.
6. Conferir novamente comando, payloadHash, proprietário e revisões.
7. Atualizar linhas com comparação de revisão.
8. Gravar histórico, recibos, RNG e relações na mesma transação.
9. COMMIT.
10. Responder com revisão confirmada.
11. Atualizar tela e iniciar animações.
```

`BEGIN IMMEDIATE` inicia a tentativa de transação de escrita; falhas e ROLLBACK precisam ser tratados explicitamente. Não manter transação aberta esperando usuário, animação, rede, hash ou decodificação de imagem. [SQ08]

Exemplo conceitual de comparação de revisão:

```sql
UPDATE profiles
SET revision = revision + 1, updated_at = :updatedAt
WHERE profile_id = :profileId
  AND revision = :expectedRevision
  AND writer_epoch = :writerEpoch;
```

O handler exige exatamente uma linha alterada. Zero linhas causa rollback com `REVISION_CONFLICT`, sem aplicar o resto do comando. O mesmo vale para os CAS específicos: `attempts.state_version` (duelo, `STATE_VERSION_MISMATCH`), `decks.head_revision` (rascunho de deck) e `editor_projects.head_revision` (autosave do editor).

O exemplo não é a transação completa: a operação, os efeitos e o recibo precisam estar no mesmo commit. O Storage Worker serializa handlers e não expõe `BEGIN` à UI.

### 12.1. Envelope de comando

Mesmo contrato de [runtime §3.1](runtime-offline-threejs.md#runtime-03):

| Campo | Contrato |
|---|---|
| `commandId` | ID único gerado pelo cliente por intenção do usuário; reenvio legítimo reutiliza o mesmo valor. |
| `profileId` | Perfil alvo; todas as linhas escritas pertencem a ele. |
| `type` | Um `command_type` do catálogo da seção 13.1. |
| `payload` | Dados discriminados por `type`, validados em runtime antes do bind. |
| `payloadHash` | SHA-256 do payload em JCS (seção 8.1); gravado em `operations.payload_hash`. |
| `expectedRevision` | `profiles.revision` esperada. Em `SAVE_DECK_DRAFT` e `SAVE_EDITOR_REVISION`, a head esperada do deck/projeto; ignorado em `SAVE_SETTINGS`, `MARK_COLLECTION` e `RUN_CARD_TEST`. |
| `writerEpoch` | Época de escrita vigente (seção 7.1), conferida em todo comando, inclusive nos que não criam `operations`; época antiga não confirma nada. |
| `expectedStateVersion` | Opcional; obrigatório nos comandos que alteram um duelo (`attempts.state_version`). |

### 12.2. Falhas do SQLite → códigos de produto

Erros de domínio (saldo, alvo, nó bloqueado, tentativa ativa) são detectados pela validação **antes** do `BEGIN`; as restrições do banco são a última defesa. Quando uma restrição dispara, o handler faz ROLLBACK e traduz a falha:

| Falha no SQLite | Código de produto (seção 26) | Tratamento |
|---|---|---|
| `RAISE` `*_IMMUTABLE`, `*_APPEND_ONLY`, `*_RETAINED` (ex.: `CARD_VERSION_IMMUTABLE`, `BATTLE_EVENTS_APPEND_ONLY`, `EDITOR_REVISION_RETAINED`) | `INTERNAL_INTEGRITY_ERROR` | Bug do handler: diagnóstico e mensagem genérica; nunca apresentado como erro do usuário. |
| `UNIQUE(profile_id, command_id)` em `operations` | `TRANSACTION_ALREADY_PROCESSED` se o `payload_hash` é igual; `COMMAND_PAYLOAD_MISMATCH` se difere | Igual: devolver o recibo gravado. Diferente: recusar sem efeito. |
| `UNIQUE(profile_id, committed_revision)` em `operations` | `REVISION_CONFLICT` | Recarregar estado; o CAS deveria ter detectado antes. |
| PK de `reward_grants` ou `UNIQUE(profile_id, grant_key)` de `pending_rewards` | `REWARD_ALREADY_GRANTED` | Exibir o recibo da concessão existente. |
| CAS com zero linhas (`profiles`, `decks`, `editor_projects`) | `REVISION_CONFLICT` | Recarregar; no editor, apresentar comparação. |
| CAS com zero linhas em `attempts.state_version` | `STATE_VERSION_MISMATCH` | Atualizar a partida a partir do estado confirmado. |
| `CHECK` de `wallets.balance` / `wallet_entries.balance_after` | `INSUFFICIENT_CREDITS` | Recusar a compra; nenhum movimento gravado. |
| `UNIQUE` de `idx_one_active_attempt` | `ACTIVE_ATTEMPT_EXISTS` | Oferecer retomar ou abandonar a tentativa atual. |
| `RAISE` `PRINTING_ASSET_NOT_DECLARED` | `CONTENT_REFERENCE_MISSING` | Publicação/importação recusada; impressão incoerente com seus bindings. |
| `FOREIGN KEY` em referência de conteúdo validada antes | `CONTENT_REFERENCE_MISSING` | Explicar versão/impressão/asset ausente. |
| Demais `FOREIGN KEY`, `CHECK`, `NOT NULL` ou tipo STRICT | `INTERNAL_INTEGRITY_ERROR` | O validador deveria ter recusado; registrar diagnóstico. |
| `SQLITE_FULL` | `STORAGE_FULL` | Rollback; preservar candidato quando possível. |
| `SQLITE_CORRUPT` / `SQLITE_NOTADB` | `DATABASE_CORRUPT` | Interromper escrita e abrir recuperação. |
| `SQLITE_IOERR` / `SQLITE_BUSY` após `busy_timeout` | `SAVE_WRITE_FAILED` | Não mostrar “Salvo”; consultar recibo antes de repetir. |

Os códigos `TRANSACTION_ALREADY_PROCESSED`, `STATE_VERSION_MISMATCH`, `ACTIVE_ATTEMPT_EXISTS` e `REWARD_ALREADY_GRANTED` têm mensagens em [gameplay §30](gameplay.md#gameplay-30).

<a id="sqlite-13"></a>

## 🧾 13. Idempotência, chaves de concessão e comandos

`operations` guarda uma linha por comando concluído, com unicidade em `(profile_id, command_id)`. O mesmo ID com o mesmo hash devolve o recibo anterior. O mesmo ID com payload diferente falha com `COMMAND_PAYLOAD_MISMATCH`. Cada operação incrementa `profiles.revision` e grava a nova revisão em `committed_revision`; `UNIQUE(profile_id, committed_revision)` garante uma operação por revisão.

Recompensas também precisam de uma chave de negócio, pois dois cliques podem gerar command IDs diferentes. **Esta é a tabela normativa única de chaves de concessão** (a mesma de [gameplay §24.5](gameplay.md#gameplay-24)):

| Concessão | `grant_key` | Comando de origem |
|---|---|---|
| Onboarding do perfil | `onboarding:{campaignId}` | `CREATE_PROFILE_ONBOARDING` |
| Primeira conclusão de nó | `first-clear:{campaignId}:{nodeId}` | `FINISH_ATTEMPT` |
| Objetivo opcional | `objective:{campaignId}:{objectiveId}` | `FINISH_ATTEMPT` |
| Descoberta | `discovery:{campaignId}:{nodeId}` | `CLAIM_DISCOVERY` |
| Abertura de pacote | `opening:{openingId}` | `OPEN_PACK` |
| Cosmético de marco | `cosmetic:{milestoneId}:{cosmeticId}` | Comando que atinge o marco (normalmente `FINISH_ATTEMPT`) |
| Concessão local CUSTOM | `custom-grant:{printingId}:{grantBatchId}` | `GRANT_CUSTOM_COPIES` |

Regras das chaves:

- A unicidade é por perfil: PK `(profile_id, grant_key)` de `reward_grants`. `profileId` **nunca** entra na chave, porque já é coluna da linha.
- A versão de conteúdo/campanha **nunca** entra na chave: uma atualização de conteúdo nunca concede de novo uma primeira vitória, um objetivo, uma Descoberta ou um marco já recebidos.
- `openingId` identifica a unidade de pacote sendo aberta; recarregar a abertura reapresenta o mesmo `openingId` e o recibo, sem novo sorteio. `grantBatchId` identifica um clique de “Adicionar cópias”; repetir após falha reutiliza o mesmo lote.
- Prêmio com escolha: a transação de origem concede sua chave normalmente e cria o direito em `pending_rewards` com a chave derivada `{chave de origem}:{slotId}` (ex.: `first-clear:{campaignId}:{nodeId}:key-card`). `CLAIM_PENDING_REWARD` grava em `reward_grants` essa mesma chave derivada.

`reward_grants` protege a concessão única, separadamente do transporte do comando. Checar apenas `command_id` não basta para impedir duas recompensas de primeira vitória.

### 13.1. Comandos que geram `operations`

- Toda mutação de perfil que precisa ser idempotente cria **exatamente uma** linha `operations` própria e incrementa `profiles.revision` no mesmo commit. Exceção declarada: `IMPORT_PROFILE` também reaplica as operações históricas do arquivo (revisões 1..N, remapeadas), porque ledgers, eventos de batalha, concessões, entitlements, prêmios pendentes e publicações têm FK `NOT NULL` para `operations`; a operação do próprio import é a N+1.
- Isso inclui **cada ação de batalha aceita**, inclusive as ações do NPC confirmadas pela aplicação: `battle_events.operation_id` é `NOT NULL` com FK para `operations`.
- **Autosave do editor não cria `operations` nem altera `profiles.revision`**: usa CAS em `editor_projects.head_revision`. O autosave de rascunho de deck usa CAS em `decks.head_revision`, e o da oficina usa CAS em `appearance_drafts.revision`.
- Preferências e marcas de coleção têm semântica de estado final (gravar duas vezes dá o mesmo resultado) e são gravadas por upsert, sem `operations`.
- `command_type` é texto livre no DDL; a aplicação aceita somente os tipos abaixo. Tipos de fixture (`SEED_FIXTURE`) existem apenas no seed técnico.

| `command_type` | Payload (resumo) | Escopo atômico (mesmo COMMIT) | `operations` |
|---|---|---|---|
| `CREATE_PROFILE_ONBOARDING` | Nome, `progressionMode`, `campaignId`, avatar, preferências iniciais. | `profiles` (sementes `rng-v1` de `economyRng`/`seedRng`, época), `settings`, `wallets`/`wallet_entries`, `inventory`/`inventory_entries`, decks iniciais confirmados, `cosmetic_entitlements` gratuitos (`origin = 'ONBOARDING'`), `campaign_progress` inicial, `reward_grants` `onboarding:{campaignId}`. | Sim (revisão 1) |
| `SAVE_DECK_DRAFT` | `deckId` (novo ou existente), nome, tipos de Energia, entradas. | `decks` (criação ou `head_revision` por CAS), `deck_versions` DRAFT, `deck_entries`. | Não — CAS em `decks.head_revision` |
| `CONFIRM_DECK` | `deckId`, revisão de base, entradas, tipos de Energia. | `deck_versions` CONFIRMED + `deck_entries` após validação integral, `decks.head_revision`. | Sim |
| `START_ATTEMPT` | Modo, `campaignId`/`nodeId`/`difficulty`, `deckId`/`deckRevision`. | `attempts` RUNNING com `state_json` em `SETUP`, sementes de `battleRng`/`aiRng` tiradas de `seedRng` (avança `profiles.economy_rng_json`), `attempt_card_refs`, `attempt_asset_refs`, checkpoint e eventos iniciais. | Sim |
| `SUBMIT_BATTLE_ACTION` | `attemptId`, ação do motor (`actionId` = `commandId`); envelope com `expectedStateVersion`. | CAS em `attempts.state_version`, `state_json`, `rng_json`, `battle_events`, `battle_checkpoints` quando a política pede. | Sim — cada ação aceita |
| `SUSPEND_ATTEMPT` | `attemptId`. | `attempts.status` RUNNING → SUSPENDED, checkpoint. | Sim |
| `ABANDON_ATTEMPT` | `attemptId`. | `attempts.status` → ABANDONED com `result_json`; nenhum prêmio. | Sim |
| `FINISH_ATTEMPT` | `attemptId`. | Transação de resultado (seção 17). Emitido automaticamente após o commit da ação que produziu o estado terminal; ao recarregar, uma tentativa com estado terminal e status RUNNING recebe o comando de novo. | Sim |
| `BUY_PRODUCT` | `productId`, preço esperado, quantidade. | Débito `CREDITS`, crédito `PACK:{productId}` ou de impressões no inventário (Empório), ledgers. | Sim |
| `OPEN_PACK` | `productId`, `openingId`. | Consome `PACK:{productId}`, sorteia por `economyRng`, credita `inventory`/`inventory_entries`, grava o novo estado de RNG, `reward_grants` `opening:{openingId}`. | Sim |
| `CLAIM_DISCOVERY` | `campaignId`, `nodeId`, opção escolhida. | Itens da Descoberta, ledgers, `reward_grants` `discovery:{campaignId}:{nodeId}`. | Sim |
| `CLAIM_PENDING_REWARD` | `rewardId`, opção escolhida. | `pending_rewards` PENDING → CLAIMED (`choice_json`, `operation_id`), `inventory`/`inventory_entries`, `reward_grants` com a chave derivada. | Sim |
| `SAVE_COSMETIC_PRESET` | `presetId`, revisão de base, configuração. | Nova revisão de `cosmetic_presets` + `cosmetic_asset_refs` (+ `assets` BLOB novos); remove o `appearance_drafts` aplicado. | Sim |
| `APPLY_APPEARANCE` | Perfil ou `deckId`; preset/revisão ou herança. | `profile_appearance` ou `deck_appearance`. | Sim |
| `BUY_COSMETIC` | `cosmeticId`, preço esperado. | Débito `CREDITS`, ledger, `cosmetic_entitlements` (`origin = 'PURCHASE'`); a PK do entitlement impede segunda compra. | Sim |
| `SAVE_EDITOR_REVISION` | `projectId` (ou criação com modo/alvo), `kind` AUTO/MANUAL, `draft` (`draftFormat 1`), resumo de validação. | `editor_projects` (criação ou `head_revision` por CAS), `editor_revisions`, `editor_asset_refs`, `assets` BLOB novos, poda de AUTO antigas (seção 19). | Não — CAS em `editor_projects.head_revision` |
| `RUN_CARD_TEST` | `runId`, `projectId`, `revision`, cenário. | `card_test_runs`, idempotente por `run_id`; não altera dados de perfil. | Não |
| `PUBLISH_CARD` | `projectId`, `projectRevision`, modo/alvo, hashes esperados. | Seção 18. | Sim |
| `GRANT_CUSTOM_COPIES` | `printingId`, quantidade, `grantBatchId`. | `inventory`/`inventory_entries` do perfil CUSTOM/LAB, `reward_grants` `custom-grant:{printingId}:{grantBatchId}`. | Sim |
| `ARCHIVE_ENTITY` | Tipo e ID do alvo. | Seção 11 (`catalog_archive_marks`, `archived` ou `status`). | Sim |
| `SAVE_BINDER` | `binderId`, nome, tipo, layout, posições. | `binders`, `binder_slots` (substituição das posições). | Sim |
| `MARK_COLLECTION` | Lista de `{markKind, subjectKind, subjectId, on}`. | Upsert/remoção em `collection_marks`. | Não — estado final |
| `IMPORT_PROFILE` | `importId`, fingerprint, dados validados em staging. | Novo `profiles` e todas as linhas do perfil (seção 24), `profile_imports`. | Sim — no perfil novo |
| `SAVE_SETTINGS` | Pares `setting_key` → valor (seção 7.1). | Upsert em `settings`. | Não — estado final |

“Publicar e adicionar ao perfil de criação” encadeia `PUBLISH_CARD` (perfil autor) e `GRANT_CUSTOM_COPIES` (perfil de destino), cada um com recibo; se a concessão falhar, a publicação permanece e a UI oferece repetir com o mesmo `grantBatchId`.

### 13.2. Recibo (`receipt_json`)

Schema mínimo de todo recibo:

```json
{
  "commandType": "OPEN_PACK",
  "committedRevision": 42,
  "summary": {
    "productId": "pack-c01-v1",
    "openingId": "opening-7f3a",
    "printingIds": ["print-base-faisca-normal-v1", "print-base-braseiro-normal-v1"]
  },
  "grants": ["opening:opening-7f3a"]
}
```

| Campo | Contrato |
|---|---|
| `commandType` | Igual a `operations.command_type`. |
| `committedRevision` | Igual a `operations.committed_revision`. |
| `summary` | Objeto específico do tipo: resultados sorteados, itens creditados, débitos, resultado da partida, `definitionId`/`version`/`printingIds` publicados etc. Suficiente para reapresentar a tela sem recalcular nada. |
| `grants` | Lista das `grant_key` inseridas nesta operação (vazia quando não há concessão). |
| `events` | Opcional, só em comandos de duelo: `{"first": n, "last": m}` com os `sequence_no` de `battle_events` gravados. |

O recibo é imutável (`OPERATION_IMMUTABLE`). A fixture técnica usa recibos `{"fixtureOnly": true}` e não é exemplo deste schema.

### 13.3. Resposta perdida

Queda antes do commit: candidato descartado. Queda após commit e antes da resposta: pesquisar o recibo por `(profile_id, command_id)` e reapresentar. Timeout da UI não é prova de rollback.

<a id="sqlite-14"></a>

## 💰 14. Carteira, inventário e ledgers

`wallets` e `inventory` são os saldos atuais utilizados nas consultas. `wallet_entries` e `inventory_entries` registram os movimentos comprometidos e o saldo resultante. Ambos são atualizados juntos.

Não recalcular toda a coleção percorrendo o histórico em cada abertura de tela. Não atualizar saldo sem movimento correspondente, exceto migração/seed explicitamente identificados por recibos.

Compra de pacote:

```text
Validar produto desbloqueado e preço versionado
→ saldo suficiente (senão INSUFFICIENT_CREDITS, sem gravar nada)
→ débito de Créditos (CREDITS)
→ crédito de pacote possuído (PACK:{productId})
→ movimentos
→ operação e recibo
→ revisão do perfil
```

Abertura de pacote:

```text
Validar pacote possuído
→ sortear pelo estado atual de economyRng
→ consumir uma unidade
→ creditar impressões
→ persistir próximo estado de RNG
→ reward_grants opening:{openingId}
→ recibo com resultados
→ COMMIT
→ apresentação Three.js
```

Rollback preserva o RNG persistido. Recarregar uma abertura já concluída usa o recibo e não sorteia novamente. Seeds de teste e comandos de laboratório não creditam perfis STANDARD.

<a id="sqlite-15"></a>

## 🃟 15. Decks e revisões

`decks` é a identidade durável. `deck_versions` guarda revisões; `deck_entries` tem uma linha por uma das 20 posições selecionadas. Duas cópias ocupam duas linhas, permitindo flair e impressão diferentes.

O flair de entrada por cópia vive **somente** em `deck_entries.entry_flair_id`. Presets cosméticos não carregam mapa de flair por entrada (um ID de entrada muda a cada revisão); guardam apenas `defaultEntryFlairId`, usado pelas cópias sem flair próprio.

Rascunhos podem estar incompletos ou falhar limites estratégicos; uma revisão CONFIRMED exige validação integral. O DDL não tenta implementar todos os critérios de um deck por triggers.

O autosave de rascunho (`SAVE_DECK_DRAFT`) não cria `operations`: grava uma revisão DRAFT com CAS em `decks.head_revision` e é agrupado por debounce, gravando só quando o conteúdo difere da head. Confirmar (`CONFIRM_DECK`) é operação com recibo (seção 13.1). `deck_versions` e `deck_entries` são append-only.

A confirmação verifica 20 entradas, limite por `deckLimitKey`, Básico elegível, posse/entitlement do modo, Energias, compatibilidade de catálogo e efeitos suportados.

`head_revision` só muda na mesma transação que grava uma revisão completa. A aplicação não deve carregar um head sem linhas correspondentes.

Trocar arte/acabamento cria ou seleciona outra impressão. Salvar não substitui silenciosamente todas as cópias de uma definição em todos os decks.

Uma tentativa usa snapshot e referências exatas; editar o deck durante pausa não modifica aquela tentativa.

<a id="sqlite-16"></a>

## ⏸️ 16. Duelo, checkpoint e replay

`attempts` guarda o estado corrente confirmado; `battle_events` guarda fatos ordenados. `battle_checkpoints` é uma cópia histórica para recuperação/replay, não outra autoridade editável.

| Coluna de `attempts` | Contrato |
|---|---|
| `mode` | `CAMPAIGN`, `ARENA`, `TRAINING`, `CUSTOM` ou `LAB`. |
| `status` | Somente `RUNNING`, `SUSPENDED`, `FINISHED` ou `ABANDONED` são persistidos. Não existem status `CREATED`/`SETUP`: a tentativa nasce `RUNNING` e o setup é a fase `SETUP` dentro de `state_json` ([gameplay §8.2](gameplay.md#gameplay-08)). |
| `campaign_id`, `node_id` | Ambos ou nenhum; obrigatórios em `CAMPAIGN` (e usados pela Arena quando o desafio é de um nó). |
| `difficulty` | `STORY`, `STANDARD` ou `EXPERT`; obrigatória em `CAMPAIGN`. |
| `deck_id`, `deck_revision` | Revisão exata usada (FK para `deck_versions`); nulos para deck temporário de treino. |
| `progression_eligible` | `1` só quando a tentativa pode conceder progresso ou recompensa; `TRAINING` e `LAB` sempre `0` (CHECK). |
| `state_version` | Contador da partida, usado no CAS de cada ação. |
| `ruleset_id`, `engine_version`, `content_fingerprint` | Versões fixadas na criação. |
| `state_json` | Estado serializável do motor, incluindo fase, decisões pendentes e continuações. |
| `rng_json` | `{"battleRng": {...}, "aiRng": {...}}` em `rng-v1` (seção 7.1). |
| `presentation_snapshot_json` | Aparência resolvida e congelada para a tentativa. |
| `result_json` | Obrigatório exatamente quando o status é `FINISHED` ou `ABANDONED`. |

Duelos LAB com rascunhos **não publicados** são efêmeros: rodam em memória, sem linha em `attempts`, sem eventos e sem retomada após recarregar, porque `deck_entries`, `attempt_card_refs` e os snapshots exigem impressões publicadas (FKs para `card_printings`). A UI identifica o duelo como “Laboratório — não salvo”; isso não é um save fictício. Duelos LAB só com cartas publicadas persistem normalmente, com `progression_eligible = 0`.

Snapshot mínimo:

```text
Cartas e suas zonas/ordem
Ativos, Bancos, pilhas evolutivas e anexos
Dano e condições
Turno global e turnos próprios
Permissões usadas
Fila serializável de efeitos e ponto de continuação
Decisão pendente e controlador
RNG de batalha e IA
Versões de motor, regras, conteúdo e definições
Configuração do encontro
Snapshot visual resolvido, sem objetos Three.js
```

Persistir ao fim de cada comando aceito e antes de solicitar uma decisão. Dados de checkpoint não podem conter closures, Promises, Map com chaves opacas ou referências a meshes.

`state_version` pertence à partida; `profiles.revision` pertence ao conjunto de dados do perfil. Eles não são o mesmo contador.

O índice parcial `idx_one_active_attempt` impede duas tentativas RUNNING/SUSPENDED para um mesmo perfil (`ACTIVE_ATTEMPT_EXISTS`). Uma transição FINISHED/ABANDONED precisa de resultado. Cada ação aceita é uma operação (seção 13.1), então `profiles.revision` e `state_version` avançam juntos, mas continuam contadores distintos. A aplicação valida ainda o motivo, os pontos e a ordem causal.

Replays referenciam tentativas retidas e seus assets/versões. Não “reproduzir” um replay chamando comandos de economia ou concedendo novamente uma vitória.

<a id="sqlite-17"></a>

## 🏆 17. Resultado e campanha

Em uma transação de encerramento (`FINISH_ATTEMPT`):

```text
Confirmar estado terminal
→ registrar resultado
→ calcular objetivos novos
→ atualizar campaign_progress
→ registrar reward_grants inéditos
→ atualizar saldos/coleção/entitlements
→ registrar movimentos e recibos
→ criar pending_rewards quando há escolha
→ finalizar tentativa
→ incrementar revisão
→ COMMIT
```

`campaign_progress` tem **uma linha por perfil/campanha/nó**: a PK `(profile_id, campaign_id, node_id)` não inclui versão. `campaign_version` é coluna e registra a versão do conteúdo na última atualização da linha; atualizar a campanha não fragmenta o histórico nem recria a linha.

| Estado | Fonte |
|---|---|
| `LOCKED`, `AVAILABLE`, `CLEARED` | Persistidos em `campaign_progress.status`. |
| `IN_PROGRESS` | Derivado: existe tentativa RUNNING/SUSPENDED para o nó. |
| `MASTERED` | Derivado: `CLEARED` e todos os objetivos aplicáveis da versão atual do nó presentes em `progress_json.completedObjectiveIds`. |

Como `MASTERED` é derivado, um objetivo novo trazido por atualização de conteúdo pode retirá-lo até ser cumprido; recompensas já concedidas não mudam.

`pending_rewards` registra a origem do direito: `source_operation_id` (operação que o criou, normalmente `FINISH_ATTEMPT`), `source_attempt_id` (tentativa, quando vier de duelo) e `created_at`. A escolha posterior é outro comando transacional (`CLAIM_PENDING_REWARD`), que muda `status` para `CLAIMED` e grava `choice_json` e `operation_id`. Os prêmios já concedidos não são revertidos por fechar o seletor; o direito pendente continua disponível.

O tipo de perfil e a origem do conteúdo fazem parte da elegibilidade. Perfis CUSTOM/LAB não concedem progresso ou recursos a STANDARD. Clonar perfil não mescla os dois históricos.

`cosmetic_entitlements` grava `origin` (`ONBOARDING`, `PURCHASE`, `MILESTONE`, `CUSTOM_GRANT`), `acquired_at` e a operação que concedeu. Os cosméticos gratuitos iniciais entram na operação de onboarding; marcos usam a chave `cosmetic:{milestoneId}:{cosmeticId}`.

<a id="sqlite-18"></a>

## 🎨 18. Transação de publicação do editor

Pré-condições: revisão de rascunho estável, documento válido, todos os efeitos compiláveis pelo registro de [efeitos-dsl.md](efeitos-dsl.md), assets presentes, testes obrigatórios aprovados para o `rules_hash` atual e versão de validador conhecida. **Testes obrigatórios** são os cenários de laboratório salvos no rascunho: cada um precisa de uma execução `PASS` em `card_test_runs` para o `rules_hash` das regras que serão publicadas. Como as regras incluem `version`, o laboratório testa já com a versão-alvo da publicação (última publicada + 1); republicar exige testar de novo.

O catálogo CUSTOM de um perfil reúne as definições que ele publicou **e** as de cujas impressões ele possui cópias (concessão a perfil de criação, perfil importado que reutiliza conteúdo existente por ID + hash); assim um perfil nunca tem inventário de impressão ausente do seu catálogo.

O modo do projeto (`editor_projects.mode`) define o alvo e o que a publicação cria:

| `mode` | Alvo e origem | Publicação cria |
|---|---|---|
| `NEW_DEFINITION` | `target_definition_id` novo; sem origem. | `card_definitions` (CUSTOM, `owner_profile_id` = perfil autor) + versão 1 + publicação + impressões. |
| `NEW_VERSION` | `target_definition_id = source_definition_id`; origem = versão publicada de base. | Nova `card_versions` (última + 1) da mesma definição + publicação + impressões. |
| `VARIANT` | `target_definition_id = source_definition_id`, `source_version` fixa; regras bloqueadas. | Só `card_printings` + `printing_assets` (+ `assets` novos) da versão existente; não cria versão nem `card_publications`. |
| `FORK` | Novo `target_definition_id`; `source_definition_id`/`source_version` registram a origem (inclusive BASE). | Nova definição CUSTOM, versão 1, com referência de origem. |

Os CHECKs de `editor_projects` garantem que só `NEW_DEFINITION` dispensa origem e que `NEW_VERSION`/`VARIANT` miram a própria definição de origem.

```text
Validar e compilar fora da transação
→ preparar documentos em JCS, rules_hash, appearance_hash, search_key e impressões
→ BEGIN IMMEDIATE
→ CAS de profiles.revision/writer_epoch e de editor_projects.head_revision
→ inserir operations (PUBLISH_CARD)
→ registrar assets BLOB ainda ausentes
→ card_definitions (primeira versão, com owner_profile_id) ou só nova versão
→ card_versions (rules_json, rules_hash, ruleset_id, search_key)
→ card_publications (relatório, profile_id, project_id, project_revision, operation_id)
→ card_printings + printing_assets (projeção exata dos bindings)
→ card_dependencies
→ card_catalog_heads
→ editor_revisions kind PUBLISHED (cópia do rascunho publicado) e head_revision
→ recibo em operations
→ COMMIT
→ mostrar carta publicada
```

Revisões do editor não recebem UPDATE; por isso a revisão publicada é gravada como **nova** revisão `kind = PUBLISHED`, e `card_publications.project_revision` aponta para ela. `card_publications` exige `profile_id` e `operation_id` sempre que há projeto vinculado (CHECK); publicações BASE instaladas pelo pacote não têm projeto nem operação.

Para apenas uma arte/foil nova de regras já publicadas, usar `VARIANT` e reutilizar `definition_id + version`; não criar uma revisão funcional desnecessária.

Publicar não concede automaticamente cartas na campanha padrão. “Publicar e adicionar ao perfil de criação” encadeia `PUBLISH_CARD` e `GRANT_CUSTOM_COPIES` (seção 13.1), com recibos e validação de escopo.

Falhar a máscara foil, a compilação ou a gravação de mídia impede a publicação completa. Não produzir uma carta visível no catálogo apontando a uma versão funcional inexistente.

<a id="sqlite-19"></a>

## 💾 19. Autosave de editor

Debounce inicial proposto: 800 ms depois da última alteração sem nova entrada; mudanças frequentes são agrupadas. Salvar manualmente força o envio imediato do candidato mais recente.

Revisões append-only de rascunho não são um INSERT por frame. Movimento contínuo do recorte acumula localmente e grava ao soltar ou ao debounce.

Cada gravação é `SAVE_EDITOR_REVISION` e **não cria `operations` nem altera `profiles.revision`**:

```text
BEGIN IMMEDIATE
→ conferir profiles.writer_epoch = :writerEpoch (sem alterar profiles.revision)
→ UPDATE editor_projects SET head_revision = :n, updated_at = :t
    WHERE project_id = :p AND head_revision = :n - 1     (CAS; zero linhas = REVISION_CONFLICT)
→ INSERT editor_revisions (kind, draft_json, validation_summary_json)
→ INSERT editor_asset_refs e assets BLOB ainda ausentes
→ podar revisões AUTO excedentes
→ COMMIT
```

| `kind` | Origem |
|---|---|
| `AUTO` | Autosave por debounce. |
| `MANUAL` | “Salvar rascunho” ou Ctrl/Cmd + S. |
| `PUBLISHED` | Gravada pela transação de publicação (seção 18). |

`draft_json` segue [editor-draft.schema.json](schemas/editor-draft.schema.json) (`draftFormat 1`): modo, alvo, regras, impressões, dados de autoria e cenários de teste; estado de UI (aba, seção, câmera) não pertence ao rascunho. `validation_summary_json` guarda o resumo da validação daquela revisão — no mínimo `{"errors": n, "warnings": n}`, opcionalmente contagens por nível e `validatorVersion` — para a biblioteca mostrar a situação sem revalidar.

Retenção de revisões:

- Mantêm-se sempre: todas as `MANUAL` e `PUBLISHED`, a revisão head, qualquer revisão referenciada por `card_test_runs` ou `card_publications` e as **20 revisões `AUTO` mais recentes**.
- As demais `AUTO` são apagadas depois de um autosave bem-sucedido; `editor_asset_refs` cai por `ON DELETE CASCADE`. BLOBs que ficarem sem referência permanecem em `assets` até uma coleta explícita futura.
- O trigger `editor_revisions_prune_auto_only` impõe o que pode ser apagado: DELETE de revisão não-AUTO, da head ou de revisão referenciada falha com `EDITOR_REVISION_RETAINED`; UPDATE falha com `EDITOR_REVISION_IMMUTABLE`.

Estados da UI:

```text
Sem alterações
Alterações locais
Salvando revisão N
Salvo — revisão N
Falha ao salvar — alterações ainda nesta tela
Conflito — revisar antes de sobrescrever
```

Uma resposta atrasada da revisão N não marca N+1 como salva. Fechar a aplicação pode perder somente o delta ainda não confirmado; a última revisão salva continua recuperável.

A pilha de Undo/Redo pode ser limitada em memória; revisões salvas importantes continuam no histórico. Undo de editor não reverte operações econômicas.

<a id="sqlite-20"></a>

## 🔒 20. Múltiplas abas, perfis e workers

Adquirir Web Lock exclusivo **por banco/origem**, antes de abrir qualquer conexão, por exemplo `card-campaign:sqlite-main`. Não usar lock apenas por perfil: todos os perfis compartilham o arquivo.

A segunda aba exibe “O jogo está aberto em outra aba”. Ela não abre uma segunda conexão “só para ler”. Pode mostrar instruções estáticas e uma opção de solicitar liberação.

Web Locks coordena contextos da mesma origem, mas não substitui as verificações de revisão de negócio. [SQ09]

Transferência cooperativa: aba antiga suspende, termina transação, fecha conexão/worker e libera lock. Só então a nova abre. Não roubar lock de uma aba ainda ativa por timeout do relógio.

Sem Web Locks homologado: bloquear o runtime persistente desta versão, em vez de criar um fallback de trava em `localStorage`. Lock sozinho também não garante que um processo externo não corrompa dados exportados.

Ao trocar perfil: suspender tentativa, invalidar tarefas de IA por epoch/jobId, limpar projeções, carregar próximo perfil pelo mesmo serviço de storage. O worker de IA nunca mantém um writer separado.

<a id="sqlite-21"></a>

## 🧰 21. Migrações SQL e catálogo

O arquivo [schema-v1.sql](database/schema-v1.sql) é a migração `0001-schema-v1`, destinada a banco novo. Não executá-lo toda inicialização.

**Todo arquivo de migração é DDL/DML puro**: não contém `BEGIN`, `COMMIT`, `END` nem `PRAGMA`. Transação, registro e marcadores pertencem ao runner. Cada migração tem número, nome, checksum e função de validação. `schema_migrations` registra a aplicação; `PRAGMA application_id` e `PRAGMA user_version` mudam na **mesma** transação. O checksum é o SHA-256 dos bytes exatos do arquivo, calculado pelo runner, não um hash autorreferente escrito dentro dele.

Semântica normativa do runner (a mesma que [test_schema.py](database/test_schema.py) executa):

```text
1. Abrir a conexão e aplicar os PRAGMAs de conexão, fora de transação,
   lendo cada um de volta e abortando se divergir:
     PRAGMA foreign_keys = ON
     PRAGMA journal_mode = DELETE
     PRAGMA synchronous = FULL
     PRAGMA busy_timeout = 1500
2. Ler application_id e user_version; recusar banco de outra aplicação ou
   mais novo que o runtime; listar as migrações pendentes em ordem.
3. Para cada migração pendente, numa ÚNICA transação:
     BEGIN IMMEDIATE
     → executar o arquivo da migração (DDL/DML puro)
     → INSERT INTO schema_migrations(version, migration_name, checksum_sha256, applied_at)
     → PRAGMA application_id = 1128354372
     → PRAGMA user_version = <versão da migração>
     → COMMIT
4. Qualquer erro: ROLLBACK. O banco permanece no user_version anterior,
   sem tabelas, linhas ou marcadores parciais.
5. Verificação pós-migração: integrity_check, foreign_key_check e objetos esperados.
```

Para um banco existente com migração pendente, antes do passo 3: adquirir lock e impedir novos comandos, e confirmar backup ou espaço para cópia recuperável. Se uma operação necessária não couber numa transação, ela requer plano de staging explícito e recuperação antes de ser aceita. No boot, um `checksum_sha256` registrado diferente do arquivo conhecido para aquela versão é `MIGRATION_FAILED` com diagnóstico, nunca motivo para reaplicar.

**Correção 3.2.0:** o schema 1 nunca foi publicado numa release do jogo; por isso as correções foram feitas no próprio `schema-v1.sql` (47 tabelas, DDL sem transação) em vez de uma migração `0002`. A partir da primeira release, todo ajuste vira migração nova; nunca editar uma migração já aplicada.

Definições publicadas permanecem imutáveis. Atualizar pacote base acrescenta versões e altera heads permitidos; não executa UPDATE em ataques antigos de replays.

Banco mais novo que o runtime: não abrir em modo de escrita. Oferecer diagnóstico/exportação por caminho compatível; nunca reduzir `user_version` para “forçar funcionar”.

<a id="sqlite-22"></a>

## 🔄 22. Conversão de IndexedDB legado (não aplicável)

**Não aplicável nesta linha.** Nenhuma implementação 2.x foi publicada; portanto não existem perfis IndexedDB nem saves `.campaign-save.json` 2/3 a converter. O runtime não inclui conversor, leitor de IndexedDB ou importador desses formatos ([runtime §4.5](runtime-offline-threejs.md#runtime-04)). Os critérios DB-042 e DB-043 ficam marcados como N/A.

Nota histórica: as specs 2.0/2.1 descreviam IndexedDB como persistência principal, e a 3.1.0 trazia um roteiro condicional de conversão com a tabela `legacy_imports`. Se um dia surgir um conversor, ele será importação validada para um perfil novo, com `source_kind` próprio em `profile_imports` e migração dedicada — nunca dual-write, ALTER sobre IndexedDB ou multiplicação de Créditos.

`legacy_imports` foi substituída por `profile_imports`, que registra importações reais desta linha:

| Coluna | Contrato |
|---|---|
| `source_kind` | `PROFILE_ZIP_4` para qualquer importação de perfil portátil formato 4 (como novo perfil ou substituindo o atual) e `DATABASE_BACKUP` para perfil extraído de um backup `.sqlite3` (seção 25.1). A origem do arquivo decide o valor, não a ação escolhida. |
| `source_fingerprint` | SHA-256 do arquivo recebido. **Não é único**: o mesmo arquivo pode ser importado de novo como outro perfil novo. A UI avisa quando o fingerprint já aparece no histórico, sem impedir. |
| `target_profile_id` | Perfil criado pela importação. |
| `report_json` | Relatório: contagens, avisos, referências ausentes e versões. |

A substituição completa da instalação por um backup não grava linha em `profile_imports`: o banco inteiro passa a ser o arquivo restaurado, e o anterior fica em `/card-campaign/backups/` (seção 25). `profile_imports` é append-only.

<a id="sqlite-23"></a>

## 📤 23. Backup completo do banco

Exportação `.sqlite3` captura **todos os perfis, conteúdo autoral, mídia BLOB e históricos locais**. A UI precisa avisar que é backup da instalação, não de um único perfil.

Parar fila de escrita em um checkpoint, esperar transações terminarem e usar mecanismo de exportação/snapshot compatível com a release SQLite WASM escolhida. Não ler bytes do arquivo em paralelo com uma escrita. A API de backup do SQLite e as utilidades WASM documentam caminhos de exportação; sua disponibilidade deve ser validada no adaptador. [SQ10] [SQ11]

O arquivo exportado deve abrir como SQLite comum, sem depender de base64 ou do layout interno do OPFS. Realizar round-trip e `integrity_check` no teste de integração.

Manifesto em arquivo acompanhante ([exemplo](examples/database-backup-manifest.example.json)):

```json
{
  "format": "card-campaign-database-backup",
  "formatVersion": 1,
  "schemaVersion": 1,
  "applicationId": 1128354372,
  "databaseFile": "card-campaign-2026-10-14.sqlite3",
  "databaseSha256": "0000000000000000000000000000000000000000000000000000000000000000",
  "databaseBytes": 0,
  "createdAt": "2026-10-14T00:00:00Z",
  "appVersion": "1.0.0",
  "sqliteVersion": "<release fixada no manifesto>",
  "includesAllProfiles": true,
  "includesImportedAssetBytes": true,
  "bundledAssetsIncluded": false,
  "requiredContentPackages": [
    {
      "packageId": "base",
      "version": "1.0.0",
      "contentHash": "0000000000000000000000000000000000000000000000000000000000000000"
    }
  ]
}
```

| Campo | Contrato |
|---|---|
| `format`, `formatVersion` | `card-campaign-database-backup`, `1`. |
| `schemaVersion`, `applicationId` | `user_version` e `application_id` do banco exportado. |
| `databaseFile` | Nome do arquivo `.sqlite3` acompanhado. |
| `databaseSha256`, `databaseBytes` | SHA-256 e tamanho exatos dos bytes exportados, medidos depois da exportação. |
| `createdAt` | Momento da exportação (ISO 8601 UTC). |
| `appVersion`, `sqliteVersion` | `app_meta.appVersion` e `sqlite_version()` da exportação. |
| `includesAllProfiles`, `includesImportedAssetBytes`, `bundledAssetsIncluded` | Alcance declarado: todos os perfis e BLOBs; arquivos empacotados não. |
| `requiredContentPackages` | Pacotes `{packageId, version, contentHash}` de `content_packages` referenciados pelo banco. |

Entrega: o manifesto é baixado **junto** com o banco, como segundo arquivo (`<nome>.sqlite3` + `<nome>.backup.json`), ou o usuário escolhe exportar um `.zip` contendo os dois. O `.sqlite3` continua abrindo sozinho em qualquer ferramenta SQLite; o manifesto acrescenta verificação de transporte. Na restauração, com manifesto, `databaseBytes` e `databaseSha256` são conferidos antes de abrir o arquivo; divergência é `IMPORT_INVALID`. Sem manifesto, a restauração segue só com as validações da seção 25 e avisa que a integridade de transporte não foi conferida. Um pacote exigido é aceito quando o build em execução o distribui ou quando o banco atual já o registra em `content_packages` (o backup traz as linhas de conteúdo; a dependência real são os arquivos BUNDLED). Fora disso, ausência ou outro `contentHash` é `CONTENT_REFERENCE_MISSING`, com instrução para instalar a versão compatível.

Assets BUNDLED continuam exigindo o pacote de conteúdo compatível. A mídia importada está no BLOB do banco. Não afirmar que o arquivo inclui modelos, fontes e sons distribuídos que só possuem referências.

<a id="sqlite-24"></a>

## 📥 24. Exportação de perfil e pacotes de cartas

Três operações diferentes:

| Arquivo | Finalidade | Inclui progresso? |
|---|---|---|
| `.sqlite3` | Backup completo da instalação. | Todos os perfis. |
| `.campaign-profile.zip` | Perfil portátil e suas dependências. | Um perfil. |
| `.cardpack.zip` | Conteúdo autoral reutilizável. | Não. |

Uma quarta forma, `.card.json`, exporta uma carta avulsa sem bytes de mídia (revisão técnica).

### 24.1. Perfil portátil `.campaign-profile.zip` (formato 4)

```text
manifest.json
profile.json
content/card-versions.json
content/printings.json
content/projects.json
assets/<sha256>.<ext>
```

`manifest.json`:

```json
{
  "format": "card-campaign-profile",
  "formatVersion": 4,
  "exportedAt": "2026-10-14T00:00:00Z",
  "appVersion": "1.0.0",
  "profileId": "profile-creator",
  "contentRefs": {
    "packages": [
      {"packageId": "base", "version": "1.0.0", "contentHash": "0000000000000000000000000000000000000000000000000000000000000000"}
    ],
    "cardVersions": [
      {"definitionId": "custom-braseiro-ex", "version": 1, "rulesHash": "0000000000000000000000000000000000000000000000000000000000000000"}
    ]
  },
  "assets": [
    {"sha256": "431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460", "bytes": 68, "mediaType": "image/png"}
  ]
}
```

| Arquivo | Conteúdo |
|---|---|
| `manifest.json` | Formato, `formatVersion 4`, `exportedAt`, `appVersion`, `profileId` de origem, `contentRefs` (pacotes BASE exigidos e versões CUSTOM incluídas, com hashes) e lista `assets` com `sha256`, `bytes` e `mediaType` de cada arquivo em `assets/`. |
| `profile.json` | Perfil (sem `writer_epoch`), `settings`, operações históricas e ledgers completos (`wallet_entries`, `inventory_entries`) com um `ledgerSummary` de conferência, `wallets`, `inventory`, decks com revisões e entradas, aparência de perfil/deck, `campaign_progress`, tentativas (terminais e suspensas) com checkpoints e eventos, replays, `pending_rewards`, `reward_grants`, entitlements, presets e rascunhos cosméticos, fichários e marcas de coleção. |
| `content/card-versions.json` | Definições e versões CUSTOM alcançáveis pelo perfil (regras JCS + `rulesHash`), inclusive versões antigas usadas por tentativas ou replays. |
| `content/printings.json` | Impressões alcançáveis (aparência JCS + `appearanceHash`). |
| `content/projects.json` | Projetos do editor do perfil e suas revisões retidas (seção 19), com resumos de validação e execuções de teste. |
| `assets/<sha256>.<ext>` | Bytes BLOB alcançáveis; o nome é o hash, conferido contra os bytes. |

Incluir somente conteúdo e assets alcançáveis pelo perfil. Não exportar outros perfis por acidente. A importação (`IMPORT_PROFILE`) cria um perfil novo, remapeia todos os IDs locais do perfil (perfil, operações, decks, tentativas, replays, recompensas pendentes, presets, fichários, projetos e execuções de teste `card_test_runs.run_id`) para que o mesmo arquivo possa ser importado de novo, reutiliza conteúdo e assets já existentes por ID + hash (mesmo ID com hash diferente é conflito, nunca sobrescrita), reaplica as linhas validadas numa transação e registra `profile_imports`. Não existe leitor de save JSON 2/3 (seção 22).

### 24.2. Pacote autoral `.cardpack.zip` (formato 1)

```text
manifest.json
cards/<definitionId>/<version>.json
printings/<printingId>.json
assets/<sha256>.<ext>
tests/<testId>.json
```

`manifest.json`:

```json
{
  "format": "card-campaign-cardpack",
  "formatVersion": 1,
  "engineVersion": "1.0.0",
  "rulesetId": "local-campaign-v2",
  "effectsDsl": 1,
  "cards": [
    {"definitionId": "custom-braseiro-ex", "version": 1, "rulesHash": "0000000000000000000000000000000000000000000000000000000000000000"}
  ],
  "printings": [
    {"printingId": "print-custom-braseiro-ex-normal-v1", "appearanceHash": "0000000000000000000000000000000000000000000000000000000000000000"}
  ],
  "assets": [
    {"sha256": "431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460", "bytes": 68, "mediaType": "image/png"}
  ],
  "tests": [
    {"testId": "coin-2", "definitionId": "custom-braseiro-ex", "version": 1, "rulesHash": "0000000000000000000000000000000000000000000000000000000000000000"}
  ]
}
```

Os testes incluídos são cenários e resultados do autor. Na importação eles são **reexecutados ou exibidos como relatório anexado à importação** (`profile_imports.report_json` ou relatório da tela de importação); não viram linhas de `card_test_runs`, que pertencem a projetos locais.

### 24.3. Carta avulsa `.card.json` (formato 1)

```text
{
  "format": "card-campaign-card",
  "formatVersion": 1,
  "rules": <documento completo de regras, dataVersion 2>,
  "printings": [<aparências completas, appearanceVersion 1>],
  "assetRefs": [{"sha256": "<64 hex>", "bytes": <n>, "mediaType": "image/png"}]
}
```

`assetRefs` lista apenas hashes, sem bytes: o arquivo serve para revisão técnica e não é portátil sozinho quando usa arte importada. A importação recalcula os hashes (JCS) para detectar conflito de mesmo ID/versão e exige que os assets referenciados já existam no banco.

Pacote de cartas e carta avulsa não carregam saldos, recibos, progresso, scripts SQL, shaders arbitrários ou código executável. Importar conteúdo nunca concede inventário em STANDARD. A spec do editor define o preview/diff e o fork de identidade ([editor §29](editor-de-cartas.md#editor-29)).

<a id="sqlite-25"></a>

## 🧯 25. Restaurar sem destruir o estado atual

Backup SQLite é entrada não confiável. Verificar tamanho, cabeçalho, `application_id`, schema, limites, estrutura permitida, integridade e referências em ambiente temporário. Não executar migrações ou triggers fornecidas pelo arquivo como se fossem código da aplicação.

Para o runtime normal, preferir restaurar **dados validados em um banco novo com schema canônico**, em vez de promover cegamente o arquivo recebido à conexão autoritativa. Copiar colunas explicitamente; não importar objetos arbitrários de `sqlite_schema`.

A leitura de banco externo usa worker descartável, read-only quando disponível, restrições de tempo/recursos e consultas de allowlist. Desabilitar extensões e funções perigosas; nenhuma entrada pode invocar `ATTACH`, `load_extension` ou SQL escolhido pelo usuário. `trusted_schema=OFF` pode ser defesa adicional no adaptador de importação, homologada separadamente do banco interno que usa funções JSON em colunas geradas.

Limites iniciais propostos: backup SQLite até 256 MiB; `.zip` de backup (banco + manifesto) até 260 MiB compactado, 257 MiB expandido e 4 entradas; perfil/pacote ZIP até 128 MiB compactado, 256 MiB expandido e 1.024 entradas. Limites podem ser revistos após medição, mas são verificados **antes e durante** leitura/descompressão.

Perfil portátil cria novo perfil por padrão. Substituição total da instalação exige confirmação explícita e backup anterior; tentativas em execução são suspensas (e a fila drenada) antes da troca, conforme o fluxo da seção 25.1 — não é preciso abandoná-las. Não mesclar carteiras automaticamente.

### 25.1. Restauração no OPFS

```text
1. Conferir databaseBytes/databaseSha256 quando há manifesto.
2. Abrir os bytes recebidos num worker descartável (sem a conexão principal), read-only
   quando disponível, sem extensões nem ATTACH, com trusted_schema=OFF e limites de tempo.
3. Validar: cabeçalho, application_id, user_version suportado, objetos de sqlite_schema
   iguais ao canônico, integrity_check, foreign_key_check, limites e referências.
4. Criar /card-campaign/staging/<importId>.sqlite3 (OPFS) pelo runner canônico (seção 21)
   e copiar as linhas validadas por colunas explícitas; repetir integrity_check e
   foreign_key_check no staging.
5. Fechar o worker descartável. Seguir por um dos caminhos abaixo.
```

A abertura de bytes num worker separado e o fechamento explícito das conexões seguem a API do SQLite WASM. [SQ11] [SQ12]

**Substituir a instalação inteira** (backup completo):

```text
Suspender tentativas e drenar a fila de comandos
→ fechar a conexão principal e encerrar o Storage Worker
→ renomear /card-campaign/main.sqlite3 → /card-campaign/backups/main-<timestamp>.sqlite3
→ mover o staging validado → /card-campaign/main.sqlite3 (move no OPFS)
→ reabrir pelo boot normal: PRAGMAs, application_id, user_version, migrações, quick_check
→ sucesso: limpar staging; manter o backup anterior até o usuário descartá-lo
```

Qualquer falha depois do primeiro rename restaura o arquivo anterior para `/card-campaign/main.sqlite3` antes de reabrir. Nunca existem dois bancos principais abertos ao mesmo tempo.

**Substituir um perfil** ou **importar perfil de um backup**: as linhas validadas do perfil escolhido são transferidas, por colunas explícitas, para um **perfil novo** no banco principal (`IMPORT_PROFILE`; `profile_imports.source_kind` = `DATABASE_BACKUP` quando a origem é um `.sqlite3`, `PROFILE_ZIP_4` quando é um perfil portátil). Ao substituir, o perfil antigo é arquivado logo depois do commit (`ARCHIVE_ENTITY`), preservando recibos e replays. Nunca há mescla no lugar de carteiras, inventários ou históricos.

Importação interrompida deixa banco atual intacto ou uma transação revertida. Staging não deve virar perfil ativo antes de todas as verificações; arquivos de staging órfãos são removidos no boot seguinte.

<a id="sqlite-26"></a>

## 🩺 26. Erros, integridade e recuperação

| Código de produto | Comportamento |
|---|---|
| `SQLITE_RUNTIME_MISSING` | Informar arquivo local faltante; não tentar baixar runtime. |
| `STORAGE_CAPABILITY_MISSING` | Mostrar capacidade ausente e impedir save fictício. |
| `ORIGIN_ISOLATION_REQUIRED` | Instruir iniciar pelo launcher com cabeçalhos. |
| `DATABASE_IN_USE` | Abrir tela de segunda aba, sem outra conexão. |
| `REVISION_CONFLICT` | Recarregar estado e apresentar comparação quando for editor. |
| `COMMAND_PAYLOAD_MISMATCH` | Recusar reutilização indevida de command ID. |
| `INSUFFICIENT_CREDITS` | Recusar compra sem saldo; mostrar quanto falta; nenhum movimento ou RNG avança. |
| `INTERNAL_INTEGRITY_ERROR` | Falha de integridade do próprio programa (trigger de imutabilidade, CHECK que o validador deveria ter barrado): rollback, diagnóstico e mensagem genérica “nada foi alterado”; nunca culpar o usuário. |
| `STORAGE_FULL` | Rollback, preservar candidato quando possível e oferecer backup/limpeza segura. |
| `DATABASE_CORRUPT` | Interromper escrita, preservar original, abrir recuperação. |
| `MIGRATION_FAILED` | Não resetar; apresentar log e opções de backup/retorno. |
| `CONTENT_REFERENCE_MISSING` | Explicar versão/asset ausente; manter dados originais. |
| `IMPORT_INVALID` | Recusar pacote sem mudanças parciais. |
| `SAVE_WRITE_FAILED` | Não mostrar “Salvo”; não executar ação econômica novamente sem checar recibo. |

A tradução de falhas do SQLite (RAISE de triggers, UNIQUE, CHECK, CAS, códigos de erro do SQLite) para estes códigos está na seção 12.2.

`quick_check` pode integrar o boot em frequência controlada (`app_meta.lastQuickCheckAt`); `integrity_check` e `foreign_key_check` são verificações mais profundas para migração, importação e diagnóstico. O primeiro não substitui o segundo: verificar integridade estrutural e relacionamentos separadamente. [SQ03] [SQ04]

Depois de erro de I/O, não entrar em laço infinito de retry. Suspender o fluxo, liberar statements, registrar diagnóstico sem copiar dados pessoais desnecessários e oferecer recuperação.

<a id="sqlite-27"></a>

## ⚡ 27. Consultas, índices e desempenho

Paginar coleção e biblioteca do editor. Não transferir todos os BLOBs ao abrir a Home.

Consulta ilustrativa:

```sql
SELECT i.printing_id, i.quantity, v.display_name,
       v.category, v.rule_box, p.finish, p.rarity
FROM inventory AS i
JOIN card_printings AS p ON p.printing_id = i.printing_id
JOIN card_versions AS v
  ON v.definition_id = p.definition_id
 AND v.version = p.definition_version
WHERE i.profile_id = :profileId AND i.quantity > 0
ORDER BY v.display_name, i.printing_id
LIMIT :limit OFFSET :offset;
```

Para bibliotecas grandes, preferir paginação por cursor estável; OFFSET é suficiente como exemplo, não uma promessa de escalabilidade ilimitada.

Busca normalizada de nomes usa `card_versions.search_key`, calculada por `search-key-v1` (seção 9); o texto digitado passa pelo mesmo algoritmo e a consulta usa prefixo (`search_key LIKE :prefixo || '%'`) sobre `idx_card_versions_search`. Não presumir que `COLLATE NOCASE` resolve todos os acentos e idiomas. FTS é extensão opcional; o schema básico não depende de FTS5.

Índices de referência (além das PKs e UNIQUEs); os marcados com * entraram na 3.2.0:

| Índice | Colunas | Consulta atendida |
|---|---|---|
| `idx_card_versions_search` | `card_versions(category, search_key, definition_id, version)` | Busca por nome normalizado e categoria. |
| `idx_card_versions_limit` | `card_versions(deck_limit_key)` | Limite de cópias por nome. |
| `idx_editor_projects_profile` * | `editor_projects(profile_id, updated_at)` | Biblioteca do Estúdio por recência. |
| `idx_editor_asset_refs_asset` * | `editor_asset_refs(asset_id)` | Dependências de um asset. |
| `idx_card_test_runs_project` * | `card_test_runs(project_id, revision)` | Testes de uma revisão. |
| `idx_card_dependencies_reverse` * | `card_dependencies(dependency_id, dependency_version)` | Quem depende de uma versão. |
| `idx_printings_definition` | `card_printings(definition_id, definition_version)` | Impressões de uma versão. |
| `idx_printings_finish` | `card_printings(finish, rarity)` | Filtros de coleção. |
| `idx_printings_set` * | `card_printings(set_id)` | Filtro por conjunto. |
| `idx_printing_assets_asset` | `printing_assets(asset_id)` | Dependências de um asset. |
| `idx_package_cards_printing` * | `package_cards(printing_id)` | Pacotes que contêm uma impressão. |
| `idx_decks_profile` * | `decks(profile_id)` | Decks do perfil. |
| `idx_deck_entries_printing` * | `deck_entries(printing_id)` | Decks que usam uma impressão. |
| `idx_one_active_attempt` | `attempts(profile_id)` parcial, UNIQUE | Uma tentativa RUNNING/SUSPENDED por perfil. |
| `idx_attempts_history` * | `attempts(profile_id, created_at)` | Histórico de tentativas. |
| `idx_attempts_node` * | `attempts(profile_id, campaign_id, node_id)` | Tentativas de um nó. |
| `idx_battle_events_operation` * | `battle_events(operation_id)` | Eventos de uma operação/recibo. |
| `idx_attempt_card_refs_printing` * | `attempt_card_refs(printing_id)` | Retenção de impressões por tentativas. |
| `idx_attempt_asset_refs_asset` * | `attempt_asset_refs(asset_id)` | Retenção de assets por tentativas. |
| `idx_cosmetic_presets_profile` * | `cosmetic_presets(profile_id)` | Presets do perfil. |
| `idx_cosmetic_asset_refs_asset` * | `cosmetic_asset_refs(asset_id)` | Dependências de um asset. |
| `idx_appearance_draft_assets_asset` * | `appearance_draft_assets(asset_id)` | Dependências de um asset. |
| `idx_binders_profile` * | `binders(profile_id, sort_order)` | Fichários do perfil em ordem. |
| `idx_binder_slots_printing` * | `binder_slots(printing_id)` | Fichários que mostram uma impressão. |
| `idx_profile_imports_fingerprint` * | `profile_imports(source_fingerprint)` | Aviso de arquivo já importado. |
| `idx_profile_imports_target` * | `profile_imports(target_profile_id)` | Origem de um perfil importado. |

Rever planos com `EXPLAIN QUERY PLAN`, usando fixtures representativas.

Metas iniciais, não resultados medidos: navegação sem decodificação pesada na thread de UI; commits normais curtos; qualquer progresso de operação longa reflete trabalho real. Importação de BLOB e exportação podem ter custo maior, com feedback e cancelamento seguro.

<a id="sqlite-28"></a>

## 🧪 28. O que o banco garante e o que não garante

| DDL / repositório | Validador / motor |
|---|---|
| Chaves únicas, FKs e tipos básicos. | Nome canônico e legalidade de evolução. |
| Saldos não negativos e idempotência estrutural. | Preço correto e elegibilidade de prêmio. |
| Uma tentativa ativa por perfil. | Turnos, ataques, alvo e condições especiais. |
| Versões, impressões, ledgers e históricos protegidos de UPDATE/DELETE por triggers. | Efeito compilável e teste representativo. |
| JSON sintaticamente válido. | Schema, semântica e limites de AST. |
| Impressão vinculada a versão publicada; `printing_assets` só com bindings declarados. | Arte/máscara corretas e qualidade visual. |
| Poda de revisões do editor restrita a AUTO não referenciadas. | Política de retenção (20 AUTO) e momento da poda. |
| Nome/ex coerentes com pontos (CHECK sobre colunas geradas). | `name` derivado de `baseName`, `deckLimitKey` e `search_key` pelos algoritmos versionados. |

Não apresentar `integrity_check = ok` como prova de que o jogo está balanceado ou de que os ataques funcionam.

O [script de teste](database/test_schema.py) aplica o DDL como o runner da aplicação (seção 21), confere a migração atômica, carrega a fixture **gerada** por [build_seed.py](database/build_seed.py) a partir dos exemplos JSON (definição, impressões, projeto do editor e preset) e verifica restrições, triggers, hashes JCS e rollback em SQLite nativo. Os [schemas de carta](schemas/card-definition.schema.json), [impressão](schemas/card-printing.schema.json) e [rascunho do editor](schemas/editor-draft.schema.json) cobrem a estrutura; a semântica de opcodes, seletores e Habilidades está em [efeitos-dsl.md](efeitos-dsl.md) e exige o validador do motor. Os testes do navegador, WASM, OPFS, cabeçalhos, encerramento forçado e migração real continuam sendo gates de implementação.

<a id="sqlite-29"></a>

## ✅ 29. Critérios de aceite
| ID | Cenário | Resultado esperado |
|---|---|---|
| DB-001 | Boot offline limpo | Runtime SQLite, WASM e workers carregam sem recurso externo. |
| DB-002 | VFS indisponível | Não cria save fictício em memória nem fallback autoritativo oculto. |
| DB-003 | Cabeçalhos ausentes | Diagnóstico aponta isolamento necessário antes de abrir campanha. |
| DB-004 | Origem diferente | Ajuda identifica origem; não afirma que os dados foram apagados. |
| DB-005 | Conexão inicial | Confere foreign_keys, journal_mode, application_id e user_version. |
| DB-006 | Banco novo | Aplica DDL, `schema_migrations`, `application_id` e `user_version` numa única transação, uma única vez; falha deixa `user_version` 0 sem tabelas. |
| DB-007 | Banco existente | Não reexecuta CREATE TABLE nem zera conteúdo. |
| DB-008 | Versão futura | Bloqueia escrita incompatível sem reduzir user_version. |
| DB-009 | Tipos STRICT | Valores não compatíveis são recusados; aplicação valida antes do bind. |
| DB-010 | JSON inválido | Regras/snapshots malformados não são gravados como válidos. |
| DB-011 | FK de impressão | Não permite inventário de printingId inexistente. |
| DB-012 | ex com pontuação errada | Bloqueia versão incompatível com a ruleset. |
| DB-013 | Normal e foil | Compartilham definição/versão quando só aparência muda. |
| DB-014 | Versão publicada | UPDATE/DELETE comum recusado; alteração exige nova versão. |
| DB-015 | Impressão publicada | Não troca assets nem definição no lugar: UPDATE/DELETE recusados por trigger e `printing_assets_declared_only` recusa par (papel, asset) fora dos bindings. |
| DB-016 | Arte BLOB | Bytes, hash e tamanho correspondem após reabrir. |
| DB-017 | Deduplicação de arte | Mesmo conteúdo é reutilizado sem duplicar BLOB. |
| DB-018 | Asset referenciado | Não é removido por limpeza de cache; miniaturas regeneráveis ficam fora do banco. |
| DB-019 | Falha no upload | Não publica carta com referência órfã. |
| DB-020 | Comando repetido | Mesmo ID/hash retorna recibo, sem segundo efeito. |
| DB-021 | Payload diferente | Mesmo ID com conteúdo diferente é recusado. |
| DB-022 | Primeira vitória duplicada | Grant key impede prêmio com outro commandId. |
| DB-023 | Saldo insuficiente | Compra é rejeitada com `INSUFFICIENT_CREDITS`, sem saldo negativo nem movimento. |
| DB-024 | Rollback econômico | Carteira, inventário, ledger e RNG voltam juntos. |
| DB-025 | Resposta perdida após commit | Recupera recibo já gravado. |
| DB-026 | Abertura retomada | Mesmas impressões e mesmo resultado. |
| DB-027 | RNG revertido | Falha antes do commit não avança RNG persistido. |
| DB-028 | CAS de perfil | Revisão incorreta altera zero linhas e não grava candidato. |
| DB-029 | CAS de partida | Versão de batalha não é confundida com revisão do perfil. |
| DB-030 | Ledger | Cada operação de saldo tem movimentos coerentes no mesmo commit. |
| DB-031 | Duelo suspenso | Retoma mão, ordem do deck, efeitos, decisão e RNG. |
| DB-032 | Tentativa única | Não aceita duas tentativas RUNNING/SUSPENDED no mesmo perfil. |
| DB-033 | Resultado terminal | Status terminal exige resultado e concessões idempotentes. |
| DB-034 | Escolha de prêmio | Direito pendente sobrevive à saída; escolha credita só uma vez. |
| DB-035 | Editor autosave | Resposta de revisão anterior não marca nova alteração como salva; autosave usa CAS no projeto, sem criar `operations`. |
| DB-036 | Publicação atômica | Regra, impressão, dependências, assets, vínculo projeto/revisão/operação e recibo confirmam juntos. |
| DB-037 | Rascunho inválido | Pode ser recuperado, mas não entra em campanha. |
| DB-038 | Segunda aba | Não abre conexão concorrente ao banco principal. |
| DB-039 | Troca de perfil | Job antigo não grava no perfil seguinte. |
| DB-040 | Transferência de aba | Fecha conexão/worker antigo antes de liberar proprietário. |
| DB-041 | Migração SQL interrompida | Rollback ou staging mantém banco original recuperável. |
| DB-042 | Conversão IndexedDB | N/A — sem implementação 2.x; o build não contém conversor nem leitor de IndexedDB (seção 22). |
| DB-043 | Conversão repetida | N/A — sem implementação 2.x; reimportar o mesmo perfil formato 4 cria outro perfil e outra linha em `profile_imports` (fingerprint não único). |
| DB-044 | Backup completo | Abre como SQLite comum, inclui BLOBs importados e tem manifesto com `databaseSha256` conferido na restauração. |
| DB-045 | Exportação de perfil | Não inclui dados privados de outros perfis. |
| DB-046 | Arte empacotada externa | Manifesto explica dependência do conteúdo instalado. |
| DB-047 | Importação conflitante | Mesmo ID/versão com hash diferente não sobrescreve. |
| DB-048 | SQLite externo malicioso | Não executa triggers/SQL do pacote como lógica da aplicação. |
| DB-049 | ZIP excedente ou traversal | Interrompe por limites e nomes inválidos antes de aplicar dados. |
| DB-050 | Falta de quota | Não sinaliza sucesso falso nem apaga saves para liberar espaço. |
| DB-051 | Integrity e foreign key checks | Ambos são executados nos gates definidos. |
| DB-052 | SQL parametrizado | Texto do usuário não executa instruções SQL. |
| DB-053 | Cache visual | Não remove arte master, cartas ou progresso. |
| DB-054 | Perfil STANDARD/CUSTOM | Concessões de criação não afetam campanha padrão. |
| DB-055 | Limpeza total explícita | Fecha handles e exige confirmação/backup; arquivar perfil não é apagar tudo. |

<a id="sqlite-30"></a>

## 🛠️ 30. Ordem de implementação

1. Worker SQLite local, boot com capabilities, abertura, runner de migração e um perfil.
2. Repositórios parametrizados, revisões, recibos e testes de rollback.
3. Coleção, deck, carteira, campanha e tentativa persistidos em SQLite.
4. Pausa/retomada e replay com referências de versões.
5. Assets BLOB e publicação atômica do editor.
6. Backup/restore, importação de perfil e diagnóstico (sem conversor legado: seção 22).
7. Testes de falha real em navegador e pacote instalado sem internet.

Não iniciar a oficina visual inteira antes de provar que uma carta publicada, um ataque e um save sobrevivem a fechar e reabrir o navegador.

<a id="sqlite-31"></a>

## 📚 31. Referências técnicas

Características de APIs se apoiam nas fontes abaixo; o schema, limites, política de perfis, comandos e organização do jogo são decisões do projeto.

- **[SQ01] SQLite WASM — persistência e VFS OPFS**
```text
https://sqlite.org/wasm/doc/trunk/persistence.md
```
- **[SQ02] MDN — Origin Private File System**
```text
https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
```
- **[SQ03] SQLite — PRAGMA**
```text
https://sqlite.org/pragma.html
```
- **[SQ04] SQLite — foreign keys**
```text
https://sqlite.org/foreignkeys.html
```
- **[SQ05] SQLite — generated columns**
```text
https://www.sqlite.org/gencol.html
```
- **[SQ06] SQLite — JSON functions**
```text
https://www.sqlite.org/json1.html
```
- **[SQ07] SQLite — STRICT tables**
```text
https://www.sqlite.org/stricttables.html
```
- **[SQ08] SQLite — transactions**
```text
https://sqlite.org/lang_transaction.html
```
- **[SQ09] MDN — Web Locks**
```text
https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
```
- **[SQ10] SQLite — Backup API**
```text
https://www.sqlite.org/backup.html
```
- **[SQ11] SQLite WASM — cookbook e exportação**
```text
https://sqlite.org/wasm/doc/trunk/cookbook.md
```
- **[SQ12] SQLite WASM — API OO1, importação e fechamento**
```text
https://sqlite.org/wasm/doc/trunk/api-oo1.md
```

As URLs são documentação de referência; o jogo não precisa consultá-las para funcionar.

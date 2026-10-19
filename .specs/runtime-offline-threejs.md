# 🧊 Runtime offline + Three.js — arquitetura de execução e apresentação

> **Versão:** 3.2.0  
> **Data:** 14 de outubro de 2026  
> **Escopo:** navegador local, single-player, campanha permanente, dados no dispositivo e 3D real  
> **Status:** especificação técnica; não inclui aplicação compilada, launcher ou assets de produção  
> **Complementos:** [gameplay.md](gameplay.md) · [campanha.md](campanha.md) · [interface-16x9.md](interface-16x9.md) · [persistencia-sqlite.md](persistencia-sqlite.md) · [efeitos-dsl.md](efeitos-dsl.md)
> **Direção visual obrigatória:** [pocket-light-v1](direcao-visual-pocket.md) — campo claro, paleta e animações na linguagem do TCG Pocket; os conceitos escuros anteriores não são referência.

> **Histórico:** desde a revisão documental 3.0, SQLite é a persistência e a autoria de cartas usa o Estúdio local, com regras e impressões versionadas. Detalhes normativos em [persistencia-sqlite.md](persistencia-sqlite.md) e [editor-de-cartas.md](editor-de-cartas.md). Nenhuma implementação 2.x foi publicada; não há saves anteriores a converter.
>
> **Revisão 3.2.0:** runner local especificado (seção 1.7), árvore de distribuição corrigida, threads e workers (seção 2.4), chaves de concessão canônicas, âncoras `HUMAN_*`/`NPC_*` e sementes de mundo recalculadas por projeção, catálogo de cenas completo, glossário de objetos de apresentação, identidade lógica de assets (`assetKey`/`artKey`) e escopo do fallback 2D.

---

## 🧭 Sumário

**Leitura visual obrigatória:** [direção Pocket](direcao-visual-pocket.md) · [referências identificadas](referencias-visuais.md).


- [📖 0. Contrato técnico e limites](#runtime-00)
- [📦 1. Distribuição realmente offline](#runtime-01)
  - [🖥️ 1.7. Runner local](#runtime-runner)
- [🛠️ 2. Stack e organização funcional](#runtime-02)
  - [🧵 2.4. Threads e workers](#runtime-threads)
- [🔁 3. Fluxo de comando e fonte de verdade](#runtime-03)
- [💾 4. Banco local e esquema de persistência](#runtime-04)
  - [🎨 4.3. Persistência de aparência no SQLite](#runtime-cosmetics-schema)
- [🔐 5. Transações, recibos e idempotência](#runtime-05)
- [⏸️ 6. Autosave, pausa e retomada](#runtime-06)
- [🗂️ 7. Exportação, importação e limites de garantia](#runtime-07)
  - [🖼️ 7.6. Importar arte de playmat](#runtime-custom-import)
- [🧬 8. Migrações e atualizações locais](#runtime-08)
- [🔒 9. Múltiplas abas e perfil ativo](#runtime-09)
- [🎲 10. RNG, determinismo e replays](#runtime-10)
- [🤖 11. IA local em worker](#runtime-11)
- [🧊 12. Three.js obrigatório e composição híbrida](#runtime-12)
  - [📖 12.5. Glossário de objetos de apresentação](#runtime-glossary)
- [🪟 13. Um renderer, múltiplos viewports](#runtime-13)
- [📐 14. Mundo 3D e campo claro na linguagem Pocket](#runtime-14)
  - [🧶 14.6. Estrutura e fundo](#runtime-playmats)
- [🃏 15. Construção da carta e acabamentos](#runtime-15)
- [🎨 16. Cor, luz e pós-processamento — Pocket Light](#runtime-16)
- [🖱️ 17. Picking, arrasto e controles](#runtime-17)
- [🏷️ 18. HUD, ancoragem e acessibilidade](#runtime-18)
- [🎞️ 19. Eventos, animação e abertura de pacotes](#runtime-19)
  - [🎬 19.1. Duas linhas de tempo e três estados](#runtime-animation-director)
- [🧰 20. Assets, manifest e dependências locais](#runtime-20)
- [🧹 21. Ciclo de vida e memória gráfica](#runtime-21)
- [⚡ 22. Qualidade gráfica e orçamentos](#runtime-22)
- [🛟 23. Perda de contexto, falhas e fallback](#runtime-23)
  - [🗂️ 23.5. Fallback 2D em DOM/CSS](#runtime-fallback-2d)
- [📲 24. PWA e cache — extensão opcional](#runtime-24)
- [🔊 25. Áudio, entrada e navegação local](#runtime-25)
- [✅ 26. Matriz de testes técnicos](#runtime-26)
- [🚧 27. Sequência de implementação](#runtime-27)
- [📚 28. Referências técnicas](#runtime-28)
- [🧭 29. Contrato final para implementação](#runtime-29)

---

<a id="runtime-00"></a>

## 📖 0. Contrato técnico e limites

Este documento transforma “local offline-first com Three.js” em requisitos de implementação verificáveis. Ele não fornece um executável nem afirma que os testes já foram executados.

**Produto:** jogo single-player local, campanha permanente, interface desktop 16:9 e apresentação tridimensional real. **Autoridade de regras:** [gameplay.md](gameplay.md). **Conteúdo:** [campanha.md](campanha.md). **Experiência de uso:** [interface-16x9.md](interface-16x9.md).

Não existe sincronização futura implícita. Não construir APIs de autenticação, salas, matchmaking, ranking, pagamentos ou infraestrutura de nuvem para esta versão.

| Termo | Significado nesta spec |
|---|---|
| Local-only | Dados e execução pertencem ao dispositivo; não há dependência de serviço remoto. |
| Offline-first | Internet ausente é operação normal, inclusive no primeiro uso após instalação completa. |
| Servidor estático local | Processo de entrega dos arquivos em loopback; não é backend de jogo. |
| Motor local | Funções que validam ações e resolvem o estado da partida. |
| Persistência | SQLite e backups explícitos; nunca uma simulação de save apenas em memória. |
| 3D obrigatório | Mesa, cartas, pacotes e dioramas usam geometria Three.js. |
| Fallback 2D | Caminho de recuperação/acessibilidade quando GPU ou contexto falham; não substitui a entrega 3D normal. |

As referências técnicas no final sustentam características das APIs. Orçamentos, nomes de módulos, formatos e políticas abaixo são decisões próprias do projeto.

---

<a id="runtime-01"></a>

## 📦 1. Distribuição realmente offline

## 1.1. Pacote principal

A distribuição deve conter aplicação compilada, catálogo integral, capítulos, cartas, miniaturas, shaders, modelos, texturas, áudio, fontes utilizadas, ajuda, workers e decodificadores necessários.

O jogador pode extrair o pacote, desligar a internet e iniciar uma campanha nova. O teste não pode depender de recursos que sobraram no cache de uma execução online.

```text
Pacote local completo
→ Executar start-local.cmd (Windows) ou start-local.sh (macOS/Linux)
→ node runner/server.mjs serve dist/ em http://localhost:4173/
→ Carregar app, assets e saves
→ Jogar sem conexão externa
```

O servidor estático serve somente arquivos de `dist/` e só escuta loopback. Não expor em `0.0.0.0`, rede doméstica ou internet. O contrato completo do runner está na seção 1.7.

## 1.2. Build e runtime não são a mesma coisa

Na máquina de desenvolvimento, é permitido instalar dependências e preparar o build com internet. Essa permissão não se estende ao launcher entregue ao jogador.

Uma distribuição que executa `npx` para baixar um servidor na primeira inicialização **não** cumpre este contrato. O runner é o arquivo `runner/server.mjs` incluído no pacote e depende apenas de Node.js ≥ 20 já instalado pelo jogador, requisito declarado no `LEIA-ME.txt` (seção 1.7).

O primeiro alvo é navegador com servidor estático local. Um aplicativo desktop empacotado pode ser uma extensão, mas Electron/Tauri não são dependências obrigatórias desta spec.

## 1.3. Origem estável

Adotar `http://localhost:4173` como origem canônica do pacote browser. Não alternar automaticamente para outra porta se ela estiver ocupada: explicar o conflito. `localhost`, `127.0.0.1`, outras portas e HTTPS são origens diferentes para armazenamento. [T13]

Usar caminhos relativos para assets e rotas `#/...`, evitando exigir reescrita de rotas no servidor estático. A mudança da pasta em disco não deve mudar a origem do navegador.

Ao detectar save aparentemente ausente, a ajuda deve lembrar verificar origem e perfil antes de criar outro histórico.

## 1.4. Não prometer duplo clique

O modo de entrega não é abrir `index.html` via `file://`. O manual do Three.js orienta o uso de servidor local para recursos sujeitos a restrições de segurança, como carregamento de módulos e assets. [T01]

Um arquivo HTML único, sem dependências, não é requisito. Dividir conteúdo e modelos em arquivos locais é compatível com offline-first.

## 1.5. Arquivo distribuído

```text
card-campaign/
├── start-local.cmd          # Windows: verifica o Node e executa node runner/server.mjs
├── start-local.sh           # macOS/Linux: idem
├── runner/
│   └── server.mjs           # servidor estático só com módulos nativos do Node ≥ 20
├── dist/                    # única pasta servida ao navegador
│   ├── index.html
│   ├── manifest.json        # assetKey → caminho, tipo, bytes e sha256 (seção 20.1)
│   ├── assets/              # bundles JS/CSS, inclusive os workers de storage, IA e mídia
│   ├── vendor/
│   │   └── sqlite/          # runtime SQLite WASM: JS, .wasm e workers auxiliares do VFS
│   ├── content/             # catálogo, campanha, produtos, decks e diálogos versionados
│   ├── models/
│   ├── textures/            # fallbacks procedurais podem ser gerados em runtime
│   ├── audio/               # pode conter slots vazios; ausência de áudio não bloqueia
│   ├── fonts/               # somente fontes cuja distribuição esteja autorizada
│   └── decoders/            # Draco/KTX2, somente quando usados
├── LICENSES/                # licenças do jogo e das dependências empacotadas
└── LEIA-ME.txt              # requisito Node ≥ 20, como iniciar, origem fixa e backup
```

`manifest.json` fica **dentro** de `dist/`: o runner não serve nada fora dessa pasta, e a aplicação lê o manifesto pela mesma origem. `runner/`, `LICENSES/` e `LEIA-ME.txt` ficam na raiz do pacote e não são acessíveis pelo navegador.

A árvore é um contrato de entrega, não a afirmação de que esses arquivos executáveis acompanham as specs.

---


## 1.6. SQLite WASM incluído

Incluir runtime SQLite, WASM e workers auxiliares da release homologada, todos locais, em `dist/vendor/sqlite/`. O runner entrega COOP `same-origin`, COEP `require-corp` e CORP `same-origin`, além dos MIME corretos (inclusive `application/wasm`), para o VFS `opfs`.

Um Storage Worker separado do worker de IA mantém a conexão (seção 2.4). O caminho lógico do banco pertence ao OPFS, não à pasta `dist`. Inicialização, PRAGMAs, lock e diagnóstico seguem [persistencia-sqlite.md](persistencia-sqlite.md#sqlite-2).

<a id="runtime-runner"></a>

## 1.7. Runner local

`runner/server.mjs` é um servidor estático mínimo escrito só com módulos nativos do Node (`node:http`, `node:fs`, `node:path` e, para abrir o navegador, `node:child_process`). Não há dependência npm, `npx`, instalação ou download em runtime.

| Item | Contrato |
|---|---|
| Requisito | Node.js ≥ 20 já instalado pelo jogador e declarado no `LEIA-ME.txt`. O runner confere `process.versions.node` e encerra com mensagem clara se a versão for menor. |
| Endereços | Escuta `127.0.0.1` **e** `::1`, porta `4173`, para que `localhost` funcione qualquer que seja a resolução do sistema. Nunca `0.0.0.0`, `::` ou interface de rede. Se o sistema não tiver IPv6 (`EADDRNOTAVAIL` em `::1`), segue apenas com `127.0.0.1` e avisa no terminal. |
| Porta ocupada | `EADDRINUSE` em qualquer dos dois endereços encerra com mensagem clara (“A porta 4173 já está em uso; feche o outro programa e tente de novo”). Não troca de porta: outra porta é outra origem e outro banco (seção 1.3). |
| Raiz servida | Somente `dist/`. O caminho da URL é decodificado, normalizado e resolvido (`realpath`); se sair de `dist/`, contiver byte nulo, segmento `..`, barra invertida ou caminho absoluto, responde 404. Links simbólicos não escapam da raiz. |
| Listagem | Sem listagem de diretório. Diretório responde 404. |
| Rotas | A aplicação usa rotas `#/...`; só `/` entrega `index.html`. Caminho inexistente responde 404, sem fallback de SPA. |
| Métodos | `GET` e `HEAD`; os demais respondem 405. |
| Host | Servir apenas `Host: localhost:4173`. Com `127.0.0.1:4173` ou `[::1]:4173`, qualquer caminho redireciona (307) para o mesmo caminho em `http://localhost:4173`, preservando a origem canônica (seção 1.3). Outro valor responde 403 (proteção contra DNS rebinding). |
| MIME | Tabela fixa por extensão: `.html` `text/html; charset=utf-8`, `.js`/`.mjs` `text/javascript; charset=utf-8`, `.css` `text/css; charset=utf-8`, `.json` `application/json`, `.wasm` `application/wasm`, `.png` `image/png`, `.jpg` `image/jpeg`, `.webp` `image/webp`, `.glb` `model/gltf-binary`, `.gltf` `model/gltf+json`, `.ktx2` `image/ktx2`, `.woff2` `font/woff2`, `.ogg` `audio/ogg`, `.m4a` `audio/mp4` e `.txt` `text/plain; charset=utf-8`. Extensão desconhecida: `application/octet-stream`. |
| Cabeçalhos | Em **toda** resposta, inclusive erros: `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`, `Cross-Origin-Resource-Policy: same-origin` e `X-Content-Type-Options: nosniff`. `index.html` e `manifest.json` usam `Cache-Control: no-cache`. |
| Navegador | Depois de escutar, abre `http://localhost:4173/` no navegador padrão. `--no-open` desativa. Falha ao abrir não encerra o servidor; o terminal mostra o endereço. |
| Encerramento | Ctrl+C fecha os sockets e sai. Mensagens do terminal em PT-BR. |

`start-local.cmd` (Windows) e `start-local.sh` (macOS/Linux) só verificam se `node` existe no `PATH` e executam `node runner/server.mjs`, repassando argumentos como `--no-open`. Sem Node, mostram o requisito e apontam o `LEIA-ME.txt`; não baixam nada.

O runner não tem API, não grava arquivos e não conhece o banco. Banco, saves e backups pertencem ao navegador (OPFS) e às exportações explícitas.

---

<a id="runtime-02"></a>

## 🛠️ 2. Stack e organização funcional

## 2.1. Stack proposta

TypeScript, HTML/CSS e Three.js, com ferramenta de build que produza bundles locais. A documentação de instalação do Three.js apresenta instalação por npm e fluxo com build/local server. [T01]

Escolher e fixar a versão exata de `three` no lockfile no início da implementação. Core e addons devem vir da mesma versão. Não inventar nesta spec um número “mais recente” nem usar URL `@latest`.

Não é obrigatório adicionar React ou outra biblioteca de UI. Qualquer framework escolhido deve respeitar a separação entre motor, persistência e apresentação.

## 2.2. Estrutura de código

```text
src/
├── domain/
│   ├── battle/          # estados, comandos, resolução, condições e dano
│   ├── cards/           # definições e operações de efeitos
│   ├── campaign/        # grafo, objetivos e desbloqueios
│   ├── economy/         # pacotes, produtos, concessões e recibos
│   └── random/          # fontes injetáveis e streams independentes
├── application/
│   ├── commands/        # coordenação e confirmação transacional
│   ├── sessions/        # perfil local, pausa e tentativa ativa
│   ├── ai/              # controlador do NPC
│   └── projections/     # modelos de tela e visões autorizadas
├── infrastructure/
│   ├── storage/         # SQLite, migrações e revisões
│   ├── files/           # importação e exportação de saves
│   ├── assets/          # manifesto e loaders locais
│   └── workers/         # entradas dos workers de storage, IA e mídia (seção 2.4)
├── presentation/
│   ├── ui/              # HTML semântico, componentes e navegação
│   ├── three/           # renderer, cenas, câmeras, materiais e picking
│   ├── animation/       # agenda de apresentação de eventos
│   └── audio/           # recursos locais e preferências
├── content/
│   ├── cards/
│   ├── decks/
│   ├── campaign/
│   ├── products/
│   ├── dialogue/
│   └── fixtures/
└── tests/
    ├── unit/
    ├── integration/
    ├── offline/
    └── visual/
```

Código de domínio próprio usa funções e dados, sem classes. Isso não impede instanciar `THREE.Scene`, `THREE.Mesh` e os demais objetos exigidos pela biblioteca.

## 2.3. Dependências permitidas

`domain` não importa DOM, Three.js, SQLite ou arquivos de imagem. `presentation` consulta projeções e envia intenções; não grava diretamente saldos.

O código de campanha não deve buscar um mesh chamado “chefe” para decidir que o chefe foi derrotado. IDs de conteúdo ligam as camadas sem transformar cena em banco de dados.

<a id="runtime-threads"></a>

## 2.4. Threads e workers

| Contexto | Responsabilidade | Não faz |
|---|---|---|
| Thread principal | Roteador, UI HTML, Three.js/renderer, diretor de animações e camada de aplicação, **incluindo o motor de regras autoritativo** (funções puras e rápidas que validam e resolvem comandos). | Não abre conexão SQLite; não executa a busca da IA nem decodificação pesada de imagem. |
| Storage Worker | Única conexão SQLite (VFS OPFS): migrações, transações, recibos, exportação e restauração. | Não resolve regras de jogo. |
| AI Worker | Carrega o **mesmo bundle de domínio** (motor) para enumerar ações legais e simular sobre a observação filtrada (seção 11). | Não recebe estado completo nem grava; sua sugestão é revalidada na thread principal. |
| Media Worker | Validação de assinatura/cabeçalho/dimensões, decodificação e normalização de imagens (`createImageBitmap`/`OffscreenCanvas`), ZIP com `fflate` e SHA-256 para importações e exportações. | Não abre SQLite: entrega bytes, metadados e hashes ao Storage Worker por mensagem. Não decide regras. |
| Workers auxiliares do SQLite | Criados pelo VFS conforme a release homologada em `dist/vendor/sqlite/`. | Não são endereçados pela aplicação. |

Nenhum worker possui DOM ou objetos Three.js. Mensagens carregam dados serializáveis por structured clone ou `ArrayBuffer` transferido; nunca funções, meshes, promessas ou handles de banco. Cada mensagem de trabalho leva `jobId` e o contexto necessário para descartar respostas antigas (seção 6.5).

Como o motor é o mesmo código na thread principal e no AI Worker, a versão do ruleset e do bundle de domínio é verificada no handshake do worker; versões divergentes recriam o worker, nunca jogam com regras diferentes.

---

<a id="runtime-03"></a>

## 🔁 3. Fluxo de comando e fonte de verdade

```text
Mouse / teclado / toque
→ Intenção na UI
→ Controlador local
→ Validação do estado e da versão
→ Resolução pura pelo motor
→ Transação SQLite
→ Confirmação de gravação
→ Publicação de estado / eventos
→ Animações Three.js e atualização HTML
```

## 3.1. Contratos

```typescript
type CommandEnvelope = {
  commandId: string;
  profileId: string;
  expectedRevision: number;
  expectedStateVersion?: number; // comandos de duelo
  writerEpoch: number;
  type: string;
  payload: unknown;
  payloadHash: string; // SHA-256 do payload canônico RFC 8785 (JCS)
};

type CommandResult = {
  committedRevision: number;
  eventIds: string[];
  receiptId?: string;
  pendingDecisionId?: string;
};
```

Os tipos ilustram o contrato; cada comando concreto deve ter payload discriminado e validação em runtime.

`payloadHash` permite reconhecer o reenvio legítimo do mesmo comando: mesmo `commandId` com o mesmo hash devolve o recibo anterior; com hash diferente falha com `COMMAND_PAYLOAD_MISMATCH`. `writerEpoch` descarta comandos de uma aba, worker ou formulário de uma época anterior (seção 9.2). `expectedStateVersion` é obrigatório nos comandos que alteram um duelo (seção 3.5).

**Hashes de JSON:** todo hash de documento JSON do projeto (payload, snapshot, definição, impressão, manifesto) usa canonicalização **RFC 8785 (JCS)**, codificação UTF-8 e **SHA-256**, representado em hexadecimal minúsculo. Não usar `JSON.stringify` com ordem de inserção nem a serialização de outra linguagem como forma canônica.

Um clique em “Atacar” não informa dano final. Um clique em “Abrir” não informa qual carta recebeu. Esses resultados pertencem ao motor e à economia locais.

## 3.2. Projeções

A UI recebe dados apropriados à tela. O bot recebe sua mão e dados públicos, nunca o estado completo por conveniência.

Essa separação promove regras justas e testes; não é uma promessa de proteção criptográfica contra o proprietário do dispositivo, que pode inspecionar o programa.

## 3.3. Alterações temporárias

Hover, arrasto e preview não modificam o estado autoritativo. O próprio arrasto pode mover um objeto de apresentação, mas um alvo inválido simplesmente retorna à posição confirmada.

Rascunhos de deck podem atualizar a UI imediatamente e autosalvar; partidas, sorteios e saldos só se apresentam como concluídos depois da transação.

## 3.4. Uma operação por vez

Serializar comandos mutáveis por perfil. Mesmo com cliques rápidos e worker ativo, não executar duas ações sobre a mesma revisão como se fossem independentes. O segundo comando precisa revalidar a revisão atual.

## 3.5. Envelope de aplicação e ação de batalha

`commandId` identifica a operação de aplicação, incluindo compra e save. Para uma ação de batalha, o adaptador pode reutilizar esse valor como `actionId` do contrato em `gameplay.md`.

`expectedRevision` é a revisão do perfil/transação. `expectedStateVersion` é a versão específica do estado do duelo. São contadores diferentes: o jogador pode editar um deck durante uma suspensão sem alterar o estado da batalha. Validar ambos quando necessário; não presumir igualdade numérica.


---

<a id="runtime-04"></a>

## 💾 4. Banco local e esquema de persistência


**SQLite WASM em worker, persistido por OPFS**, é a fonte única de verdade. O contrato completo e o DDL estão em [persistencia-sqlite.md](persistencia-sqlite.md) e [schema-v1.sql](database/schema-v1.sql).

**Arquivo lógico:** `/card-campaign/main.sqlite3`. **Schema SQL:** `1`. Não há banco IndexedDB anterior a converter (seção 4.5); a numeração de migrações SQL começa no schema `1`.

O schema cobre perfis, catálogo versionado, impressões, assets BLOB, coleção, decks, economia, campanha, tentativas, replays, presets e projetos do Estúdio. Tabelas relacionais guardam vínculos e quantidades; JSON validado guarda AST de efeitos e snapshots. Não persistir toda a campanha numa única string.

O Storage Worker é proprietário da conexão e responde a comandos tipados. O servidor local continua estritamente estático.

## 4.1. O que não guardar no save

Não serializar `Mesh`, `Scene`, `Texture`, renderer, DOM, sockets inexistentes, funções, promessas ou referências a workers. Não salvar a posição intermediária de uma moeda como resultado de aleatoriedade.

O save contém fatos de jogo e IDs de apresentação, não objetos de GPU.

## 4.2. Preferências e cache

`localStorage` pode armazenar uma preferência pequena de boot quando necessário, mas nunca ser a única cópia de inventário. Cache de assets e estado de campanha são subsistemas distintos.

Limpar miniaturas regeneráveis não deve apagar o perfil. A ação “Apagar todos os dados” precisa ser explícita e independente da limpeza de cache.


<a id="runtime-cosmetics-schema"></a>


## 4.3. Persistência de aparência no SQLite

| Tabela | Chave | Dados |
|---|---|---|
| `cosmetic_entitlements` | perfil + cosmético | Desbloqueio, origem e recibo. |
| `cosmetic_presets` | preset + revisão | Parâmetros e acessórios validados. |
| `assets` | SHA-256 | Linha endereçada por conteúdo: BLOB importado; linha BUNDLED opcional só para integridade (seção 20.1). |
| `appearance_drafts` | perfil + contexto | Rascunho separado de preset aplicado. |
| `cosmetic_asset_refs` / `appearance_draft_assets` | proprietário + asset | Retenção dos bytes usados. |
| `profile_appearance` / `deck_appearance` | perfil/deck | Herança ou revisão explícita do preset. |
| `attempt_asset_refs` | tentativa + asset | Retenção para retomada e replay. |

O ruleset continua `local-campaign-v2`. Snapshot visual é resolvido no início da tentativa; editar um preset não reescreve a partida. Os tipos TypeScript abaixo representam DTOs de aplicação, não nomes de tabelas.

## 4.4. Esquemas de aparência

```typescript
type PlaymatDisplayMode = "TURN_OWNER" | "PLAYER_FIXED" | "NEUTRAL";

type PlaymatSelection = {
  playmatId: string;
  definitionVersion: number;
  variantId: string;
  customImageHash?: string;
  crop: { x: number; y: number; width: number; height: number };
  accentHex: string;
  materialProfile: "CLOTH" | "MATTE" | "SYNTHETIC";
  patternOpacity: number;
  ambientLevel: "OFF" | "LOW" | "STANDARD";
  impactReaction: "OFF" | "RIPPLE";
};

type CosmeticPreset = {
  presetId: string;
  revision: number;
  profileId: string;
  name: string;
  playmat: PlaymatSelection;
  sleeveId: string;
  coinId: string;
  defaultEntryFlairId: string;
};

type MatchPresentationSnapshot = {
  presentationVersion: string;
  arenaId: string;
  playerCosmetics: CosmeticPreset;
  opponentCosmetics: CosmeticPreset;
  resolvedAssetIds: readonly string[];
};
```

`crop` usa coordenadas normalizadas na imagem de origem: x/y entre 0 e 1, largura/altura positivas, x+largura e y+altura no máximo 1. A proporção do recorte é validada usando dimensões reais da imagem; valores normalizados iguais não garantem 4:3 em toda origem.

Cor aceita somente `#RRGGBB`; opacidade de padrão 0–0,25; material/efeitos usam allowlist. Decalques opcionais também usam IDs de conteúdo e limites de quantidade, escala e região segura.

O flair de entrada por cópia vive somente em `deck_entries.entry_flair_id` ([persistência §15](persistencia-sqlite.md#sqlite-15)); o preset guarda apenas o `defaultEntryFlairId` usado quando a entrada não define um. Ao duplicar o deck, as entradas são copiadas com seus flairs. Não usar nome da carta como chave quando duas cópias podem ter aparências diferentes.

Preferências de conforto não pertencem ao snapshot: ficam em `settings` e podem substituir visualmente os cosméticos sem reescrever regras ou histórico.


## 4.5. Conversão dos dados anteriores — não aplicável

Nenhuma implementação 2.x foi publicada, portanto não existem perfis IndexedDB nem saves `.campaign-save.json` 2/3 a converter. O runtime **não** inclui conversor legado, leitor de IndexedDB ou importador desses formatos. [Persistência, seção 22](persistencia-sqlite.md#sqlite-22) condiciona a conversão à existência de saves; essa condição não ocorre nesta linha.

Nota histórica: as revisões documentais 2.0/2.1 descreviam IndexedDB e saves JSON; a revisão 3.0 trocou esse desenho por SQLite antes de qualquer implementação. Os critérios R-076 e R-078 permanecem na matriz apenas para rastreabilidade, marcados como N/A.

Playmats nascem na `definitionVersion 2` (perfil `pocket-light-v1`); não há presets de versão anterior nem migração de presets.

## 4.6. Gravação de preset e compra de cosmético

Salvar preset valida referências e posse, grava nova revisão e associa ao deck/perfil em uma transação. Uma prévia bloqueada no Empório não é um entitlement.

Comprar cosmético: validar saldo/condição → debitar Créditos → criar entitlement → registrar recibo, tudo atomicamente. Reenvio da mesma operação retorna o mesmo recibo. Comprar novamente item permanente já possuído não debita outra vez.

Cancelar uma prévia não altera banco. Trocar apenas câmera/qualidade não cria uma nova revisão de preset a cada frame.

---

<a id="runtime-05"></a>

## 🔐 5. Transações, recibos e idempotência


## 5.1. Preparar fora, confirmar dentro

```text
Consultar recibo por commandId
→ ler snapshot e revisão
→ preparar candidato, hashes e assets fora da transação
→ BEGIN IMMEDIATE no Storage Worker
→ conferir novamente recibo, payloadHash, epoch e revisões
→ aplicar alterações, RNG, relações e histórico
→ registrar recibo e nova revisão
→ COMMIT
→ responder à aplicação
→ apresentar eventos
```

SQL é parametrizado. Zero linhas na atualização condicionada por revisão causa rollback, não uma tentativa de mesclar dois estados. Uma operação repetida com payload diferente é erro.

Não esperar animação, input, hash, arquivo ou decodificação durante a transação. O worker serializa handlers; a UI não recebe uma API de SQL arbitrário.

## 5.2. Escopo atômico

Abertura de pacote: debitar pacote + registrar cartas + atualizar RNG + recibo.

Compra: debitar Créditos + creditar produto + recibo.

Fim de batalha: registrar resultado + objetivos + desbloqueios + saldos + recibos + limpar ponteiro ativo.

Prêmio com escolha: registrar direito ao prêmio no resultado; escolha posterior credita a opção uma única vez. Não fingir que uma carta ainda não escolhida já está no inventário.

## 5.3. Chaves únicas

Há duas proteções independentes:

1. **Idempotência de comando:** `UNIQUE(profile_id, command_id)` na tabela `operations`. Reenvio do mesmo comando devolve o mesmo recibo (seção 3.1).
2. **Concessão única de negócio:** `grant_key` em `reward_grants`, escopada por perfil pela coluna `reward_grants.profile_id`. Dois cliques podem gerar `commandId` diferentes; a chave de negócio continua impedindo a segunda recompensa.

Chaves canônicas de concessão:

```text
onboarding:{campaignId}
first-clear:{campaignId}:{nodeId}
objective:{campaignId}:{objectiveId}
discovery:{campaignId}:{nodeId}
opening:{openingId}
cosmetic:{milestoneId}:{cosmeticId}
custom-grant:{printingId}:{grantBatchId}
```

`profileId` **não** entra na chave, porque já é coluna da linha. A versão de conteúdo/campanha também **não** entra: uma atualização de conteúdo nunca concede de novo a primeira vitória, um objetivo ou uma Descoberta já recebidos. A tabela normativa, com origem e operação de cada chave, está em [persistência, seção 13](persistencia-sqlite.md#sqlite-13).

A mesma chave reapresentada por recarregamento não cria uma segunda concessão.

## 5.4. Falha

Antes do commit: nenhuma alteração parcial é publicada. Depois do commit: recuperar o recibo existente, mesmo que a tela não tenha exibido o resultado.


Sucesso de `COMMIT` confirma a operação na camada de persistência. A UI não mostra “Salvo” antes dessa resposta. Ainda não há promessa de imunidade a falha física, exclusão de dados do navegador ou perda de quota; manter backup exportável.

---

<a id="runtime-06"></a>

## ⏸️ 6. Autosave, pausa e retomada

## 6.1. Checkpoints

Persistir após cada comando aceito que altera a partida e em cada fronteira de decisão pendente. Não depender do evento de fechamento da página, que pode não completar operações assíncronas.

O checkpoint inclui:

```text
Estado completo serializável
Versão de regras e catálogo
Snapshot do deck
Fila de efeitos e ponto de continuação
Decisão pendente e controlador
RNGs e cursores
Contadores de turno e uso
Ponteiro do último evento confirmado
Status de pausa
```

Filas de efeito usam IDs/opcodes e dados. Uma closure JavaScript não pode ser a única representação de uma resolução ainda incompleta.

## 6.2. Pausa real

Ao solicitar pausa, impedir novos comandos e impedir o worker de aplicar outra ação. Uma unidade atômica já iniciada termina no checkpoint válido; então o status passa a pausado.

Congelar simulação, animações pertinentes e áudio conforme preferência. A ajuda pode permanecer navegável. Não cobrar tempo de decisão, pois a campanha não usa derrota por relógio.

A Page Visibility API comunica mudanças de visibilidade; navegadores também podem limitar timers e animação em abas ocultas. Usar o evento explicitamente, sem supor que a frequência de quadros representa passagem de turnos. [T18]

## 6.3. Retomar

Carregar o checkpoint, validar compatibilidade e reconstruir as cenas. A decisão pendente deve reaparecer antes de ações incompatíveis.

A partida não precisa reproduzir toda a sequência visual passada. Pode reconstruir o estado confirmado e registrar “Retomado” no histórico de interface, sem inventar evento de regra.

## 6.4. Sair e voltar à coleção

Há um duelo ativo por perfil. O jogador pode suspender, consultar coleção ou editar um deck; o snapshot da tentativa não muda. Outra batalha exige concluir ou abandonar a ativa.

Salvar e sair é diferente de desistir. Não registrar derrota só porque o jogador voltou ao início.

## 6.5. Worker tardio

Cada trabalho inclui `jobId`, `attemptId`, revisão e epoch. Ao pausar ou trocar perfil, resultados antigos ficam inválidos. Revalidar tudo antes de executar um comando sugerido pelo bot.

## 6.6. Estado canônico

O status persistido de uma tentativa assume somente `RUNNING`, `SUSPENDED`, `FINISHED` ou `ABANDONED`. `RUNNING` identifica a tentativa em execução; `SUSPENDED` é a tentativa pausada, que a UI apresenta como “Pausado”; `FINISHED` e `ABANDONED` são terminais. Não criar dois estados persistidos equivalentes chamados `PAUSED` e `SUSPENDED`.

Preparação da partida (embaralhar, mão inicial, colocar Básicos, moeda inicial) é uma **fase** dentro do `state_json` da tentativa `RUNNING`, não um status persistido. Não existem `CREATED` nem `SETUP` como status de tentativa; uma tentativa interrompida durante a preparação retoma na mesma fase.


---

<a id="runtime-07"></a>

## 🗂️ 7. Exportação, importação e limites de garantia


## 7.1. Formatos atuais

| Formato | Conteúdo |
|---|---|
| `.sqlite3` | Banco completo: todos os perfis, rascunhos, cartas autorais e BLOBs. |
| `.campaign-profile.zip`, formato 4 | Um perfil e suas dependências de conteúdo/mídia. |
| `.cardpack.zip`, formato 1 | Conteúdo autoral, sem saldos ou progresso. |

Não há formato `.campaign-save.json` 2/3 a importar: nenhuma implementação 2.x foi publicada (seção 4.5). O número `4` do perfil apenas evita colisão com rótulos de documentação anteriores; não implica leitor dos formatos 2/3.

## 7.2. Exportação coerente

Suspender em checkpoint, drenar comandos e produzir snapshot com API de exportação SQLite homologada. Não copiar bytes do banco enquanto outro handler grava. Assets BUNDLED permanecem dependências do pacote instalado; BLOBs importados acompanham o banco.

## 7.3. Importação

Validar tamanho, estrutura, versões, referências, hashes e schema em staging. Não executar código/SQL contido em importações. Um backup SQLite recebido não vira banco ativo sem análise; preferir transferir dados validados para schema canônico novo.

Perfil importado cria nova identidade local por padrão; substituição exige confirmação e backup. Não mesclar inventários/recibos de históricos independentes.

## 7.4. Limites reais

Armazenamento da origem pode ser removido e sofrer quota. Solicitar persistência quando disponível não substitui backup externo. Um backup dentro do mesmo armazenamento não protege contra limpeza completa daquela origem.

## 7.5. Mensagens

```text
“Salvo no SQLite deste navegador.”
“Este backup inclui todos os perfis locais.”
“As artes importadas estão incluídas; assets do jogo exigem o pacote compatível.”
“Arquivo validado; escolha criar um novo perfil ou substituir com confirmação.”
```

Procedimentos e limites normativos estão em [persistencia-sqlite.md](persistencia-sqlite.md#sqlite-23).

<a id="runtime-custom-import"></a>

## 7.6. Importar arte de playmat

O arquivo do usuário é conteúdo raster, não código. Aceitar somente imagens estáticas PNG/JPEG/WebP após verificar assinatura real, cabeçalho, dimensões, tamanho e ausência de animação. A extensão sozinha não basta. APNG/WebP animado são rejeitados nesta revisão.

Limites normativos da UI: 10 MiB por entrada, no máximo 4096 px por eixo e 16.777.216 pixels. Verificar cabeçalho antes de decodificar para evitar expansão inesperada. Processo pesado ocorre no Media Worker (seção 2.4), fora do caminho síncrono de interação, com cancelamento e limite de trabalho.

Pipeline:
```text
Selecionar Blob
→ validar bytes/cabeçalho/dimensões
→ decodificar imagem local
→ normalizar orientação e composição opaca
→ recortar proporcionalmente
→ gerar master normalizado e miniatura
→ calcular hash de conteúdo
→ persistir BLOB + metadados + referências + preset em transação SQLite
→ disponibilizar prévia
```

`createImageBitmap` fornece uma API de decodificação/recorte e opções de redimensionamento; não substitui validação dos limites da aplicação. [T24] Liberar bitmap e object URLs quando não forem mais utilizados.

Não guardar o caminho absoluto original nem carregar o arquivo novamente pelo path. Armazenar a cópia normalizada no registro local. Remover metadados não necessários à apresentação. A imagem do usuário nunca vai para um serviço externo.


## 7.7. Artes customizadas no backup

Masters de playmat, artes e máscaras de cartas importadas ficam como BLOBs SQLite, com relações de retenção. Exportação completa `.sqlite3` inclui esses bytes. Exportação de perfil inclui os assets alcançáveis por seus presets, decks, projetos e tentativas.

Importação `.cardpack.zip` não carrega progresso ou Créditos. A política comum de limites, nomes e descompressão está em [persistência, seções 24 e 25](persistencia-sqlite.md#sqlite-24).

Os backups descritos são formatos do jogo a implementar, diferentes do ZIP documental desta entrega.

## 7.8. Exclusão e coleta de assets

Excluir um preset não remove automaticamente a imagem ainda referenciada por outro preset, tentativa ou replay. Executar coleta por referências após transação concluída.

“Limpar cache visual” pode remover miniaturas e texturas GPU regeneráveis. Não remove o Blob master de uma imagem customizada usada por um save. A opção “Remover artes importadas” é separada, mostra dependências e pede confirmação.

Na falta de espaço, oferecer excluir derivados/replays ou exportar backup. Não substituir silenciosamente uma imagem customizada por neutro e depois apagar sua referência original.

---

<a id="runtime-08"></a>

## 🧬 8. Migrações e atualizações locais

## 8.1. Versões distintas

Guardar `appVersion`, `databaseSchemaVersion`, `saveFormatVersion`, `contentVersion`, `rulesetVersion` e versão de assets. Elas não precisam subir juntas.

Uma correção de textura não deve obrigar reescrever toda a campanha. Uma alteração de dano precisa de versão funcional, não apenas de arquivo de imagem.

## 8.2. Atualização

O jogador instala um novo pacote local de modo explícito. Não consultar um endpoint de update no boot. Preservar a origem canônica para manter o acesso ao mesmo banco.

Antes de migrar, validar o pacote e produzir um backup quando viável. Migração incompatível ou quota insuficiente deve abortar com explicação e manter o original utilizável, não resetar o perfil automaticamente.

## 8.3. Partidas em andamento

Manter definições/versionamentos necessários para retomar a tentativa antiga ou solicitar que o usuário conclua/abandone antes de uma atualização incompatível. Não executar o mesmo replay sob regras diferentes silenciosamente.

As migrações precisam de funções explícitas por origem/destino e fixtures de saves antigos. Desconhecer uma versão futura produz recusa informativa, não interpretação aproximada.


## 8.4. Migrações SQL

Usar scripts ordenados, hash, `schema_migrations` e `PRAGMA user_version`. Aplicar schema/dados e marcador na mesma transação quando possível. Não executar o schema de criação toda inicialização.

Não há conversão de IndexedDB nesta linha (seção 4.5). Não confundir versão de documento, SQLite, schema, catálogo, ruleset (`local-campaign-v2`) ou formato de carta (`dataVersion 2`).

---

<a id="runtime-09"></a>

## 🔒 9. Múltiplas abas e perfil ativo


## 9.1. Único proprietário do banco

Adquirir Web Lock exclusivo por origem/banco antes de abrir o VFS. [T14] A segunda aba não abre outra conexão, mesmo “somente leitura”; mostra aviso e instrução para retornar à aba ativa. Esse contrato substitui a política antiga por perfil.

## 9.2. Revisões e fencing

Comandos ainda conferem revisões e `writerEpoch` para descartar resultados de IA ou formulários antigos. Lock é coordenação de runtime; revisão é consistência de negócio. Não usar relógio de parede como autoridade.

## 9.3. Capacidade ausente

Sem Web Locks, OPFS, Worker ou isolamento requerido pelo VFS escolhido, bloquear execução persistente com diagnóstico. Não criar fallback de trava, modo leitura ou fallback autoritativo em localStorage/IndexedDB. Um laboratório volátil só existe em build de desenvolvimento, não abre o banco e precisa de aviso inequívoco.

## 9.4. Transferência e perfis

Transferência cooperativa suspende, conclui escrita, fecha conexão/worker e libera o lock antes da próxima aba assumir. Ao trocar perfil, manter a conexão única, invalidar jobs antigos e reconstruir as projeções.

---

<a id="runtime-10"></a>

## 🎲 10. RNG, determinismo e replays

## 10.1. Streams separados

| Stream | Consumo autorizado |
|---|---|
| `battleRng` | Embaralhamento, moeda, busca aleatória e geração de Energia. |
| `economyRng` | Pacotes aleatórios e concessões explicitamente aleatórias. |
| `aiRng` | Desempates e amostras hipotéticas da busca da IA. |
| `visualRng` | Partículas, variação de rotação e efeitos decorativos. |

Mudar qualidade gráfica, abrir menu ou inclinar uma carta não pode consumir `battleRng`. O bot não consulta o cursor futuro do combate para decidir seu plano.

## 10.2. Persistência

A semente e o estado/cursor necessário para reproduzir cada stream funcional fazem parte do checkpoint. Evitar `Math.random()` espalhado por efeitos de cartas.

O algoritmo do PRNG, o embaralhamento, a versão (`rng-v1`) e a serialização do estado são **normativos** e estão definidos em [gameplay.md §27.3](gameplay.md#gameplay-27). O runtime não escolhe outro gerador nem outra forma de embaralhar: replay, retomada e testes de hash dependem dessa definição única. `visualRng` pode usar o mesmo algoritmo, mas nunca compartilha estado com os streams funcionais.

Resultados de uma operação são calculados sem modificar o estado persistido e confirmados junto com seu cursor. Uma tentativa de gravação rejeitada não avança o RNG oficial.

## 10.3. Reinício e retomada

Retomar usa o mesmo estado. Reiniciar duelo normal cria um novo `attemptId` e uma nova semente de tentativa. Reiniciar puzzle usa a mesma fixture autoral.

O programa não impede o usuário de restaurar manualmente um backup antigo. O objetivo é consistência e reprodutibilidade, não anti-cheat de competição online.

## 10.4. Replay

Guardar estado inicial versionado, comandos aceitos e eventos/resultados aleatórios ou stream suficiente para reprodução. Checkpoints adicionais permitem saltar a um turno sem reproduzir todas as animações.

Replay é leitura: não pode chamar concessão de recompensa nem atualizar objetivos. Após partida finalizada, uma opção local pode revelar ambas as mãos para estudo. Durante partida ativa, essa opção não existe na experiência normal.

Sem versão compatível, mostrar resumo e motivo de indisponibilidade. Não refazer a partida com cartas novas.

---

<a id="runtime-11"></a>

## 🤖 11. IA local em worker

## 11.1. Escopo

IA é algoritmo local de tomada de decisão. Não chamar LLM, API de linguagem, serviço de agentes ou geração remota para jogar, arbitrar efeitos ou dar dicas.

Web Workers permitem executar trabalho fora da thread principal e trocar mensagens com a página. O worker deve receber dados serializáveis, não tentar manipular DOM ou os objetos de apresentação. [T15] O AI Worker carrega o mesmo bundle de domínio da thread principal (seção 2.4); não existe uma segunda implementação de regras para a IA.

## 11.2. Mensagem de trabalho

```json
{
  "type": "PLAN_ACTION",
  "jobId": "ai-job-042",
  "attemptId": "attempt-028",
  "stateRevision": 51,
  "writerEpoch": 3,
  "aiProfileId": "mara-standard-v1",
  "observation": {
    "selfHand": [],
    "publicBoard": {},
    "opponentHandCount": 4
  },
  "searchBudget": {
    "maxNodes": 2000,
    "maxDepth": 4
  }
}
```

O exemplo não é uma observação de partida completa. Nunca acrescentar `humanHand`, ordem real do baralho humano ou semente do combate só para facilitar implementação.

## 11.3. Busca

Enumerar ações legais, avaliar vitórias/derrotas imediatas e explorar sequências. Amostras de informação oculta devem vir de hipóteses compatíveis com observações, não do save real.

O orçamento principal usa número de nós e profundidade, para não fazer um computador mais rápido produzir uma dificuldade inesperadamente diferente. Um watchdog técnico pode interromper trabalho excessivo e usar a melhor ação válida já encontrada.

Registrar a ação escolhida no histórico de comandos. Replays reproduzem comandos aceitos; não precisam recalcular toda a busca sob outro hardware.

## 11.4. Cancelamento

Ignorar resultado se perfil, tentativa, epoch, revisão ou estado de pausa mudaram. Encerrar/recriar worker travado não reinicia o duelo.

Plano descartado por revisão antiga (`AI_JOB_STALE`) não encerra o laço da IA: se ainda cabe a ela agir, ela replaneja com o estado atual. Isso cobre o jogador que age enquanto a IA pensa (ex.: confirma a preparação antes dela); sem o replanejamento, a tela já teria reagido à jogada e ninguém chamaria a IA de novo, e o duelo pararia na vez do adversário. Só `NOT_YOUR_TURN` encerra a espera sem erro.

Antes de executar a sugestão, usar o mesmo validador de ações do humano. Uma ação inválida sinaliza bug do planejador e aciona fallback seguro, nunca privilégio para o NPC.

## 11.5. Previsibilidade e UI

Apenas atrasos curtos de apresentação são permitidos para leitura; não fazer “pensamento” falso com duração fixa longa. Exibir processamento real se o orçamento não responder prontamente e manter pausa disponível.

---

<a id="runtime-12"></a>

## 🧊 12. Three.js obrigatório e composição híbrida

## 12.1. Baseline gráfico

A apresentação principal usa `WebGLRenderer` com **WebGL2**. A documentação atual informa que WebGL1 não é suportado pelo renderer desde r163. Não prometer WebGL1 nem exigir WebGPU nesta versão. [T02]

No boot, testar capacidade real de criar o contexto. A disponibilidade do navegador não significa automaticamente que a GPU/driver está utilizável.

## 12.2. Camadas

```text
Camada 0 — canvas Three.js compartilhado
Camada 1 — HUDs e etiquetas HTML ancoradas a pontos da cena
Camada 2 — navegação, listas, formulários e ações
Camada 3 — drawers / seletores
Camada 4 — modal e foco bloqueante
Camada 5 — mensagens críticas e diagnóstico
```

Um modal bloqueia picking na cena abaixo. Um texto legível não deve virar textura minúscula apenas para afirmar que “tudo é 3D”.

## 12.3. Objetos reais

Cartas devem possuir frente, verso, espessura e resposta à câmera/iluminação. Pacotes possuem volume e animação própria. Mesa possui plano físico, pilhas e espaços. Campanha possui dioramas e pedestais.

CSS `perspective` numa imagem não satisfaz o requisito de objeto Three.js. Pode complementar a UI, mas não substituir os elementos principais acima.

## 12.4. Catálogo de cenas

| Cena | Objetos | Câmera / interação |
|---|---|---|
| `start` | Tela de entrada (boot e perfis): mesa clara de exposição com deck e moeda, sem dados de perfil antes do boot. | Perspectiva leve e estática; ações em HTML. |
| `home` | Mesa de exposição, deck favorito e miniatura da campanha. Não é montada no Início desde os menus em caixas ([interface §7](interface-16x9.md#interface-07)). | Perspectiva leve; links semânticos. |
| `campaign-map` | Dioramas e conexões. | Ortográfica inclinada; pan/zoom limitados. |
| `campaign-chapter` | Seis pedestais de encontros. | Seleção e foco de nó. |
| `briefing` | Miniatura da arena do nó e carta-chave em pedestal. | Órbita lenta opcional, desligada em movimento reduzido; dados em HTML. |
| `battle` | Mesa, oito slots, pilhas, Energias e Estádio. | Fixa, enquadrada para legibilidade. |
| `hand` | Cartas em leque contido. | Ortográfica em viewport inferior. |
| `card-transit` | `CardTransitScene`: proxy de carta entre viewports (seção 15.8). | Ortográfica em coordenadas de tela; sem picking. |
| `attack-cutin` | Cut-in de ataque: carta ampliada, faixa com nome e palco da moeda. | Câmera própria sobre a mesa; bloqueia picking incompatível durante o preset. |
| `result` | Mesa final congelada e itens recebidos, lidos do recibo persistido. | Fixa; nenhum item aparece sem recibo. |
| `card-inspector` | Uma carta de alta resolução. | Rotação limitada e botão frontal. |
| `immersive-card` | Cena imersiva opcional de uma impressão (seção 15.3). | Dentro do inspector; falha, qualidade Baixa ou movimento reduzido voltam à carta estática. |
| `pack-opening` | Pacote, corte e cinco cartas. | Perspectiva de vitrine, pulável. |
| `card-editor` | Carta, variantes e materiais do Estúdio. | Mesmo renderer/compositor do jogo; formulários em HTML. |
| `deck-preview` | Deckbox, sleeve, moeda e carta selecionada. | Prévia, sem afetar o deck. |
| `appearance-workshop` | Mesa-fixture da biblioteca de aparência e da oficina do deck (S41/S42): playmat, sleeve, moeda e flair. | Preview isolado (seção 20.9), sem RNG funcional nem escrita até salvar. |
| `discovery` | Três cartas face-up. | Seleção clara, sem sorteio oculto. |
| `gallery` | Vitrine local de cartas e acabamentos. | Navegação por páginas; pode hospedar `binder` e `trophies`. |
| `binder` | Páginas de fichário (S09/S10); pode ser parte de `gallery`. | Virar página; slots por ID, com alternativa sem arrasto. |
| `trophies` | Troféus e medalhas de objetivos e perfil (S25/S34). | Prateleira com foco por item; lista HTML equivalente. |
| `emporium-preview` | Produto selecionado. | Controles de compra em HTML. |

Cenas podem compartilhar materiais e geometria. Não precisam permanecer todas renderizando ao mesmo tempo. Os IDs desta tabela são os identificadores de cena usados por viewports, testes e capturas.

<a id="runtime-glossary"></a>

## 12.5. Glossário de objetos de apresentação

| Nome canônico | Significado |
|---|---|
| `CardVisual` | Group de uma carta: corpo, frente, verso, acabamento e marcador (seção 15.1). Compartilhado entre batalha, coleção, Estúdio e revelação. |
| `BoardRoot` | Raiz da mesa de batalha: fundo, aro, faixas, playmat, guias, raízes de cartas/anexos/Energias/efeitos e registro de âncoras (seção 14.6). |
| `PackVisual` | Pacote com volume, costura/corte e pilha de cartas da abertura. |
| `DeckBoxVisual` | Deckbox com sleeve aplicado, usado em `home`, `deck-preview` e `appearance-workshop`. |
| `CoinVisual` | Moeda cosmética que só apresenta resultados já resolvidos (seção 19.9). |
| `CampaignNodeVisual` | Pedestal/diorama de um nó no mapa ou capítulo. |
| `CardTransitScene` | Cena ortográfica de trânsito entre viewports (seção 15.8). |
| IDs de cena | Os identificadores da tabela da seção 12.4 (`battle`, `hand`, `card-transit`, `attack-cutin` etc.). |

Os nomes `CardMesh`, `BoardScene` e `BoardVisual` **não são usados**: uma carta é sempre `CardVisual`, a mesa é `BoardRoot` e a cena da mesa é a cena `battle`.

---

<a id="runtime-13"></a>

## 🪟 13. Um renderer, múltiplos viewports

## 13.1. Regra de recursos

Criar um `WebGLRenderer` principal e um canvas compartilhado. Para palco, carta selecionada e mão, usar cenas/câmeras com recortes adequados. O manual mostra o padrão de múltiplas cenas usando um único contexto. [T08]

Não criar um canvas WebGL por carta da coleção, por modal ou por linha de deck.

## 13.2. Registro de viewport

Cada palco registra retângulo CSS, câmera, cena, prioridade de entrada, estado visível e necessidade de redraw. O renderer converte retângulos para sua área de desenho.

Quando duas regiões se sobrepõem, definir ordem de desenho e limpar depth/stencil no contexto correto. Não deixar a profundidade da mesa cortar a carta do inspector.

## 13.3. Retângulos

`getBoundingClientRect()` usa coordenadas relativas à viewport do navegador. Os cálculos precisam subtrair a origem do canvas quando ele não ocupa a página inteira.

No WebGL, o recorte usa origem inferior; CSS usa origem superior. Converter Y uma vez. DPR não deve ser multiplicado tanto no helper quanto no renderer, produzindo escala dupla.

Contrato recomendado: helpers trabalham em pixels CSS; o adaptador do renderer trata o pixel ratio. Testes com DPR 1, 1,5 e 2 confirmam picking e desenho no mesmo lugar.

## 13.4. Atualização

Redimensionar atualiza drawing buffer, retângulos, aspecto/projeção de câmeras, frustum ortográfico e posição de etiquetas. Não recriar todo o contexto em cada resize.

Coleção e menus estáticos podem renderizar sob demanda. Cenas com animação usam um loop compartilhado, não vários `requestAnimationFrame` independentes.

---

<a id="runtime-14"></a>

## 📐 14. Mundo 3D e campo claro na linguagem Pocket

## 14.1. Convenções

| Propriedade | Contrato |
|---|---|
| Up | +Y. |
| Superfície | XZ; humano em Z positivo, NPC em Z negativo. |
| Centro | Origem do campo. |
| Frente da carta | Plano XY local, normal +Z. |
| Carta deitada | Rotação −π/2 em X. |
| Geometria compartilhada | Largura 1, altura 1,4, espessura 0,012. |
| Perfil visual | `pocket-light-v1`. |

Unidades são convenções do projeto. Cartas podem usar escalas de apresentação distintas no Ativo, Banco e mão, preservando a proporção. Regras não consultam distâncias ou escala dos meshes.

## 14.2. Âncoras semânticas e encaixe

Manter âncoras por ID. `HUMAN_*` é o jogador local e `NPC_*` o adversário; o prefixo `PLAYER_*` não é usado. Lista completa:

| Grupo | IDs |
|---|---|
| Ativos | `HUMAN_ACTIVE`, `NPC_ACTIVE` |
| Bancos | `HUMAN_BENCH_0`, `HUMAN_BENCH_1`, `HUMAN_BENCH_2`, `NPC_BENCH_0`, `NPC_BENCH_1`, `NPC_BENCH_2` |
| Pilhas | `HUMAN_DECK_TOP`, `HUMAN_DISCARD`, `NPC_DECK_TOP`, `NPC_DISCARD` |
| Energia | `HUMAN_ENERGY_READY`, `HUMAN_ENERGY_NEXT`, `NPC_ENERGY_READY`, `NPC_ENERGY_NEXT` |
| Mão | `HUMAN_HAND`, `NPC_HAND`, `NPC_HAND_ENTRY` (ponto onde cartas viradas entram no leque do NPC) |
| Pontos | `HUMAN_POINTS`, `NPC_POINTS` |
| Global | `STADIUM` |

Banco 0/1/2 aparece à esquerda/centro/direita **na visão local**, para os dois lados; nunca usar índice incidental de children. Os oito slots de carta usam os mesmos IDs de [battle-layout.json](examples/battle-layout.json).

**Sementes de world layout (1080p).** Obtidas por projeção inversa dos centros de tela de [battle-layout.json](examples/battle-layout.json) no plano da mesa, com a câmera da seção 14.3 e o viewport do campo `board` `[24, 80, 1872, 788]` (pixels CSS da janela 1920×1080). A escala é a largura da carta em unidades de mundo (altura = 1,4 × escala).

| Âncora | X | Z | Escala | Centro de tela alvo |
|---|---|---|---|---|
| `NPC_ACTIVE` | 0 | −1,49 | 1,73 | (960, 340) |
| `HUMAN_ACTIVE` | 0 | +1,65 | 1,68 | (960, 574) |
| `NPC_BENCH_0/1/2` | −2,34 / 0 / +2,34 | −3,90 | 1,17 | (788 / 960 / 1132, 170) |
| `HUMAN_BENCH_0/1/2` | −2,16 / 0 / +2,16 | +3,95 | 1,08 | (788 / 960 / 1132, 756) |

Resultado calculado: centros projetados a no máximo 0,4 px das metas (tolerância exigida: ±4 px); larguras projetadas a até 1,3 px; todas as cartas sobre a superfície 12,8×9,6 com folga ≥ 0,08. As sementes são **assimétricas** de propósito: a perspectiva e o layout dão mais espaço de tela ao lado do NPC. A altura projetada fica até 8% abaixo do retângulo 5:7 do layout por causa da inclinação; isso é esperado e não se corrige esticando a carta.

Pilhas humanas ficam na lateral X positiva e as do NPC na lateral X negativa, fora dos retângulos das oito cartas. As sementes antigas (Ativos Z ±1,35; Bancos Z ±3,55, X ±2,15) projetavam o NPC 31–39 px abaixo das metas e foram substituídas. Os valores acima continuam **seeds** sujeitas à homologação, não coordenadas finais.

**Perfil compacto 720p.** O mesmo procedimento sobre `board` `[152, 60, 976, 508]` (o campo de 976 px centralizado na janela de 1280 desde a remoção da coluna lateral, 3.3.0; câmera e sementes não mudam, porque campo e slots deslocam juntos 136 px) gera âncoras próprias, porque as metas normalizadas de 720p diferem das de 1080p: câmera `(0, 19.36, 4.17)` olhando para `(0, 0, 0.05)`; Ativos Z −1,32/+1,73 (escalas 1,94/1,88); Banco do NPC Z −3,88, X −2,99/−0,08/+2,83, escala 1,14; Banco humano Z +3,97, X −2,76/−0,07/+2,61, escala 1,05. O deslocamento −0,08 em X decorre dos slots de 720p, centrados em X=636, enquanto o centro do viewport é X=640. Com as cartas sobre a superfície, o aro próximo projeta até Y≈582, 14 px além do limite 568: em 720p, esse corte do aro é a margem cosmética admitida na seção 14.9, nunca o corte de carta ou superfície. Se as metas de 720p mudarem, recalcular.

A adaptação usa a região protegida e os centros de tela definidos em [battle-layout.json](examples/battle-layout.json). Ajustar câmera, escala de apresentação por papel e posições visuais das âncoras para cumprir projeção, proporção e não sobreposição, sempre recalculando as sementes por projeção inversa quando a câmera mudar. Não deformar a arte para compensar uma câmera inadequada.

Deck e descarte do mesmo lado têm espaços distintos; Energia é outra zona. O Estádio ocupa posição lateral à faixa central, não o lugar de uma criatura.

## 14.3. Câmeras

Mesa (1080p): `PerspectiveCamera`, FOV vertical 28°, posição inicial `(0, 20.15, 4.62)`, olhando para `(0, 0, 0.33)`; inclinação de aproximadamente 12° da vertical e distância ≈ 20,6 até o alvo. Near/far iniciais 0,1/80, ajustados à escala final. A câmera de 720p está na seção 14.2.

Rodar `fitBounds` por perfil depois de carregar dimensões, rótulos e reservas do layout. O enquadramento precisa conter, ao mesmo tempo:
1. os cantos projetados das oito cartas nas escalas de apresentação, cada centro a ±4 px da meta;
2. as oito cartas sobre a superfície 12,8×9,6;
3. a **estrutura externa inteira (aro)** dentro do retângulo `board` do perfil; a única exceção documentada é o aro próximo em 720p (seção 14.2).

Números calculados para a seção 14.2 (1080p): superfície projetada em Y 108–825; estrutura 13,8×10,2 (seção 14.6) em Y 88–850 e X 404–1516, dentro de `board` (Y 80–868, X 24–1896).

Por que a câmera mudou: a proposta anterior, `(0, 19.56, 4.16)` olhando para a origem, projeta o aro próximo da estrutura 13,8×10,6 em Y≈908, abaixo do limite 868 do campo. As sementes exatas para aquela câmera seriam NPC Z −1,77/−4,10 e humano +1,28/+3,52. Com o alvo na origem, nenhuma combinação de distância e FOV em ±10% mantém ao mesmo tempo as cartas sobre a superfície e o aro 13,8×10,6 dentro do viewport: recuar 10% (aro em Y 119–866) faz o Banco do NPC ultrapassar a borda distante da mesa, e FOV 30,8° tem o mesmo efeito. Por isso o alvo avança 0,33 em +Z, para o lado humano, mantendo a inclinação; a distância cresce 3%; e o aro frontal/traseiro afina (seção 14.6).

Ajustes permitidos na homologação: distância e FOV em até ±10% e deslocamento do alvo em Z, recalculando as sementes por projeção inversa. Se o aro ainda não couber, reduzir a profundidade da estrutura externa; nunca reduzir a superfície, o número de slots ou o texto. As metas de tela pertencem a [battle-layout.json](examples/battle-layout.json); o campo `camera` desse arquivo deve refletir estes valores.

Mão: câmera ortográfica no mesmo renderer, independente da perspectiva do campo. Cut-in/inspector: câmeras de apresentação próprias. Não rotacionar o campo 180° ao mudar turno.

As posições propostas não são valores do aplicativo oficial. Homologar cantos projetados de todas as cartas, anexos e hitboxes em 1080p/720p. Não deixar escolha de cosmético alterar frustum de modo que uma carta saia do campo.

## 14.4. Conversão de tela e mundo

O adaptador pode lançar raios das metas de tela ao plano da mesa para construir âncoras e resolver a escala de cada papel. Pixels CSS, pixels físicos e unidades de mundo são separados.

Toda mudança de layout atualiza viewports, matrizes, etiquetas e picking na mesma passagem. Não fazer a carta desenhada se deslocar antes de seu alvo clicável. O resize não altera a ordem lógica da mão.

## 14.5. Frente legível

Cartas públicas dos dois participantes são orientadas ao observador. HP e informações externas ficam em HTML com tamanho de tela. Nenhum texto é espelhado por escala negativa.

Espessura pequena e sombra leve bastam para comunicar volume. Não tornar cartas placas de metal ou colocar a câmera na altura da mesa.

<a id="runtime-playmats"></a>
## 14.6. Estrutura e fundo

Superfície inicial 12,8×9,6 unidades, proporção 4:3, cantos arredondados; estrutura externa 13,8×10,2 (aro lateral 0,5; aro frontal e traseiro 0,3). A proposta anterior de 13,8×10,6 não cabe no viewport de 1080p com as cartas sobre a superfície (seção 14.3). A geometria pode ajustar seu enquadramento, mas nunca o número de slots, e `fitBounds` sempre inclui o aro. A forma é própria, inspirada na superfície arredondada da referência.

```text
BoardRoot
├── LightBackdrop          # branco/azul suave; sem sala ou paisagem realista
├── TableBody              # TableSurface (entorno da arena, opaca) e TableRim: aro branco fosco e sombra leve
├── PlaymatImage           # imagem local do tapete, quando houver
├── Arena                  # ArenaOpponentHalf/ArenaPlayerHalf, ArenaStroke, ArenaRim, ArenaCenterBand
├── PlayerBand             # ciano; oculta (o turno acende a metade da arena)
├── OpponentBand           # coral; oculta
├── PlaymatSurface         # decalque/padrão do tapete cosmético
├── CenterCircle/CenterRing/Midline  # disco central, aro branco e linha central
├── FunctionalZoneGuides   # linhas claras, independentes da arte
├── PublicCardsRoot
├── AttachmentsRoot
├── EnergyZonesRoot
├── BoardEffectsRoot       # efeito temporário, não interativo
└── AnchorRegistry
```

**Mesa em arena (decisão do autor, 16/10/2026; [gameplay-pocket §2](gameplay-pocket.md#pocket-2)):** geometria e cores ficam em `three/battle/arena.ts` (`ARENA`, `ARENA_COLORS`), compartilhadas com a mesa 2D (`Board2D`, `battle.css`).

- **Arena:** `tableGeometryWorld` desenha em px de projeto um círculo no centro de espelho, com raio = canto de Banco mais distante × `ARENA.radiusPad` (1,04): ≈ 427 px em `desktop1080` e ≈ 307 px em `compact720`. Depois projeta o círculo de volta no plano da mesa, para ele aparecer redondo na tela. Saem dali as metades distante e próxima (gradientes lineares no Z do mundo), o aro de 16 px, o filete lilás de 3 px e a faixa central de 56 px de borda a borda.
- **Disco central:** raio = `ARENA.discK` × largura do Ativo (1,0; antes 1,35), com disco interno a `ARENA.innerK` (0,66). A linha central continua.
- **Turno:** `PlayerBand`/`OpponentBand` continuam no grafo, mas ocultas. O valor animado de cada faixa (0,55 → 1, mesma suavização) vira o uniforme `hot` (0 → 1) da metade daquele lado: coral mais forte no turno do NPC, azul mais forte no humano.
- **Tapete:** a `TableSurface` leva o entorno (claro em cima, azul embaixo), tingido pelo tapete cosmético (`playmatTint`, k = 0,32; neutro sem tingimento). `PlaymatSurface` acrescenta só o decalque periférico. Com imagem local (`PlaymatImage`), o alfa das metades da arena cai para 0,38 e a imagem aparece por baixo.
- **Ordem de desenho:** superfície (opaca) < `PlaymatImage` (−3) < metades da arena (−2,8) < filete (−2,7) < aro (−2,6) < faixa central (−2,5) < decalque `PlaymatSurface` (−2) < disco, aro e linha central e guias dos slots (−1). Toda a arena é decoração, fora da camada de picking; slots, pilhas, pratos de Energia, cartas e HUD não mudam.

Dioramas da campanha pertencem às cenas de mapa/briefing. Em combate, a identidade do capítulo usa a arte cosmética e motivos abstratos discretos. Não carregar o porto 3D inteiro atrás da mesa.

Manter offsets de superfície/guias/cartas para evitar z-fighting. Não resolver planos coplanares somente por `renderOrder`.

## 14.7. Playmat por turno

`resolveDisplayedPlaymat(snapshot, activePlayerId, preferences)` escolhe `TURN_OWNER`, `PLAYER_FIXED` ou `NEUTRAL`. O controlador de uma decisão pendente não se torna dono do turno.

Crossfade de 280 ms, até duas texturas simultâneas. O crossfade troca o tingimento do entorno e o decalque; a arena não entra nele — a metade do dono do turno acende pelo valor da faixa (seção 14.6). Camadas funcionais, hitboxes e câmera não se movem. Preferir dois samplers e mescla da cor linear no mesmo material; não criar duas mesas com duas hitboxes.

Efeitos atrasados/checkup continuam com a apresentação do turno que está encerrando. Só trocar quando o cursor visual alcança a abertura do próximo turno. Mesmo material/versão/parâmetros dispensa crossfade.

## 14.8. Materiais

Corpo e aro foscos claros; textura de trama discreta e opcional. `MATTE` é padrão. Nenhum material do campo padrão é couro escuro, bronze ou ouro ornamental. O amarelo pertence a pontos/recompensas.

Arte de tapete deve manter sua cor estável; `MeshBasicMaterial` ou caminho equivalente com iluminação controlada é preferível para a impressão. Corpo/aro podem usar `MeshStandardMaterial`. Mapas e envelopes do shader seguem a gestão de cores da seção 16. [T21]

Reflexo físico/iridescência é seletivo; `MeshPhysicalMaterial` não deve ser aplicado indiscriminadamente a cada objeto. [T22] Normal map não deforma slots nem cria colisão. Imagens customizadas só definem arte/recorte; não fornecem código, câmeras ou posições de regra.

## 14.9. Teste de projeção

Projetar bounds de oito cartas, HP, fichas, pilhas e mão. Conferir contenção na região de cada perfil de resolução e interseção com HTML bloqueante. Uma margem cosmética pode cortar no viewport; uma carta ou controle de decisão não.

A câmera inicial não dispensa calibração. Os testes estáticos do pacote verificam retângulos de layout, não uma renderização real. Homologação 3D exige a futura aplicação.

---

<a id="runtime-15"></a>

## 🃏 15. Construção da carta e acabamentos

## 15.1. Objeto composto

```text
CardVisual (Group)
├── BodyMesh           # espessura e bordas
├── FrontMesh          # impressão frontal
├── BackMesh           # verso / sleeve
├── FinishOverlay      # máscara de holo/foil quando aplicável
└── SelectionMarker    # contorno ou base, sem regra própria
```

Geometria compartilhada pode ser um corpo com cantos arredondados leves. Frente e verso possuem UVs corretas; não espelhar texto com escala negativa para “corrigir” orientação.

A entidade visual contém IDs e recursos de apresentação. Dano, Energias e efeitos pertencem ao domínio.

## 15.2. Arte impressa

Manter impressão com iluminação controlada, usando material não iluminado ou configuração equivalente para preservar cores e leitura. A borda pode receber material metálico separado.

A textura deve incluir a carta inteira quando esse for o asset disponível. Ao gerar impressão a partir de dados, preservar margens e proporção; texto detalhado continua disponível em HTML.

## 15.3. Acabamentos

| Acabamento | Implementação proposta | Proteção de leitura |
|---|---|---|
| Normal | Frente opaca, borda discreta. | Sem cintilação contínua. |
| Holo | Reflexo localizado por máscara da ilustração. | Nome e regras fora da máscara. |
| Foil | Variação de brilho/cor pela normal e direção de visão. | Intensidade limitada. |
| Cromado | Borda metálica e áreas selecionadas refletivas. | Nunca transformar toda a carta em espelho branco. |
| Arte completa | Outra impressão/UV, mesma geometria. | Dados em inspector. |
| Imersivo | Cena adicional opcional dentro do inspector. | Saída, pausa e texto sempre acessíveis. |

Shader não muda `CardDefinition`. Raridade não determina dano.

## 15.4. Cache e instâncias

Não duplicar uma textura idêntica para cada exemplar. Cache por asset/impressão e referência contada. Instâncias compartilham geometria; seleção e efeitos temporários devem ter parâmetros próprios, sem alterar simultaneamente todas as cópias.

Um `InstancedMesh` pode ajudar para elementos repetidos, mas não é obrigação se a heterogeneidade de materiais tornar a solução mais complexa. Medir antes de otimizar por suposição.

## 15.5. Sem requisito de personagem 3D por carta

A entrega exige cartas e cenas tridimensionais, não centenas de criaturas animadas. Modelos de personagens podem ser extensão posterior e não devem bloquear a fatia vertical.


## 15.6. Face, verso e visibilidade

`CardVisual` recebe um descriptor permitido à projeção, não o objeto completo do save. Para uma carta oculta do NPC, usar descriptor com `opaqueId`, `sleeveId` e transform; não receber `definitionId`, `printingId`, raridade, flair ou textura frontal nessa representação.

A face frontal e a posterior são superfícies distintas. Não usar uma única imagem com `DoubleSide` que mostre texto invertido no verso. A lateral tem material neutro; o flip troca a normal visível sem alterar a identidade do objeto de domínio.

No reveal público, substituir o descriptor oculto pelo permitido no momento correto. Ao ocultar e embaralhar novamente, invalidar associações visuais de posição; conhecimento legitimamente registrado no log não equivale a rastreamento da posição atual.

## 15.7. Mão ortográfica e reflow

Identificar cada carta por ID estável no estado autorizado. Layout retorna transform-base por carta e ordem visual; animação aplica offsets acima do base. Não usar índice do array como identidade durante remoção ou inserção.

Ao chegar uma carta, calcular destinos de todo o leque uma vez e interpolar de transforms atuais para novos. O foco altera prioridade e offset, não a ordem lógica. Uma mudança de viewport recalcula destinos, preservando o progresso normalizado.

Usar picking no viewport ativo e hit proxies estáveis; objetos de preview e VFX não participam. Os cálculos continuam em pixels CSS antes de converter para NDC. [T10]

## 15.8. Trânsito entre cena da mão, mesa e destaque

Uma carta em trânsito entre viewports é desenhada em `CardTransitScene`, câmera ortográfica em coordenadas de tela, no mesmo canvas. A fonte original fica visualmente suprimida durante o trânsito e mantém seu slot reservado; não desenhar duas frentes simultâneas como se houvesse duas cartas.

Procedimento:
1. Projetar os quatro cantos da carta de origem e a âncora de destino no espaço CSS do canvas.
2. Criar proxy visual com escala e orientação equivalentes à origem.
3. Interpolar posição, escala e quaternion até a representação de destino.
4. Reconciliar a cena final com o evento confirmado.
5. Remover proxy e recursos transitórios, restaurando picking somente no destino correto.

Trajetória pode usar Bézier cúbica com ponto de controle elevado; isso é movimento de apresentação. Não testar colisão do arco para decidir se a jogada acertou o Banco.

Em resize, projetar novamente extremidades e manter a progressão; em Pular, saltar ao passo 4. Em cancelamento pré-commit, o destino é a mão original. Em commit aceito, cancelamento de gesto não desfaz a carta.

## 15.9. Cópias de destaque e anexos

Uma carta destacada em ataque pode ser um proxy de apresentação. A entidade do campo mantém sua reserva e seus IDs. Anexos não são duplicados como novas Energias. Quando o proxy termina, o campo é reconstruído a partir do estado apresentado.

A decisão de mostrar um proxy maior não depende de consultar informações ocultas. Uma carta especial do NPC só revela acabamento quando sua identidade já é pública.

## 15.10. Flair e acabamento

Acabamento é um componente de material; flair é um emitter/clip finito com gatilho. Manter IDs e bibliotecas separados. O flair não importa o módulo de dano.

Chave de reprodução: `attemptId:eventId:effectLayer:entityId`. Uma chave já apresentada não repete ao reconstruir mesh, trocar material, fazer hover ou restaurar um viewport. Uma nova entrada legitimamente registrada recebe novo `eventId`.

Mapear gatilhos aceitos: entrada pública, evolução e promoção/movimento para Ativo, conforme o perfil. Compra oculta nunca dispara flair público. Uma simulação de preview recebe namespace diferente de uma tentativa real.

## 15.11. Finalização e descarte

Todo proxy, emitter e outline temporário tem `finishVisual()` e `disposeVisual()` idempotentes, sem chamar funções de gameplay. Se material ou áudio falhar, a pose final e o texto ainda são aplicados.

Compartilhar geometria e textura por asset; valores de seleção e intensidades por instância não alteram um material compartilhado de todas as cópias. Clonar estado de material ou usar parâmetros por instância conforme a técnica adotada.

## 15.12. Templates claros e arte de TCG

O catálogo visual usa molduras finas/prateadas, campos de tipo e texto de alto contraste, conforme [direcao-visual-pocket.md](direcao-visual-pocket.md#visual-06). Os modelos não recebem custo universal de mana nem campo de Resistência ausente do ruleset.

Imagens existentes não são recoloridas destrutivamente. Nova arte/layout publicado produz nova impressão; shaders se limitam às camadas autorizadas. `CardVisual` é compartilhado entre batalha, coleção, Estúdio e revelação.

A normalidade do corpo e a cor da impressão não dependem do ambiente noturno de um cenário. Mesmo uma carta com arte escura é exibida em shell claro com dados legíveis.

---

<a id="runtime-16"></a>

## 🎨 16. Cor, luz e pós-processamento — Pocket Light

## 16.1. Uma pipeline de cor

Usar o perfil [pocket-light-v1](direcao-visual-pocket.md#visual-03). Texturas de cor sRGB; máscaras, normal e roughness como `NoColorSpace`; cálculo de iluminação/interpolação no espaço linear; saída sRGB uma vez. A documentação Three.js descreve essa separação. [T09]

Não compensar arte escura causada por configuração errada adicionando luz laranja. Não fazer conversão dupla em um compositor.

## 16.2. Baseline explícita

Ponto de partida do adaptador:

```typescript
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor("#F4F8FC", 1);
```

Impressão da carta: material de cor estável, `toneMapped = false`, textura anotada. Borda, espessura e foil separados. A inicialização completa depende do renderer e do build fixado; o trecho não é um aplicativo.

Se uma pipeline HDR/pós-processamento for acrescentada, sua saída deve manter as cores alvo e usar a conversão adequada. Não habilitar ACES, LUT de cinema, teal-and-orange ou vinheta preta por conveniência.

## 16.3. Iluminação

Ambiente branco-azulado suave e key ampla; contraste baixo no corpo da mesa, contraste forte no texto. Sombras curtas azul-acinzentadas e transparentes. Sem objetos emitindo fogo permanente para iluminar tudo.

A cor do campo não muda para laranja quando entra um Pokémon de Fogo. O efeito elemental é local e temporário. Cenário externo ausente usa fundo claro, não preto.

## 16.4. Pós-processamento

Sem profundidade de campo e motion blur na batalha. Bloom seletivo e limitado ao VFX/foil aprovado; letras, HP e botões ficam fora.

Somente o cut-in pode escurecer temporariamente a mesa, com véu de 20–30% e restauração ao terminar ou pular. HUD crítico e pause continuam legíveis. O modo reduzido remove tremor e flash repetitivo.

## 16.5. Assinaturas

Ataques têm paleta por tipo e formas limpas: rajada de Fogo, splash de Água, folhas, faíscas, anéis Psíquicos, impacto Lutador, arco Noturno localizado, traços Metálicos, fluxo Dragão e impacto Incolor.

O tipo da carta, da Energia e do ataque não é inferido da cor do shader. Holo/foil/CHROME são acabamentos, não comandos de dano. As sequências detalhadas estão no documento visual e na interface.

## 16.6. Escalabilidade

Qualidade baixa desliga efeitos caros, mas mantém a mesa em arena (seção 14.6), aro branco, cartas 3D e dados. Usar sprite de reflexo local em vez de ambiente caro quando apropriado. Não trocar o estilo inteiro quando a GPU tem pouco recurso.

---

<a id="runtime-17"></a>

## 🖱️ 17. Picking, arrasto e controles

## 17.1. Ordem de entrada

```text
Modal / drawer ativo
→ Controle HTML sob o ponteiro
→ Viewport 3D de maior prioridade
→ Raycast em camada interativa
→ Intenção de seleção
→ Consulta de ações legais
```

Não usar raycast global atrás de um botão de “Cancelar”. Efeitos decorativos, partículas e cenário devem ficar fora das camadas de picking de cartas.

## 17.2. Ponteiro normalizado

`Raycaster.setFromCamera` recebe coordenadas normalizadas de −1 a +1. O cálculo precisa usar o retângulo do palco selecionado, não sempre a janela inteira. [T10]

```typescript
function toViewportNdc(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number }
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return { x: 2 * u - 1, y: 1 - 2 * v };
}
```

Não multiplicar `clientX/clientY` por DPR nesse cálculo em pixels CSS.

## 17.3. Raycast e ID

Usar meshes de alvo simples e estáveis. O resultado retorna um ID de carta/slot; o controlador valida a possibilidade. Selecionar a malha não autoriza automaticamente jogar a carta.

A borda de uma carta pequena pode possuir área de interação ampliada, desde que não se sobreponha ambiguamente a outro alvo.

## 17.4. Arrasto

Capturar ponteiro durante o gesto, definir limiar para distinguir clique de arrasto e cancelar corretamente em `pointercancel` ou perda de foco.

A carta arrastada é uma prévia. Soltar num alvo legal envia comando; soltar fora devolve à posição. Não remover a carta da mão persistida no `pointerdown`.

## 17.5. Alternativas

Toda operação tem caminho sem arrasto: selecionar carta → ação → alvo → confirmar. Teclado e toque acessam o mesmo conjunto de comandos.

No mapa, oferecer lista HTML equivalente a todos os nós. No inspector, botão “Frente” restaura rotação. Rolagem da coleção não move a câmera da cena por acidente.

---

<a id="runtime-18"></a>

## 🏷️ 18. HUD, ancoragem e acessibilidade

## 18.1. Projeção

Cada entidade visível possui pontos de ancoragem para HP, Energia e condições. Projetar esses pontos com a câmera do viewport correto e converter para a área CSS correspondente.

Atualizar depois de movimento da câmera, resize ou transição. Não prender uma etiqueta à posição antiga porque o mesh se animou.

## 18.2. Informação crítica

HP, dano, condições, pontos, custos e jogador do turno existem em dados semânticos HTML. Nunca depender de uma captura da textura para obter números.

Não desenhar um número de HP no shader e depois tentar ler pixels para decidir o estado do Pokémon.

## 18.3. Oclusão

Evitar que etiquetas atravessem modais ou sobreponham a mão. Elementos fora do frustum deixam de exibir tooltip flutuante, mas sua informação pode continuar acessível na lista do campo.

Nesta versão, não é necessário simular oclusão física perfeita de toda etiqueta. Priorizar leitura estável sobre realismo.

## 18.4. Foco e anúncios

Mudanças de turno e decisões obrigatórias recebem anúncio discreto. Não narrar cada partícula. Modal prende o foco temporariamente e o devolve ao controle de origem.

Reduzir movimento desliga tremor, órbita contínua e trajetórias amplas. O jogador ainda consegue abrir, examinar, jogar e receber cartas.

## 18.5. Recuperação acessível

Quando o contexto 3D não estiver utilizável, a representação 2D deve manter funções centrais: campo, mão, ações, inspeção, campanha e save. A tela informa que é modo de compatibilidade, sem sugerir perda de progresso. Implementação, escopo por tela e retrato estão na seção 23.5.

---

<a id="runtime-19"></a>

## 🎞️ 19. Eventos, animação e abertura de pacotes

<a id="runtime-animation-director"></a>

## 19.1. Duas linhas de tempo e três estados

Manter `committedState` (estado confirmado no banco), `presentedProjection` (estado atualmente visível) e `presentationCursor` (evento visual já aplicado).

```text
Comando legal
→ resolver e persistir lote de eventos
→ criar plano de apresentação
→ apresentar eventos em ordem e com barreiras
→ reconciliar projeção final
→ liberar o próximo comando / decisão
```

Não atualizar toda a tela imediatamente para o estado final enquanto uma animação ainda mostra um Pokémon vivo que já foi Nocauteado. Também não usar um transform de mesh como fonte de HP. A projeção apresentada aplica deltas de eventos confirmados, nunca recalcula regras.

Se já houver uma decisão obrigatória, o lote termina em uma barreira antes dela. Só eventos confirmados podem compor o plano; o diretor não prevê o resultado da resposta ainda não escolhida.

## 19.2. Envelope de apresentação

```typescript
type PresentationBatch = {
  attemptId: string;
  batchId: string;
  fromStateVersion: number;
  toStateVersion: number;
  firstEventSequence: number;
  lastEventSequence: number;
  presentationVersion: string;
  events: readonly VisiblePresentationEvent[];
  finalProjection: BattleView;
  barrier: "READY_FOR_ACTION" | "PENDING_DECISION" | "MATCH_ENDED";
};

type PresentationStep = {
  stepId: string;
  eventIds: readonly string[];
  presetId: string;
  sourceAnchorIds: readonly string[];
  targetAnchorIds: readonly string[];
  durationMs: number;
  parallelGroupId?: string;
  visibility: "PUBLIC" | "OWNER";
  finishPolicy: "RECONCILE_CONFIRMED";
};
```

Tipos ilustrativos: `VisiblePresentationEvent` e `BattleView` devem ser unions/projeções validadas na implementação. A ausência de uma definição oculta é intencional; não preencher a union com `fullState: any`.

No catálogo de eventos, usar **`MATCH_ENDED`** como nome canônico desta documentação. Adaptadores podem traduzir nomes legados como `MATCH_FINISHED`, sem produzir os dois eventos de término na mesma tentativa.

## 19.3. Vocabulário de eventos e correspondência visual

| Evento confirmado | Contrato de apresentação |
|---|---|
| `TURN_STARTED` | Faixa de turno e seleção de tapete pelo dono do turno. |
| `CARDS_DEALT` | Distribuição inicial, frentes somente ao proprietário. |
| `CARD_DRAWN` | Trânsito deck → mão, conforme observador. |
| `CARD_REVEALED` / `CARD_HIDDEN` | Abrir/encerrar acesso visual à identidade autorizada. |
| `DECK_SHUFFLED` | Movimento neutro de versos; ordem lógica já resolvida. |
| `POKEMON_ENTERED` | Entrada e flair após aceite. |
| `POKEMON_EVOLVED` | Nova carta no topo e anexos preservados. |
| `TRAINER_PLAYED` | Área de resolução; subtipo define a apresentação. |
| `TOOL_ATTACHED` | Miniatura/ícone ligado ao Pokémon. |
| `STADIUM_REPLACED` | Atualização da carta global, não do playmat. |
| `ENERGY_ATTACHED` / `ENERGY_MOVED` / `ENERGY_DISCARDED` | Trajetória a partir da origem correta. |
| `ATTACK_DECLARED` | Destaque de carta/nome e preparação. |
| `ABILITY_TRIGGERED` / `ABILITY_ACTIVATED` | Acento na fonte real. |
| `COIN_RESOLVED` | Face final predefinida. |
| `DAMAGE_APPLIED` / `HEAL_APPLIED` | Número, barra e log por categoria. |
| `CONDITION_APPLIED` / `CONDITION_REMOVED` | Atualização de estado e ícone. |
| `POKEMON_MOVED` | Recuo, troca ou promoção segundo `reason`. |
| `CARD_DISCARDED` / `CARD_RETURNED` | Movimento sem prêmio implícito. |
| `POKEMON_KNOCKED_OUT` | Saída da pilha e anexos por destinos. |
| `POINTS_GRANTED` | Contador real, sem inferência visual. |
| `MATCH_ENDED` | Resumo depois da resolução terminal completa. |
| `PACK_OPENING_COMMITTED` | Cartas do recibo, sem novo sorteio. |
| `COSMETIC_UNLOCKED` | Preview do item adquirido, sem segunda concessão. |

Essa tabela é contrato de nomes propostos, não uma API do Pocket. A camada de adaptação deve manter mapeamento único entre eventos existentes e os acima.

## 19.4. Diretor de apresentação

Implementar por funções e estado explícito:
`planPresentation`, `startBatch`, `advancePresentation`, `finishCurrentGroup`, `skipToBarrier`, `pausePresentation`, `resumePresentation`, `reconcileProjection` e `disposePresentation`.

Sem callbacks de animação que chamam `applyAction`, debitam Créditos ou concedem cartas. `onComplete` só altera o cursor visual e recursos de apresentação.

Clipes Three.js podem ser executados com `AnimationMixer`, cuja API oferece atualização por delta, controle de tempo, pausa por escala e liberação de ações. [T23] Tweens de câmera/cartas também podem usar interpolação própria; ambos obedecem ao mesmo relógio de apresentação.

O scheduler controla dependências, não uma coleção de `setTimeout()` independentes. Um timeout de segurança encerra a apresentação e reconcilia; não inventa uma jogada ou derrota.

## 19.5. Trilhas, paralelismo e precedência

Trilhas: movimentos de cartas, VFX, HUD/log, áudio e decoração. Eventos independentes de um mesmo grupo podem rodar em paralelo. Eventos com dependência respeitam sequência.

Exemplo: três danos simultâneos usam um grupo paralelo; concessão de pontos espera o processamento visual de todos os Nocautes daquele grupo. Uma escolha de substituto é barreira; nenhum movimento assume uma resposta ainda não escolhida.

Não somar presets compostos e seus subclipes duas vezes. A tabela de [tempos da interface](interface-16x9.md#interface-motion-timing) é a fonte. `ATTACK_STANDARD=1400 ms` já contém destaque/impacto; moedas e KO são outros grupos.

## 19.6. Estado e duração do relógio

Todas as durações são medidas em tempo de apresentação. `normal=1`, `fast=0.55` e Instantânea elimina a interpolação. Reduzir movimento troca a forma do efeito sem alterar dados.

Ao pausar, interromper atualização de mixers e envelopes de áudio, bloquear aplicação de comandos e invalidar jobs de IA conforme o contrato existente. Ao voltar de aba oculta, reiniciar a referência temporal; não aplicar um delta de vários minutos em um único frame.

Usar segundos no `AnimationMixer` e converter milissegundos do catálogo uma vez. Misturar unidades não pode produzir um giro de moeda de 1.100 segundos.

## 19.7. Skip e cancelamento seguro

Pular finaliza o grupo atual e percorre eventos já confirmados até a próxima barreira. `PENDING_DECISION` permanece aguardando o jogador/IA autorizado. “Pular tudo” não escolhe cartas, Energias ou recompensas automaticamente.

No fim:
- reconciliar transforms, mão, pilhas, HP, condições, tapete e contadores;
- atualizar cursor;
- liberar proxies, partículas e áudio transitório;
- restaurar foco para o controle pertinente.

Repetir a mesma solicitação de skip é idempotente. Uma notificação tardia de término do mixer não avança a próxima escolha. Usar um token de geração para ignorar callbacks de planos já descartados.

## 19.8. Pausa, retomada e perda de contexto

Salvar fatos de jogo no checkpoint; cursor visual é opcional e não autoritativo. Ao reconstruir após perda de contexto, restaurar diretamente `committedState` projetado, sem reproduzir flairs de entrada de todas as cartas que já estavam em campo.

Se o jogador retoma durante uma escolha, apresentar a mesma escolha. Se o resultado foi confirmado antes da falha, abrir o mesmo resumo/recibo. Um erro de shader não modifica `attemptId`, RNG ou inventário.

## 19.9. Moeda não é gerador aleatório

Receber resultado confirmado, criar trajetória decorativa com stream cosmético e terminar com a face correspondente voltada ao observador. Suportar restauração/skip sem precisar simular o quique físico.

N moedas: lista de N resultados do domínio; a apresentação pode agrupar sem cortar a lista. Uma sequência até coroa não ganha um teto lógico por limite de duração. Mostrar resumo textual de sequências longas.

## 19.10. Pacote e revelação

Abertura local transacional produz `openingId`, produto, versão, impressões e recibo. A cena usa apenas esses dados. Corte do pacote, ordem visual e gesto não fazem novo sorteio.

Exibir uma carta por vez; avanços alteram o índice apresentado. A sequência inteira pode ser pulada para o resumo. Nunca registrar posse no callback que termina a animação da última carta.

Em modo imersivo, carregar somente asset local autorizado. Uma falha desse recurso volta à carta estática e ao mesmo recibo.

## 19.11. Projeção e proteção de informação

O plano entregue ao renderer humano não contém faces ocultas do NPC por conveniência. Nem preload de textura, nome de objeto, som, raridade ou flair devem revelar informação por uma representação de carta oculta.

Isso é uma regra de fair play e arquitetura local, não uma promessa de impedir que o proprietário do computador inspecione o save completo.

Ao passar de público para oculto, limpar binding de frente, tooltip e atributos acessíveis. Se um efeito embaralha uma mão, trocar identificadores opacos de posições quando necessário. O bot recebe observação filtrada independentemente do que existe na GPU.

## 19.12. Testes determinísticos de apresentação

Rodar uma sequência de eventos conhecida em Normal, Rápida, Instantânea, movimento reduzido e com skips em cada subetapa. Comparar projeção terminal, cursor, referências vivas e hash de regras, não pixels de partículas aleatórias.

Nos testes visuais, fixar somente RNG cosmético e relógio. Verificar keyframes de origem, revelação, contato, impacto e pose final. Registrar diferenças de screenshot em fixtures 1080p e 720p sem confundir pequenas diferenças de GPU com erro de regras.

Os exemplos no pacote são dados de contrato. Não constituem uma suíte executada contra um jogo pronto.

## 19.13. Perfil de coreografia Pocket Light

Usar [motion-choreography.json](examples/motion-choreography.json) com os mesmos IDs/durações de [animation-presets.json](examples/animation-presets.json). O primeiro descreve fases visuais; o segundo é o catálogo de duração. Validar soma e não duplicar presets compostos.

Compra vai do deck à mão; ataque usa cut-in com faixa; abertura de pacote usa costura/tira e deslizamento de pilha. Não reutilizar uma animação genérica de flip para todas as ações. Giro revela somente informação autorizada.

Os passos são parâmetros declarativos interpretados por funções homologadas, nunca código executável importado de JSON. A agenda visual pode ser interrompida/reconciliada sem consumir RNG funcional.

`presentationVersion = "pocket-light-v1"` nos novos snapshots; dados antigos não recebem atualização destrutiva. Registrar versão do tema e dos presets para testes/replays, sem serializar materiais ou meshes.

---

<a id="runtime-20"></a>

## 🧰 20. Assets, manifest e dependências locais

## 20.1. Manifest

Assets empacotados são referenciados no conteúdo por uma chave lógica **`assetKey`**, nunca por caminho ou hash. Exemplos: `mat-neutral:v2:albedo` (playmat `<playmatId>:v<definitionVersion>:<papel>`), `art:faisca:a` (arte de carta), `arena-grove:v1:model` (modelo de arena). O arquivo de distribuição `dist/manifest.json` mapeia cada `assetKey` para caminho relativo a `dist/`, tipo de mídia, bytes e `sha256`. Um conjunto de dependências declara quais chaves cada cena, playmat e impressão usam.

```json
{
  "manifestVersion": 1,
  "contentVersion": "1.0.0",
  "assets": [
    {
      "assetKey": "arena-grove:v1:model",
      "path": "models/arena-grove.glb",
      "mediaType": "model/gltf-binary",
      "bytes": 1843200,
      "sha256": "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
      "required": true
    },
    {
      "assetKey": "art:faisca:a",
      "path": "textures/cards/faisca-a.webp",
      "mediaType": "image/webp",
      "bytes": 412160,
      "sha256": "b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5b2c3d4e5",
      "required": true
    },
    {
      "assetKey": "mat-neutral:v2:albedo",
      "path": "textures/playmats/mat-neutral-v2-2048.webp",
      "mediaType": "image/webp",
      "bytes": 958464,
      "sha256": "c3d4e5f6c3d4e5f6c3d4e5f6c3d4e5f6c3d4e5f6c3d4e5f6c3d4e5f6c3d4e5f6",
      "required": true
    }
  ]
}
```

`bytes` e `sha256` do exemplo são **ilustrativos**. Os valores reais são gerados pelo build a partir dos arquivos finais; não copiar hashes fictícios para o manifesto de distribuição. Na carga, um arquivo com tamanho ou hash diferente do manifesto é falha classificada (seção 20.5), não asset válido.

**Identidade de assets e SQLite.** A tabela `assets` guarda somente linhas endereçadas por conteúdo (`sha256`): BLOBs importados pelo jogador e, opcionalmente, linhas BUNDLED sem bytes usadas para conferir integridade. `assetKey` não é chave de `assets`; a relação chave lógica → hash pertence ao manifesto do pacote instalado. Metadados mutáveis ficam nas relações, nunca numa nova identidade do mesmo conteúdo.

**Arte de cartas.**

| Caso | Referência | Regra |
|---|---|---|
| Catálogo base (BUNDLED) | `artKey` lógico, resolvido pelo manifesto | A arte de uma carta base pode ser substituída numa versão posterior do pacote **sem mudar `printingId`**. Arte é cosmética: replays mantêm as regras e podem exibir a arte mais nova. |
| Impressão sem arte | `artMode: TEMPLATE_ONLY`, `artKey` e `artAssetId` nulos | Moldura, nome e dados; a janela de arte mostra um placeholder tipado (ícone e cor do tipo), não um erro. |
| Arte importada pelo jogador | `artAssetId` = BLOB + `sha256` | Imutável por impressão: nova arte publicada cria nova impressão (seção 15.12). |

O contrato estrutural está em [card-printing.schema.json](schemas/card-printing.schema.json); retenção e BLOBs em [persistencia-sqlite.md](persistencia-sqlite.md#sqlite-10).

## 20.2. glTF / GLB

Usar formatos compatíveis com `GLTFLoader` e resolver referências relativas a partir da raiz local correta. O loader oferece integração com decodificadores auxiliares; o suporte de uma extensão não significa que seus arquivos já estejam distribuídos. [T11]

Inspecionar também referências internas do modelo: um `.gltf` local pode apontar a texturas externas. Preferir `.glb` quando reduzir dispersão, sem supor que todo conteúdo binário é automaticamente independente.

## 20.3. Decodificadores

Quando utilizar Draco, distribuir o decoder local e configurar seu caminho. Quando utilizar KTX2/Basis, distribuir os arquivos de transcodificação e testar suporte do renderer antes do carregamento. [T16] [T17]

Um modelo que exige decoder não incluído não pode funcionar apenas na máquina que tem cache prévio. Manter fallback não comprimido só quando o custo de distribuição justificar.

## 20.4. Fontes e áudio

Usar fontes locais autorizadas ou stack de sistema. Não Google Fonts por URL remota. Áudios, ambientes, sprites e ícones também são locais.

A aplicação deve registrar origem/licença dos assets e preservar avisos de dependências. Esta documentação não fornece fontes, imagens oficiais, músicas ou modelos.

## 20.5. Carregamento sob demanda não é download remoto

Miniaturas podem carregar ao rolar a coleção e a arena ao escolher capítulo, desde que os bytes já estejam no pacote local. Lazy loading reduz memória, não transfere a dependência para internet.

Classificar falhas: arquivo faltando, checksum diferente, formato não suportado, erro de decoder, contexto perdido. A mensagem “sem internet” não explica um GLB ausente do disco.

## 20.6. Referências externas proibidas

O build de produção deve inspecionar bundles, CSS, manifests, arquivos glTF e configuração de loaders para impedir CDNs, telemetria, analytics e endpoints não locais.

Documentação pode conter referências externas de consulta. O jogo não deve abri-las automaticamente nem depender delas para apresentar ajuda.


## 20.7. Manifestos de tapetes e efeitos

Cada `PlaymatDefinition` declara ID, versão, nomes localizados, variantes, asset de cor, thumbnail, perfil material, efeito ambiente permitido, política de desbloqueio e fallback neutro. Não inclui regras de combate.

Cada `FlairDefinition` declara ID, versão, eventos que o disparam, preset gráfico, orçamento de partículas, duração, alternativa reduzida e compatibilidade com cartas. Cada `AttackPresentationDefinition` declara seu mapeamento visual sem alterar o ataque funcional.

O manifesto de arquivos mantém origem/licença, hash, bytes e dependências locais. Presets e exemplos desta documentação não fornecem os arquivos de arte por si só. Validar no build real que cada asset exigido existe ou possui fallback deliberado.

No pacote de produção, incluir as artes dos seis capítulos mesmo quando ainda bloqueadas na campanha. Desbloqueio é acesso no jogo, não download remoto.

## 20.8. Resoluções e cache de playmats

Perfis de textura de cor: Baixo 1024×768; Médio 1536×1152; Alto 2048×1536. Produção pode manter master 4096×3072 fora do carregamento de batalha.

Uma textura RGBA8 de 2048×1536 ocupa aproximadamente 12 MiB sem mipmaps e 16 MiB com cadeia completa, antes de overhead. Esses valores são estimativas aritméticas, não medição de VRAM. Compressão, formato e driver mudam alocação real.

Manter carregadas as duas artes resolvidas para a tentativa, mais o neutro pequeno. Não manter cada preset do Empório na GPU. Usar miniaturas para a biblioteca e LRU para a prévia.

## 20.9. Preview isolado

A oficina utiliza fixture local próprio, IDs de sessão de preview e RNG cosmético. Nunca entregar ao editor a referência mutável de uma tentativa ativa.

Trocar opções na oficina agenda somente trabalho gráfico. Nenhuma simulação de ataque deve registrar vitória, missão, dano ou gasto. Ao sair, liberar cena/proxies exclusivos e conservar apenas caches compartilhados com referência ativa.

---

<a id="runtime-21"></a>

## 🧹 21. Ciclo de vida e memória gráfica

## 21.1. Recursos compartilhados

Uma cena ao sair remove listeners, controles, animações e objetos de sua propriedade. Geometrias, materiais, texturas e render targets precisam de descarte apropriado; remover um mesh da cena não libera automaticamente todos os recursos de GPU. [T03] [T04]

Materiais e texturas compartilhados usam contagem de referências. Descartar o material de um inspector não pode quebrar uma carta ainda visível na mesa.

## 21.2. Ordem de saída

```text
Bloquear novos comandos de apresentação
→ Cancelar animações e callbacks locais
→ Desregistrar viewports e picking
→ Remover listeners / controles
→ Desanexar objetos da cena
→ Liberar referências de assets
→ Descartar recursos sem consumidores
```

O renderer principal permanece entre rotas; só é descartado ao encerrar ou reconstruir a camada gráfica.

## 21.3. Cache limitado

Cache de arte ampliada possui limite de memória estimado e política LRU. Miniaturas são separadas da imagem de inspeção. Não manter toda a coleção em resolução máxima porque uma carta foi vista uma vez.

Exemplo de estimativa: uma textura RGBA 2048×2048 sem compressão ocupa 16 MiB de pixels-base; mipmaps completos acrescentam aproximadamente um terço. Isso é cálculo de orçamento, não uma medição exata de consumo real do driver.

## 21.4. Instrumentação

Usar `renderer.info` para acompanhar chamadas e contagens disponíveis, complementando com ferramentas do navegador. Esses contadores ajudam no diagnóstico, mas não substituem medição completa de memória e fluidez. [T02]

Testar repetição: abrir/fechar inspector cem vezes, alternar entre mapa e batalha, visitar coleção grande e mudar acabamentos. Contagem de recursos deve estabilizar, não crescer indefinidamente.

## 21.5. Recursos de mídia

Gerenciar áudio e imagens decodificadas além da GPU. Fechar recursos de imagem quando a API usada exigir e quando não houver mais consumidores; liberar material não significa liberar todas as referências de imagem. [T04]

---

<a id="runtime-22"></a>

## ⚡ 22. Qualidade gráfica e orçamentos

Metas abaixo são **orçamentos iniciais de desenvolvimento**, não benchmarks executados ou garantia de desempenho em qualquer máquina.

| Perfil | DPR máximo inicial | Efeitos | Meta de apresentação |
|---|---:|---|---|
| Baixo | 1,0 | Sem bloom, sombras simplificadas, foil estático/simplificado. | 30 fps estáveis no dispositivo de referência escolhido. |
| Médio | 1,5 | Sombras limitadas e acabamentos seletivos. | Buscar 60 fps em 1080p no equipamento validado. |
| Alto | 2,0 | Reflexos e pós-processamento controlados. | Buscar 60 fps mantendo margem de memória. |

Reduzir DPR e efeitos antes de reduzir tamanho de fonte. Mesmo no Baixo, as cartas continuam meshes 3D.

## 22.1. Orçamentos de referência

| Recurso | Orçamento inicial para investigação |
|---|---|
| Chamadas de desenho da cena de batalha | Até aproximadamente 200 por frame no perfil Médio. |
| Triângulos visíveis de cenário e objetos | Até aproximadamente 250 mil no Médio. |
| Luzes com sombra dinâmica | No máximo uma no perfil inicial. |
| Partículas simultâneas | Poucas centenas, agrupadas e descartáveis. |
| Cartas de alta resolução na GPU | Somente campo, mão e inspeções próximas, sob cache limitado. |
| Tarefa síncrona na UI | Evitar blocos longos; trabalho de IA sai da thread principal. |
| Tempo de frame para 60 fps | Aproximadamente 16,7 ms totais disponíveis. |
| Tempo de frame para 30 fps | Aproximadamente 33,3 ms totais disponíveis. |

Esses limites são sinais de investigação, não razões para quebrar regras ou omitir efeitos de uma carta. Uma cena simples pode falhar no desempenho por shaders caros mesmo abaixo da contagem de triângulos.

## 22.2. Equipamentos

Registrar sistema, navegador, GPU, resolução, DPR e versão do build em todo relatório. Pelo menos um equipamento com GPU integrada deve fazer parte da validação.

Não escrever “roda em qualquer navegador” sem matriz de testes.

## 22.3. Degradação dinâmica

Mudanças automáticas de qualidade podem diminuir resolução e partículas, mas não alterar aparência a cada frame de forma instável. Usar medição com histerese e informar ajuste quando relevante.

O motor não usa delta de frame para calcular dano, turnos ou chance. FPS baixo não dá mais tempo ou recursos a nenhum lado.

## 22.4. Metas de conteúdo

Definir orçamento real do pacote após inventário de assets. Não prometer download mínimo e ao mesmo tempo exigir centenas de vídeos imersivos em alta resolução. A campanha completa offline precisa caber no pacote distribuído ou numa instalação local explicitamente completa.


## 22.5. Limites de apresentação de batalha e playmats

Orçamentos-alvo desta revisão, somados aos limites existentes, não adicionais:
- máximo de duas texturas de playmat em uma transição e orçamento de até 64 MiB para recursos de superfície/preview no perfil Alto;
- até 200 partículas vivas no Médio em toda a batalha, priorizando impactos sobre ambiente;
- no máximo uma cut-in principal de carta por vez;
- uma única luz com sombra e nenhum shadow caster por partícula;
- cursores, guias e HUD sempre disponíveis mesmo quando ambiente/flair forem removidos.

No Baixo, playmat usa cor/textura fosca, transição simples e até 40 partículas de feedback. Em Alto, permitir detalhes dentro do orçamento global; não aumentar o limite de partículas de todas as camadas independentemente.

Medir frame time, draw calls, texturas residentes, proxies vivos e tarefas da thread principal durante abertura, mão cheia, ataque multialvo, troca de tapete e cinquenta entradas/saídas da oficina. Os números são metas a testar, não resultados obtidos.

---

<a id="runtime-23"></a>

## 🛟 23. Perda de contexto, falhas e fallback

## 23.1. Contexto WebGL perdido

Ao receber perda de contexto, bloquear ações de cena, pausar a partida e mostrar aviso HTML. O estado confirmado continua no motor/save, não no renderer.

Tentar reconstruir renderer/cenas a partir de assets locais e do snapshot conforme o ciclo de recuperação implementado. Se falhar, oferecer modo de compatibilidade 2D, exportar save e voltar ao início.

Não declarar derrota, rerrolar moedas ou gerar novas cartas.

## 23.2. Asset ausente

Arte individual ausente: moldura local com nome, tipo e dados. Modelo de cenário ausente: mesa procedural simples. Carta sem definição funcional: não executar; indicar erro de conteúdo e preservar a tentativa.

Diferenciar degradação cosmética de falta de regra. Não substituir a regra por um ataque aproximado só para continuar.

## 23.3. Falha de armazenamento

Não mostrar “Salvo” se a transação falhou. Suspender novas ações irreversíveis e oferecer tentar gravar novamente, exportar estado recuperável e diagnóstico local.

Quando somente o último estado em memória puder ser exportado, identificar isso claramente como recuperação, não como confirmação de que o banco foi atualizado.

## 23.4. Recuperação sem loops

Contabilizar tentativas de recuperação para não entrar em um ciclo infinito de recarregar página. Um erro repetido abre tela de diagnóstico com versão, código e opções seguras.

O jogador pode acessar o gerenciamento de saves sem precisar carregar a arena defeituosa.

<a id="runtime-fallback-2d"></a>

## 23.5. Fallback 2D em DOM/CSS

**Quando entra:** falha ao criar o contexto WebGL2, perda de contexto sem recuperação (seção 23.1), escolha explícita do jogador em Configurações ou orientação retrato (largura < altura) durante a batalha.

**Como é feito:** HTML/CSS semântico, sem canvas de renderização. Consome as mesmas projeções de tela da apresentação 3D (`BattleView` e projeções das demais telas) e envia as mesmas intenções e comandos. Não existe motor, validação ou caminho de gravação paralelo.

| Tela | Escopo em 2D |
|---|---|
| Batalha | Campo (Ativos, Bancos, pilhas, Energia, pontos e Estádio), mão, ações, decisões pendentes e log. |
| Abertura de pacote | Resumo do recibo e lista de revelação; pular continua disponível. |
| Mapa da campanha | Visão em lista de capítulos e nós, a mesma lista HTML equivalente da seção 17.5. |
| Inspector de carta | Dados em HTML e a face como imagem estática. |
| Prévia do Estúdio | Imagem 2D da face gerada pelo mesmo compositor Canvas das cartas, exibida como imagem. |

Telas que já são HTML (coleção, decks, Empório, saves, configurações) continuam iguais, com miniaturas estáticas no lugar das cenas 3D.

**Retrato:** com largura menor que a altura, a batalha usa a variante 2D compacta (NPC acima, jogador abaixo, mão em faixa rolável), mesmo com GPU disponível. Ao voltar para paisagem, a batalha pode retornar ao 3D.

**Garantias:** entrar no 2D nunca altera o estado de jogo, não consome RNG, não registra evento e não resolve decisão pendente. Voltar ao 3D reconstrói as cenas a partir do estado confirmado, sem reproduzir flairs ou animações já apresentadas (seção 19.8). A tela informa “Modo de compatibilidade 2D”.

---

<a id="runtime-24"></a>

## 📲 24. PWA e cache — extensão opcional

## 24.1. Não substituir o pacote completo

A entrega principal funciona servindo arquivos locais. PWA é opção adicional, não condição para jogar nem prova de que todos os capítulos estão disponíveis offline.

Service workers exigem contexto seguro nas condições documentadas; localhost é tratado como origem adequada para desenvolvimento. Seu ciclo de instalação e atualização precisa ser tratado explicitamente. [T07]

## 24.2. Contrato de instalação PWA

Somente mostrar “Pronto para jogar totalmente offline” depois de verificar shell, bundles, catálogo e todos os assets obrigatórios para a campanha instalada.

Cache apenas da Home não satisfaz o requisito. Um capítulo não visitado precisa abrir em modo offline também.

Se a quota não comportar a instalação integral, informar a limitação e direcionar ao pacote local completo. Não declarar instalação completa só porque o service worker ativou.

## 24.3. Versão consistente

Caches incluem versão/hash. Não combinar código novo com tabelas de cartas antigas sem compatibilidade. Atualizações ficam pendentes até fronteira segura, preferencialmente fora de uma partida.

Não ativar `skipWaiting`/troca de controlador durante duelo como política genérica sem tratamento do estado. Uma atualização opcional não justifica reiniciar o navegador e perder uma escolha.

## 24.4. Desenvolvimento

Desabilitar registro do service worker no fluxo de desenvolvimento normal, ou usar limpeza explícita, para evitar assets antigos mascarando mudanças. Testes de PWA usam build de produção e perfil separado.

## 24.5. Rede

Mesmo quando o computador está conectado, o jogo não busca serviços externos. Uma instalação PWA originalmente obtida de um servidor externo só pode prometer offline depois da instalação verificada; isso é distinto do pacote local que permite a primeira execução sem internet.

---

<a id="runtime-25"></a>

## 🔊 25. Áudio, entrada e navegação local

## 25.1. Áudio

Usar arquivos locais e ativação a partir de gesto quando o navegador exigir. Música, efeitos e UI têm controles independentes.

Falha de áudio não bloqueia jogo. Confirmações, moeda, dano e objetivos possuem feedback visual e textual.

Pausa não deve deixar efeitos de turno seguindo sozinhos. Retomada sincroniza a apresentação, sem tocar todas as notificações antigas de uma vez.

## 25.2. Navegação

Rotas hash compartilham a mesma aplicação. Back/forward respeitam contexto de edição, partida suspensa e modal. Navegar para uma rota de resultado sem recibo válido mostra ausência explicada, não concede recompensa pelo parâmetro da URL.

Uma URL de save, node ou replay não é comando autorizado para alterar estado.

## 25.3. Preferências

Armazenar qualidade, volume, tamanho de texto, modo de movimento reduzido e atalhos por perfil ou dispositivo conforme definição da UI. Preferências de vídeo não invalidam replays.

## 25.4. Diagnóstico

Gerar relatório local com appVersion, catálogo, ruleset, capacidades gráficas, erro e IDs envolvidos. O usuário escolhe salvar o arquivo. Nenhum envio automático de telemetria faz parte desta versão.

---

<a id="runtime-26"></a>

## ✅ 26. Matriz de testes técnicos

| ID | Caso | Critério |
|---|---|---|
| R-001 | Pacote virgem | Primeira execução sem internet e sem cache prévio. |
| R-002 | Capítulo novo | C06 abre offline após progressão/fixture autorizada de teste. |
| R-003 | Bibliotecas | Three.js e addons são locais e da mesma versão. |
| R-004 | CDN | Build não dispara requisições externas. |
| R-005 | Decoder | GLB comprimido funciona sem buscar WASM remoto. |
| R-006 | Fontes | Interface funciona sem fonte de rede. |
| R-007 | Servidor local | Launcher não executa download ou npx remoto. |
| R-008 | Porta ocupada | Não troca de origem silenciosamente. |
| R-009 | file:// | Ajuda explica o launcher suportado. |
| R-010 | Origem | Mudança de hostname/porta é diagnosticável como outro armazenamento. |
| R-011 | Persistência | Recarga restaura inventário e campanha. |
| R-012 | Ação duplicada | Mesmo commandId gera uma alteração. |
| R-013 | Recompensa duplicada | Chave de objetivo impede crédito repetido. |
| R-014 | Transação abortada | Não há débito sem produto. |
| R-015 | Commit sem animação | Recibo recuperado mostra mesmo resultado. |
| R-016 | Quota | Mensagem de falha não afirma sucesso. |
| R-017 | Autosalvamento | Não depende de beforeunload. |
| R-018 | Escolha pendente | Fila e decisão voltam após recarga. |
| R-019 | Retomar moeda | Resultado já resolvido não muda. |
| R-020 | Pausa | Bot não aplica comandos. |
| R-021 | Aba oculta | Simulação pausa conforme contrato. |
| R-022 | Job antigo | Resultado de worker com revisão antiga é descartado. |
| R-023 | Troca de perfil | Não há escrita na coleção anterior. |
| R-024 | Segunda aba | Banco (origem) não possui duas conexões; segunda aba não abre conexão nem em leitura. |
| R-025 | Transferência | Epoch antiga não consegue confirmar alterações. |
| R-026 | Web Locks ausente | Runtime persistente bloqueado com diagnóstico; nenhum fallback de trava ou modo leitura. |
| R-027 | Importação | Arquivo inválido não altera perfil. |
| R-028 | Checksum | Alteração acidental é detectada, sem alegar anti-cheat. |
| R-029 | Backup novo perfil | Não mistura saldos e recibos. |
| R-030 | Migração | Falha preserva dados anteriores. |
| R-031 | Ruleset antigo | Retomada exige versão compatível. |
| R-032 | Replay | Não altera progressão. |
| R-033 | RNG visual | Qualidade/animação não alteram RNG funcional. |
| R-034 | IA | Observação não contém mão humana nem semente do combate. |
| R-035 | Ação IA inválida | Mesmo validador rejeita. |
| R-036 | WebGL2 | Capacidade real verificada; sem promessa de WebGL1. |
| R-037 | 3D obrigatório | Carta tem frente, verso, espessura e perspectiva real. |
| R-038 | Renderer | Uma instância principal, sem canvas por miniatura. |
| R-039 | Viewports | Mesa, mão e inspector não vazam profundidade. |
| R-040 | DPR | Picking correto em 1, 1,5 e 2. |
| R-041 | Resize | Câmera, HUD e seleção permanecem alinhados. |
| R-042 | Modal | Clique não atravessa para a cena. |
| R-043 | Picking | Decoração não intercepta carta. |
| R-044 | Arrasto inválido | Não altera estado persistido. |
| R-045 | Teclado | Fluxo equivalente sem arrasto. |
| R-046 | Carta NPC | Nome e HP permanecem legíveis. |
| R-047 | Foil | Máscara não encobre regras. |
| R-048 | Cor | Sem dupla conversão ou máscara tratada como textura de cor. |
| R-049 | Pular animação | Cursor visual avança sem reexecutar eventos. |
| R-050 | Nocaute | Resultado só aparece após grupo completo de resolução. |
| R-051 | Memória | Cem inspeções não causam crescimento indefinido. |
| R-052 | Recursos compartilhados | Fechar inspector não descarta textura usada na mesa. |
| R-053 | Contexto perdido | Partida pausa e permanece recuperável. |
| R-054 | Arte ausente | Fallback cosmético não altera regras. |
| R-055 | Definição ausente | Erro de conteúdo não vira ataque inventado. |
| R-056 | PWA incompleta | Não informa offline integral. |
| R-057 | PWA atualizando | Não mistura versões durante tentativa. |
| R-058 | Debug | Fixtures não concedem progresso de perfil normal. |
| R-059 | Performance | Relatório registra hardware, build e métricas medidas. |
| R-060 | Modo baixo | Mantém 3D principal com efeitos reduzidos. |
| R-061 | Sem GPU | Compatibilidade 2D permite gerenciamento e ações essenciais. |
| R-062 | Áudio | Silêncio não impede entender resultados. |
| R-063 | Rota resultado | URL sem recibo não concede prêmio. |
| R-064 | Sem telemetria | Nenhuma rotina envia dados sem parte explícita do produto. |

## Roteiro de aceite offline

Descompactar distribuição em máquina/perfil de teste limpo; bloquear acesso externo, preservando loopback; iniciar; criar perfil; concluir tutorial; abrir pacote; editar deck; jogar campanha; suspender numa escolha; fechar/reabrir; retomar; visitar arena de capítulo ainda não carregada; exportar/importar backup; inspecionar log de requisições originadas pela aplicação.

O tráfego de outros serviços do navegador não é tráfego do jogo. Medir as requisições atribuíveis ao contexto da aplicação, sem confundir HMR do desenvolvimento com comportamento de produção.

## Aceite visual

Capturar mapa, editor, inspeção, abertura e combate em 1920×1080 e 1280×720, além de estado de dez cartas na mão, modal, condição especial e contexto perdido. Testar hover, teclado e toque onde aplicável.

Esta spec define testes a executar; a entrega documental não realizou benchmark de GPU, validação em navegadores ou teste funcional de uma implementação.


### 🧪 Critérios adicionais da revisão 2.1

| ID | Verificação | Critério |
|---|---|---|
| R-065 | Material de playmat | Dois samplers em transição, sem duplicar zonas de picking ou deslocar as cartas. |
| R-066 | Fit de câmera | Projetar todos os cantos e HUDs em 1080p/720p/DPR 1, 1.5 e 2; nenhum alvo fica sob painel indevido. |
| R-067 | Plano da mesa | Guias/artes não sofrem z-fighting nem criam silhuetas que ocultam cartas. |
| R-068 | CardTransitScene | Trânsito entre mesa/mão mantém posição e escala visual contínuas com uma única instância de domínio. |
| R-069 | Superfície oculta | Objeto de carta do NPC não recebe asset frontal nem assinatura audiovisual de carta secreta. |
| R-070 | Flair idempotente | Chave evento+entidade não cria segundo emissor em mensagens repetidas ou reconstrução de contexto. |
| R-071 | Diretor de animação | PresentedProjection aplica deltas confirmados em ordem, sem mostrar HP final antes do impacto. |
| R-072 | Barreira de decisão | Skip para na escolha pendente; não inventa alvo/resposta para concluir lote. |
| R-073 | Relógio de apresentação | Pausa e visibilitychange não acumulam delta que avance vários turnos ao retornar. |
| R-074 | Callbacks tardios | Generation token invalida callbacks antigos após skip/resize/context loss. |
| R-075 | Mesmo resultado | Playback nos quatro modos consome zero sorteios de combate e preserva hash final do estado. |
| R-076 | Conversão IndexedDB 2/3 → SQLite 1 | N/A — nesta linha (sem implementação 2.x): não há saves IndexedDB a converter nem conversor no runtime (seção 4.5). |
| R-077 | Preset e posse | Validação rejeita IDs, cores, floats, crop e referências não permitidos antes do commit. |
| R-078 | Formato 3 sem assets | N/A — nesta linha (sem implementação 2.x): não há importador de saves JSON formato 3 (seção 7.1). |
| R-079 | Importação de imagem | Limites de bytes, dimensões e formato são aplicados antes/depois do decode; nenhuma URL remota aceita. |
| R-080 | Backup portátil | Bloqueia path traversal, excesso de expansão, symlinks, hashes inválidos e referências externas. |
| R-081 | Importação atômica | Erro na validação final não deixa meia carteira/preset no banco; staging é limpo com segurança. |
| R-082 | GC de assets | Imagem usada por replay/tentativa não é removida ao apagar apenas um preset. |
| R-083 | Recursos gráficos | Trocar playmat/cena repetidamente mantém cache limitado; dispose não invalida recursos ainda compartilhados. |
| R-084 | Instalação offline | Primeiro uso de todos os nove temas, shaders e sons funciona sem cache externo, CDN ou download. |

São critérios planejados de implementação, não resultados de execução de uma aplicação neste pacote.

---

<a id="runtime-27"></a>

## 🚧 27. Sequência de implementação

| Etapa | Entrega | Não avançar sem |
|---|---|---|
| 1 | Domínio determinístico, fixtures e testes básicos. | Partida completa por comandos, sem dependência de renderização. |
| 2 | SQLite, operação idempotente, pausa, exportação e retomada. | Interrupção recuperável sem duplicar cartas. |
| 3 | Uma mesa Three.js real, mão, picking e HUD HTML. | Legalidade independente da animação; 1080p/720p legíveis. |
| 4 | Mapa C01, editor, pack 3D e coleção local. | Fatia vertical de campanha completa offline. |
| 5 | Conteúdo dos outros capítulos e IA. | Grafo e balanceamento mínimo auditados. |
| 6 | Acabamentos, galeria, qualidade e robustez. | Performance medida, ausência de vazamentos e fallback. |
| 7 | Empacotamento final e PWA opcional. | Primeira execução offline e assets completos. |

Three.js entra na primeira fatia jogável, não como uma decoração prometida para depois de todo o produto. O motor pode e deve ser testado antes da cena, mas a entrega visual da fatia não é somente HTML estático.

Não implementar multiplayer como “preparação para o futuro”. Não criar adaptadores fictícios de servidor para substituir chamadas locais simples. Extensões futuras devem ser novas decisões de escopo.

---

<a id="runtime-28"></a>

## 📚 28. Referências técnicas

Documentação técnica consultada para esta revisão em 14 de outubro de 2026. Links são referências para desenvolvimento, não dependências de rede da aplicação.

As decisões de arquitetura são próprias. As fontes não afirmam que este projeto, seus assets ou seus benchmarks já existem.

T12 e T20 foram removidos em revisões anteriores; numeração preservada para rastreabilidade. Não reutilizar esses números para novas referências.


### [T01] Three.js — Installation

```text
https://threejs.org/manual/pages/installation.html
```

### [T02] Three.js — WebGLRenderer

```text
https://threejs.org/docs/pages/WebGLRenderer.html
```

### [T03] Three.js — Cleanup

```text
https://threejs.org/manual/pages/cleanup.html
```

### [T04] Three.js — How to dispose of objects

```text
https://threejs.org/manual/pages/how-to-dispose-of-objects.html
```

### [T05] MDN — IDBTransaction — referência histórica da revisão IndexedDB

```text
https://developer.mozilla.org/docs/Web/API/IDBTransaction
```

### [T06] MDN — StorageManager.persist

```text
https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
```

### [T07] MDN — Using Service Workers

```text
https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
```

### [T08] Three.js — Multiple scenes

```text
https://threejs.org/manual/pages/multiple-scenes.html
```

### [T09] Three.js — Color management

```text
https://threejs.org/manual/pages/color-management.html
```

### [T10] Three.js — Raycaster

```text
https://threejs.org/docs/pages/Raycaster.html
```

### [T11] Three.js — GLTFLoader

```text
https://threejs.org/docs/pages/GLTFLoader.html
```

### [T13] MDN — Storage quotas and eviction criteria

```text
https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
```

### [T14] MDN — Web Locks API

```text
https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
```

### [T15] MDN — Using Web Workers

```text
https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
```

### [T16] Three.js — KTX2Loader

```text
https://threejs.org/docs/pages/KTX2Loader.html
```

### [T17] Three.js — DRACOLoader

```text
https://threejs.org/docs/pages/DRACOLoader.html
```

### [T18] MDN — Page Visibility API

```text
https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
```

### [T19] MDN — IDBDatabase.transaction — referência histórica da revisão IndexedDB

```text
https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction
```


### [T21] Three.js — MeshStandardMaterial

```text
https://threejs.org/docs/pages/MeshStandardMaterial.html
```

### [T22] Three.js — MeshPhysicalMaterial

```text
https://threejs.org/docs/pages/MeshPhysicalMaterial.html
```

### [T23] Three.js — AnimationMixer

```text
https://threejs.org/docs/pages/AnimationMixer.html
```

### [T24] MDN — createImageBitmap

```text
https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
```

---

<a id="runtime-29"></a>

## 🧭 29. Contrato final para implementação

> O jogo deve abrir e permanecer funcional sem internet a partir de um pacote local completo. A campanha, a IA, os sorteios e os saves rodam no dispositivo. SQLite confirma operações antes de a UI apresentar sucesso. Three.js renderiza cartas, mesa, pacotes e mapas reais em 3D, enquanto HTML mantém navegação, leitura e acessibilidade. Nenhuma física, taxa de quadros, shader, atualização de cache ou callback atrasado pode alterar regras ou duplicar recompensas.

O critério final não é “a tela abriu offline depois que já tinha sido usada online”. É: **perfil novo, assets locais completos, progresso real, duelo reproduzível e retomada segura, inclusive numa região ainda não visitada**.

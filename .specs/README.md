# 🎮 Especificações — experiência visual TCG Pocket, campanha local e Three.js

> **Pacote:** 3.2.0 · **Revisão:** 14 de outubro de 2026  
> **Perfil visual:** `pocket-light-v1`  
> **Plataforma:** navegador local, 16:9, single-player, offline-first, Three.js e SQLite WASM/OPFS.  
> **Entrega:** documentação completa e referências técnicas. Não contém jogo, editor executável, runtime WASM, artes prontas ou fontes.

## 🔧 Revisão 3.2.0 — correções e lacunas

Auditoria completa das specs 3.1.0: ~70 erros, contradições e lacunas corrigidos in-place (lista e justificativas no [CHANGELOG](CHANGELOG.md)). Destaques: nova spec normativa [efeitos-dsl.md](efeitos-dsl.md) com os 32 opcodes executáveis; schemas de carta/impressão completos e nove schemas de conteúdo novos; DDL v1 corrigido (47 tabelas, migração atômica pelo runner, gatilhos de imutabilidade, vínculo projeto↔publicação); hashes por RFC 8785 (JCS); chaves de concessão únicas e sem versão de conteúdo; regras antes ausentes (primeiro jogador, Zona de Energia, piso de dano, condições, promoções simultâneas, `rng-v1`); geometria de batalha completa e mapa evento→preset; conversor IndexedDB declarado não aplicável.

## 🎯 O que a revisão visual 3.1 mudou

O visual das imagens conceituais escuras anteriores foi descartado como referência. A apresentação passa a usar o **campo claro, a paleta azul/lavanda, o aro branco, os detalhes ciano/coral, os cards ilustrados e a linguagem de animação do Pokémon TCG Pocket**.

Não é uma troca isolada de cor: composição do campo, câmera, luz, materiais, molduras de carta, efeitos, telas de campanha e Estúdio foram alinhados. A mesa de batalha não fica em uma sala medieval, porto noturno ou oficina de bronze.

Os hexadecimais, as coordenadas 16:9 e os tempos são aproximações autorais para implementação, não tokens ou medições internos da Pokémon. As [fontes visuais](referencias-visuais.md) distinguem o que foi observado do que foi projetado. Nenhuma captura oficial é redistribuída como arte de produção.

## 📚 Oito specs normativas

| Documento | Responsabilidade |
|---|---|
| [direcao-visual-pocket.md](direcao-visual-pocket.md) | Paleta, tipografia, campo, câmera, arte, materiais, animações, briefs e critérios de conformidade. Leitura obrigatória antes de produzir a interface. |
| [gameplay.md](gameplay.md) | Regras, turnos, cartas, Energia, efeitos, condições, pontuação, inventário e contratos de apresentação. |
| [efeitos-dsl.md](efeitos-dsl.md) | Linguagem executável de efeitos: blocos, seletores, fórmulas, condições, durações, gatilhos e registro de opcodes. |
| [interface-16x9.md](interface-16x9.md) | Telas, rotas, batalha, mão, playmats, personalização, pacotes, coleção, decks e acessibilidade. |
| [campanha.md](campanha.md) | Campanha Jornada dos Ginásios (`circuito-dos-arquivos-v1`), 45 nós planejados, desafios, objetivos, economia, rivais da franquia e desbloqueios. |
| [runtime-offline-threejs.md](runtime-offline-threejs.md) | Instalação offline, runner local, workers, cenas, renderização, animação, picking, memória, desempenho e recuperação. |
| [persistencia-sqlite.md](persistencia-sqlite.md) | SQLite WASM/OPFS, 47 tabelas, comandos, transações, versões, migração, BLOBs, backup e restore. |
| [editor-de-cartas.md](editor-de-cartas.md) | Estúdio de autoria: regras, ataques, Habilidades, arte, ex, normal/foil, testes e publicação imutável. |

A [adaptação da gameplay ao Pokémon TCG Pocket](gameplay-pocket.md) (preparação na mesa, faixa de turno, avisos, menu, tutorial, ataque e animações a partir de um vídeo de referência; observações em [referencias/](referencias/gameplay-pocket-observacoes.md)) prevalece sobre interface e runtime para a mesa de batalha.

O [catálogo de conteúdo](catalogo-conteudo.md) do conteúdo `base` 3.1.0 — todos os sets do Pokémon TCG Pocket do Genetic Apex (A1) ao Deluxe Pack ex (A4b), mais Promo-A e Promo-B — é **gerado** por `npm run content:build` a partir de `src/content/`; não é editado à mão. O índice traz resumo, conjuntos, acabamentos, produtos com as probabilidades de cada pacote, decks, campanha, objetivos, prêmios e a auditoria de Créditos; as cartas de cada set ficam em arquivos próprios, `catalogo/cartas-<set>.md` (por exemplo, [cartas-a1.md](catalogo/cartas-a1.md)).

A direção visual é autoridade para aparência. Gameplay é autoridade para regras; o DSL, para a forma executável dos efeitos. A spec de persistência é autoridade para gravação. Imagens conceituais antigas não podem introduzir regras, números, campos ou funcionalidades conflitantes.

## 🧊 Como deve parecer

Campo quase visto de cima, com leve profundidade, uma base arredondada clara com a arena do Pocket no centro — metade do adversário coral, a do jogador azul-clara, aceso o lado de quem joga ([gameplay-pocket §2](gameplay-pocket.md#pocket-2)) — e cartas verticais. Um Ativo e três posições de Banco por lado; três indicadores de pontos; mão em primeiro plano. Inspector fica recolhido por padrão, abrindo quando solicitado.

Interface branca/azul-pálido, botões arredondados e texto azul-escuro. Laranja aparece em cartas e efeitos de Fogo, não como identidade global. Arte segue uma família de ilustração de cartas japonesas, permitindo pintura suave, traço, aquarela e render estilizado, em vez de impor fantasia sombria.

Compra é movimento curto do deck para a mão. Revelação de pacote é saída/deslizamento da carta frontal para mostrar a próxima. Ataque usa carta ampliada, faixa com nome, efeito elemental e retorno ao campo. Nenhuma física ou animação determina resultados.

## 💾 O que permanece

Campanha permanente e integralmente offline. Three.js real, UI HTML acessível, SQLite como fonte persistente e editor de cartas completo. Não há conta, serviços online, fila competitiva, geração remota de arte ou espera por pacotes.

Ruleset `local-campaign-v2`, schema SQLite `1` (corrigido em 3.2.0 antes de qualquer publicação), `dataVersion` funcional `2`, `effects-dsl-v1` e `rng-v1`. A revisão visual não exige novas tabelas e não altera HP, ataques, economia ou resultados. Artes/impressões publicadas são imutáveis; novos visuais recebem novas versões/IDs. Presets de conforto não reescrevem duelos antigos.

## 🎨 Configurações e exemplos

| Arquivo | Uso |
|---|---|
| [visual-tokens.json](examples/visual-tokens.json) | Cores sRGB, tipografia, espaços e condições de apresentação. |
| [theme-pocket.css](design/theme-pocket.css) | Variáveis e componentes CSS de referência, sem fontes remotas. |
| [battle-layout.json](examples/battle-layout.json) | Retângulos de tela, oito âncoras de cartas e câmera inicial para 1080p/720p. |
| [animation-presets.json](examples/animation-presets.json) | Os 38 presets de duração preservados e vinculados ao perfil claro. |
| [motion-choreography.json](examples/motion-choreography.json) | Doze sequências detalhadas por fase, sem executar regras. |
| [playmats.example.json](examples/playmats.example.json) | Nove tapetes, novos assets/versionamento visual, mesmos direitos e preços. |
| [cosmetic-preset.example.json](examples/cosmetic-preset.example.json) | Exemplo da seleção da Academia na nova revisão. |
| [presentation-plan.example.json](examples/presentation-plan.example.json) | Compra adversária sem exposição de frente, raridade ou foil. |
| [art-briefs.json](examples/art-briefs.json) | Cinco briefs de produção: cartas, NPC, capítulo e playmat. |
| [visual-capture-matrix.json](examples/visual-capture-matrix.json) | Dezoito cenários de captura em dois viewports; testes visuais ainda não executados. |
| [card-definition.example.json](examples/card-definition.example.json) | Braseiro ex, 140 HP, definição funcional de referência preservada. |
| [card-printings.example.json](examples/card-printings.example.json) | Duas impressões normal/foil da mesma regra, preservadas como exemplos estruturais. |
| [editor-project.example.json](examples/editor-project.example.json) | Projeto de autoria correspondente aos exemplos. |
| [database-backup-manifest.example.json](examples/database-backup-manifest.example.json) | Envelope ilustrativo do backup de banco. |

Os arquivos de exemplo não são uma aplicação ou um catálogo jogável. IDs de assets são contratos para produção. Não tratar `status` de exemplo como prova de que uma arte, shader ou recurso já existe.

## 🗄️ SQL, schemas e validação

[Schema SQL](database/schema-v1.sql) (DDL puro, aplicado pelo runner numa única transação), [gerador do seed](database/build_seed.py) e [seed técnico](database/seed-demo.sql), [banco demo](database/demo.sqlite3), [script de teste](database/test_schema.py) e [instruções do banco](database/README.md).

Schemas em [schemas/](schemas/): definição de carta (DSL completo), impressão, rascunho do Estúdio, deck de conteúdo, produto, objetivo, nó de campanha, tabela de prêmio, NPC, perfil de IA, fixture de batalha, cosmético e diálogo. Os geradores ficam em `scripts/gen_card_schema.py` e `scripts/gen_content_schemas.py`.

O banco demo usa fixtures técnicas; não é save jogável. O script testa SQLite nativo, não substitui homologação do VFS OPFS em navegador.

```bash
python database/build_seed.py
python database/test_schema.py --report database/sqlite-test-results.json --output database/demo.sqlite3 --overwrite
python scripts/validate_specs.py --write-report
python scripts/build_manifest.py
```

A ordem importa: o manifesto é gerado por último. O validador usa Python e o pacote `jsonschema` no ambiente de desenvolvimento; não é dependência do jogo.

Resultados e limitações estão em [VALIDACAO.md](VALIDACAO.md). Mudanças estão em [CHANGELOG.md](CHANGELOG.md). O manifesto de hashes é [MANIFEST.sha256](MANIFEST.sha256).

## 🛠️ Ordem de implementação

1. Ler direção visual e gameplay; montar um fixture correto de oito slots.
2. Implementar o motor e a persistência SQLite sem depender do renderer.
3. Entregar campo claro Three.js, mão, rótulos HTML, seleção e retomada.
4. Aplicar as coreografias de compra, ataque, revelação e condições.
5. Entregar coleção, editor de decks e Estúdio com os mesmos materiais.
6. Completar campanha, playmats e homologação visual em 1080p/720p.

Não refazer o motor porque uma imagem parece outro card game. Não aceitar apenas “é branco e azul”: comparar câmera, composição, cartas, legibilidade e ritmo com as referências identificadas.

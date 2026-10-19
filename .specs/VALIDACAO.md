# ✅ Validação do pacote 3.2.0

> **Data:** 14 de outubro de 2026  
> **Escopo executado:** documentos, configurações, schemas, exemplos, integridade do banco demo e testes em SQLite nativo.  
> **Não executado:** jogo, Estúdio, render Three.js, comparação de screenshots, GPU, WASM/OPFS ou importação em navegador.

## 📚 Verificação documental e de configuração

Execução reproduzível: `python scripts/validate_specs.py --write-report`. Resultado estruturado: [documentation-test-results.json](documentation-test-results.json) — **0 pendências**.

| Verificação | Resultado |
|---|---|
| Markdown examinados, excluindo este relatório | 12 |
| Links relativos conferidos | 541; nenhum ausente |
| Âncoras explícitas | 257; sem duplicação; todas as âncoras da 3.1.0 preservadas |
| Numeração de seções | Única em todos os documentos |
| Blocos JSON em Markdown | 33 interpretados; cartas, impressões, ataques, Habilidades e blocos de efeito validados contra os schemas |
| Arquivos JSON | 29 interpretados |
| JSON Schema | 13 schemas verificados; 27 validações de exemplos/fragmentos |
| Effect DSL | 34 opcodes; tabela do documento idêntica ao registro do schema |
| Chaves de concessão | 38 ocorrências; nenhuma com `profileId` ou versão de conteúdo |
| Tokens de cor | JSON e CSS correspondem, inclusive as faixas de ataque |
| Layout projetado | 2 perfis; 8 slots 5:7 sem interseção; regiões novas sem sobrepor cartas; mão centrada; tabelas §23.5/§23.14 iguais ao JSON |
| Rotas | 53 (S00–S52), IDs e caminhos únicos |
| Presets | 38 de jogo iguais à tabela §36.2; 3 de interface |
| Coreografias | 12; fases contínuas, soma igual ao preset, easing válido, sem mutação de domínio |
| Playmats | 9; versão 2; preset de exemplo sem mapa de flair |
| Briefs de arte | 7 |
| Matriz de captura | 18 cenários × perfis do layout, todos pendentes |

A validação de retângulos e proporções **não equivale a renderizar a projeção Three.js**.

## 🎨 Contraste numérico

Limiar 4,5:1, luminância relativa sRGB.

| Par | Razão |
|---|---:|
| `text` / `surface` | 11.64:1 |
| `textSecondary` / `surface` | 5.82:1 |
| `primaryInk` / `primary` | 5.86:1 |
| `text` / `cyanSoft` | 10.23:1 |
| `success` / `surface` | 6.08:1 |
| `danger` / `surface` | 6.51:1 |

Faixas de ataque (branco sobre a cor escurecida do tipo): GRASS 4.61, FIRE 4.61, WATER 4.63, LIGHTNING 4.62, PSYCHIC 4.64, FIGHTING 4.62, DARKNESS 7.04, METAL 4.60, DRAGON 4.64, COLORLESS 4.63.

## 🗄️ SQLite realmente executado

`python database/test_schema.py` em Python `sqlite3`, SQLite **3.50.4**: **89 verificações aprovadas de 89**. O [relatório SQL](database/sqlite-test-results.json) registra: migração atômica (falha mantém `user_version` 0), DDL sem transação própria, 47 tabelas, seed gerado igual ao arquivo, cobertura de todas as tabelas, hashes JCS, gatilhos de imutabilidade e poda, bindings declarados, restrições de tentativa e progresso, CAS de revisão, rollback, reabertura e backup nativo.

O banco demo (`user_version` 1, 47 tabelas) abre com `integrity_check = ok` e nenhuma violação de chave estrangeira. É fixture técnica, não save jogável.

## 📋 Critérios de produto ainda a implementar

| Spec | Critérios planejados |
|---|---:|
| `campanha.md` | 56 |
| `direcao-visual-pocket.md` | 60 |
| `editor-de-cartas.md` | 70 |
| `efeitos-dsl.md` | 24 |
| `gameplay.md` | 88 |
| `interface-16x9.md` | 132 |
| `persistencia-sqlite.md` | 55 |
| `runtime-offline-threejs.md` | 84 |
| **Total** | **569** |

R-076, R-078, DB-042, DB-043 e C-054 estão marcados N/A (sem implementação 2.x). Os testes acima **não significam que esses critérios passaram**: o jogo é implementado a partir deste pacote.

## 🔎 Evidência visual e fidelidade

Referências em [referencias-visuais.md](referencias-visuais.md). Códigos hexadecimais, dimensões, curvas e milissegundos são alvos autorais; não foram extraídos do Pocket. A campanha horizontal e o editor de cartas são propostas deste projeto.

## 🔒 Integridade da entrega

[MANIFEST.sha256](MANIFEST.sha256) é gerado por último (`python scripts/build_manifest.py`) e contém tamanho e hash de todos os arquivos, exceto ele próprio. Conferir esse manifesto é diferente de validar regras de gameplay.

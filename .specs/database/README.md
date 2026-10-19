# 🗄️ Banco técnico de referência

Este diretório contém **DDL, gerador de fixture e testes nativos**, não a implementação do serviço de storage do jogo.

| Arquivo | Papel |
|---|---|
| `schema-v1.sql` | Migração `0001-schema-v1`: **47 tabelas**, índices, restrições e triggers. DDL puro, sem `BEGIN`/`COMMIT`/`PRAGMA`. |
| `build_seed.py` | Gera `seed-demo.sql` a partir dos exemplos JSON (`../examples/`), com hashes JCS (RFC 8785) + UTF-8 + SHA-256. |
| `seed-demo.sql` | Fixture técnica **gerada**; não editar à mão. Inclui um PNG de 1 pixel em BLOB. |
| `test_schema.py` | Aplica o DDL como o runner da aplicação, carrega a fixture e verifica restrições, triggers, hashes e rollback. |
| `demo.sqlite3` | Banco de inspeção gerado pelo teste (`--output`). |
| `sqlite-test-results.json` | Relatório gerado pelo teste (`--report`). |

O seed não passa pelo futuro validador completo do Estúdio e identifica a publicação como fixture. A tentativa e o deck de duas cartas são intencionalmente incompletos e não devem ser importados como campanha jogável.

## 🧬 Semântica do runner de migração

O arquivo de migração não abre transação nem altera PRAGMAs. O runner da aplicação ([persistência §21](../persistencia-sqlite.md#sqlite-21)) — e `test_schema.py`, que o reproduz — faz:

```text
PRAGMAs de conexão, fora de transação (lidos de volta):
  foreign_keys = ON · journal_mode = DELETE · synchronous = FULL · busy_timeout = 1500
BEGIN IMMEDIATE
→ schema-v1.sql
→ INSERT INTO schema_migrations (versão, nome, SHA-256 dos bytes do arquivo, data)
→ PRAGMA application_id = 1128354372
→ PRAGMA user_version = 1
→ COMMIT
Erro → ROLLBACK; o banco continua em user_version 0, sem tabelas.
```

O teste confere essa atomicidade com uma migração propositalmente quebrada.

## ▶️ Execução

A partir da pasta `.specs`:

```bash
python database/build_seed.py
python database/test_schema.py
python database/test_schema.py --report database/sqlite-test-results.json --output database/demo.sqlite3 --overwrite
```

1. `build_seed.py` regenera `seed-demo.sql` deterministicamente. Rode-o sempre que um exemplo JSON usado pela fixture mudar.
2. `test_schema.py` falha se `seed-demo.sql` divergir do gerador, se o DDL contiver transação/PRAGMA ou se qualquer verificação não passar. Ele cria um banco temporário, aplica a migração como o runner, carrega o seed, testa restrições, triggers, poda de revisões do editor, CAS e rollback, fecha/reabre e verifica uma cópia de backup nativa.
3. Saídas opcionais: `--report <arquivo.json>` grava o relatório; `--output <arquivo.sqlite3>` grava o banco de inspeção; `--overwrite` permite substituir um `--output` existente.

O schema requer suporte a tabelas STRICT, colunas geradas e funções JSON. O runner da aplicação deve fixar e homologar a release distribuída do SQLite; a versão da biblioteca do seu Python pode ser diferente.

## 🔒 Limites

O DDL é uma camada de proteção, não o motor de regras. Publicação válida, preços, limite de deck, seletores, autoria de Habilidades e scripts de migração precisam de código de aplicação.

Triggers protegem histórico publicado contra mutação comum. Não desativá-las para atualizar cartas. Heads e novas revisões são o caminho previsto; revisões AUTO do editor são as únicas podáveis. Exclusões de perfis são tratadas como arquivamento nesta linha; reset completo é outra operação.

O worker de banco, VFS OPFS, cabeçalhos COOP/COEP e UI não são fornecidos aqui. Consulte [persistencia-sqlite.md](../persistencia-sqlite.md).

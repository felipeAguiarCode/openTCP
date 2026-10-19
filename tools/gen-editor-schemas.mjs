// Gera src/domain/editor/schemas.generated.ts a partir dos schemas da spec (card-definition, card-printing,
// editor-draft): o Estúdio valida no navegador sem ler arquivos. Rode depois de .specs/scripts/gen_card_schema.py.
//   node tools/gen-editor-schemas.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, '.specs', 'schemas', f), 'utf8'));
const entry = (name, file) => `/** ${file} */\nexport const ${name}: SchemaNode = JSON.parse(${JSON.stringify(JSON.stringify(read(file)))}) as SchemaNode;\n`;
const out = `// GERADO a partir de .specs/schemas/{card-definition,card-printing,editor-draft}.schema.json. Não editar à mão:
// o teste schemas.test.ts confere, documento a documento, que este módulo é idêntico aos arquivos da spec.
import type { SchemaNode } from './jsonschema.ts';

${entry('CARD_DEFINITION_SCHEMA', 'card-definition.schema.json')}
${entry('CARD_PRINTING_SCHEMA', 'card-printing.schema.json')}
${entry('EDITOR_DRAFT_SCHEMA', 'editor-draft.schema.json')}`;
fs.writeFileSync(path.join(root, 'src', 'domain', 'editor', 'schemas.generated.ts'), out);
process.stdout.write('schemas.generated.ts atualizado\n');

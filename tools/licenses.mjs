// Copia as licenças das dependências empacotadas para LICENSES/ (runtime §1.5, §20.7).
// Só módulos nativos do Node. Falha se uma licença obrigatória estiver ausente.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const BUNDLED = [
  { name: 'three', license: 'MIT', file: 'node_modules/three/LICENSE' },
  { name: 'preact', license: 'MIT', file: 'node_modules/preact/LICENSE' },
  { name: '@preact/signals', license: 'MIT', file: 'node_modules/@preact/signals/LICENSE' },
  { name: 'fflate', license: 'MIT', file: 'node_modules/fflate/LICENSE' },
  { name: '@fontsource/nunito (fonte Nunito)', license: 'OFL-1.1', file: 'node_modules/@fontsource/nunito/LICENSE' },
  { name: '@sqlite.org/sqlite-wasm (SQLite)', license: 'Public Domain', file: null },
];

const SQLITE_NOTICE = `SQLite — domínio público.
O código-fonte do SQLite foi dedicado ao domínio público pelos seus autores.
Detalhes: https://sqlite.org/copyright.html (texto informativo; o jogo não acessa este endereço).
O pacote @sqlite.org/sqlite-wasm distribui o build WebAssembly oficial do SQLite.
`;

export function writeLicenses(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const index = [];
  for (const dep of BUNDLED) {
    const safe = dep.name.replace(/[^a-z0-9.-]+/gi, '_').replace(/^_+|_+$/g, '');
    const out = path.join(targetDir, `${safe}.txt`);
    if (dep.file) {
      const src = path.join(root, dep.file);
      if (!fs.existsSync(src)) throw new Error(`licença ausente: ${dep.file}`);
      fs.copyFileSync(src, out);
    } else {
      fs.writeFileSync(out, SQLITE_NOTICE);
    }
    index.push(`${dep.name} — ${dep.license} — ${path.basename(out)}`);
  }
  const game = `Card Campaign — projeto de fã não oficial, sem fins comerciais.
Código, motor de regras, campanha e textos de interface pertencem ao projeto open-tcgp. Os rivais são
treinadores da franquia Pokémon, com falas escritas para o projeto.
Dados das cartas (conteúdo 3.5.0): sets do Pokémon TCG Pocket do Genetic Apex (A1) ao Deluxe Pack ex (A4b),
Promo-A e Promo-B — nomes, números, atributos e efeitos são de terceiros (© The Pokémon Company / Nintendo /
Creatures / GAME FREAK), usados apenas localmente; Pokémon é marca registrada dos seus titulares.
Imagens das cartas (dist/assets, “Impressão completa”): a carta impressa de cada impressão, de terceiros
(© The Pokémon Company; ilustradores creditados em cada carta), obtidas via Limitless TCG — uso local, não
redistribuir. Retratos dos treinadores (avatares do jogador e dos rivais), bolas de Energia e a frente oficial
dos pacotes (fornecidas pelo autor; as do Genetic Apex, do Serebii), as moedas do Pokémon TCG Pocket (a face, do
Serebii; a coroa, derivada dela), os sleeves do Pocket (versos, do Serebii) e os ícones de efeito (fornecidos pelo
autor): imagens de terceiros (© The Pokémon Company) — uso local, não redistribuir.
Tapetes e as demais moedas são texturas procedurais; o verso foi fornecido pelo autor.

Bibliotecas incluídas:
${index.map((l) => `- ${l}`).join('\n')}
`;
  fs.writeFileSync(path.join(targetDir, 'LEIA-LICENCAS.txt'), game);
  return index;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const list = writeLicenses(path.join(root, 'LICENSES'));
  process.stdout.write(`${list.length} licenças em LICENSES/\n`);
}

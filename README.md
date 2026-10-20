# Card Campaign

Jogo de cartas para um jogador, offline, no navegador (Preact + Three.js + SQLite WASM).

> Projeto de fã, não oficial. As imagens do Pokémon TCG Pocket (© The Pokémon Company) e as origens brutas delas
> não vão para o repositório público; sem elas a validação do conteúdo (`npm run dev`/`build`) acusa a arte ausente.

## Requisitos

- [Node.js](https://nodejs.org) 22 ou mais recente
- [Python](https://www.python.org) 3, disponível como `python`, com o Pillow: `pip install pillow`
- Navegador atual (Chrome, Edge, Firefox ou Safari)

## Passo a passo

1. Clone e instale as dependências:

   ```sh
   git clone https://github.com/felipeAguiarCode/openTCP.git
   cd openTCP
   npm ci
   ```

2. Confira as artes e as origens delas (já ficam no repositório local; detalhes em `src/presentation/assets/ASSETS.md`):

   ```text
   src/content/source/pocket/raw/<setId>/   JSON das cartas de cada set (Limitless TCG)
   src/presentation/assets/
   ├── cards/<setId>/                       imagem de cada carta (no set novo, ponha <CÓDIGO>-NNN.webp ao lado do JSON)
   ├── portraits/                           emotes dos treinadores (a própria origem)
   ├── card-back-source.png                 verso das cartas
   └── source/                              origens brutas: packs/, coins/, sleeves/, effects/, energy/energys.png
   ```

3. Regenere as artes só quando uma origem mudar (`-- --check` confere sem gravar):

   ```sh
   npm run assets:import
   npm run assets:energy
   npm run assets:packs
   npm run assets:coins
   npm run assets:sleeves
   npm run assets:effects
   python -c "from PIL import Image; Image.open('src/presentation/assets/card-back-source.png').save('src/presentation/assets/card-back.webp', quality=90)"
   ```

4. Rode o jogo:

   ```sh
   npm run dev
   ```

   Abra http://localhost:5173

## Outros comandos

| Comando | O que faz |
|---|---|
| `npm run build` e `npm run preview` | Gera a versão final em `dist/` e serve em http://localhost:4173 |
| `npm test` | Roda os testes |
| `npm run package` | Gera o pacote offline em `card-campaign/` (abra com `start-local.cmd` ou `./start-local.sh`) |

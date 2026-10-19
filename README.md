# Card Campaign

Jogo de cartas para um jogador, offline, no navegador (Preact + Three.js + SQLite WASM).

> Projeto de fã, não oficial. As imagens do Pokémon TCG Pocket (© The Pokémon Company) não estão neste repositório:
> elas são geradas a partir do seu material de referência na pasta `.inspo/`.

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

2. Coloque a pasta `.inspo/` na raiz do projeto:

   ```text
   .inspo/
   ├── decks/<Set (CÓDIGO)>/    JSON e imagens das cartas de cada set
   ├── decks/_base/Card_Back.png
   ├── portraits/               emotes dos treinadores
   ├── scene/battle/energys.png
   ├── boosters/                arte dos pacotes
   ├── coins/serebii/           moedas
   ├── sleeves/serebii/         sleeves
   └── effects/                 ícones de efeito
   ```

3. Gere as artes:

   ```sh
   npm run inspo:import
   npm run inspo:energy
   npm run inspo:packs
   npm run inspo:coins
   npm run inspo:sleeves
   npm run inspo:effects
   python -c "from PIL import Image; Image.open('.inspo/decks/_base/Card_Back.png').save('src/presentation/assets/card-back.webp', quality=90)"
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

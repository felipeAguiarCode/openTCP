# 📚 Referências visuais — Pokémon TCG Pocket

> **Revisão documental:** 3.2.0 · **Consulta:** 14 de outubro de 2026  
> **Uso:** sustentar a direção visual e distinguir observação de decisão de implementação.  
> **Autoridade de design:** [direcao-visual-pocket.md](direcao-visual-pocket.md).

## 🔎 Como ler a referência

Foram consultadas páginas oficiais e examinadas as imagens de batalha, ataque, pontos, acessórios, abertura e edição listadas abaixo. As páginas oficiais avisam que algumas capturas são de produto em desenvolvimento. Portanto, elas são uma **referência visual identificada**, não uma prova da aparência de toda versão, evento ou acessório atual.

Não foi realizada medição quadro a quadro de um cliente executável. Milissegundos, curvas de interpolação, dimensões 16:9, materiais Three.js e códigos hexadecimais deste pacote são **parâmetros de implementação aproximados**, sujeitos a comparação visual. Não são tokens extraídos do aplicativo nem valores fornecidos pela Pokémon.

As imagens conceituais escuras geradas anteriormente nesta conversa **não são referência aprovada**. Seus números de cartas, tipos inventados, cinco posições, resistência, “mana” e recursos online não devem ser transcritos para o projeto.

As capturas oficiais não são redistribuídas neste ZIP como assets do jogo. Os endereços abaixo são documentação para a equipe. A aplicação entregue deve carregar apenas conteúdo local.

## 🃏 RP01 — Composição do campo padrão

**Fonte:** site oficial japonês, “Como jogar — Batalhas”, imagem `img12.png`.

**Observação:** superfície clara azul/lilás; aro branco; faixa ciano próxima e coral distante; Ativos centrais; três posições de Banco por participante; HP fora da impressão; fichas circulares de Energia; pilhas na lateral; mão em primeiro plano. O desenho central faz parte da identidade visual do produto de referência.

**Aplicação:** campo claro, visão quase superior, mesmos grupos funcionais, profundidade pequena e fundo sem ambiente cinematográfico. As faixas usam os tokens `playerBand` (próxima) e `opponentBand` (distante); `cyan` fica reservado à seleção de cartas. O motivo central autoral não deve parecer uma marca de botão interativo.

```text
https://www.pokemontcgpocket.com/ja/howtoplay/battle/
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img12.png
```

## ⚔️ RP02 — Destaque do ataque

**Fonte:** mesma página, imagem `img13.png`.

**Observação:** carta ampliada e inclinada sobre a mesa temporariamente escurecida; faixa horizontal colorida com nome do ataque; linhas de velocidade e brilhos. A carta permanece protagonista — não aparece uma criatura independente lutando no cenário.

**Aplicação:** cut-in de carta, tipografia legível, cor da família do ataque — em tom escurecido (`attackStripColors`) para o texto branco manter 4,5:1 — e retorno rápido ao campo. A captura não fornece duração, easing ou shader.

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img13.png
```

## 🏅 RP03 — Pontos

**Fonte:** mesma página, imagem `img14.png`.

**Observação:** sobreposição clara azul/ciano, avatar circular, discos amarelos de pontuação e campo em segundo plano. A imagem apresenta três marcadores de pontos.

**Aplicação:** feedback breve por pontos confirmados e tela clara de resultado. Não copiar os cinco ou seis indicadores das imagens conceituais rejeitadas.

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img14.png
```

## 🎨 RP04 — Playmat ilustrado

**Fonte:** mesma página, imagem `img17.png`.

**Observação:** ilustração colorida cobrindo a superfície compartilhada, cartas e guias por cima, mantendo a geometria do campo.

**Aplicação:** trocar arte sem trocar slots, hitboxes, regras ou cor de Energia. A alternância por dono do turno é o comportamento adotado no nosso projeto; esta captura estática, isoladamente, não prova a coreografia da transição.

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img17.png
```

## 🪙 RP05 — Moeda

**Fonte:** mesma página, imagem `img18.png`.

**Observação:** moeda tridimensional em destaque sobre fundo azul/ciano, com mensagem simples.

**Aplicação:** rotação e face final coerentes com o resultado já salvo; não usar física como sorteio.

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img18.png
```

## ✨ RP06 — Flair em campo

**Fonte:** mesma página, imagem `img19.png`.

**Observação:** efeito curto concentrado ao redor de uma carta, sem converter a arena inteira no elemento da criatura.

**Aplicação:** separar flair de entrada, material foil e efeito funcional do ataque.

```text
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img19.png
```

## 📦 RP07 — Rasgo e abertura de pacote

**Fonte:** site oficial japonês, “Colecionar cartas”, imagem `img07.png?v=2`.

**Observação:** embalagem volumétrica, tira superior separada, linha de corte luminosa e raios suaves multicoloridos sobre fundo azul claro.

**Aplicação:** pacote central, corte acessível por gesto ou botão, revelação de pilha e brilho limpo. Não usar portal preto, fumaça pesada ou explosão de fogo genérica para todo pacote.

```text
https://www.pokemontcgpocket.com/ja/howtoplay/card/
https://www.pokemontcgpocket.com/assets/img/ja/howtoplay/img07.png?v=2
```

## 🧰 RP08 — Decks e flair no editor

**Fonte:** suporte oficial, “The flair I obtained is missing / I don’t know how to use it”; imagem de edição de deck.

**Observação:** botões arredondados claros, superfícies azul muito pálido, grade limpa, deckbox de cor contextual, divisões suaves e ações com pouca ornamentação. O suporte distingue configuração de flair cosmético e flair de batalha.

**Aplicação:** menus leves e Estúdio com formulários claros, mesmo quando o conteúdo é complexo. Não inferir do retângulo vermelho de instrução um token da interface: ele é uma anotação do suporte.

```text
https://app-ptcgp.pokemon-support.com/hc/en-us/articles/39078417091865-The-flair-I-obtained-is-missing-I-don-t-know-how-to-use-it
https://app-ptcgp.pokemon-support.com/hc/article_attachments/39253921220505
```

## 🖼️ RP09 — Variedade de ilustrações

**Fonte:** página oficial “Colecionar cartas” e site internacional do produto.

**Evidência textual:** o catálogo combina ilustrações de diferentes épocas e novas artes; existem artes completas, efeitos de profundidade e cartas imersivas.

**Aplicação:** não reduzir o estilo a um único acabamento. O catálogo autoral deve admitir ilustração de traço limpo, pintura suave, paisagem narrativa e render estilizado, mantendo criaturas reconhecíveis e quadros de texto legíveis.

```text
https://www.pokemontcgpocket.com/ja/howtoplay/card/
https://tcgpocket.pokemon.com/en-us/
```

## 🧊 RT01 — Gestão de cores Three.js

Texturas de cor, mapas de dados, espaço de trabalho e saída precisam de tratamento diferente. A documentação explica sRGB, Linear-sRGB, `NoColorSpace`, conversão de shaders customizados e saída com pós-processamento.

```text
https://threejs.org/manual/pages/color-management.html
```

## 🪟 RT02 — Renderer e múltiplas cenas

O renderer documentado usa WebGL2. Viewport, scissor, limpeza de depth e gestão de recursos dão suporte ao contrato de canvas compartilhado, mão e inspector.

```text
https://threejs.org/docs/pages/WebGLRenderer.html
https://threejs.org/manual/pages/multiple-scenes.html
```

## 🗄️ RT03 — Persistência SQLite no navegador

A documentação oficial descreve alternativas e requisitos dos VFS de persistência. Esta revisão visual mantém o contrato WASM/OPFS de `persistencia-sqlite.md`; não introduz persistência em memória disfarçada de save.

```text
https://sqlite.org/wasm/doc/trunk/persistence.md
```

## 🧪 Homologação visual futura

A equipe deverá registrar a versão do build, a resolução, o DPR, a qualidade e o frame/instante de cada comparação. Comparar organização, leitura, luminosidade, ritmo e causalidade, não apenas uma captura atraente.

A documentação não afirma que o jogo, shaders ou animações já foram renderizados e aprovados. A matriz de capturas em `examples/visual-capture-matrix.json` é um plano de teste.

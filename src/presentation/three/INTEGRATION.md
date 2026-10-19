# Integração da camada Three.js com a UI (Preact)

Tudo é importado de `src/presentation/three/index.ts`. A cena **nunca** chama regras, sorteia ou concede
algo: recebe projeções confirmadas (`BattleView`, eventos redigidos, recibos) e devolve gestos tipados.
A integração descrita aqui está implementada em `ui/app/renderer.ts`, `ui/components/stage-host.tsx`,
`ui/components/battle-stage.tsx` e `ui/components/scenes.tsx`.

## 1. Um renderer por aplicação (`ui/app/renderer.ts`)

- `attachRenderer(host, quality)` cria (uma vez) o canvas `.gl-canvas` e o `RenderSystem`
  (`createRenderSystem(canvas, { quality, onContextLost, onContextRestored })`) e o **empresta** ao elemento
  `host`: o canvas vira filho do host e cobre-o inteiro; as coordenadas CSS dos palcos são relativas a ele.
- `detachRenderer(host)` devolve o canvas (escondido, contexto vivo). Só um host por vez: se outra tela viva
  está com o canvas, `attachRenderer` devolve `null` e a cena usa o HTML equivalente.
- O canvas é **transparente** (`alpha: true`): fora dos viewports aparece o fundo HTML da tela.
- `glStatus`: `READY`; `LOST` ao perder o contexto; `UNAVAILABLE` sem WebGL2, se a criação falhar ou se o
  contexto não voltar em 4 s → toda cena cai para a versão 2D/HTML. Ao restaurar, a mesa chama
  `stage.setView(controller.view.value)` (os recursos voltam pela GPU).
- `qualityOf(settings.quality)`: AUTO → HIGH com DPR ≥ 2, senão MEDIUM.

## 2. Mesa de batalha (`BattleStageHost`)

`MatchScreen` decide `use3d` (WebGL2 detectado, sem “Apresentação 2D”, paisagem). Em 3D, o host:

```ts
const stage = createBattleStage(rs, { attemptId, layoutProfile: layout.profile, frame, speed, reducedMotion,
  presentation: battlePresentation(content, session.presentation, settings.playmatDisplay),
  resolveCard: (ref) => ({ face: faceOf(content, ref.printingId)!, definition: content.catalog.definition(ref.definitionKey) }) });
stage.setView(controller.view.value, presentation);
controller.setPresenter(createStagePresenter(stage));   // cada BattleUpdate → stage.present({ events, before, after })
```

- `frame` = conteúdo 16:9 do `StageLayout` (`offset`, `design × scale`) em px do host; `setLayoutProfile`
  e `setFrame` acompanham o layout da UI (o perfil vem da UI, não da altura do frame).
- Realces: `stage.setHighlights(highlights)` aceita o `Highlights` (Sets) da mesa 2D. Ids: `entityId`, `cardId`
  da mão e âncoras (`HUMAN_BENCH_0..2`, `HUMAN_ENERGY_READY`…). `stage.setLocked(busy)` bloqueia cliques/arrasto.
- **Picking**: o ponteiro passa pela cena 3D (`stage.onPick` → mesmo `PickTarget` do `Board2D`). Uma camada
  semântica (`.stage3d-overlay`, registrada com `rs.addInputSurface`) põe botões transparentes nas âncoras
  projetadas com os mesmos `data-anchor`/`aria-label`/`disabled` da mesa 2D (os e2e usam esses botões nos
  dois modos). O botão só emite o pick no teclado (`detail === 0`) ou quando o picking 3D não reconheceu o
  clique — nunca os dois. Botão secundário: `stage.onInspect` → `onInspect(CardRef)`.
- **Mão**: desenhada em 3D (leque OVERLAPPING_FAN, base 48/34 px abaixo da borda, atrás da barra; foco/
  seleção sobe 104/76 px inteira em `CardTransitScene`). Lista `sr-only` (`data-anchor="HUMAN_HAND"`) para
  teclado e leitores de tela; o foco de teclado sobe a carta (`stage.setKeyboardFocus`). Em 2D, `Hand2D`.
- **Arrasto**: `stage.onDragIntent` → `onPick(target)` (o alvo só é legal com uma ação pendente realçada);
  se nada for apresentado em 1,5 s, `stage.cancelDrag()` devolve a carta (`UI_DRAG_RETURN`).
- **HUD**: rótulos de PS (`.b2-hp`), condições e números flutuantes saem da projeção **apresentada**
  (`stage.onPresentedChange`), posicionados por `stage.getAnchorRects()` a cada `onAnchorsChanged`; os
  `aria-label` saem da `BattleView` confirmada. Rótulos sob cartas em primeiro plano somem
  (`stage.getOverlayRects()`). Cues: `TURN_BANNER` → `controller.banner`, `COIN_RESULT` → `controller.coin`,
  `DAMAGE`/`HEAL` → números flutuantes.
- **Fallback 2D**: `glStatus === 'UNAVAILABLE'` → `Board2D` + `Hand2D` com os mesmos alvos; o presenter
  volta a ser o 2D do controlador (`setPresenter(null)` no desmonte).
- **Imagem local do tapete** (interface §23.26; UI-111/112/113): `battlePresentation(..., urls)` põe em cada
  lado `matImage` (`MatImageSource`: assetId, URL de objeto de `assetObjectUrl`, recorte 4:3, cor-base) — as
  imagens vêm de `displayedMatImage`, como na mesa 2D. A mesa exibe a do dono exibido (`resolveDisplayedPlaymat`:
  TURN_OWNER/PLAYER_FIXED/NEUTRAL), com o procedural neutro por baixo, opacidade 0,55 e crossfade de 280 ms
  (`PLAYMAT_TRANSITION`). Texturas no cache LRU (`matimg:<assetId>:<url>`), liberadas ao trocar/descartar.
  URLs resolvidas depois da montagem → `stage.setPresentation(p)` (sem reiniciar a mesa). Status em
  `stage.onMatImageStatus` / `matImageStatus()` (`none`/`loading`/`loaded`/`missing`) → `data-mat-image` em
  `.stage3d`; `missing` (asset ausente ou que não decodifica) → tapete neutro + aviso `.b2-mat-missing`
  (`role="status"`, mesmo texto da 2D), sem bloquear a partida.

### Âncoras para o HUD (`getAnchorRects()`, px CSS do host; perfil `FOCUS_TABLE`)

| HUD | Âncora / região | Posição |
|---|---|---|
| Barra do adversário (nome, título, turno) | `getRegions().hud` | topo |
| Barra do jogador (nome, status) | `getRegions().humanBar` | rodapé |
| 3 marcadores de ponto (dourados e numerados quando conquistados) | `NPC_POINTS` / `HUMAN_POINTS` | centro de cada barra |
| PS grande + barra verde | `ENTITY:<entityId>` | número alinhado à direita em `x + width`, topo em `y` |
| Condições | `ENTITY:<entityId>` | abaixo do PS |
| Finalizar turno (flutuante) | `HUMAN_END_TURN` (região `endTurn`) | logo à direita da linha central |
| Menu/Pausa, Histórico (redondos) | `getRegions().menu` / `history` | margem esquerda inferior |
| Popover de ações | `getRegions().actions` + slot/carta selecionada | transitório, junto à seleção |
| Contadores de baralho/descarte | `HUMAN_DECK_TOP`, `HUMAN_DISCARD` (direita), `NPC_DECK_TOP`, `NPC_DISCARD` (esquerda) | canto inferior direito da pilha |
| Mão do NPC (contagem) | `NPC_HAND` (leque de versos no topo central, atrás da barra) | abaixo da barra |
| Energia pronta/próxima | `*_ENERGY_READY` / `*_ENERGY_NEXT` | ficha 3D; botão semântico por cima |
| Mão (foco/teclado) | `HAND_CARD:<cardId>`, `HUMAN_HAND` | — |

## 3. Cenas (`ui/components/scenes.tsx`)

Todas usam `useStageHost(create, deps)`: empresta o renderer ao contêiner da cena, cria o palco cobrindo-o
(`setRect` por `ResizeObserver`) e devolve o canvas no desmonte; sem 3D, mostra o HTML original.

| Componente | Palco | Ligações |
|---|---|---|
| `Showcase` (S03) | `createShowcaseStage` (fundo transparente) | cartas do deck/iniciais no pedestal |
| `PackOpeningScene` (S06) | `createPackOpeningStage` | "Abrir"/clique no pacote (`data-testid="tear-pack"`) → `tear()`; o gesto na costura também abre; a revelação continua na tela HTML do recibo |
| `CampaignMapScene` (S19/S20) | `createCampaignMapStage` | `onPick` NODE → `onSelect`; `setStatuses`/`setSelected` (+ `focusNode` quando a UI muda a seleção); S20 → `focusChapter`; botões semânticos reposicionados por `getNodeRects()` a cada `onViewChange` |
| `CardInspectorScene` (S08) | `createCardInspectorStage` | "Ver verso" → `toggleSide()`; "Centralizar" → `showFront()` |

A Descoberta (S28) e o replay (S39) continuam em HTML/2D; `createDiscoveryStage` está pronto para a S28.

## 4. Verso das cartas

Todo verso (deck, mão do NPC, cartas ocultas, pilhas do pacote, CardVisual) usa a arte única
`src/presentation/assets/card-back.webp` via `CARD_BACK_URL` (`card/card-back.ts`); o sleeve cosmético não
muda o verso.

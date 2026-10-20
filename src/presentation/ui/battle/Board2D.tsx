// Mesa 2D (runtime §C9; interface §23, §27.6): mesmas regiões, slots e comandos da mesa 3D
// (battle-layout.json), em DOM/CSS. Usada sem WebGL2, por acessibilidade ou em retrato, e como camada
// semântica de botões equivalente aos objetos 3D (interface §35.4). Composição no espírito do Pocket:
// Banco distante no topo, Ativos frente a frente no eixo central, Banco próximo embaixo; pilhas do NPC à
// esquerda e as humanas à direita; Energia em fichas redondas; PS grande no canto superior direito.
import { HpNumber } from './pocket.tsx';
import { reducedMotion } from '../app/store.ts';
import type { JSX } from 'preact';
import type { PlayerId } from '../../../domain/battle/types.ts';
import type { BattleView, CardRef, EntityView, SideView } from '../../../domain/battle/views.ts';
import { CONDITION_LABEL, TYPE_LABEL } from '../../../domain/cards/text.ts';
import type { PokemonType, SpecialCondition } from '../../../domain/cards/types.ts';
import type { ContentIndex } from '../../../application/content.ts';
import { CardFace, faceOf } from '../components/cards.tsx';
import { TypeIcon } from '../components/icons.tsx';
import { energyOrbUrl } from '../../assets/energy.ts';
import { MatImageSurface, useMatImage } from '../components/mat-image.tsx';
import type { CustomMatImage } from '../../../application/appearance.ts';
import { boxStyle, fanLayout, toBox, within, type Rect, type RegionId, type SlotId, type StageLayout } from './layout.ts';
import { useEffect, useRef, useState } from 'preact/hooks';
import { PLAY_AREA, useHandDrag, type HandDragHandlers } from './hand-drag.tsx';
import { useEnergyDrag2D, type EnergyDragEvent } from './energy-drag.tsx';
import { useEntityDrag2D } from './entity-drag.tsx';
import { ARENA, arenaRadiusPx } from '../../three/battle/arena.ts';
import { EffectMarks, marksOf } from './effect-marks.tsx';


/** Bola de Energia (arte do atlas) na mesa 2D; ícone de tipo para tipos sem bola. `dim`: próxima Energia, ainda não gerada. */
function EnergyOrb({ type, size, dim }: { readonly type: string; readonly size: number; readonly dim?: boolean }): JSX.Element {
  const url = energyOrbUrl(type);
  if (!url) return <TypeIcon type={type as PokemonType} size={size} label={false} />;
  return <img class={`b2-energy-orb ${dim ? 'is-dim' : ''}`} src={url} alt="" width={size} height={size} draggable={false} />;
}

export type PickTarget =
  | { readonly kind: 'ENTITY'; readonly entityId: string }
  | { readonly kind: 'HAND_CARD'; readonly cardId: string }
  | { readonly kind: 'SLOT'; readonly anchorId: string }
  | { readonly kind: 'PILE'; readonly anchorId: string };

export type Highlights = {
  readonly selectable: ReadonlySet<string>; readonly selected: ReadonlySet<string>; readonly targets: ReadonlySet<string>;
  /** Cartas da mão que podem evoluir agora: contorno amarelo (gameplay-pocket §6). */
  readonly evolvable?: ReadonlySet<string>;
  /** Pokémon que flutuam e podem ser arrastados até o Ativo (promoção depois do nocaute, gameplay-pocket §6.2). */
  readonly floating?: ReadonlySet<string>;
};

const NONE: ReadonlySet<string> = new Set();
/** Partidas cuja preparação a mesa 2D mostrou e o fim da janela do giro de revelação (uma vez por partida). */
const setupShown = new Set<string>();
const revealUntil = new Map<string, number>();
const REVEAL_MS = 900;

export type FloatingNumber = { readonly entityId: string; readonly text: string; readonly kind: 'damage' | 'heal' };

type BoardProps = {
  readonly layout: StageLayout;
  readonly view: BattleView;
  readonly content: ContentIndex;
  readonly human: PlayerId;
  readonly names: { readonly human: string; readonly npc: string };
  readonly highlights: Highlights;
  readonly floating: readonly FloatingNumber[];
  readonly onPick: (t: PickTarget) => void;
  readonly onInspect: (ref: CardRef) => void;
  /** Ponteiro sobre uma carta da mesa (prévia ampliada, interface §24.2); null ao sair. */
  readonly onHover?: (t: PickTarget | null) => void;
  readonly locked: boolean;
  /** Imagem local do tapete exibida agora (preferência + turno); null = tapete procedural. */
  readonly matImage?: CustomMatImage | null;
  /** Verso das cartas de cada lado (imagem do sleeve do Pocket equipado no deck); null = verso padrão. */
  readonly sleeves?: { readonly human: string | null; readonly npc: string | null };
  /** Arrasto livre do orbe da Energia pronta (gameplay-pocket §6). */
  readonly onEnergyDrag?: (e: EnergyDragEvent) => void;
  /** Pokémon flutuante solto sobre o Ativo vazio (promoção). */
  readonly onEntityDrop?: (entityId: string) => void;
  /** Básicos da preparação ainda virados para baixo (desviram quando o duelo começa). */
  readonly faceDown?: ReadonlySet<string>;
};

type EntityDrag = ReturnType<typeof useEntityDrag2D>;

/** Efeitos do arrasto da Energia sobre um slot: alvo sob o orbe (cresce de leve) e ligação recém-feita (pulso). */
type EnergyFx = { readonly over: string | null; readonly absorb: string | null };

const CONDITIONS: readonly SpecialCondition[] = ['POISONED', 'BURNED', 'ASLEEP', 'PARALYZED', 'CONFUSED'];

/** Entrar/sair do ponteiro de mouse ou caneta sobre uma carta (toque não tem hover; a prévia por toque é a seleção). */
export function hoverHandlers(onHover: ((t: PickTarget | null) => void) | undefined, t: PickTarget) {
  if (!onHover) return {};
  return {
    onPointerEnter: (e: PointerEvent) => { if (e.pointerType !== 'touch') onHover(t); },
    onPointerLeave: () => onHover(null),
  };
}

function conditionsOf(e: EntityView): SpecialCondition[] {
  return CONDITIONS.filter((c) => (c === 'POISONED' ? e.conditions.poisoned : c === 'BURNED' ? e.conditions.burned : e.conditions.control === c));
}

export function entityLabel(content: ContentIndex, e: EntityView): string {
  const face = faceOf(content, e.top.printingId);
  const conds = conditionsOf(e).map((c) => CONDITION_LABEL[c]);
  const energy = e.energies.length ? `${e.energies.length} Energia(s): ${e.energies.map((x) => TYPE_LABEL[x.type as PokemonType] ?? x.type).join(', ')}` : 'sem Energia';
  const effects = [...new Set(e.effects.map((x) => x.label))];
  return [face?.name ?? 'Pokémon', `${e.remainingHp} de ${e.maxHp} PS`, energy, ...(conds.length ? [`condições: ${conds.join(', ')}`] : []),
    ...(effects.length ? [`efeitos: ${effects.join(', ')}`] : []), ...(e.tool ? ['com Ferramenta'] : [])].join(', ');
}

function EnergyPips({ e }: { readonly e: EntityView }): JSX.Element | null {
  if (!e.energies.length) return null;
  if (e.energies.length <= 4) return <span class="b2-energy">{e.energies.map((x) => <EnergyOrb key={x.id} type={x.type} size={18} />)}</span>;
  const counts = new Map<string, number>();
  for (const x of e.energies) counts.set(x.type, (counts.get(x.type) ?? 0) + 1);
  return <span class="b2-energy">{[...counts].map(([t, n]) => <span key={t} class="b2-energy-group"><EnergyOrb type={t} size={18} />×{n}</span>)}</span>;
}

/**
 * A mesa visual vai do meio da barra do adversário até o meio da barra do jogador: a mão grande fica por cima da borda
 * próxima, como no Pocket. Os filhos continuam posicionados pelo canto do campo (`board`).
 */
/** Verso de cada lado como variável CSS (`--back-human`/`--back-npc`); o CSS aplica a do lado pelo `data-anchor`. */
function sleeveVars(sleeves: BoardProps['sleeves']): Record<string, string> {
  const out: Record<string, string> = {};
  if (sleeves?.human) out['--back-human'] = `url("${sleeves.human}")`;
  if (sleeves?.npc) out['--back-npc'] = `url("${sleeves.npc}")`;
  return out;
}

function tableStyle(l: StageLayout): Record<string, string> {
  const [x, y] = tableOrigin(l);
  const bar = l.regions.humanBar;
  return boxStyle(toBox(l, [x, y, l.regions.board[2], bar[1] + bar[3] / 2 - y]));
}

/** Canto superior esquerdo da mesa visual (meio da barra do adversário), origem dos filhos. */
function tableOrigin(l: StageLayout): readonly [number, number] {
  return [l.regions.board[0], l.regions.hud[1] + l.regions.hud[3] / 2];
}

/** Posiciona um filho da mesa pelo retângulo do perfil (coordenadas de tela). */
const at = (l: StageLayout, r: Rect) => { const [x, y] = tableOrigin(l); return boxStyle(within(l, r, [x, y, 0, 0])); };

function Slot({ entity, anchorId, props, fx, drag, revealing }: {
  readonly entity: EntityView | null; readonly anchorId: SlotId; readonly props: BoardProps; readonly fx?: EnergyFx; readonly drag?: EntityDrag; readonly revealing?: boolean;
}): JSX.Element {
  const { highlights, onPick, content, floating, locked, layout } = props;
  const size = anchorId.includes('ACTIVE') ? 'active' : 'bench';
  const style = at(layout, layout.slots[anchorId]);
  if (!entity) {
    const target = highlights.targets.has(anchorId);
    return (
      <button type="button" class={`b2-slot b2-${size} is-empty ${target ? 'is-target' : ''} ${target && drag?.overTarget ? 'is-drop-hover' : ''}`} style={style} data-anchor={anchorId} disabled={locked || !target}
        aria-label={target ? 'Espaço vazio — escolher este espaço' : 'Espaço vazio'} onClick={() => onPick({ kind: 'SLOT', anchorId })} />
    );
  }
  const id = entity.entityId;
  const cls = [highlights.selected.has(id) ? 'is-selected' : '', highlights.targets.has(id) ? 'is-target' : '', highlights.selectable.has(id) ? 'is-selectable' : '',
    fx?.over === id ? 'is-drop-hover' : '', fx?.absorb === id ? 'is-energy-absorb' : '',
    highlights.floating?.has(id) ? 'is-floating' : '', drag?.draggingId === id ? 'is-lifted' : ''].join(' ');
  const face = faceOf(content, entity.top.printingId);
  const pick = () => onPick({ kind: 'ENTITY', entityId: id });
  const down = !!props.faceDown?.has(id);
  const cardSize = size === 'active' ? 'sm' : 'xs';
  // Virado na preparação; ao começar o duelo, gira do verso para a frente.
  const visual = down ? <CardFace face={null} hidden size={cardSize} />
    : revealing ? <span class="b2-flip"><CardFace face={null} hidden size={cardSize} /><CardFace face={face} size={cardSize} /></span>
      : <CardFace face={face} size={cardSize} />;
  const hpPct = entity.maxHp ? (entity.remainingHp / entity.maxHp) * 100 : 0;
  const nums = floating.filter((f) => f.entityId === id);
  return (
    <button type="button" class={`b2-slot b2-${size} ${cls}`} style={style} data-anchor={anchorId} data-entity={id} aria-label={entityLabel(content, entity)} aria-pressed={highlights.selected.has(id)}
      onClick={drag ? drag.click(pick) : pick} onContextMenu={(e) => { e.preventDefault(); props.onInspect(entity.top); }} disabled={locked}
      {...hoverHandlers(props.onHover, { kind: 'ENTITY', entityId: id })} {...(drag ? drag.bind(id, face) : {})}>
      {visual}
      {down ? null : <span class={`b2-hp ${hpPct <= 25 ? 'is-low' : ''}`} aria-hidden="true"><HpNumber value={entity.remainingHp} reduced={reducedMotion.value} /><span class="b2-hpbar"><span style={{ width: `${hpPct}%` }} /></span></span>}
      <EnergyPips e={entity} />
      <EffectMarks key={id} marks={marksOf(entity.conditions, entity.effects)} reduced={reducedMotion.value} paused={down} />
      {entity.tool ? <span class="b2-tool" aria-hidden="true">Ferramenta</span> : null}
      {nums.map((n, i) => <span key={i} class={`b2-float b2-float-${n.kind}`} aria-hidden="true">{n.text}</span>)}
    </button>
  );
}

function Piles({ side, prefix, props }: { readonly side: SideView; readonly prefix: 'HUMAN' | 'NPC'; readonly props: BoardProps }): JSX.Element {
  const { layout } = props;
  const p = prefix === 'HUMAN' ? 'human' : 'npc';
  const top = side.discard[side.discard.length - 1];
  return (
    <>
      <button type="button" class="b2-pile b2-deck" style={at(layout, layout.regions[`${p}Deck` as RegionId])} data-anchor={`${prefix}_DECK_TOP`}
        onClick={() => props.onPick({ kind: 'PILE', anchorId: `${prefix}_DECK_TOP` })} aria-label={`Baralho ${prefix === 'HUMAN' ? 'seu' : 'do adversário'}: ${side.deckCount} cartas`}>
        <span class="b2-pile-back" /><b class="b2-count">{side.deckCount}</b>
      </button>
      <button type="button" class="b2-pile b2-discard" style={at(layout, layout.regions[`${p}Discard` as RegionId])} data-anchor={`${prefix}_DISCARD`}
        onClick={() => props.onPick({ kind: 'PILE', anchorId: `${prefix}_DISCARD` })} {...hoverHandlers(props.onHover, { kind: 'PILE', anchorId: `${prefix}_DISCARD` })} aria-label={`Descarte ${prefix === 'HUMAN' ? 'seu' : 'do adversário'}: ${side.discard.length} cartas`}>
        {top ? <CardFace face={faceOf(props.content, top.printingId)} size="xs" /> : <span class="b2-pile-empty" />}<b class="b2-count">{side.discard.length}</b>
      </button>
    </>
  );
}

/**
 * Zona de Energia como prato (gameplay-pocket §5.2; referências .specs/referencias/batalha/energy-*.png): disco branco-lilás;
 * com Energia pronta, o orbe brilhante do tipo com halo ciano pulsando (arrastável no seu turno); o ícone escuro da
 * próxima Energia na borda de baixo — à direita do seu prato, à esquerda do adversário.
 */
function EnergyZone({ side, prefix, props, drag }: {
  readonly side: SideView; readonly prefix: 'HUMAN' | 'NPC'; readonly props: BoardProps; readonly drag?: ReturnType<typeof useEnergyDrag2D>;
}): JSX.Element {
  const { layout, highlights } = props;
  const region = layout.regions[prefix === 'HUMAN' ? 'humanEnergy' : 'npcEnergy'];
  const selectable = highlights.selectable.has(`${prefix}_ENERGY_READY`);
  const ready = side.energyZone.ready as PokemonType | null;
  const next = side.energyZone.next as PokemonType | null;
  const plate = layout.energy.ready * 1.45 * layout.scale;
  const pick = () => props.onPick({ kind: 'PILE', anchorId: `${prefix}_ENERGY_READY` });
  return (
    <div class={`b2-zone b2-zone-${prefix.toLowerCase()}`} style={at(layout, region)}>
      <div class={`b2-plate ${ready ? 'is-filled' : 'is-empty'}`} style={{ width: `${plate}px`, height: `${plate}px` }}>
        <button type="button" class={`b2-orb ${ready ? '' : 'is-empty'} ${selectable ? 'is-selectable' : ''} ${highlights.selected.has(`${prefix}_ENERGY_READY`) ? 'is-selected' : ''} ${drag?.dragging ? 'is-lifted' : ''}`}
          style={ready ? { '--orb': `var(--pocket-type-${ready.toLowerCase()})` } : undefined}
          data-anchor={`${prefix}_ENERGY_READY`} disabled={props.locked || !selectable} onClick={drag ? drag.bind.click(pick) : pick}
          onPointerDown={drag?.bind.onPointerDown} onPointerMove={drag?.bind.onPointerMove} onPointerUp={drag?.bind.onPointerUp} onPointerCancel={drag?.bind.onPointerCancel}
          aria-label={ready ? `Energia pronta${prefix === 'NPC' ? ' do adversário' : ''}: ${TYPE_LABEL[ready]}` : 'Sem Energia pronta'} title={ready ? `Pronta: ${TYPE_LABEL[ready]}` : 'Sem Energia pronta'}>
          {ready ? <EnergyOrb type={ready} size={Math.round(layout.energy.ready * layout.scale * 0.9)} /> : null}
        </button>
        <span class="b2-next" style={next ? { '--orb': `var(--pocket-type-${next.toLowerCase()})` } : undefined} data-anchor={`${prefix}_ENERGY_NEXT`}
          title={next ? `Próxima: ${TYPE_LABEL[next]}` : 'Sem próxima Energia'} role="img"
          aria-label={next ? `Próxima Energia${prefix === 'NPC' ? ' do adversário' : ''}: ${TYPE_LABEL[next]}` : 'Sem próxima Energia'}>
          {next ? <EnergyOrb type={next} size={Math.round(layout.energy.next * layout.scale * 0.8)} dim /> : null}
        </span>
      </div>
    </div>
  );
}

/** Contador de pontos das barras (interface §23.5): marcadores numerados; os conquistados acendem em dourado. */
export function PointsCounter({ points, pointsToWin, prefix, name }: { readonly points: number; readonly pointsToWin: number; readonly prefix: 'HUMAN' | 'NPC'; readonly name: string }): JSX.Element {
  return (
    <span class="points-counter" data-anchor={`${prefix}_POINTS`} role="img" aria-label={`${name}: ${points} de ${pointsToWin} pontos`}>
      {Array.from({ length: pointsToWin }, (_, i) => <span key={i} class={i < points ? 'on' : ''} aria-hidden="true">{i < points ? i + 1 : ''}</span>)}
    </span>
  );
}

function NpcHand({ count, props }: { readonly count: number; readonly props: BoardProps }): JSX.Element {
  const { layout } = props;
  const [w, h] = layout.npcBack;
  const shown = Math.min(count, 7);
  return (
    <div class="b2-npc-hand" style={at(layout, layout.regions.npcHand)} data-anchor="NPC_HAND" aria-label={`Mão do adversário: ${count} cartas`} role="img">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} class="b2-back-mini" style={{ width: `${w * layout.scale}px`, height: `${h * layout.scale}px`, marginLeft: i ? `${-w * layout.scale * 0.55}px` : '0', transform: `rotate(${(i - (shown - 1) / 2) * 4}deg)` }} />
      ))}
      <b class="b2-count">{count}</b>
    </div>
  );
}

export function Board2D(props: BoardProps): JSX.Element {
  const { view, human, layout } = props;
  const npc: PlayerId = human === 'A' ? 'B' : 'A';
  const me = view.sides[human];
  const them = view.sides[npc];
  const [ox, oy] = tableOrigin(layout);
  const [cx, cy] = layout.center;
  const circle = layout.slots.HUMAN_ACTIVE[2] * ARENA.discK;
  // Arena (gameplay-pocket §2): o mesmo círculo da mesa 3D, envolvendo os dois Bancos.
  const benches = (Object.keys(layout.slots) as SlotId[]).filter((id) => id.includes('_BENCH_')).map((id) => {
    const [x, y, w, h] = layout.slots[id];
    return { center: [x + w / 2, y + h / 2], size: [w, h] };
  });
  const arena = arenaRadiusPx(cx, cy, benches);
  const unit = layout.scale * (layout.design[1] / 1080);
  const mat = useMatImage(props.matImage);
  const energy = useEnergyDrag2D({
    enabled: !props.locked && props.highlights.selectable.has('HUMAN_ENERGY_READY'), type: me.energyZone.ready as PokemonType | null,
    targets: props.highlights.targets, onEvent: props.onEnergyDrag,
  });
  const fx: EnergyFx = { over: energy.over, absorb: energy.absorb };
  const promote = useEntityDrag2D({ floating: props.highlights.floating ?? NONE, locked: props.locked, onDrop: props.onEntityDrop });
  // Fim da preparação: todos os Pokémon em campo desviram juntos (os do adversário aparecem só agora). A troca de rota
  // S22 → S23 remonta a mesa logo depois, então a janela da revelação fica guardada no módulo por partida.
  const settingUp = view.phase === 'SETUP';
  const [revealing, setRevealing] = useState<ReadonlySet<string>>(NONE);
  useEffect(() => {
    if (settingUp) { setupShown.add(view.matchId); return undefined; }
    if (setupShown.delete(view.matchId) && !reducedMotion.value) revealUntil.set(view.matchId, performance.now() + REVEAL_MS);
    const left = (revealUntil.get(view.matchId) ?? 0) - performance.now();
    if (left <= 0) return undefined;
    setRevealing(new Set([me.active, ...me.bench, them.active, ...them.bench].filter((e): e is EntityView => !!e).map((e) => e.entityId)));
    const t = setTimeout(() => { setRevealing(NONE); revealUntil.delete(view.matchId); }, left);
    return () => clearTimeout(t);
  }, [settingUp, view.matchId]);
  return (
    <div class={`board2d profile-${layout.profile} turn-${view.currentPlayer === human ? 'human' : 'npc'}`} style={{ ...tableStyle(layout), ...sleeveVars(props.sleeves) }} role="group" aria-label="Mesa de batalha">
      <div class="b2-table" aria-hidden="true">
        <span class="b2-far" style={{ height: `${(cy - oy) * layout.scale}px` }} />
        {props.matImage ? <MatImageSurface image={props.matImage} state={mat} /> : null}
        <span class="b2-arena" style={{ left: `${(cx - ox - arena) * layout.scale}px`, top: `${(cy - oy - arena) * layout.scale}px`, width: `${arena * 2 * layout.scale}px`, height: `${arena * 2 * layout.scale}px`,
          '--rim': `${ARENA.rimPx * unit}px`, '--stroke': `${ARENA.strokePx * unit}px` }} />
        <span class="b2-band" style={{ top: `${(cy - oy) * layout.scale}px`, height: `${ARENA.bandPx * unit}px` }} />
        <span class="b2-center" style={{ left: `${(cx - ox - circle) * layout.scale}px`, top: `${(cy - oy - circle) * layout.scale}px`, width: `${circle * 2 * layout.scale}px`, height: `${circle * 2 * layout.scale}px` }} />
        <span class="b2-midline" style={{ top: `${(cy - oy) * layout.scale}px` }} />
      </div>
      {props.matImage && mat.missing ? <span class="b2-mat-missing" role="status">Imagem do tapete indisponível — usando o tapete neutro</span> : null}
      <NpcHand count={them.handCount} props={props} />
      <Piles side={them} prefix="NPC" props={props} />
      <Piles side={me} prefix="HUMAN" props={props} />
      <EnergyZone side={them} prefix="NPC" props={props} />
      <EnergyZone side={me} prefix="HUMAN" props={props} drag={energy} />
      {them.bench.map((b, i) => <Slot key={`n${i}`} entity={b} anchorId={`NPC_BENCH_${i as 0 | 1 | 2}`} props={props} revealing={!!b && revealing.has(b.entityId)} />)}
      <Slot entity={them.active} anchorId="NPC_ACTIVE" props={props} revealing={!!them.active && revealing.has(them.active.entityId)} />
      <Slot entity={me.active} anchorId="HUMAN_ACTIVE" props={props} fx={fx} drag={promote} revealing={!!me.active && revealing.has(me.active.entityId)} />
      {me.bench.map((b, i) => <Slot key={`h${i}`} entity={b} anchorId={`HUMAN_BENCH_${i as 0 | 1 | 2}`} props={props} fx={fx} drag={promote} revealing={!!b && revealing.has(b.entityId)} />)}
      {energy.ghostEl}
      {promote.ghostEl}
      {view.stadium ? (
        <button type="button" class="b2-stadium" style={at(layout, layout.regions.stadium)} data-anchor="STADIUM" onClick={() => props.onInspect(view.stadium!)}
          {...hoverHandlers(props.onHover, { kind: 'PILE', anchorId: 'STADIUM' })}
          aria-label={`Estádio em jogo: ${faceOf(props.content, view.stadium.printingId)?.name}`}>
          <CardFace face={faceOf(props.content, view.stadium.printingId)} size="xs" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Mão em leque no rodapé (`handPolicy`): sobreposição quando não cabe, foco com escala ≤ 1,15 e elevação ≤ 24 px.
 * Arrastar uma carta até o campo a joga (hand-drag.tsx); o clique seleciona e realça os alvos.
 */
export function Hand2D({ layout, cards, content, highlights, onPick, onInspect, onHover, locked, ...drag }: {
  readonly layout: StageLayout; readonly cards: readonly CardRef[]; readonly content: ContentIndex; readonly highlights: Highlights;
  readonly onPick: (t: PickTarget) => void; readonly onInspect: (ref: CardRef) => void; readonly onHover?: (t: PickTarget | null) => void; readonly locked: boolean;
} & HandDragHandlers): JSX.Element {
  const handRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const zoneAt = (x: number, y: number) => {
    const r = zoneRef.current?.getBoundingClientRect();
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const { bind, ghostEl, draggingId, dragging, overZone } = useHandDrag({ ...drag, highlights, locked, zoneAt, handTop: () => handRef.current?.getBoundingClientRect().top ?? Infinity });
  // Treinador sem alvo em arrasto: zona verde translúcida no centro da mesa (gameplay-pocket §6).
  const zone = dragging && highlights.targets.has(PLAY_AREA) ? (
    <div ref={zoneRef} class={`trainer-zone ${overZone ? 'is-hover' : ''}`} style={boxStyle(toBox(layout, layout.regions.trainerZone))} aria-hidden="true" data-testid="trainer-zone" />
  ) : null;
  const region = toBox(layout, layout.regions.hand);
  const [cw, ch] = [layout.handCard[0] * layout.scale, layout.handCard[1] * layout.scale];
  const slots = fanLayout(cards.length, region.width, cw, layout.fan.maxTilt, layout.fan.stepRatio);
  const lift = layout.fan.focusLift * layout.scale;
  // A base da carta sai `bottomBleed` px pela borda inferior, atrás da barra do jogador.
  const top = (layout.design[1] + layout.fan.bottomBleed - layout.handCard[1] - layout.regions.hand[1]) * layout.scale;
  return (
    <>
    {zone}
    <div class="hand2d" ref={handRef} style={{ ...boxStyle(region), '--lift': `${-lift}px`, '--focus-scale': String(layout.fan.focusScale) }} role="list" aria-label={`Sua mão: ${cards.length} cartas`} data-anchor="HUMAN_HAND">
      {cards.map((c, i) => {
        const face = faceOf(content, c.printingId);
        const playable = highlights.selectable.has(c.cardId);
        const evolvable = playable && !!highlights.evolvable?.has(c.cardId);
        const selected = highlights.selected.has(c.cardId);
        const s = slots[i]!;
        const { click, ...dragHandlers } = bind(c.cardId, face);
        return (
          <div role="listitem" key={c.cardId} class={`hand2d-item ${draggingId === c.cardId ? 'is-dragging' : ''}`} style={{ left: `${s.x}px`, top: `${top + s.y}px`, width: `${cw}px`, height: `${ch}px`, zIndex: selected ? 50 : s.z, '--tilt': `${s.rotate}deg` }}>
            <button type="button" class={`hand2d-card ${selected ? 'is-selected' : ''} ${playable ? 'is-playable' : ''} ${evolvable ? 'is-evolvable' : ''}`} disabled={locked}
              aria-label={`${face?.name ?? 'Carta'}${playable ? ', jogável' : ''}`} aria-pressed={selected}
              onClick={click(() => onPick({ kind: 'HAND_CARD', cardId: c.cardId }))} onContextMenu={(e) => { e.preventDefault(); onInspect(c); }}
              {...dragHandlers} {...hoverHandlers(onHover, { kind: 'HAND_CARD', cardId: c.cardId })}>
              <CardFace face={face} size="sm" />
            </button>
          </div>
        );
      })}
      {ghostEl}
    </div>
    </>
  );
}

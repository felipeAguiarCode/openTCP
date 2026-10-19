// Representações HTML de cartas e decks (interface §5, §10.2): face composta do template
// pocket-light-card-v1 com dados da carta e janela de arte com placeholder tipado; em “Impressão completa” a face é só
// a imagem da carta impressa (sem nome, PS, ataques nem rodapé do template por cima).
import { RARITY_SYMBOL_LABEL, type RaritySymbol } from '../../../domain/cards/rarity.ts';
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { printedArtSource, printedArtUrl, printedArtUrlNow } from '../../assets/card-art.ts';
import { cardFace, catalogNames, type CardFaceData } from '../../../domain/cards/text.ts';
import { definitionKey, type PokemonType } from '../../../domain/cards/types.ts';
import type { ContentIndex } from '../../../application/content.ts';
import { TypeIcon, typeGlyphPath } from './icons.tsx';
import { DeckBox3D } from './deck-box.tsx';

const faceCache = new WeakMap<ContentIndex, Map<string, CardFaceData | null>>();

/** Face de uma impressão, gerada uma vez por conteúdo carregado (o texto PT-BR sai do DSL a cada geração). */
export function faceOf(content: ContentIndex, printingId: string): CardFaceData | null {
  let cache = faceCache.get(content);
  if (!cache) faceCache.set(content, (cache = new Map()));
  if (cache.has(printingId)) return cache.get(printingId)!;
  const cat = content.catalog;
  let face: CardFaceData | null = null;
  try {
    const p = cat.printing(printingId);
    const def = cat.definition(definitionKey(p.cardDefinitionId, p.cardDefinitionVersion));
    face = cardFace(def, p, catalogNames(cat));
  } catch {
    face = null;
  }
  cache.set(printingId, face);
  return face;
}

const coverRank = (f: CardFaceData) => (f.category === 'POKEMON' ? 10 : 0) + (f.ruleBox !== 'NONE' ? 5 : 0) + (f.subtitle.includes('2') ? 2 : f.subtitle.includes('1') ? 1 : 0);

/** Faces distintas do deck da mais “de capa” para a menos (Pokémon de maior estágio, regra especial primeiro). */
export function rankedFaces(content: ContentIndex, printingIds: readonly string[]): CardFaceData[] {
  const out: CardFaceData[] = [];
  for (const id of new Set(printingIds)) {
    const f = faceOf(content, id);
    if (f && !out.some((o) => o.definitionKey === f.definitionKey)) out.push(f);
  }
  return out.map((f, i) => ({ f, i })).sort((a, b) => coverRank(b.f) - coverRank(a.f) || a.i - b.i).map((x) => x.f);
}

/** Capa do deck: a escolhida pelo jogador (se ainda está no deck) ou a de maior estágio, com regra especial primeiro. */
export function coverFace(content: ContentIndex, printingIds: readonly string[], chosen: string | null = null): CardFaceData | null {
  if (chosen && printingIds.includes(chosen)) return faceOf(content, chosen);
  return rankedFaces(content, printingIds)[0] ?? null;
}

const RARITY_LABEL: Record<string, string> = { COMMON: 'Comum', UNCOMMON: 'Incomum', RARE: 'Rara', ULTRA: 'Ultra', PROMO: 'Promo' };
const FINISH_LABEL: Record<string, string> = { NORMAL: 'Normal', HOLOGRAPHIC: 'Holográfica', FOIL: 'Foil', CHROME: 'Cromada' };
export const rarityLabel = (r: string) => RARITY_LABEL[r] ?? r;
/** Símbolo do Pocket como texto (◊◊, ☆, ♛…; “Promo” para promocionais). */
export const symbolText = (s: RaritySymbol) => (s === 'PROMO' ? 'Promo' : s);
export const finishLabel = (f: string) => FINISH_LABEL[f] ?? f;

function mainType(face: CardFaceData): PokemonType {
  return face.types[0] ?? 'COLORLESS';
}

/** Descrição estruturada para leitor de tela (interface §35.4). */
export function cardAriaLabel(face: CardFaceData): string {
  const parts = [face.name, face.subtitle];
  if (face.hp !== null) parts.push(`${face.hp} PS`);
  if (face.ruleBox !== 'NONE') parts.push(face.ruleBox === 'EX' ? 'ex' : 'Mega ex');
  for (const a of face.attacks) parts.push(`ataque ${a.name}${a.damage ? ` ${a.damage}` : ''}, custo ${a.cost.length}`);
  parts.push(`raridade ${RARITY_SYMBOL_LABEL[face.raritySymbol]}`);
  return parts.filter(Boolean).join(', ');
}

/**
 * Arte resolvida de uma impressão (Estúdio): URL local (object URL de BLOB) + recorte e transformação não
 * destrutivos. O espelhamento afeta só a ilustração, nunca textos/HP (ED-042).
 */
export type CardArt = {
  readonly url: string;
  readonly mode: 'ART_WINDOW' | 'FULL_ART' | 'FULL_PRINTING' | 'TEMPLATE_ONLY';
  readonly crop?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly transform?: { readonly scale: number; readonly offsetX: number; readonly offsetY: number; readonly rotationDegrees: number; readonly mirrorIllustration: boolean; readonly exposure: number };
};

function artStyle(art: CardArt): JSX.CSSProperties {
  const crop = art.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const t = art.transform ?? { scale: 1, offsetX: 0, offsetY: 0, rotationDegrees: 0, mirrorIllustration: false, exposure: 0 };
  // O recorte normalizado vira escala/posição do fundo; a transformação extra é aplicada à camada da ilustração.
  const w = Math.max(0.01, crop.width);
  const h = Math.max(0.01, crop.height);
  return {
    backgroundImage: `url("${art.url}")`,
    backgroundSize: `${100 / w}% ${100 / h}%`,
    backgroundPosition: `${w >= 1 ? 0 : (crop.x / (1 - w)) * 100}% ${h >= 1 ? 0 : (crop.y / (1 - h)) * 100}%`,
    transform: `translate(${t.offsetX * 50}%, ${t.offsetY * 50}%) rotate(${t.rotationDegrees}deg) scale(${t.mirrorIllustration ? -t.scale : t.scale}, ${t.scale})`,
    filter: t.exposure ? `brightness(${Math.max(0, 1 + t.exposure)})` : undefined,
  };
}

/**
 * URL da imagem da Impressão completa de uma face: a arte resolvida pelo Estúdio (`art`, com recorte) ou a do
 * catálogo (empacotada na hora; importada pelo resolvedor do boot). null nos outros modos, enquanto carrega ou se falhou.
 */
function usePrintedArt(face: CardFaceData | null, art: CardArt | null): string | null {
  const source = art ? null : printedArtSource(face);
  const [state, setState] = useState<{ readonly source: string | null; readonly url: string | null }>(() => ({ source, url: printedArtUrlNow(face) }));
  useEffect(() => {
    if (!source) return;
    let alive = true;
    void printedArtUrl(face).then((url) => { if (alive) setState({ source, url }); });
    return () => { alive = false; };
  }, [source]);
  if (art) return art.mode === 'FULL_PRINTING' ? art.url : null;
  return state.source === source ? state.url : printedArtUrlNow(face);
}

/** Face completa (inspector 2D, fallback e miniaturas grandes). Escala pela largura do contêiner. */
export function CardFace({ face, size = 'md', hidden = false, quantity, dim = false, art = null }: {
  readonly face: CardFaceData | null; readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; readonly hidden?: boolean; readonly quantity?: number; readonly dim?: boolean;
  readonly art?: CardArt | null;
}): JSX.Element {
  const printedUrl = usePrintedArt(hidden ? null : face, art);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!face || hidden) {
    return <div class={`card-face card-${size} card-back`} aria-label="Carta oculta" role="img"><div class="card-back-pattern" /></div>;
  }
  if (printedUrl && printedUrl !== failedUrl) {
    // Impressão completa: a imagem já traz moldura, nome, PS, ataques e rodapé; o template não desenha nada por cima.
    return (
      <div class={`card-face card-${size} is-full-printing finish-${face.finish.toLowerCase()} ${dim ? 'is-dim' : ''}`} role="img" aria-label={cardAriaLabel(face)}>
        {art && (art.crop || art.transform)
          ? <div class="card-printing-image" aria-hidden="true" style={artStyle(art)} />
          : <img class="card-printing-image" src={printedUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false} onError={() => setFailedUrl(printedUrl)} />}
        {/* O nome segue no DOM (busca, testes, seleção por texto) sem aparecer sobre a imagem. */}
        <span class="card-name sr-only">{face.name}</span>
        {quantity !== undefined ? <span class="card-qty" aria-label={`${quantity} cópias`}>×{quantity}</span> : null}
      </div>
    );
  }
  const t = mainType(face).toLowerCase();
  const trainer = face.category === 'TRAINER';
  return (
    <div class={`card-face card-${size} type-${t} ${trainer ? 'is-trainer' : ''} ${face.ruleBox !== 'NONE' ? 'is-rulebox' : ''} finish-${face.finish.toLowerCase()} ${dim ? 'is-dim' : ''} ${art && art.mode !== 'TEMPLATE_ONLY' && art.mode !== 'ART_WINDOW' ? 'has-full-art' : ''}`} role="img" aria-label={cardAriaLabel(face)}>
      {art && art.mode !== 'TEMPLATE_ONLY' && art.mode !== 'ART_WINDOW' ? <div class="card-full-art" aria-hidden="true"><div class="card-art-image" style={artStyle(art)} /></div> : null}
      <div class="card-head">
        <span class="card-stage">{face.subtitle}{face.evolvesFromName ? <small> · de {face.evolvesFromName}</small> : null}</span>
        <span class="card-name">{face.ruleBox !== 'NONE' ? face.name.replace(/\s+ex$/, '') : face.name}{face.ruleBox !== 'NONE' ? <b class="ex-tag"> ex</b> : null}</span>
        {face.hp !== null ? <span class="card-hp"><small>PS</small>{face.hp}</span> : null}
        {face.types[0] ? <TypeIcon type={face.types[0]} size={18} label={false} /> : null}
      </div>
      <div class="card-art" aria-hidden="true">
        {art && art.mode === 'ART_WINDOW'
          ? <div class="card-art-image" style={artStyle(art)} />
          : art && art.mode !== 'TEMPLATE_ONLY' ? null
            : <svg viewBox="0 0 24 24" class="card-art-glyph"><path d={typeGlyphPath(mainType(face))} fill-rule="evenodd" /></svg>}
      </div>
      <div class="card-body">
        {face.abilities.map((a) => (
          <div class="card-ability" key={a.name}><b>Habilidade · {a.name}</b><p>{a.text}</p></div>
        ))}
        {face.attacks.map((a) => (
          <div class="card-attack" key={a.name}>
            <div class={`card-attack-strip strip-${a.type.toLowerCase()}`}>
              <span class="card-cost">{a.cost.map((c, i) => <TypeIcon key={i} type={c} size={14} label={false} />)}</span>
              <span class="card-attack-name">{a.name}</span>
              <span class="card-damage">{a.damage}</span>
            </div>
            {a.text ? <p>{a.text}</p> : null}
          </div>
        ))}
        {trainer ? <p class="card-trainer-text">{face.trainerText}</p> : null}
        {face.ruleBoxText ? <p class="card-rulebox">{face.ruleBoxText}</p> : null}
      </div>
      {!trainer ? (
        <div class="card-foot">
          <span>Fraqueza {face.weakness ?? '—'}</span>
          <span>Recuo {face.retreat ?? 0}</span>
        </div>
      ) : null}
      <div class="card-meta"><span>{face.setId.toUpperCase()} {face.collectorNumber}</span><span class="rarity-symbol" aria-label={RARITY_SYMBOL_LABEL[face.raritySymbol]}>{symbolText(face.raritySymbol)}</span></div>
      {quantity !== undefined ? <span class="card-qty" aria-label={`${quantity} cópias`}>×{quantity}</span> : null}
    </div>
  );
}

/** Miniatura de grade (interface §10.2): face reduzida + nome + quantidade + estados. */
export function CardTile({ face, quantity, owned = true, selected = false, badge, onClick, onContext, disabledReason }: {
  readonly face: CardFaceData | null; readonly quantity?: number; readonly owned?: boolean; readonly selected?: boolean; readonly badge?: string;
  readonly onClick?: () => void; readonly onContext?: () => void; readonly disabledReason?: string;
}): JSX.Element {
  const label = face ? `${cardAriaLabel(face)}${quantity !== undefined ? `, ${quantity} no inventário` : ''}${owned ? '' : ', não obtida'}` : 'Carta';
  return (
    <button type="button" class={`card-tile ${selected ? 'is-selected' : ''} ${owned ? '' : 'is-missing'}`} onClick={onClick} aria-label={label} aria-pressed={selected}
      aria-disabled={disabledReason ? 'true' : undefined} title={disabledReason}
      onContextMenu={onContext ? (e) => { e.preventDefault(); onContext(); } : undefined}>
      <CardFace face={face} size="sm" dim={!owned} />
      <span class="card-tile-name">{face?.name ?? '—'}</span>
      {quantity !== undefined ? <span class="card-tile-qty">×{quantity}</span> : null}
      {badge ? <span class="card-tile-badge">{badge}</span> : null}
    </button>
  );
}

export function EnergyTypes({ types, size = 20 }: { readonly types: readonly string[]; readonly size?: number }): JSX.Element {
  return <span class="energy-types">{types.map((t) => <TypeIcon key={t} type={t as PokemonType} size={size} />)}</span>;
}

export function DeckTile({ name, energyTypes, count, valid, coverFace, status, active, onClick, children }: {
  readonly name: string; readonly energyTypes: readonly string[]; readonly count: number; readonly valid: boolean; readonly coverFace: CardFaceData | null;
  readonly status?: string; readonly active?: boolean; readonly onClick?: () => void; readonly children?: preact.ComponentChildren;
}): JSX.Element {
  const t = (energyTypes[0] ?? 'COLORLESS').toLowerCase();
  return (
    <div class={`deck-tile type-${t} ${active ? 'is-active' : ''}`}>
      <button type="button" class="deck-tile-main" onClick={onClick} aria-label={`${name}, ${count} de 20 cartas, ${valid ? 'válido' : 'inválido'}${status ? `, ${status}` : ''}`}>
        <div class="deck-box" aria-hidden="true"><DeckBox3D face={coverFace} energyType={energyTypes[0] ?? null} size="sm" /></div>
        <div class="deck-tile-info">
          <strong>{name}</strong>
          <EnergyTypes types={energyTypes} size={18} />
          <span class={`deck-count ${valid ? 'ok' : 'bad'}`}>{count}/20 {valid ? '· válido' : '· inválido'}</span>
          {status ? <span class="deck-status">{status}</span> : null}
        </div>
      </button>
      {children ? <div class="deck-tile-actions">{children}</div> : null}
    </div>
  );
}

export function RewardChip({ kind, label, amount }: { readonly kind: 'credits' | 'pack' | 'card' | 'cosmetic' | 'medal'; readonly label: string; readonly amount?: number }): JSX.Element {
  return <span class={`reward-chip reward-${kind}`}>{amount !== undefined ? <b>{amount}</b> : null} {label}</span>;
}

// Caixas de menu no estilo dos menus da EA/Madden (interface §5, §7): mosaico de caixas com arte, título em caixa
// alta, subtítulo, dados e chamada de ação. A caixa inteira é um único botão (área de clique invisível por cima); ações
// secundárias, quando há, ficam acima dela. Foco e hover: aro branco com brilho azul e uma leve subida.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { ContentIndex } from '../../../application/content.ts';
import type { Npc } from '../../../content/types.ts';
import { printedArtUrlNow } from '../../assets/card-art.ts';
import { portraitUrl } from '../../assets/portraits.ts';
import { coverFace } from './cards.tsx';
import { Icon, type IconName } from './icons.tsx';

export type TileSize = 'hero' | 'wide' | 'tall' | 'sq';
export type TileTone =
  | 'blue' | 'ink' | 'cyan' | 'coral' | 'gold' | 'lavender'
  | 'grass' | 'fire' | 'water' | 'lightning' | 'psychic' | 'fighting' | 'darkness' | 'metal' | 'colorless';

export function MenuTile({ title, kicker, subtitle, size = 'sq', tone = 'blue', art, artClass, badge, meta, cta, actions, onClick, testId, label, disabledReason, autoFocus, class: cls }: {
  readonly title: string;
  readonly kicker?: string | null;
  readonly subtitle?: ComponentChildren;
  readonly size?: TileSize;
  readonly tone?: TileTone;
  readonly art?: ComponentChildren;
  readonly artClass?: string;
  readonly badge?: ComponentChildren;
  readonly meta?: ComponentChildren;
  readonly cta?: string | null;
  /** Botões secundários (ficam acima da área de clique da caixa). */
  readonly actions?: ComponentChildren;
  readonly onClick?: () => void;
  readonly testId?: string;
  /** Nome acessível; por padrão, título e subtítulo de texto. */
  readonly label?: string;
  /** Motivo do bloqueio: a caixa continua focável, anuncia o motivo e não navega. */
  readonly disabledReason?: string | null;
  readonly autoFocus?: boolean;
  readonly class?: string;
}): JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, [autoFocus]);
  const blocked = !!disabledReason;
  const name = label ?? [kicker, title, typeof subtitle === 'string' ? subtitle : null, cta].filter(Boolean).join(', ');
  return (
    <div class={`menu-tile size-${size} tone-${tone} ${blocked ? 'is-locked' : ''} ${cls ?? ''}`}>
      <span class="tile-bg" aria-hidden="true" />
      {art ? <span class={`tile-art ${artClass ?? ''}`} aria-hidden="true">{art}</span> : null}
      <span class="tile-body" aria-hidden="true">
        {kicker ? <span class="tile-kicker">{kicker}</span> : null}
        <strong class="tile-title">{title}</strong>
        {subtitle ? <span class="tile-sub">{subtitle}</span> : null}
        {meta ? <span class="tile-meta">{meta}</span> : null}
        {cta ? <span class="tile-cta">{cta}<Icon name="play" size={14} /></span> : null}
      </span>
      {badge ? <span class="tile-badge" aria-hidden="true">{badge}</span> : null}
      {blocked ? <span class="tile-lock" aria-hidden="true"><Icon name="lock" size={18} /></span> : null}
      <button ref={ref} type="button" class="tile-hit" aria-label={blocked ? `${name}. Indisponível: ${disabledReason}` : name} aria-disabled={blocked ? 'true' : undefined}
        title={disabledReason ?? undefined} data-testid={testId} onClick={(e) => { if (blocked) { e.preventDefault(); return; } onClick?.(); }} />
      {actions ? <span class="tile-actions">{actions}</span> : null}
    </div>
  );
}

/** Mosaico de caixas: 4 colunas, linhas que dividem a altura disponível (mínimo legível), denso. */
export function TileGrid({ children, class: cls, label }: { readonly children: ComponentChildren; readonly class?: string; readonly label?: string }): JSX.Element {
  return <section class={`tile-grid ${cls ?? ''}`} aria-label={label}>{children}</section>;
}

/** Cor da caixa do capítulo: o tipo do Ginásio (Prólogo em ciano, Viridian em azul profundo, final em ouro). */
export const CHAPTER_TONE: Readonly<Record<string, TileTone>> = {
  P00: 'cyan', C01: 'grass', C02: 'water', C03: 'lightning', C04: 'psychic', C05: 'fighting', C06: 'ink', F00: 'gold',
};

/** Anfitrião do capítulo: o chefe (ou a final); no Prólogo, quem dá as aulas. */
export function chapterHost(c: ContentIndex, chapterId: string): Npc | null {
  const nodes = c.nodeList.filter((n) => n.chapterId === chapterId);
  const host = nodes.find((n) => n.kind === 'FINAL') ?? nodes.find((n) => n.kind === 'BOSS') ?? nodes[0];
  return host ? c.npcs.get(host.npcId) ?? null : null;
}

export function TileIcon({ name }: { readonly name: IconName }): JSX.Element {
  return <span class="tile-icon"><Icon name={name} /></span>;
}

export function TilePortrait({ portraitKey }: { readonly portraitKey: string | null | undefined }): JSX.Element | null {
  const url = portraitUrl(portraitKey ?? null);
  return url ? <img class="tile-portrait" src={url} alt="" decoding="async" draggable={false} /> : null;
}

export function TileProgress({ value, max }: { readonly value: number; readonly max: number }): JSX.Element {
  return <span class="tile-progress"><span style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} /></span>;
}

/** Carta-chave do rival: a capa do deck do encontro mais adiantado dele (perfil Padrão). */
function rivalCardUrl(c: ContentIndex, npcId: string): string | null {
  const nodes = c.nodeList.filter((n) => n.npcId === npcId && n.difficultyProfiles);
  const profile = nodes.length ? nodes[nodes.length - 1]!.difficultyProfiles!.STANDARD : null;
  const deck = profile ? c.decks.get(profile.npcDeckId) : null;
  return deck ? printedArtUrlNow(coverFace(c, deck.entries.map((e) => e.printingId))) : null;
}

/** Arte grande de rival nas caixas: a carta-chave do deck dele, nítida, com o retrato (emote) por cima. */
export function RivalArt({ c, npc }: { readonly c: ContentIndex; readonly npc: Npc | null | undefined }): JSX.Element | null {
  if (!npc) return null;
  const card = rivalCardUrl(c, npc.npcId);
  const portrait = portraitUrl(npc.portraitAssetKey);
  return (
    <span class={`tile-rival ${card ? '' : 'no-card'}`}>
      {card ? <img class="tile-rival-card" src={card} alt="" decoding="async" draggable={false} /> : null}
      {portrait ? <img class="tile-rival-portrait" src={portrait} alt="" decoding="async" draggable={false} /> : null}
    </span>
  );
}

/** Concordância simples: “1 disponível”, “3 disponíveis”. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

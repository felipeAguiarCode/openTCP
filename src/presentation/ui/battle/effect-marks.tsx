// Selos de efeito nas cartas em campo (interface §25.21; ícones do Pokémon TCG Pocket): uma coluna de ícones na borda
// direita da carta — Condições Especiais e efeitos temporários (não pode atacar, mais dano, dano prevenido…). Quando um
// efeito novo pega a carta, o ícone estoura grande no centro dela, com um brilho na cor do efeito, e voa para a coluna;
// um selo que sai encolhe e some. Mesa 3D (overlay HTML) e 2D. Com movimento reduzido, os selos só aparecem e somem.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { EffectBadge, EffectBadgeKind } from '../../../domain/battle/effect-badges.ts';
import { CONDITION_LABEL } from '../../../domain/cards/text.ts';
import type { SpecialCondition } from '../../../domain/cards/types.ts';
import { effectIconUrl, type EffectIconId } from '../../assets/effects.ts';

export type EffectMark = {
  readonly key: string;
  readonly icon: EffectIconId;
  readonly label: string;
  /** Cor do brilho: a da Condição ou a do tipo de efeito (positivo, negativo, bloqueio). */
  readonly tone: string;
  /** Efeitos por trás do selo (um selo por tipo): um id novo dispara o estouro. */
  readonly ids: readonly string[];
};

const CONDITION_ORDER: readonly SpecialCondition[] = ['ASLEEP', 'PARALYZED', 'CONFUSED', 'POISONED', 'BURNED'];
const KIND_ORDER: readonly EffectBadgeKind[] = ['BAN', 'PLAY_NEGATIVE', 'INVALID', 'BUFF', 'DEBUFF', 'OTHER_POSITIVE', 'OTHER_NEGATIVE'];
const KIND_ICON: Readonly<Record<EffectBadgeKind, EffectIconId>> = {
  BAN: 'ban', PLAY_NEGATIVE: 'play-negative', INVALID: 'invalid', BUFF: 'buff', DEBUFF: 'debuff', OTHER_POSITIVE: 'other-positive', OTHER_NEGATIVE: 'other-negative',
};
const KIND_TONE: Readonly<Record<EffectBadgeKind, string>> = {
  BAN: 'ban', PLAY_NEGATIVE: 'negative', INVALID: 'shield', BUFF: 'positive', DEBUFF: 'negative', OTHER_POSITIVE: 'positive', OTHER_NEGATIVE: 'negative',
};

type Conditions = { readonly poisoned: boolean; readonly burned: boolean; readonly control: string | null };

/** Selos de um Pokémon: as Condições primeiro, depois um selo por tipo de efeito (os textos dos efeitos juntos). */
export function marksOf(conditions: Conditions, effects: readonly EffectBadge[]): EffectMark[] {
  const out: EffectMark[] = [];
  for (const c of CONDITION_ORDER) {
    const on = c === 'POISONED' ? conditions.poisoned : c === 'BURNED' ? conditions.burned : conditions.control === c;
    if (on) out.push({ key: `cond:${c}`, icon: c.toLowerCase() as EffectIconId, label: CONDITION_LABEL[c], tone: c.toLowerCase(), ids: [`cond:${c}`] });
  }
  for (const kind of KIND_ORDER) {
    const of = effects.filter((e) => e.kind === kind);
    if (!of.length) continue;
    out.push({ key: `fx:${kind}`, icon: KIND_ICON[kind], label: [...new Set(of.map((e) => e.label))].join(' · '), tone: KIND_TONE[kind], ids: of.map((e) => e.effectId) });
  }
  return out;
}

/** Texto acessível dos selos (“Envenenado, Não pode atacar”). */
export function marksLabel(marks: readonly EffectMark[]): string {
  return marks.map((m) => m.label).join(', ');
}

const BURST_MS = 1100;
/** Intervalo entre estouros de efeitos que chegam juntos (um de cada vez, como no Pocket). */
const STAGGER_MS = 360;
const LEAVE_MS = 380;

function MarkIcon({ mark, cls }: { readonly mark: EffectMark; readonly cls: string }): JSX.Element {
  const url = effectIconUrl(mark.icon);
  return url
    ? <img class={`fx-mark ${cls}`} src={url} alt={mark.label} title={mark.label} draggable={false} />
    : <span class={`fx-mark is-text ${cls}`} title={mark.label}>{mark.label}</span>;
}

/** Coluna exibida: os selos atuais, com os que saem de volta na posição que tinham. */
function column(marks: readonly EffectMark[], leaving: readonly { readonly mark: EffectMark; readonly index: number }[]): { readonly mark: EffectMark; readonly out: boolean }[] {
  const out = marks.map((mark) => ({ mark, out: false }));
  for (const l of [...leaving].sort((a, b) => a.index - b.index)) out.splice(Math.min(l.index, out.length), 0, { mark: l.mark, out: true });
  return out;
}

/**
 * Coluna de selos de uma carta, com o estouro dos efeitos novos. `paused`: a carta está coberta ou virada — o diff
 * espera e o estouro toca quando ela volta à vista. A primeira montagem (retomar o duelo) não anima.
 */
export function EffectMarks({ marks, reduced, paused = false }: { readonly marks: readonly EffectMark[]; readonly reduced: boolean; readonly paused?: boolean }): JSX.Element | null {
  const seen = useRef<ReadonlySet<string> | null>(null);
  const shown = useRef<readonly EffectMark[]>(marks);
  const [bursts, setBursts] = useState<readonly { readonly token: number; readonly mark: EffectMark }[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  /** Selos que saem, com a posição que tinham na coluna (encolhem no lugar). */
  const [leaving, setLeaving] = useState<readonly { readonly mark: EffectMark; readonly index: number }[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); }, []);
  const idsKey = marks.flatMap((m) => m.ids).sort().join('|');
  useEffect(() => {
    if (paused) return;
    const ids = new Set(marks.flatMap((m) => m.ids));
    const before = seen.current;
    const gone = shown.current.map((mark, index) => ({ mark, index })).filter(({ mark }) => !marks.some((x) => x.key === mark.key));
    seen.current = ids;
    shown.current = marks;
    if (!before) return;
    const added = marks.filter((m) => m.ids.some((id) => !before.has(id)));
    if (added.length && !reduced) {
      const token = Date.now() + Math.random();
      setBursts((b) => [...b, ...added.map((mark, i) => ({ token: token + i / 1000, mark }))]);
      setFresh(new Set(added.map((m) => m.key)));
      timers.current.push(setTimeout(() => { setBursts((b) => b.filter((x) => x.token < token)); setFresh(new Set()); }, BURST_MS + STAGGER_MS * (added.length - 1)));
    }
    if (gone.length && !reduced) {
      setLeaving((l) => [...l, ...gone]);
      timers.current.push(setTimeout(() => setLeaving((l) => l.filter((x) => !gone.some((g) => g.mark === x.mark))), LEAVE_MS));
    }
  }, [idsKey, paused]);
  if (!marks.length && !bursts.length && !leaving.length) return null;
  const last = bursts[bursts.length - 1];
  return (
    <>
      {last ? <span key={`flash-${last.token}`} class={`fx-flash tone-${last.mark.tone}`} aria-hidden="true" /> : null}
      {bursts.map((b, i) => {
        const delay = { animationDelay: `${i * STAGGER_MS}ms` };
        return (
          <span key={b.token} class={`fx-burst tone-${b.mark.tone}`} aria-hidden="true">
            <span class="fx-burst-ring" style={delay} />
            {effectIconUrl(b.mark.icon) ? <img src={effectIconUrl(b.mark.icon)!} alt="" draggable={false} style={delay} /> : null}
          </span>
        );
      })}
      <span class={`fx-marks ${paused ? 'is-paused' : ''}`} data-testid="effect-marks">
        {column(marks, leaving).map(({ mark, out }) => <MarkIcon key={out ? `out:${mark.key}` : mark.key} mark={mark} cls={out ? 'is-leaving' : fresh.has(mark.key) ? 'is-new' : ''} />)}
      </span>
    </>
  );
}

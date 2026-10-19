// Abertura do duelo (gameplay-pocket §3; preset de UI DUEL_INTRO): duas faixas diagonais fecham a tela — a vermelha do
// rival por cima, a azul do jogador por baixo —, os retratos descem pesados com impacto e tremor, e entram “VS.”, os
// nomes e a saudação do rival. Aparece uma vez por tentativa recém-iniciada (nunca ao retomar) e some sozinha; a IA
// espera ela terminar. Com movimento reduzido, a pose final aparece com um fade curto, sem queda nem tremor.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { UI_PRESETS } from '../../animation/catalog.ts';

/** Duração total (preset de UI DUEL_INTRO) e do fade de saída; com movimento reduzido, só a pose final por pouco mais de 1 s. */
export const DUEL_INTRO_MS = UI_PRESETS.DUEL_INTRO;
export const DUEL_INTRO_REDUCED_MS = 1200;
const LEAVE_MS = 380;

const fresh = new Set<string>();
/** Marca a tentativa recém-iniciada (quem chamou startAttempt): a abertura aparece na primeira tela dela. */
export function markFreshAttempt(attemptId: string): void {
  fresh.add(attemptId);
}
/** Consome a marca: true só na primeira vez para a tentativa (S22 → S23 remonta a tela sem repetir a abertura). */
export function takeFreshAttempt(attemptId: string): boolean {
  return fresh.delete(attemptId);
}

export type DuelSide = { readonly name: string; readonly portraitUrl: string | null };

function Avatar({ side, role }: { readonly side: DuelSide; readonly role: 'npc' | 'human' }): JSX.Element {
  return (
    <div class={`duel-avatar duel-avatar-${role}`}>
      {side.portraitUrl ? <img src={side.portraitUrl} alt="" draggable={false} /> : <span class="duel-avatar-initial">{side.name.slice(0, 1).toUpperCase()}</span>}
    </div>
  );
}

export function DuelIntro({ npc, human, greeting, reduced, onDone }: {
  readonly npc: DuelSide; readonly human: DuelSide; readonly greeting: string; readonly reduced: boolean; readonly onDone: () => void;
}): JSX.Element {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const total = reduced ? DUEL_INTRO_REDUCED_MS : DUEL_INTRO_MS;
    const leave = setTimeout(() => setLeaving(true), total - LEAVE_MS);
    const done = setTimeout(onDone, total);
    return () => { clearTimeout(leave); clearTimeout(done); };
  }, []);
  return (
    <div class={`duel-intro ${reduced ? 'is-reduced' : ''} ${leaving ? 'is-leaving' : ''}`} role="dialog" aria-modal="true"
      aria-label={`${npc.name} contra ${human.name}. ${greeting}`} data-testid="duel-intro">
      <div class="duel-intro-veil" aria-hidden="true" />
      <div class="duel-stage" aria-hidden="true">
        <div class="duel-band duel-band-npc" />
        <div class="duel-band duel-band-human" />
        <Avatar side={npc} role="npc" />
        <Avatar side={human} role="human" />
      </div>
      <span class="duel-name duel-name-npc">{npc.name}</span>
      <b class="duel-vs">VS.</b>
      <span class="duel-greeting">{greeting}</span>
      <span class="duel-name duel-name-human">{human.name}</span>
    </div>
  );
}

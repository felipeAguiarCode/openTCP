// Ciclo de vida da página (interface §27.5, §31.5; runtime §9): aba oculta suspende IA e entrada;
// transferência cooperativa grava a tentativa numa fronteira atômica antes de liberar o banco.
import { signal } from '@preact/signals';
import { suspendAttempt } from '../../../application/battle.ts';
import { battleSession, ctx } from './store.ts';

/** A aba ficou oculta durante um duelo: ao voltar, o jogador escolhe “Continuar”. */
export const pausedByVisibility = signal(false);
/** O banco foi entregue a outra aba: esta aba não grava mais nada. */
export const transferredAway = signal(false);

export async function suspendForTransfer(): Promise<boolean> {
  const session = battleSession.value;
  const game = ctx.value;
  if (session && game && !session.result) {
    session.paused = true;
    await suspendAttempt(game, session);
  }
  return true;
}

export function resumeAfterVisibility(): void {
  const session = battleSession.value;
  if (session) session.paused = false;
  pausedByVisibility.value = false;
}

export function installLifecycle(): () => void {
  const onVisibility = () => {
    const session = battleSession.value;
    if (document.visibilityState === 'hidden' && session && !session.result) {
      session.paused = true;
      pausedByVisibility.value = true;
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}

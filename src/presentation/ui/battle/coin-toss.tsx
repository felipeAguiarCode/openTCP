// Cara ou coroa de abertura (gameplay-pocket §3): logo depois da abertura VS de uma tentativa recém-iniciada, a moeda
// equipada no deck do jogador sobe, gira e cai na face que o motor sorteou — cara, o jogador começa; coroa, o rival.
// O resultado fica na tela por um instante e o overlay some sozinho; a IA espera. Com movimento reduzido, a face
// sorteada aparece parada, já com o resultado.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { CoinFace } from '../../assets/coins.ts';
import { CoinDisc, type CoinLike } from '../components/coin.tsx';

/** Giro da moeda, duração total e fade de saída (ms); com movimento reduzido, só o resultado. */
export const COIN_TOSS_SPIN_MS = 1400;
export const COIN_TOSS_MS = 2900;
export const COIN_TOSS_REDUCED_MS = 1600;
const LEAVE_MS = 320;

export function CoinToss({ coin, face, rival, reduced, onDone }: {
  readonly coin: CoinLike | null; readonly face: CoinFace; readonly rival: string; readonly reduced: boolean; readonly onDone: () => void;
}): JSX.Element {
  const [phase, setPhase] = useState<'SPIN' | 'RESULT' | 'LEAVING'>(reduced ? 'RESULT' : 'SPIN');
  useEffect(() => {
    const total = reduced ? COIN_TOSS_REDUCED_MS : COIN_TOSS_MS;
    const timers = [
      setTimeout(() => setPhase((p) => (p === 'SPIN' ? 'RESULT' : p)), reduced ? 0 : COIN_TOSS_SPIN_MS),
      setTimeout(() => setPhase('LEAVING'), total - LEAVE_MS),
      setTimeout(onDone, total),
    ];
    return () => { for (const t of timers) clearTimeout(t); };
  }, []);
  const heads = face === 'HEADS';
  const result = heads ? 'Cara!' : 'Coroa!';
  const who = heads ? 'Você começa.' : `${rival} começa.`;
  return (
    <div class={`coin-toss side-${heads ? 'human' : 'npc'} ${phase === 'SPIN' ? '' : 'is-result'} ${phase === 'LEAVING' ? 'is-leaving' : ''}`}
      role="dialog" aria-modal="true" aria-label={`Cara ou coroa para decidir quem começa. ${result} ${who}`} data-testid="coin-toss" data-face={face}>
      <div class="coin-toss-veil" aria-hidden="true" />
      <span class="coin-toss-title">Cara ou coroa?</span>
      <CoinDisc coin={coin} face={face} toss={!reduced} size={200} label={coin ? coin.names['pt-BR'] : 'Moeda'} />
      {phase === 'SPIN' ? <span class="coin-toss-rule">Cara: você começa · Coroa: {rival} começa</span> : (
        <div class="coin-toss-result" role="status" aria-live="polite" data-testid="coin-toss-result">
          <b>{result}</b>
          <span>{who}</span>
        </div>
      )}
    </div>
  );
}

// Guia de cenário preparado (interface §6.4, §16; campanha §13): dicas do tutorial com “Pular explicação”
// e, nos puzzles, três níveis de ajuda — conceito, próxima decisão e solução comentada. Só lê o conteúdo:
// ajuda nunca muda a partida, os objetivos ou as recompensas.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ContentFixture } from '../../../content/types.ts';
import { loadViewState, saveViewState } from '../app/router.ts';
import { Button } from '../components/controls.tsx';
import { Icon } from '../components/icons.tsx';

type GuideState = { readonly hidden: boolean; readonly tip: number; readonly level: number };

const LEVELS = ['Conceito', 'Próxima decisão', 'Solução comentada'] as const;

export function FixtureGuide({ fixture, attemptId }: { readonly fixture: ContentFixture; readonly attemptId: string }): JSX.Element | null {
  const key = `S23:guide:${attemptId}`;
  const [state, setState] = useState<GuideState>(() => loadViewState(key, { hidden: false, tip: 0, level: 0 }));
  const update = (next: GuideState) => { setState(next); saveViewState(key, next); };
  const tips = [...(fixture.guidance ?? [])].sort((a, b) => a.step - b.step);
  const notes = (fixture.solution ?? []).map((s) => s.command.note).filter((n): n is string => !!n);
  const title = fixture.label.split(' — ')[0] ?? fixture.label;

  if (state.hidden) {
    return (
      <div class="fixture-guide is-collapsed">
        <span class="badge">Cenário preparado</span>
        <Button size="sm" variant="ghost" icon="help" onClick={() => update({ ...state, hidden: false })}>{fixture.kind === 'PUZZLE' ? 'Ajuda' : 'Mostrar dicas'}</Button>
      </div>
    );
  }

  if (fixture.kind === 'PUZZLE') {
    return (
      <section class="fixture-guide" aria-label="Ajuda do puzzle">
        <header><span class="badge">Cenário preparado</span><strong>{title}</strong></header>
        <p class="small">{fixture.label.split(' — ')[1] ?? ''}</p>
        <ol class="guide-levels">
          {LEVELS.map((label, i) => (
            <li key={label} class={i < state.level ? 'is-open' : ''}>
              {i < state.level ? (
                <>
                  <b>{label}</b>
                  <p class="small">{tips[i]?.text.replace(/^[^:]+:\s*/, '') ?? '—'}</p>
                  {i === 2 && notes.length ? <ol class="guide-solution small">{notes.map((n, k) => <li key={k}>{n}</li>)}</ol> : null}
                </>
              ) : i === state.level ? (
                <Button size="sm" onClick={() => update({ ...state, level: i + 1 })}>Ver {label.toLowerCase()}</Button>
              ) : <span class="muted small">{label}</span>}
            </li>
          ))}
        </ol>
        <Button size="sm" variant="ghost" onClick={() => update({ ...state, hidden: true })}>Ocultar ajuda</Button>
      </section>
    );
  }

  const tip = tips[Math.min(state.tip, tips.length - 1)];
  if (!tip) return null;
  return (
    <section class="fixture-guide" aria-label="Dicas do tutorial" aria-live="polite">
      <header><span class="badge">Tutorial</span><strong>{title}</strong></header>
      <p><Icon name="info" size={16} /> {tip.text}</p>
      <div class="row">
        <Button size="sm" variant="ghost" onClick={() => update({ ...state, tip: state.tip - 1 })} disabledReason={state.tip > 0 ? null : 'Primeira dica.'}>Anterior</Button>
        <span class="small muted">{Math.min(state.tip, tips.length - 1) + 1}/{tips.length}</span>
        <Button size="sm" onClick={() => update({ ...state, tip: state.tip + 1 })} disabledReason={state.tip < tips.length - 1 ? null : 'Última dica.'}>Próxima dica</Button>
      </div>
      {notes.length ? (
        <details class="small">
          <summary>Solução comentada</summary>
          <ol class="guide-solution">{notes.map((n, k) => <li key={k}>{n}</li>)}</ol>
        </details>
      ) : null}
      <Button size="sm" variant="ghost" onClick={() => update({ ...state, hidden: true })}>Pular explicação</Button>
    </section>
  );
}

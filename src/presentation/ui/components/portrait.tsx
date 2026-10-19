// Retratos (emotes) de treinadores como avatar do jogador e dos rivais. O PNG já é um emblema redondo com aro
// próprio e o cabelo ou os acessórios podem sair do disco: só a imagem, sem contorno, sombra, fundo nem recorte.
import type { JSX } from 'preact';
import { PORTRAITS_BY_TRAINER, portraitUrl } from '../../assets/portraits.ts';

/** Retrato pela chave `portrait:<arquivo>`; sem arquivo no pacote, nada. `unknown` mostra só a silhueta (rival não encontrado). */
export function PortraitImage({ portraitKey, label, class: cls, unknown }: {
  readonly portraitKey: string | null | undefined; readonly label: string; readonly class?: string; readonly unknown?: boolean;
}): JSX.Element | null {
  const url = portraitUrl(portraitKey);
  if (!url) return null;
  return <img class={`portrait ${unknown ? 'is-unknown' : ''} ${cls ?? ''}`} src={url} alt={label} draggable={false} decoding="async" />;
}

/** Seletor de avatar: todos os retratos, agrupados por treinador. O escolhido cresce e os outros esmaecem — sem contorno. */
export function PortraitPicker({ value, onChange, testId }: { readonly value: string | null; readonly onChange: (key: string) => void; readonly testId?: string }): JSX.Element {
  return (
    <div class={`portrait-picker ${value ? 'has-value' : ''}`} role="radiogroup" aria-label="Avatar" data-testid={testId}>
      {PORTRAITS_BY_TRAINER.map((group) => (
        <div key={group.trainerName} class="portrait-group">
          <span class="portrait-group-name">{group.trainerName}</span>
          <div class="portrait-row">
            {group.portraits.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={value === p.key} class={`portrait-choice ${value === p.key ? 'is-active' : ''}`}
                title={p.label} aria-label={p.label} data-portrait={p.key} onClick={() => onChange(p.key)}>
                <img src={p.url} alt="" draggable={false} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

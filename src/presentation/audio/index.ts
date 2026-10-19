// Áudio da aplicação: mixer único, desbloqueado no primeiro gesto, com volumes das preferências e pausa
// junto da sessão (aba oculta). Sem arquivos ou sem permissão do navegador, tudo segue em silêncio.
import { effect } from '@preact/signals';
import { pausedByVisibility } from '../ui/app/lifecycle.ts';
import { settings } from '../ui/app/store.ts';
import { appMixer } from './mixer.ts';

export { appMixer } from './mixer.ts';
export { cueForSignal, placeholderCues, type BattleSignal, type CueId } from './cues.ts';

export function installAudio(target: EventTarget = window): () => void {
  const mixer = appMixer();
  const removeUnlock = mixer.installUnlock(target);
  const stopVolumes = effect(() => {
    const s = settings.value;
    mixer.setVolumes({ volumeMusic: s.volumeMusic, volumeBattle: s.volumeBattle, volumeUi: s.volumeUi, volumePacks: s.volumePacks });
  });
  const stopPause = effect(() => mixer.setSuspended(pausedByVisibility.value));
  return () => { removeUnlock(); stopVolumes(); stopPause(); };
}

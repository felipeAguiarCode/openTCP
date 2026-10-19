import { render } from 'preact';
import type { AiPort } from './application/ports/ai.ts';
import { loadBaseContent } from './infrastructure/content/loader.ts';
import { browserPlatform } from './infrastructure/platform/browser.ts';
import { createBrowserStorage, requestCooperativeTransfer } from './infrastructure/storage/client.ts';
import { createAiPort } from './infrastructure/workers/ai-port.ts';
import { App } from './presentation/ui/App.tsx';
import { installCardBack } from './presentation/assets/index.ts';
import { installAudio } from './presentation/audio/index.ts';
import { bootServicesSignal } from './presentation/ui/app/boot.ts';
import { installLifecycle, suspendForTransfer, transferredAway } from './presentation/ui/app/lifecycle.ts';
import './presentation/ui/styles/index.css';

bootServicesSignal.value = {
  platform: browserPlatform(),
  loadContent: () => loadBaseContent(),
  createStorage: () => createBrowserStorage({
    onTransferRequested: () => suspendForTransfer(),
    onTransferred: () => { transferredAway.value = true; },
  }),
  createAi: (content): AiPort => createAiPort(content),
  requestTransfer: () => requestCooperativeTransfer(),
};
installLifecycle();
installCardBack();
installAudio();

const root = document.getElementById('app');
if (root) render(<App />, root);

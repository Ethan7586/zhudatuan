import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import '@shop/design/tokens.css';
import '@shop/design/base.css';
import '@shop/design/components.css';
import '@shop/design/workspace.css';
import './style.css';
import { startDocumentPrefetch } from './shared/api/DocumentPrefetch';
import { loadConsoleRuntimeConfig } from './shared/config/RuntimeConfig';
import {
  clearDynamicImportRecoveryAfterStableBoot,
  recoverFromDynamicImportFailure,
} from './shared/recovery/DynamicImportRecovery';

const root = document.getElementById('root');
if (!root) throw new Error('APP_ROOT_MISSING');
const renderer = createRoot(root);
void loadConsoleRuntimeConfig().then(async (runtimeConfig) => {
  startDocumentPrefetch(runtimeConfig);
  void import('./shared/interaction/ConsoleModulePreload')
    .then(({ preloadCurrentConsoleBoot }) => preloadCurrentConsoleBoot(window.location.pathname))
    .catch(() => undefined);
  return await import('./app/providers');
}).then(
  ({ Providers }) => {
    clearDynamicImportRecoveryAfterStableBoot();
    window.setTimeout(() => renderer.render(<StrictMode><Providers /></StrictMode>));
  },
  (cause: unknown) => {
    if (recoverFromDynamicImportFailure(cause)) return;
    const message = cause instanceof Error ? cause.message : 'APPLICATION_BOOTSTRAP_FAILED';
    renderer.render(<StrictMode><main className="statemain"><section role="alert">
      <h2>应用配置无效</h2><p>{message}</p>
      <button className="shopbutton shopbuttondefault" type="button" onClick={() => window.location.reload()}>重试</button>
    </section></main></StrictMode>);
  },
);

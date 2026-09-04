import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { ErrorView } from './Error';

export interface ApplicationModule {
  readonly Providers: ComponentType;
}

export async function bootstrapApplication(
  load: () => Promise<ApplicationModule>,
  commit: (application: ReactNode) => void,
): Promise<void> {
  try {
    const { Providers } = await load();
    commit(<StrictMode><Providers /></StrictMode>);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'APPLICATION_BOOTSTRAP_FAILED';
    commit(<StrictMode><main className="statemain"><ErrorView title="应用配置无效" message={message}
      retry={() => window.location.reload()} /></main></StrictMode>);
  }
}

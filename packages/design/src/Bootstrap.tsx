import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { ErrorView } from './Error';

export interface ApplicationModule {
  readonly Providers: ComponentType;
}

export async function bootstrapApplication(load: () => Promise<ApplicationModule>, commit: (application: ReactNode) => void): Promise<void> {
  try {
    const { Providers } = await load();
    commit(
      <StrictMode>
        <Providers />
      </StrictMode>
    );
  } catch {
    commit(
      <StrictMode>
        <main className="statemain">
        <ErrorView title="应用配置无效" message="应用暂时无法启动，请刷新页面；若问题持续，请联系管理员。" retry={() => window.location.reload()} />
        </main>
      </StrictMode>
    );
  }
}

import type { ReactNode } from 'react';
import { SessionProvider } from '../entity/session/viewmodel/SessionContext';
import { useSessionViewModel } from '../entity/session/viewmodel/SessionViewModel';
import type { StorefrontEntryPath } from '../route/EntryPath';
import { ThemeRuntime } from './ThemeRuntime';

export function SessionRuntime({ entry, children }: Readonly<{ entry: StorefrontEntryPath; children: ReactNode }>) {
  const session = useSessionViewModel(entry);
  return <SessionProvider value={session}><ThemeRuntime theme={session.experience?.theme ?? null}>{children}</ThemeRuntime></SessionProvider>;
}

export { useSession } from '../entity/session/viewmodel/SessionContext';

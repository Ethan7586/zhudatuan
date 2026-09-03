import type { ReactNode } from 'react';
import { SessionProvider } from '../entity/session/viewmodel/SessionContext';
import { useSessionViewModel } from '../entity/session/viewmodel/SessionViewModel';
import type { StorefrontEntryPath } from '../route/EntryPath';

export function SessionRuntime({ entry, children }: Readonly<{ entry: StorefrontEntryPath; children: ReactNode }>) {
  return <SessionProvider value={useSessionViewModel(entry)}>{children}</SessionProvider>;
}

export { useSession } from '../entity/session/viewmodel/SessionContext';

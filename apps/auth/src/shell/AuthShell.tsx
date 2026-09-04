import type { ReactNode } from 'react';
import { AuthFooter } from './AuthFooter';

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="authshell">
      <div className="authambient" aria-hidden="true" />
      <main className="authmain">{children}</main>
      <AuthFooter />
    </div>
  );
}

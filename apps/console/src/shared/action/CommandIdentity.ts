import type { MutableRefObject } from 'react';

export interface CommandIdentity {
  fingerprint: string;
  identity: string;
}

export function identityFor(reference: MutableRefObject<CommandIdentity | undefined>, fingerprint: string, create: () => string): string {
  if (reference.current?.fingerprint !== fingerprint) reference.current = { fingerprint, identity: create() };
  return reference.current.identity;
}

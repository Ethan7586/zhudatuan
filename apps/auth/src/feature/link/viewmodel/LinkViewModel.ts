import type { FailureView } from '@shop/presentation';
import { presentError } from '@shop/presentation';
import { useEffect, useState } from 'react';
import type { AuthTarget } from '@shop/config/client';
import type { LinkSnapshot } from '../model/Link';
import type { ReadLink } from '../application/ReadLink';

export type LinkState = Readonly<{ kind: 'loading' }> | Readonly<{ kind: 'ready'; snapshot: LinkSnapshot }> | Readonly<{ kind: 'empty' }> | Readonly<{ kind: 'failed'; failure: FailureView }>;
export function useLinkViewModel(reader: ReadLink, target: AuthTarget) {
  const [state, setState] = useState<LinkState>({ kind: 'loading' });
  useEffect(() => {
    const request = new AbortController();
    setState({ kind: 'loading' });
    void reader.execute(target, request.signal).then(
      (snapshot) => {
        if (!request.signal.aborted) setState(snapshot.links.length === 0 ? { kind: 'empty' } : { kind: 'ready', snapshot });
      },
      (cause: unknown) => {
        if (!request.signal.aborted) setState({ kind: 'failed', failure: presentError(cause) });
      }
    );
    return () => request.abort();
  }, [reader, target]);
  return state;
}

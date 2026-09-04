import { useCallback, useEffect, useState } from 'react';

export interface ResourceQuery<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly reload: () => void;
}

export function useResourceQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>): ResourceQuery<T> {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Readonly<{ data?: T; error?: unknown }>>({});
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({});
    void load(controller.signal).then(
      (data) => setState(Object.freeze({ data })),
      (error: unknown) => {
        if (!controller.signal.aborted) setState(Object.freeze({ error }));
      }
    );
    return () => controller.abort();
  }, [key, load, revision]);

  return Object.freeze({ data: state.data, error: state.error, reload });
}

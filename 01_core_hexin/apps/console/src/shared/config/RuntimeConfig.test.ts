import { describe, expect, it } from 'vitest';
import { loadProductionConfig } from './RuntimeConfig';

describe('production runtime configuration', () => {
  it('starts the immutable artifact fallback before the optional runtime response settles', async () => {
    let resolveRuntime: (response: Response) => void = () => undefined;
    let resolveArtifact: (response: Response) => void = () => undefined;
    const requests: string[] = [];
    const fetcher = ((input: string | URL | Request) => {
      const path = String(input);
      requests.push(path);
      return new Promise<Response>((resolve) => {
        if (path === '/console-runtime.json') resolveRuntime = resolve;
        else resolveArtifact = resolve;
      });
    }) as typeof fetch;

    const loading = loadProductionConfig('console.example.test', fetcher);
    expect(requests).toEqual(['/console-runtime.json', '/console-build.json']);

    resolveRuntime(new Response('', { status: 404 }));
    resolveArtifact(new Response('', { status: 500 }));
    await expect(loading).rejects.toThrow('CONSOLE_RUNTIME_CONFIG_HTTP_500');
  });
});

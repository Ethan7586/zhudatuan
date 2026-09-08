import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { localProviderEnvironment } from '@shop/config/server';
import { providerFixtureResult } from './ProviderFixture';

const { providerPort: port } = localProviderEnvironment();
const catalog = parse(readFileSync(resolve('config/providers.yml'), 'utf8'));
const providers = new Set<string>((catalog.providers ?? []).map(({ id }: { id: string }) => id));
if (providers.size !== 11) throw new Error('LOCAL_PROVIDER_CATALOG_INVALID');

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
  let bytes = 0;
  request.on('data', (chunk: Buffer) => {
    bytes += chunk.byteLength;
    if (bytes > 1_048_576) request.destroy(new Error('PROVIDER_FIXTURE_BODY_TOO_LARGE'));
  });
  request.on('error', () => {
    if (!response.headersSent) response.writeHead(413, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end('{"code":"PROVIDER_FIXTURE_BODY_TOO_LARGE"}');
  });
  request.on('end', () => {
    const result = providerFixtureResult(request.method, url.pathname, request.headers, providers);
    const body = JSON.stringify(result.body);
    response.writeHead(result.status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
    response.end(body);
  });
});
server.listen(port, '0.0.0.0');
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close());

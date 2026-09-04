import { postgresTlsProxyConfiguration, startPostgresTlsProxy } from './PostgresTlsProxy.js';

const server = await startPostgresTlsProxy(postgresTlsProxyConfiguration());

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    if (stopping) return;
    stopping = true;
    server.close((cause) => {
      if (cause) process.stderr.write('POSTGRES_TLS_PROXY_SHUTDOWN_FAILED\n');
      process.exitCode = cause ? 1 : 0;
    });
  });

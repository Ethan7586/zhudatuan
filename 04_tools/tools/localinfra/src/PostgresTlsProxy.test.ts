import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type LookupFunction } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSecureContext, TLSSocket } from 'node:tls';
import { promisify } from 'node:util';
import { describe, expect, test, vi } from 'vitest';
import { openPostgresTlsConnection, postgresTlsProxyConfiguration } from './PostgresTlsProxy.js';

const valid = {
  ZHUDATUAN_POSTGRES_PROXY_CA_FILE: '/opt/zhudatuan-staging-full/shared/tls/aliyun-rds-ca.pem',
  ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST: 'pgm-example.pg.rds.aliyuncs.com',
  ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_PORT: '5432',
};
const rdsCaCredential = '/run/credentials/zhudatuan-staging-full-postgres-proxy.service/rds-ca-certificate';
const execute = promisify(execFile);

describe('staging PostgreSQL TLS proxy', () => {
  test('pins its loopback listener and accepts a DNS upstream plus isolated CA path', () => {
    expect(postgresTlsProxyConfiguration(valid)).toEqual({
      caFile: valid.ZHUDATUAN_POSTGRES_PROXY_CA_FILE,
      connectTimeoutMs: 5_000,
      localHost: '127.0.0.1',
      localPort: 55_442,
      upstreamHost: valid.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST,
      upstreamPort: 5_432,
    });
  });

  test('requires the proxy-specific systemd credential path in a live process', () => {
    const live = { ...valid, ZHUDATUAN_POSTGRES_PROXY_CA_FILE: rdsCaCredential };
    try {
      for (const [key, value] of Object.entries(live)) vi.stubEnv(key, value);
      expect(postgresTlsProxyConfiguration().caFile).toBe(rdsCaCredential);
      vi.stubEnv('ZHUDATUAN_POSTGRES_PROXY_CA_FILE', valid.ZHUDATUAN_POSTGRES_PROXY_CA_FILE);
      expect(() => postgresTlsProxyConfiguration()).toThrow('POSTGRES_PROXY_CA_FILE_INVALID');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test.each([
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST: '127.0.0.1' }, 'POSTGRES_PROXY_UPSTREAM_HOST_INVALID'],
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST: 'localhost' }, 'POSTGRES_PROXY_UPSTREAM_HOST_INVALID'],
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST: 'production.invalid value' }, 'POSTGRES_PROXY_UPSTREAM_HOST_INVALID'],
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_PORT: '55442' }, 'POSTGRES_PROXY_UPSTREAM_PORT_INVALID'],
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_CA_FILE: '/etc/ssl/certs/ca.pem' }, 'POSTGRES_PROXY_CA_FILE_INVALID'],
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_CA_FILE: '/opt/zhudatuan-staging-full/shared/tls/../../../../etc/ca.pem' }, 'POSTGRES_PROXY_CA_FILE_INVALID'],
    [{ ...valid, ZHUDATUAN_POSTGRES_PROXY_CA_FILE: '/run/credentials/other.service/rds-ca-certificate' }, 'POSTGRES_PROXY_CA_FILE_INVALID'],
  ])('rejects an unsafe boundary', (environment, code) => {
    expect(() => postgresTlsProxyConfiguration(environment)).toThrow(code);
  });

  test('fails closed when PostgreSQL refuses TLS negotiation', async () => {
    const upstream = createServer((socket) => {
      socket.once('data', (request) => {
        expect([...request]).toEqual([0, 0, 0, 8, 4, 210, 22, 47]);
        socket.end('N');
      });
    });
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const address = upstream.address();
    if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_INVALID');
    await expect(
      openPostgresTlsConnection(
        {
          connectTimeoutMs: 1_000,
          upstreamHost: '127.0.0.1',
          upstreamPort: address.port,
        },
        'unused'
      )
    ).rejects.toThrow('POSTGRES_PROXY_UPSTREAM_TLS_REQUIRED');
    await new Promise<void>((resolve, reject) => upstream.close((cause) => (cause ? reject(cause) : resolve())));
  });

  test('verifies CA, hostname, and SNI during PostgreSQL TLS negotiation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zhudatuan-pg-tls.'));
    try {
      const key = join(directory, 'server.key');
      const certificate = join(directory, 'server.crt');
      await execute('openssl', [
        'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '1',
        '-subj', `/CN=${valid.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST}`,
        '-addext', `subjectAltName=DNS:${valid.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST}`,
        '-keyout', key, '-out', certificate,
      ]);
      const ca = await readFile(certificate, 'utf8');
      const secureContext = createSecureContext({ cert: ca, key: await readFile(key, 'utf8') });
      const upstream = createServer((socket) => {
        socket.once('data', (request) => {
          expect([...request]).toEqual([0, 0, 0, 8, 4, 210, 22, 47]);
          socket.write('S', () => {
            const secure = new TLSSocket(socket, { isServer: true, secureContext });
            secure.once('error', () => undefined);
            secure.once('secure', () => secure.end());
          });
        });
      });
      await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
      const address = upstream.address();
      if (address === null || typeof address === 'string') throw new Error('TEST_SERVER_ADDRESS_INVALID');
      const lookup: LookupFunction = (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
        else callback(null, '127.0.0.1', 4);
      };
      const secure = await openPostgresTlsConnection({
        connectTimeoutMs: 2_000,
        lookup,
        upstreamHost: valid.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST,
        upstreamPort: address.port,
      }, ca);
      expect(secure.authorized).toBe(true);
      secure.destroy();
      await expect(openPostgresTlsConnection({
        connectTimeoutMs: 2_000,
        lookup,
        upstreamHost: 'wrong-host.pg.rds.aliyuncs.com',
        upstreamPort: address.port,
      }, ca)).rejects.toThrow();
      await expect(openPostgresTlsConnection({
        connectTimeoutMs: 2_000,
        lookup,
        upstreamHost: valid.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST,
        upstreamPort: address.port,
      }, '')).rejects.toThrow();
      await new Promise<void>((resolve, reject) => upstream.close((cause) => (cause ? reject(cause) : resolve())));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

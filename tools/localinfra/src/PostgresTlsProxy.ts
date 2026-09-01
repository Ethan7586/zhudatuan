import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { connect as connectTcp, createServer, isIP, type LookupFunction, type Server, type Socket } from 'node:net';
import { connect as connectTls, type ConnectionOptions, type TLSSocket } from 'node:tls';

const LOCAL_HOST = '127.0.0.1';
const LOCAL_PORT = 55_442;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const STAGING_RDS_CA_FILE = '/opt/zhudatuan-staging-full/shared/tls/aliyun-rds-ca.pem';
const STAGING_RDS_CA_CREDENTIAL = '/run/credentials/zhudatuan-staging-full-postgres-proxy.service/rds-ca-certificate';
const POSTGRES_SSL_REQUEST = Buffer.from([0, 0, 0, 8, 4, 210, 22, 47]);

export interface PostgresTlsProxyConfiguration {
  readonly caFile: string;
  readonly connectTimeoutMs: number;
  readonly localHost: typeof LOCAL_HOST;
  readonly localPort: typeof LOCAL_PORT;
  readonly upstreamHost: string;
  readonly upstreamPort: number;
}

export interface PostgresTlsTarget {
  readonly connectTimeoutMs: number;
  readonly lookup?: LookupFunction;
  readonly upstreamHost: string;
  readonly upstreamPort: number;
}

export function postgresTlsProxyConfiguration(source: Readonly<Record<string, string | undefined>> = process.env): PostgresTlsProxyConfiguration {
  const upstreamHost = required(source.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_HOST, 'POSTGRES_PROXY_UPSTREAM_HOST_REQUIRED');
  if (!isDnsName(upstreamHost) || upstreamHost === 'localhost' || upstreamHost.endsWith('.local')) {
    throw new Error('POSTGRES_PROXY_UPSTREAM_HOST_INVALID');
  }

  const upstreamPort = integer(source.ZHUDATUAN_POSTGRES_PROXY_UPSTREAM_PORT, 'POSTGRES_PROXY_UPSTREAM_PORT_INVALID');
  if (upstreamPort < 1_024 || upstreamPort > 65_535 || upstreamPort === LOCAL_PORT) {
    throw new Error('POSTGRES_PROXY_UPSTREAM_PORT_INVALID');
  }

  const caFile = required(source.ZHUDATUAN_POSTGRES_PROXY_CA_FILE, 'POSTGRES_PROXY_CA_FILE_REQUIRED');
  const staticValidation = source !== process.env;
  if (!isAbsolute(caFile) || (caFile !== STAGING_RDS_CA_CREDENTIAL && !(staticValidation && caFile === STAGING_RDS_CA_FILE))) {
    throw new Error('POSTGRES_PROXY_CA_FILE_INVALID');
  }

  return Object.freeze({
    caFile,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
    localHost: LOCAL_HOST,
    localPort: LOCAL_PORT,
    upstreamHost,
    upstreamPort,
  });
}

export async function startPostgresTlsProxy(configuration: PostgresTlsProxyConfiguration): Promise<Server> {
  const caMetadata = await lstat(configuration.caFile);
  if (!caMetadata.isFile() || caMetadata.isSymbolicLink()) throw new Error('POSTGRES_PROXY_CA_FILE_UNSAFE');
  const ca = await readFile(configuration.caFile, 'utf8');
  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('POSTGRES_PROXY_CA_INVALID');
  }

  await probeUpstream(configuration, ca);
  const server = createServer({ pauseOnConnect: true }, (client) => {
    void bridge(client, configuration, ca);
  });
  server.on('error', (cause) => {
    process.stderr.write(`POSTGRES_TLS_PROXY_SERVER_ERROR ${safeError(cause)}\n`);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(configuration.localPort, configuration.localHost, () => {
      server.off('error', reject);
      resolve();
    });
  });
  process.stdout.write(`POSTGRES_TLS_PROXY_READY ${configuration.localHost}:${configuration.localPort} upstream=tls-verified\n`);
  return server;
}

export async function openPostgresTlsConnection(configuration: PostgresTlsTarget, ca: string): Promise<TLSSocket> {
  const socket = await openTcp(configuration);
  try {
    await requirePostgresTls(socket, configuration.connectTimeoutMs);
    return await upgradeToVerifiedTls(
      socket,
      {
        ca,
        host: configuration.upstreamHost,
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
        servername: configuration.upstreamHost,
      },
      configuration.connectTimeoutMs
    );
  } catch (cause) {
    socket.destroy();
    throw cause;
  }
}

async function bridge(client: Socket, configuration: PostgresTlsProxyConfiguration, ca: string): Promise<void> {
  try {
    const upstream = await openPostgresTlsConnection(configuration, ca);
    const closeBoth = (): void => {
      client.destroy();
      upstream.destroy();
    };
    client.once('error', closeBoth);
    upstream.once('error', closeBoth);
    client.once('close', () => upstream.destroy());
    upstream.once('close', () => client.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
    client.resume();
  } catch (cause) {
    process.stderr.write(`POSTGRES_TLS_PROXY_CONNECTION_FAILED ${safeError(cause)}\n`);
    client.destroy();
  }
}

async function probeUpstream(configuration: PostgresTlsProxyConfiguration, ca: string): Promise<void> {
  const socket = await openPostgresTlsConnection(configuration, ca);
  socket.destroy();
}

function openTcp(configuration: PostgresTlsTarget): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connectTcp({
      host: configuration.upstreamHost,
      port: configuration.upstreamPort,
      ...(configuration.lookup ? { lookup: configuration.lookup } : {}),
    });
    const timeout = setTimeout(() => fail(new Error('POSTGRES_PROXY_UPSTREAM_TIMEOUT')), configuration.connectTimeoutMs);
    const fail = (cause: Error): void => {
      clearTimeout(timeout);
      socket.destroy();
      reject(cause);
    };
    socket.once('error', fail);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.off('error', fail);
      resolve(socket);
    });
  });
}

function requirePostgresTls(socket: Socket, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => fail(new Error('POSTGRES_PROXY_SSL_RESPONSE_TIMEOUT')), timeoutMs);
    const fail = (cause: Error): void => {
      clearTimeout(timeout);
      cleanup();
      reject(cause);
    };
    const receive = (response: Buffer): void => {
      clearTimeout(timeout);
      cleanup();
      if (response.byteLength !== 1 || response[0] !== 0x53) {
        reject(new Error('POSTGRES_PROXY_UPSTREAM_TLS_REQUIRED'));
        return;
      }
      resolve();
    };
    const cleanup = (): void => {
      socket.off('error', fail);
      socket.off('data', receive);
    };
    socket.once('error', fail);
    socket.once('data', receive);
    socket.write(POSTGRES_SSL_REQUEST);
  });
}

function upgradeToVerifiedTls(socket: Socket, options: ConnectionOptions, timeoutMs: number): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const secure = connectTls({ ...options, socket });
    const timeout = setTimeout(() => fail(new Error('POSTGRES_PROXY_TLS_HANDSHAKE_TIMEOUT')), timeoutMs);
    const fail = (cause: Error): void => {
      clearTimeout(timeout);
      secure.destroy();
      reject(cause);
    };
    secure.once('error', fail);
    secure.once('secureConnect', () => {
      clearTimeout(timeout);
      secure.off('error', fail);
      if (!secure.authorized) {
        fail(new Error('POSTGRES_PROXY_CERTIFICATE_UNAUTHORIZED'));
        return;
      }
      resolve(secure);
    });
  });
}

function required(value: string | undefined, code: string): string {
  if (value === undefined || value.trim() !== value || value.length === 0) throw new Error(code);
  return value;
}

function integer(value: string | undefined, code: string): number {
  if (value === undefined || !/^\d{1,5}$/.test(value)) throw new Error(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(code);
  return parsed;
}

function isDnsName(value: string): boolean {
  return value.length <= 253 && isIP(value) === 0 && value.includes('.') && value.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

function safeError(cause: unknown): string {
  if (!(cause instanceof Error)) return 'UNKNOWN';
  return cause.message.replace(/[^A-Z0-9_.:-]/giu, '_').slice(0, 120);
}

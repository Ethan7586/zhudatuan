import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdtemp, readFile, rm, writeFile, chmod, chown } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const ROOT = '/opt/zhudatuan-staging-full/shared/tls';
const DIRECTORY_CHAIN = Object.freeze([
  Object.freeze({ path: '/opt', private: false }),
  Object.freeze({ path: '/opt/zhudatuan-staging-full', private: false }),
  Object.freeze({ path: '/opt/zhudatuan-staging-full/shared', private: true }),
  Object.freeze({ path: ROOT, private: true }),
]);
const execute = promisify(execFile);

if (process.getuid?.() !== 0) fail('STAGING_TLS_ROOT_REQUIRED');
const directory = process.argv[2] ?? ROOT;
if (directory !== ROOT) fail('STAGING_TLS_DIRECTORY_INVALID');
await requireSafeDirectory(directory);

const targets = {
  ca: join(directory, 'internal-ca.crt'),
  certificate: join(directory, 'internal.crt'),
  key: join(directory, 'internal.key'),
};
for (const path of Object.values(targets)) {
  try {
    await lstat(path);
    fail('STAGING_TLS_TARGET_EXISTS');
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause;
  }
}

const temporary = await mkdtemp(join(tmpdir(), 'zhudatuan-staging-tls.'));
try {
  const caKey = join(temporary, 'ca.key');
  const ca = join(temporary, 'ca.crt');
  const key = join(temporary, 'internal.key');
  const request = join(temporary, 'internal.csr');
  const certificate = join(temporary, 'internal.crt');
  const extensions = join(temporary, 'server.ext');
  await writeFile(extensions, [
    'basicConstraints=critical,CA:FALSE',
    'keyUsage=critical,digitalSignature,keyEncipherment',
    'extendedKeyUsage=serverAuth',
    'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '',
  ].join('\n'), { mode: 0o600 });
  await execute('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-sha256', '-nodes', '-days', '365',
    '-subj', '/CN=Zhudatuan Full Staging Internal CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', caKey, '-out', ca]);
  await execute('openssl', ['req', '-newkey', 'rsa:3072', '-sha256', '-nodes', '-subj', '/CN=127.0.0.1',
    '-keyout', key, '-out', request]);
  await execute('openssl', ['x509', '-req', '-sha256', '-days', '90', '-in', request, '-CA', ca, '-CAkey', caKey,
    '-CAcreateserial', '-extfile', extensions, '-out', certificate]);
  await execute('openssl', ['verify', '-CAfile', ca, certificate]);
  await execute('openssl', ['x509', '-checkend', String(30 * 24 * 60 * 60), '-noout', '-in', certificate]);
  const inspection = (await execute('openssl', ['x509', '-text', '-noout', '-in', certificate])).stdout;
  if (!inspection.includes('CA:FALSE') || !inspection.includes('IP Address:127.0.0.1') || !inspection.includes('DNS:localhost')) {
    fail('STAGING_TLS_CERTIFICATE_CONTRACT_INVALID');
  }
  await Promise.all([
    install(ca, targets.ca),
    install(certificate, targets.certificate),
    install(key, targets.key),
  ]);
  process.stdout.write(`STAGING_INTERNAL_TLS_READY caSha256=${await fingerprint(targets.ca)} certificateSha256=${await fingerprint(targets.certificate)}\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function install(source, destination) {
  const bytes = await readFile(source);
  await writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
  await chown(destination, 0, 0);
  await chmod(destination, 0o600);
}

async function requireSafeDirectory(path) {
  if (path !== ROOT) fail('STAGING_TLS_DIRECTORY_INVALID');
  for (const candidate of DIRECTORY_CHAIN) {
    let metadata;
    try {
      metadata = await lstat(candidate.path);
    } catch (cause) {
      if (cause?.code === 'ENOENT') fail('STAGING_TLS_DIRECTORY_MISSING');
      throw cause;
    }
    const mode = metadata.mode & 0o777;
    const unsafeMode = candidate.private ? mode !== 0o700 : (mode & 0o022) !== 0;
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || metadata.uid !== 0 || metadata.gid !== 0 || unsafeMode) {
      fail('STAGING_TLS_DIRECTORY_UNSAFE');
    }
  }
}

async function fingerprint(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function fail(code) {
  throw new Error(code);
}

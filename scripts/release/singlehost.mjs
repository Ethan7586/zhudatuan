import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { BUNDLED_ENTRY_FILES } from '../lib/CommerceEntries.mjs';

const root = resolve(import.meta.dirname, '../..');
const releaseId = process.argv[2]?.trim();
const version = process.argv[3]?.trim();
if (!releaseId || !/^\d{8}-\d+$/.test(releaseId)) throw new Error('SINGLEHOST_RELEASE_ID_INVALID');
if (!version || !/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/i.test(version)) throw new Error('SINGLEHOST_VERSION_INVALID');

const directoryName = `smartwiston-release-${releaseId}`;
const outputRoot = resolve('/tmp', directoryName);
const archive = `${outputRoot}.tar.gz`;
if (existsSync(outputRoot) || existsSync(archive)) throw new Error('SINGLEHOST_RELEASE_EXISTS');

const clientManifest = JSON.parse(readFileSync(join(root, 'evidence/releases/clientbundles.json'), 'utf8'));
if (clientManifest.version !== version) throw new Error('SINGLEHOST_CLIENT_VERSION_DRIFT');
const clients = ['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'];
if (clientManifest.clients.map(({ id }) => id).join(',') !== clients.join(',')) throw new Error('SINGLEHOST_CLIENT_SET_DRIFT');

mkdirSync(outputRoot, { recursive: false, mode: 0o755 });
for (const client of clients) copyTree(join(root, 'apps', client, 'dist'), join(outputRoot, 'apps', client));
copyTree(join(root, 'database', 'migrations'), join(outputRoot, 'database', 'migrations'));
copyTree(join(root, 'database', 'contracts'), join(outputRoot, 'database', 'contracts'));
copyTree(join(root, 'infrastructure', 'container', 'singlehost'), join(outputRoot, 'deployment'));

const runtimeSource = join(root, 'services', 'commerce', 'dist');
const runtimeTarget = join(outputRoot, 'runtime');
mkdirSync(runtimeTarget, { recursive: true, mode: 0o755 });
const runtime = readdirSync(runtimeSource)
  .filter((name) => /Main\.js$/.test(name))
  .sort();
if (runtime.join(',') !== BUNDLED_ENTRY_FILES.join(',')) throw new Error('SINGLEHOST_RUNTIME_SET_DRIFT');
for (const name of runtime) copyFileSync(join(runtimeSource, name), join(runtimeTarget, name));

const migrations = readdirSync(join(root, 'database', 'migrations'))
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort();
const schemaHead = migrations.at(-1)?.split('_', 1)[0];
if (!schemaHead) throw new Error('SINGLEHOST_SCHEMA_HEAD_MISSING');
const sourceCommit = git(['rev-parse', 'HEAD']).trim();
const release = Object.freeze({
  schema: 'smartwiston.singlehost.release.v1',
  releaseId,
  createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  sourceBranch: 'backend-reconstruction',
  sourceCommit,
  sourcePatchSha256: patchHash(),
  serviceVersion: version,
  clientVersion: version,
  schemaHead,
  domains: [
    'yengze.press',
    'www.yengze.press',
    'api.yengze.press',
    'passport.yengze.press',
    'console.yengze.press',
    'miniapp.yengze.press',
    'store.yengze.press',
    'supplier.yengze.press',
    'img.yengze.press',
    'upload.yengze.press',
    'download.yengze.press',
  ],
});
writeFileSync(join(outputRoot, 'release.json'), `${JSON.stringify(release, null, 2)}\n`, { mode: 0o644 });
writeFileSync(join(outputRoot, 'deployment', 'release.env'), `SERVICE_VERSION=${version}\n`, { mode: 0o644 });

const checksums = files(outputRoot).map((path) => `${fileHash(path)}  ${relative(outputRoot, path).split('\\').join('/')}`);
writeFileSync(join(outputRoot, 'checksums.sha256'), `${checksums.join('\n')}\n`, { mode: 0o644 });
execFileSync('tar', ['--no-xattrs', '-czf', archive, '-C', '/tmp', directoryName], {
  env: { ...process.env, COPYFILE_DISABLE: '1' },
  stdio: 'inherit',
});
process.stdout.write(`${archive}\n${fileHash(archive)}\n${checksums.length} files\n`);

function copyTree(source, target) {
  cpSync(source, target, {
    recursive: true,
    errorOnExist: true,
    filter: (path) => !path.endsWith('.map') && !basename(path).startsWith('.env') && !path.endsWith('.key'),
  });
}

function files(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files(path, result);
    else if (entry.isFile() && !lstatSync(path).isSymbolicLink() && basename(path) !== 'checksums.sha256') result.push(path);
    else throw new Error(`SINGLEHOST_SPECIAL_FILE_FORBIDDEN:${relative(outputRoot, path)}`);
  }
  return result;
}

function patchHash() {
  const digest = createHash('sha256');
  digest.update(git(['diff', '--binary', 'HEAD']));
  for (const path of git(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean).sort()) {
    digest.update(path);
    digest.update('\0');
    digest.update(readFileSync(join(root, path)));
    digest.update('\0');
  }
  return digest.digest('hex');
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function git(arguments_) {
  return execFileSync('git', arguments_, { cwd: root, encoding: 'utf8' });
}

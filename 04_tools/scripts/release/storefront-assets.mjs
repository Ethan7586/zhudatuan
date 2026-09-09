import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { link, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const STOREFRONT_ASSET_CACHE_SECONDS = 31_536_000;
const MANIFEST_SCHEMA = 'storefront.asset-pool.v1';

export async function mergeStorefrontAssetPool({ poolRoot, assetRoots }) {
  const pool = absoluteDirectory(poolRoot, 'STOREFRONT_ASSET_POOL_INVALID');
  const roots = [...new Set(assetRoots.map((root) => absoluteDirectory(root, 'STOREFRONT_ASSET_ROOT_INVALID')))];
  if (roots.length === 0) throw new Error('STOREFRONT_ASSET_ROOT_MISSING');

  const objectRoot = join(pool, 'objects');
  const lockFile = join(pool, '.merge.lock');
  const manifestFile = join(pool, 'manifest.json');
  await mkdir(objectRoot, { recursive: true, mode: 0o755 });
  const lock = await open(lockFile, 'wx');

  let createdObjects = 0;
  let linkedFiles = 0;
  try {
    const manifest = await readManifest(manifestFile);
    const assets = new Map(Object.entries(manifest.assets));

    for (const root of roots) {
      await requireDirectory(root);
      for (const file of await regularFiles(root)) {
        const name = assetName(root, file);
        const digest = await digestFile(file);
        const existing = assets.get(name);
        if (existing !== undefined && existing !== digest) throw new Error(`STOREFRONT_ASSET_NAME_COLLISION:${name}`);
        assets.set(name, digest);
        if (await ensureObject(objectRoot, digest, file)) createdObjects += 1;
      }
    }

    const orderedAssets = Object.fromEntries([...assets].sort(([left], [right]) => left.localeCompare(right)));
    for (const root of roots) {
      for (const [name, digest] of Object.entries(orderedAssets)) {
        const target = join(root, name);
        const object = objectPath(objectRoot, digest);
        await mkdir(dirname(target), { recursive: true, mode: 0o755 });
        if (await replaceWithObjectLink(target, object, digest)) linkedFiles += 1;
      }
    }

    await atomicWrite(manifestFile, `${JSON.stringify({
      schema: MANIFEST_SCHEMA,
      cacheSeconds: STOREFRONT_ASSET_CACHE_SECONDS,
      assets: orderedAssets,
    }, null, 2)}\n`);

    return Object.freeze({
      assetCount: assets.size,
      createdObjects,
      linkedFiles,
      releaseAssetRoots: roots.length,
      cacheSeconds: STOREFRONT_ASSET_CACHE_SECONDS,
    });
  } finally {
    await lock.close();
    await rm(lockFile, { force: true });
  }
}

async function readManifest(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (value?.schema !== MANIFEST_SCHEMA || value.cacheSeconds !== STOREFRONT_ASSET_CACHE_SECONDS
      || value.assets === null || typeof value.assets !== 'object' || Array.isArray(value.assets)) {
      throw new Error('STOREFRONT_ASSET_MANIFEST_INVALID');
    }
    for (const [name, digest] of Object.entries(value.assets)) {
      if (assetName('.', name) !== name || !/^[a-f0-9]{64}$/u.test(digest)) throw new Error('STOREFRONT_ASSET_MANIFEST_INVALID');
    }
    return value;
  } catch (cause) {
    if (cause?.code === 'ENOENT') return { schema: MANIFEST_SCHEMA, cacheSeconds: STOREFRONT_ASSET_CACHE_SECONDS, assets: {} };
    throw cause;
  }
}

async function ensureObject(objectRoot, digest, source) {
  const target = objectPath(objectRoot, digest);
  try {
    const information = await lstat(target);
    if (!information.isFile() || information.isSymbolicLink() || await digestFile(target) !== digest) {
      throw new Error(`STOREFRONT_ASSET_OBJECT_INVALID:${digest}`);
    }
    return false;
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause;
  }

  await mkdir(dirname(target), { recursive: true, mode: 0o755 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, await readFile(source), { flag: 'wx', mode: 0o644 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return true;
}

async function replaceWithObjectLink(target, object, digest) {
  try {
    const information = await lstat(target);
    if (!information.isFile() || information.isSymbolicLink()) throw new Error(`STOREFRONT_ASSET_TARGET_INVALID:${target}`);
    if (information.ino === (await lstat(object)).ino) return false;
    if (await digestFile(target) !== digest) throw new Error(`STOREFRONT_ASSET_TARGET_CONFLICT:${target}`);
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause;
  }

  const temporary = `${target}.${process.pid}.${randomUUID()}.link`;
  try {
    await link(object, temporary);
    await rename(temporary, target);
  } catch (cause) {
    if (cause?.code === 'EXDEV') throw new Error('STOREFRONT_ASSET_POOL_DIFFERENT_FILESYSTEM');
    throw cause;
  } finally {
    await rm(temporary, { force: true });
  }
  return true;
}

async function regularFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory)).sort()) {
      const file = join(directory, entry);
      const information = await lstat(file);
      if (information.isSymbolicLink()) throw new Error(`STOREFRONT_ASSET_SYMLINK_FORBIDDEN:${relative(root, file)}`);
      if (information.isDirectory()) await visit(file);
      else if (information.isFile()) files.push(file);
      else throw new Error(`STOREFRONT_ASSET_TYPE_INVALID:${relative(root, file)}`);
    }
  }
  await visit(root);
  return files;
}

function assetName(root, file) {
  const name = relative(resolve(root), resolve(root, file)).split(sep).join('/');
  if (!name || name.startsWith('../') || name.includes('/../') || name === '..') throw new Error('STOREFRONT_ASSET_NAME_INVALID');
  return name;
}

function objectPath(root, digest) {
  return join(root, digest.slice(0, 2), digest);
}

async function requireDirectory(directory) {
  const information = await lstat(directory);
  if (!information.isDirectory() || information.isSymbolicLink()) throw new Error(`STOREFRONT_ASSET_ROOT_INVALID:${directory}`);
}

function absoluteDirectory(value, code) {
  if (typeof value !== 'string' || !isAbsolute(value) || value === '/') throw new Error(code);
  return resolve(value);
}

async function atomicWrite(target, source) {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, source, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

function digestFile(file) {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolveDigest(hash.digest('hex')));
  });
}

function argumentsFrom(argv) {
  const result = { poolRoot: '', assetRoots: [] };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`STOREFRONT_ASSET_ARGUMENT_MISSING:${flag ?? 'unknown'}`);
    if (flag === '--pool') result.poolRoot = value;
    else if (flag === '--assets') result.assetRoots.push(value);
    else throw new Error(`STOREFRONT_ASSET_ARGUMENT_UNKNOWN:${flag}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await mergeStorefrontAssetPool(argumentsFrom(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

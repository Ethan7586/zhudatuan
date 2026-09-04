import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rm, chmod, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const execute = promisify(execFile);
const directory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(directory, '../../../../..');
const git = '/usr/bin/git';
const tar = '/usr/bin/tar';
const options = argumentsFrom(process.argv.slice(2));
const toolchain = await resolveBuildToolchain();

await requireNewTarget(options.output, 'RELEASE_OUTPUT');
await requireNewTarget(options.archive, 'RELEASE_ARCHIVE');
const status = (await execute(git, ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repository })).stdout;
if (status.trim()) fail('RELEASE_WORKTREE_NOT_CLEAN');
const commit = (await execute(git, ['rev-parse', 'HEAD'], { cwd: repository })).stdout.trim();
if (!/^[a-f0-9]{40}$/u.test(commit)) fail('RELEASE_COMMIT_INVALID');
const build = await buildRelease(toolchain);
const postBuildStatus = (await execute(git, ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repository })).stdout;
if (postBuildStatus.trim()) fail('RELEASE_BUILD_MUTATED_TRACKED_SOURCE');

let createdOutput = false;
try {
  const artifacts = parseYaml(await readFile(join(directory, 'artifacts.yml'), 'utf8'));
  for (const artifact of artifacts.releaseArtifacts) {
    if (artifact.requiredMarker === undefined) continue;
    const source = await readFile(resolve(repository, artifact.artifact), 'utf8');
    if (!source.includes(artifact.requiredMarker)) fail(`RELEASE_ARTIFACT_MARKER_MISSING:${artifact.id}`);
  }
  const sources = [...new Set([
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/artifacts.yml',
    '02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/delivery.yml',
    ...artifacts.releaseArtifacts.map(({ artifact }) => artifact),
    ...artifacts.deploymentArtifacts,
  ])].sort();
  await mkdir(options.output, { recursive: false, mode: 0o755 });
  createdOutput = true;
  for (const source of sources) await copyArtifact(source);

  const copied = await regularFiles(options.output);
  const manifest = Object.freeze({
    schema: 'zhudatuan.staging.release.v2',
    commit,
    treeState: 'clean',
    generatedAt: new Date().toISOString(),
    fileCount: copied.length + 1,
    build,
  });
  const manifestFile = join(options.output, '.zhudatuan-staging-release.json');
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
  const inventoryFiles = [...copied, manifestFile].sort((left, right) => relative(options.output, left).localeCompare(relative(options.output, right)));
  const inventoryLines = [];
  for (const file of inventoryFiles) inventoryLines.push(`${await digestFile(file)}  ${relative(options.output, file)}`);
  const inventorySource = `${inventoryLines.join('\n')}\n`;
  await writeFile(join(options.output, '.zhudatuan-staging-inventory.sha256'), inventorySource,
    { encoding: 'utf8', flag: 'wx', mode: 0o644 });

  await mkdir(dirname(options.archive), { recursive: true, mode: 0o755 });
  await execute(tar, ['-czf', options.archive, '-C', options.output, '.']);
  const archiveInformation = await lstat(options.archive);
  if (!archiveInformation.isFile() || archiveInformation.isSymbolicLink()) fail('RELEASE_ARCHIVE_INVALID');
  process.stdout.write(`${JSON.stringify({
    schema: manifest.schema,
    commit,
    releaseDirectory: options.output,
    archive: options.archive,
    archiveSha256: await digestFile(options.archive),
    inventorySha256: digest(inventorySource),
    fileCount: inventoryLines.length,
  })}\n`);
} catch (cause) {
  if (createdOutput) await rm(options.output, { recursive: true, force: true });
  await rm(options.archive, { force: true });
  throw cause;
}

async function buildRelease(buildToolchain) {
  const hosts = Object.freeze({
    accounts: process.env.ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST,
    console: process.env.ZHUDATUAN_STAGING_FULL_CONSOLE_HOST,
    api: process.env.ZHUDATUAN_STAGING_FULL_API_HOST,
  });
  if (!Object.values(hosts).every(publicStagingHost) || new Set(Object.values(hosts)).size !== 3) {
    fail('RELEASE_PUBLIC_STAGING_HOSTS_INVALID');
  }
  const commands = ['npm run build:auth', 'npm run build:console', 'npm run build:commerce'];
  const solutionOrigin = 'https://disabled.full.staging.example.invalid';
  const common = {
    PATH: `${dirname(buildToolchain.node)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    CI: '1',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
    npm_config_userconfig: '/dev/null',
    VITE_CLIENT_VERSION: '0.0.0-staging',
  };
  await execute(buildToolchain.node, [buildToolchain.npmCli, 'run', 'build:auth'], { cwd: repository, maxBuffer: 10 * 1024 * 1024, env: {
    ...common,
    VITE_API_BASE_URL: `https://${hosts.api}`,
    VITE_AUTH_STAGING_API_ORIGIN: `https://${hosts.api}`,
    VITE_ADMIN_ORIGIN: `https://${hosts.console}`,
    VITE_AUTH_STAGING_ADMIN_ORIGIN: `https://${hosts.console}`,
    VITE_STOREFRONT_ORIGIN: 'https://disabled.full.staging.example.invalid',
    VITE_AUTH_STAGING_STOREFRONT_ORIGIN: 'https://disabled.full.staging.example.invalid',
  } });
  await execute(buildToolchain.node, [buildToolchain.npmCli, 'run', 'build:console'], { cwd: repository, maxBuffer: 10 * 1024 * 1024, env: {
    ...common,
    VITE_API_BASE_URL: `https://${hosts.api}`,
    VITE_AUTH_BASE_URL: `https://${hosts.accounts}`,
    VITE_ZHUDIAN_SOLUTION_ORIGIN: solutionOrigin,
  } });
  await execute(buildToolchain.node, [buildToolchain.npmCli, 'run', 'build:commerce'], { cwd: repository, maxBuffer: 10 * 1024 * 1024, env: common });
  await assertBuildMarkers(hosts, solutionOrigin);
  return Object.freeze({ commands, hosts, lockfileSha256: await digestFile(join(repository, 'package-lock.json')),
    nodeVersion: process.version, nodeBinarySha256: buildToolchain.nodeBinarySha256,
    npmCliSha256: buildToolchain.npmCliSha256, solutionOrigin });
}

async function resolveBuildToolchain() {
  const node = await realpath(process.execPath);
  const nodeInformation = await lstat(node);
  if (!nodeInformation.isFile() || nodeInformation.isSymbolicLink() || (nodeInformation.mode & 0o022) !== 0) {
    fail('RELEASE_NODE_BINARY_INVALID');
  }
  const candidates = [
    resolve(dirname(node), '../lib/node_modules/npm/bin/npm-cli.js'),
    '/usr/share/nodejs/npm/bin/npm-cli.js',
  ];
  for (const candidate of candidates) {
    try {
      const npmCli = await realpath(candidate);
      const information = await lstat(npmCli);
      if (!information.isFile() || information.isSymbolicLink() || (information.mode & 0o022) !== 0) continue;
      return Object.freeze({ node, npmCli, nodeBinarySha256: await digestFile(node), npmCliSha256: await digestFile(npmCli) });
    } catch (cause) {
      if (cause?.code !== 'ENOENT') throw cause;
    }
  }
  fail('RELEASE_NPM_CLI_NOT_FOUND');
}

async function assertBuildMarkers(hosts, solutionOrigin) {
  const contracts = [
    [resolve(repository, '01_core_hexin/apps/auth-web/dist'), [`https://${hosts.api}`, `https://${hosts.console}`]],
    [resolve(repository, '01_core_hexin/apps/console/dist'), [`https://${hosts.api}`, `https://${hosts.accounts}`, solutionOrigin]],
  ];
  for (const [root, markers] of contracts) {
    const found = new Set();
    for (const file of await regularFiles(root)) {
      const source = await readFile(file);
      for (const marker of markers) if (source.includes(Buffer.from(marker))) found.add(marker);
    }
    if (found.size !== markers.length) fail(`RELEASE_BUILD_MARKER_MISSING:${relative(repository, root)}`);
  }
}

async function copyArtifact(source) {
  if (typeof source !== 'string' || source.startsWith('/') || source.split('/').some((part) => part === '..' || part === '.')) {
    fail('RELEASE_ARTIFACT_PATH_INVALID');
  }
  const input = resolve(repository, source);
  if (!input.startsWith(`${repository}/`)) fail('RELEASE_ARTIFACT_PATH_INVALID');
  const output = resolve(options.output, source);
  const information = await lstat(input);
  if (information.isSymbolicLink()) fail(`RELEASE_ARTIFACT_SYMLINK_FORBIDDEN:${source}`);
  if (information.isDirectory()) {
    await mkdir(output, { recursive: true, mode: 0o755 });
    for (const entry of (await readdir(input)).sort()) await copyArtifact(`${source}/${entry}`);
    return;
  }
  if (!information.isFile()) fail(`RELEASE_ARTIFACT_TYPE_INVALID:${source}`);
  await mkdir(dirname(output), { recursive: true, mode: 0o755 });
  await copyFile(input, output, 1);
  await chmod(output, information.mode & 0o111 ? 0o755 : 0o644);
}

async function regularFiles(root) {
  const files = [];
  async function visit(directoryPath) {
    for (const entry of (await readdir(directoryPath)).sort()) {
      const file = join(directoryPath, entry);
      const information = await lstat(file);
      if (information.isSymbolicLink()) fail(`RELEASE_OUTPUT_SYMLINK_FORBIDDEN:${relative(root, file)}`);
      if (information.isDirectory()) await visit(file);
      else if (information.isFile()) files.push(file);
      else fail(`RELEASE_OUTPUT_TYPE_INVALID:${relative(root, file)}`);
    }
  }
  await visit(root);
  return files;
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
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

function publicStagingHost(value) {
  return typeof value === 'string' && value.length <= 253 && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(value)
    && value.includes('.') && /(?:^|\.)staging(?:\.|$)/u.test(value)
    && !['accounts.zhudatuan.com', 'console.zhudatuan.com', 'api.zhudatuan.com'].includes(value);
}

async function requireNewTarget(value, code) {
  if (!isAbsolute(value) || value === '/' || basename(value).length < 3) fail(`${code}_INVALID`);
  try {
    await lstat(value);
    fail(`${code}_EXISTS`);
  } catch (cause) {
    if (cause?.code !== 'ENOENT') throw cause;
  }
}

function argumentsFrom(values) {
  let output;
  let archive;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--output') output = values[++index];
    else if (values[index] === '--archive') archive = values[++index];
    else fail('RELEASE_ARGUMENT_INVALID');
  }
  if (typeof output !== 'string' || typeof archive !== 'string' || output === archive) fail('RELEASE_ARGUMENT_INVALID');
  const normalizedOutput = resolve(output);
  const normalizedArchive = resolve(archive);
  if (normalizedArchive.startsWith(`${normalizedOutput}/`) || normalizedOutput.startsWith(`${normalizedArchive}/`)) {
    fail('RELEASE_TARGET_OVERLAP');
  }
  return Object.freeze({ output: normalizedOutput, archive: normalizedArchive });
}

function fail(code) {
  throw new Error(code);
}

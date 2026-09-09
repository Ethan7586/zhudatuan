import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { DeliveryError, invariant } from './errors.mjs';
import { normalizeRepoPath } from './glob.mjs';

const execFileAsync = promisify(execFile);

export async function resolveGitRef(projectRoot, reference) {
  const output = await git(projectRoot, ['rev-parse', '--verify', `${reference}^{commit}`]);
  return output.trim();
}

export async function currentHead(projectRoot) {
  return resolveGitRef(projectRoot, 'HEAD');
}

export async function changedFiles(projectRoot, fromRef, toRef, explicitFiles = []) {
  if (explicitFiles.length > 0) {
    return explicitFiles.map((path) => Object.freeze({ status: 'M', path: normalizeRepoPath(path), sourcePath: null }));
  }
  const { stdout } = await execFileAsync('git', ['diff', '--name-status', '-z', '--find-renames', fromRef, toRef, '--'], {
    cwd: projectRoot,
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  });
  return parseNameStatus(stdout);
}

export async function assertBuildRefIsCheckedOut(projectRoot, toSha) {
  const head = await currentHead(projectRoot);
  invariant(head === toSha, 'BUILD_REF_NOT_CHECKED_OUT', 'Build once requires the target commit to be checked out', { head, toSha });
}

export async function assertWorktreeClean(projectRoot) {
  const status = await git(projectRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  invariant(status.trim() === '', 'WORKTREE_NOT_CLEAN', 'Installation requires a clean committed worktree', {
    paths: status.trimEnd().split('\n').filter(Boolean).slice(0, 20),
  });
}

export async function git(projectRoot, args) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    throw new DeliveryError('GIT_COMMAND_FAILED', `git ${args.join(' ')} failed`, {
      stderr: String(error?.stderr ?? '').trim(),
      exitCode: error?.code,
    });
  }
}

export function parseNameStatus(buffer) {
  const tokens = buffer.toString('utf8').split('\0');
  if (tokens.at(-1) === '') tokens.pop();
  const changes = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    invariant(Boolean(status), 'GIT_DIFF_PARSE_FAILED', 'Missing git diff status');
    if (status.startsWith('R') || status.startsWith('C')) {
      const sourcePath = tokens[index++];
      const path = tokens[index++];
      invariant(Boolean(sourcePath && path), 'GIT_DIFF_PARSE_FAILED', `Missing paths for ${status}`);
      changes.push(Object.freeze({ status, sourcePath: normalizeRepoPath(sourcePath), path: normalizeRepoPath(path) }));
    } else {
      const path = tokens[index++];
      invariant(Boolean(path), 'GIT_DIFF_PARSE_FAILED', `Missing path for ${status}`);
      changes.push(Object.freeze({ status, sourcePath: null, path: normalizeRepoPath(path) }));
    }
  }
  return changes;
}

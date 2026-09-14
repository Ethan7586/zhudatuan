import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export class AutoNodeActivationCliExecutor {
  constructor({
    stateRoot,
    providerStateRoot,
    activationCli = fileURLToPath(new URL('./autonode-activate-runtime.mjs', import.meta.url)),
    runner = runCommand,
  }) {
    this.stateRoot = resolve(requiredText(stateRoot, 'stateRoot'));
    this.providerStateRoot = resolve(requiredText(providerStateRoot, 'providerStateRoot'));
    this.activationCli = resolve(requiredText(activationCli, 'activationCli'));
    this.runner = runner;
  }

  async plan(request) {
    return await this.#execute('plan', request);
  }

  async apply(request, approvedPlanDigest) {
    return await this.#execute('apply', request, requiredText(approvedPlanDigest, 'approvedPlanDigest'));
  }

  async #execute(command, request, approvedPlanDigest) {
    await mkdir(this.stateRoot, { recursive: true });
    const temporary = await mkdtemp(join(this.stateRoot, '.request-'));
    const requestFile = join(temporary, 'activation-request.json');
    await writeFile(requestFile, `${JSON.stringify(request, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    try {
      const args = [
        this.activationCli,
        command,
        '--state-root', this.stateRoot,
        '--provider-state-root', this.providerStateRoot,
        '--request', requestFile,
        ...(approvedPlanDigest === undefined ? [] : ['--approved-plan-digest', approvedPlanDigest]),
      ];
      const output = await this.runner(process.execPath, args, { cwd: dirname(this.activationCli) });
      try {
        return JSON.parse(output);
      } catch {
        throw new Error(`AUTONODE_TASK_EXECUTOR_OUTPUT_INVALID:${command}`);
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}

async function runCommand(command, args, options) {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const collect = (target, chunk) => {
      const next = target + chunk.toString('utf8');
      if (Buffer.byteLength(next) > MAX_OUTPUT_BYTES) {
        child.kill('SIGKILL');
        throw new Error('AUTONODE_TASK_EXECUTOR_OUTPUT_TOO_LARGE');
      }
      return next;
    };
    child.stdout.on('data', (chunk) => {
      try { stdout = collect(stdout, chunk); } catch (cause) { rejectPromise(cause); }
    });
    child.stderr.on('data', (chunk) => {
      try { stderr = collect(stderr, chunk); } catch (cause) { rejectPromise(cause); }
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) resolvePromise(stdout.trim());
      else rejectPromise(new Error(`AUTONODE_TASK_EXECUTOR_FAILED:${code ?? signal}:${stderr.trim().slice(-1000)}`));
    });
  });
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`AUTONODE_TASK_EXECUTOR_FIELD_INVALID:${name}`);
  return value.trim();
}

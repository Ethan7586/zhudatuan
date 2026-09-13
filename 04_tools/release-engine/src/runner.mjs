import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { DeliveryError } from './errors.mjs';

export async function runCommand(spec, context) {
  const argv = expandArgv(spec.argv, context);
  const cwd = expandText(spec.cwd ?? context.projectRoot, context);
  const timeoutMs = spec.timeoutMs ?? 10 * 60_000;
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const output = [];
  let timedOut = false;
  const result = await new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      cwd,
      env: { ...process.env, ...context.environment, ...(spec.environment ?? {}) },
      shell: false,
      stdio: [spec.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    if (spec.input !== undefined) child.stdin.end(spec.input);
    child.stdout.on('data', (chunk) => output.push(chunk));
    child.stderr.on('data', (chunk) => output.push(chunk));
    child.on('error', reject);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2_000).unref();
    }, timeoutMs);
    child.on('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal });
    });
  });
  const durationMs = Math.round(performance.now() - started);
  const log = Buffer.concat(output).toString('utf8');
  if (context.logPath) {
    await mkdir(dirname(context.logPath), { recursive: true });
    await writeFile(context.logPath, log);
  }
  if (timedOut || result.exitCode !== 0) {
    throw new DeliveryError(timedOut ? 'COMMAND_TIMEOUT' : 'COMMAND_FAILED', `${spec.name} failed`, {
      argv,
      cwd,
      exitCode: result.exitCode,
      signal: result.signal,
      timeoutMs,
      outputTail: log.slice(-4_000),
    });
  }
  return { name: spec.name, argv, cwd, startedAt, durationMs, exitCode: result.exitCode, ...(spec.input === undefined ? {} : { inputBytes: Buffer.byteLength(spec.input) }), output: log, outputTail: log.slice(-2_000) };
}

export function expandArgv(argv, context) {
  const result = [];
  for (const argument of argv) {
    if (argument === '{{changedFiles}}') {
      result.push(...context.changedFiles);
    } else {
      result.push(expandText(argument, context));
    }
  }
  return result;
}

export function expandText(value, context) {
  return String(value).replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g, (_, key) => {
    if (!(key in context)) throw new DeliveryError('COMMAND_TEMPLATE_UNKNOWN', `Unknown command template ${key}`);
    return String(context[key]);
  });
}

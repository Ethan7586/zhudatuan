#!/usr/bin/env node
import { stat, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const GATEWAY = '/usr/local/sbin/ai-delivery-candidate';
const AGENT = '/usr/local/lib/ai-delivery/agent.mjs';
const INCOMING = '/opt/ai-delivery/incoming/';
const MAX_UPLOAD_BYTES = 160 * 1024 * 1024;
const CANDIDATE_ACTIONS = new Set(['lookup', 'reuse', 'stage', 'status', 'verify']);
const ALLOWED_FLAGS = new Set([
  '--project', '--node', '--target', '--source-sha', '--sha256',
  '--tree-digest', '--manifest-digest', '--archive', '--manifest',
  '--pointer-root', '--service',
]);

export function parseOriginalCommand(original) {
  const command = String(original ?? '').trim();
  const scp = command.match(/^scp -t(?: --)? (\/opt\/ai-delivery\/incoming\/[A-Za-z0-9_.-]+)$/);
  if (scp) return { kind: 'scp', path: scp[1] };
  if (!/^[A-Za-z0-9_./:@+ =-]+$/.test(command)) throw denied('COMMAND_CHARACTERS_DENIED');
  const tokens = command.split(/ +/);
  if (tokens.shift() !== GATEWAY) throw denied('COMMAND_ENTRYPOINT_DENIED');
  validateAgentArguments(tokens);
  return { kind: 'agent', args: tokens };
}

export function validateAgentArguments(args) {
  const [action, ...tokens] = args;
  if (!CANDIDATE_ACTIONS.has(action)) throw denied('PRODUCTION_ACTION_DENIED', { action });
  if (tokens.length % 2 !== 0) throw denied('ARGUMENT_PAIR_REQUIRED');
  const values = new Map();
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!ALLOWED_FLAGS.has(flag) || values.has(flag)) throw denied('ARGUMENT_DENIED', { flag });
    if (!/^[A-Za-z0-9_./:@+-]+$/.test(value)) throw denied('ARGUMENT_VALUE_DENIED', { flag });
    values.set(flag, value);
  }
  if (values.get('--project') !== 'zdt-next') throw denied('PROJECT_DENIED');
  for (const flag of ['--node', '--target']) if (!values.has(flag)) throw denied('SCOPE_REQUIRED', { flag });
  if (action === 'lookup' || action === 'reuse') {
    for (const flag of ['--source-sha', '--sha256', '--tree-digest', '--manifest-digest']) {
      if (!values.has(flag)) throw denied('ARTIFACT_IDENTITY_REQUIRED', { flag });
    }
  }
  if (action === 'stage') {
    for (const flag of ['--archive', '--manifest', '--sha256', '--tree-digest']) {
      if (!values.has(flag)) throw denied('STAGE_ARGUMENT_REQUIRED', { flag });
    }
    for (const flag of ['--archive', '--manifest']) {
      if (!values.get(flag).startsWith(INCOMING)) throw denied('INCOMING_PATH_REQUIRED', { flag });
    }
  }
  return { action, values };
}

async function main() {
  if (process.getuid?.() === 0 && process.argv[2] === '--agent') {
    const args = process.argv.slice(3);
    validateAgentArguments(args);
    process.exitCode = await run(AGENT, args);
    return;
  }
  const request = parseOriginalCommand(process.env.SSH_ORIGINAL_COMMAND);
  if (request.kind === 'scp') {
    process.exitCode = await run('/usr/bin/scp', ['-t', request.path]);
    if (process.exitCode === 0) {
      const uploaded = await stat(request.path);
      if (!uploaded.isFile() || uploaded.size > MAX_UPLOAD_BYTES) {
        await rm(request.path, { force: true });
        throw denied('UPLOAD_SIZE_DENIED', { bytes: uploaded.size, maxBytes: MAX_UPLOAD_BYTES });
      }
    }
    return;
  }
  process.exitCode = await run('/usr/bin/sudo', ['-n', '--', GATEWAY, '--agent', ...request.args]);
}

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { PATH: '/usr/sbin:/usr/bin:/sbin:/bin' } });
    child.once('error', reject);
    child.once('exit', (code, signal) => signal ? reject(denied('CHILD_SIGNAL', { signal })) : resolveRun(code ?? 1));
  });
}

function denied(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code: error.code ?? 'CANDIDATE_GATEWAY_FAILED', details: error.details ?? {} } })}\n`);
    process.exitCode = 1;
  });
}

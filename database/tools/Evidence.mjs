import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parse } from 'yaml';

export async function loadYaml(path) {
  return parse(await readFile(path, 'utf8'));
}

export async function digestFile(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export function businessNumber(value = 'unavailable') {
  return `EV${createHash('sha256').update(value).digest('hex').slice(0, 16).toUpperCase()}`;
}

export function redact(value) {
  return String(value)
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[DATABASE_URL]')
    .replace(/(?:secret|token|password|private[_-]?key|ciphertext)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/[0-9a-f]{32,}/gi, '[HASH]')
    .slice(0, 1000);
}

export function emitEvidence(evidence, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
  if (exitCode !== 0) process.exitCode = exitCode;
}

export function requestId() {
  return randomUUID();
}

export async function runNode(root, script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: root,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runCommand } from '../src/runner.mjs';

test('a timed-out command terminates its descendant processes', { skip: process.platform === 'win32' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-command-'));
  const pidPath = join(directory, 'descendant.pid');
  const signalPath = join(directory, 'descendant-terminated');
  const descendant = `process.on('SIGTERM', () => { require('node:fs').writeFileSync(${JSON.stringify(signalPath)}, 'yes'); process.exit(0); }); setInterval(() => {}, 1000);`;
  const parent = `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'ignore' }); writeFileSync(${JSON.stringify(pidPath)}, String(child.pid)); setInterval(() => {}, 1000);`;
  try {
    await assert.rejects(
      runCommand({ name: 'timeout-with-descendant', argv: [process.execPath, '-e', parent], timeoutMs: 500 }, { projectRoot: directory, environment: {}, changedFiles: [] }),
      (error) => error.code === 'COMMAND_TIMEOUT',
    );
    assert.ok(existsSync(pidPath), 'the command started its descendant');
    for (let attempt = 0; attempt < 25 && !existsSync(signalPath); attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readFileSync(signalPath, 'utf8'), 'yes');
  } finally {
    if (existsSync(pidPath)) {
      try { process.kill(Number(readFileSync(pidPath, 'utf8')), 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a timed-out command waits for a descendant that ignores SIGTERM to be killed', { skip: process.platform === 'win32' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-command-'));
  const pidPath = join(directory, 'descendant.pid');
  const heartbeatPath = join(directory, 'descendant-heartbeat');
  const descendant = `const fs = require('node:fs'); process.on('SIGTERM', () => {}); setInterval(() => fs.writeFileSync(${JSON.stringify(heartbeatPath)}, String(Date.now())), 30);`;
  const parent = `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'ignore' }); writeFileSync(${JSON.stringify(pidPath)}, String(child.pid)); setInterval(() => {}, 1000);`;
  try {
    const started = performance.now();
    await assert.rejects(
      runCommand({ name: 'timeout-with-stubborn-descendant', argv: [process.execPath, '-e', parent], timeoutMs: 500 }, { projectRoot: directory, environment: {}, changedFiles: [] }),
      (error) => error.code === 'COMMAND_TIMEOUT',
    );
    assert.ok(performance.now() - started >= 2_400, 'the command waits for the SIGKILL escalation');
    const lastHeartbeat = readFileSync(heartbeatPath, 'utf8');
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.equal(readFileSync(heartbeatPath, 'utf8'), lastHeartbeat, 'the descendant stopped before the next command');
  } finally {
    if (existsSync(pidPath)) {
      try { process.kill(Number(readFileSync(pidPath, 'utf8')), 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

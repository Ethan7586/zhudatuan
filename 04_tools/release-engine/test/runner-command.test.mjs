import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { runCommand } from '../src/runner.mjs';

test('terminating the Runner also terminates the active command process group', { skip: process.platform === 'win32' }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'runner-command-'));
  const pidPath = join(directory, 'descendant.pid');
  const readyPath = join(directory, 'descendant-ready');
  const signalPath = join(directory, 'descendant-terminated');
  const descendant = `const fs = require('node:fs'); process.on('SIGTERM', () => { fs.writeFileSync(${JSON.stringify(signalPath)}, 'yes'); process.exit(0); }); fs.writeFileSync(${JSON.stringify(readyPath)}, 'yes'); setInterval(() => {}, 1000);`;
  const command = `const { spawn } = require('node:child_process'); const { writeFileSync } = require('node:fs'); const child = spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'ignore' }); writeFileSync(${JSON.stringify(pidPath)}, String(child.pid)); setInterval(() => {}, 1000);`;
  const runnerModule = new URL('../src/runner.mjs', import.meta.url).href;
  const controller = `const { runCommand } = await import(${JSON.stringify(runnerModule)}); try { await runCommand({ name: 'interrupted-command', argv: [process.execPath, '-e', ${JSON.stringify(command)}], timeoutMs: 10000 }, { projectRoot: ${JSON.stringify(directory)}, environment: {}, changedFiles: [] }); } catch (error) { process.exitCode = error.code === 'COMMAND_INTERRUPTED' ? 143 : 1; }`;
  const runner = spawn(process.execPath, ['--input-type=module', '-e', controller], { stdio: 'ignore' });
  try {
    for (let attempt = 0; attempt < 100 && !existsSync(readyPath); attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(existsSync(readyPath), 'the descendant installed its signal handler');
    assert.ok(existsSync(pidPath), 'the command started its descendant');
    const exited = new Promise((resolve) => runner.once('exit', resolve));
    runner.kill('SIGTERM');
    await exited;
    for (let attempt = 0; attempt < 25 && !existsSync(signalPath); attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(readFileSync(signalPath, 'utf8'), 'yes');
  } finally {
    if (runner.exitCode === null) runner.kill('SIGKILL');
    if (existsSync(pidPath)) {
      try { process.kill(Number(readFileSync(pidPath, 'utf8')), 'SIGKILL'); } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

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

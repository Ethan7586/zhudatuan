import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import { buildRelease } from '../src/build-core-1-6.mjs';

test('runs tests and typecheck together, then builds after both finish', async () => {
  const projectRoot = resolve(import.meta.dirname, '../../..');
  const directory = await mkdtemp(join(tmpdir(), 'zdt-build-concurrency-'));
  const testsMarker = join(directory, 'tests-started');
  const typesMarker = join(directory, 'typecheck-started');
  const simultaneous = `
    const fs = require('node:fs');
    fs.writeFileSync(process.argv[1], 'started');
    const started = Date.now();
    const timer = setInterval(() => {
      if (fs.existsSync(process.argv[2])) { clearInterval(timer); process.exit(0); }
      if (Date.now() - started > 5000) { clearInterval(timer); process.exit(2); }
    }, 10);
  `;
  const planPath = join(directory, 'plan.json');
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const plan = {
    project: 'fixture',
    to: { sha: sourceSha },
    runId: 'concurrency',
    changes: [],
    deploymentOrder: [],
    actions: {
      preflight: [],
      tests: [{ name: 'tests', argv: ['node', '-e', simultaneous, testsMarker, typesMarker], timeoutMs: 7000 }],
      typecheck: [{ name: 'typecheck', argv: ['node', '-e', simultaneous, typesMarker, testsMarker], timeoutMs: 7000 }],
      build: [{ name: 'build', argv: ['node', '-e', 'const fs = require("node:fs"); if (!fs.existsSync(process.argv[1]) || !fs.existsSync(process.argv[2])) process.exit(3)', testsMarker, typesMarker] }],
    },
  };
  try {
    await writeFile(planPath, JSON.stringify(plan));
    const events = [];
    const result = await buildRelease({ project: 'fixture', projectRoot }, planPath, (event) => events.push(event));
    assert.equal(result.phases.tests.length, 1);
    assert.equal(result.phases.typecheck.length, 1);
    assert.equal(result.phases.build.length, 1);
    for (const phase of ['tests', 'typecheck', 'build']) {
      assert.ok(events.some((event) => event.phase === phase && event.event === 'start'));
      assert.ok(events.some((event) => event.phase === phase && event.event === 'complete' && event.durationMs >= 0));
    }
    const buildStarted = events.findIndex((event) => event.phase === 'build' && event.event === 'start');
    assert.ok(buildStarted > events.findIndex((event) => event.phase === 'tests' && event.event === 'complete'));
    assert.ok(buildStarted > events.findIndex((event) => event.phase === 'typecheck' && event.event === 'complete'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

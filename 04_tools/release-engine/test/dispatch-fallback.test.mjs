import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { githubTimings } from '../../../scripts/delivery-timings.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(new URL('../../..', import.meta.url).pathname);
const dispatcher = join(root, 'scripts/delivery-dispatch.sh');
const sourceSha = 'a'.repeat(40);

async function simulate(mode) {
  const directory = await mkdtemp(join(tmpdir(), 'runner-dispatch-'));
  const log = join(directory, 'calls.log');
  const state = join(directory, 'state');
  await writeFile(state, 'aliyun');
  const gh = join(directory, 'gh');
  await writeFile(gh, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$MOCK_LOG"
if [ "$1" = workflow ] && [ "$2" = view ]; then exit 0; fi
if [ "$1" = run ] && [ "$2" = list ]; then
  if [[ " $* " == *" --event "* ]]; then
    if [ "$(<"$MOCK_STATE")" = hosted ]; then echo 102; else echo 101; fi
  else echo 100; fi
  exit 0
fi
if [ "$1" = workflow ] && [ "$2" = run ]; then
  if [[ " $* " == *"execution_location=github-hosted"* ]]; then echo hosted > "$MOCK_STATE"; fi
  exit 0
fi
if [ "$1" = run ] && [ "$2" = cancel ]; then exit 0; fi
if [ "$1" = run ] && [ "$2" = watch ]; then exit 0; fi
if [ "$1" = run ] && [ "$2" = view ]; then
  if [[ " $* " == *" --log"* ]]; then echo 'RUNNER_1_6_RESULT={"state":"HEALTHY"}'; exit 0; fi
  if [[ " $* " == *" --json createdAt,jobs"* ]]; then
    echo '{"createdAt":"2026-09-16T00:00:00Z","jobs":[{"name":"Choose execution location","startedAt":"2026-09-16T00:00:02Z","completedAt":"2026-09-16T00:00:06Z","steps":[{"name":"Run actions/checkout@v6","startedAt":"2026-09-16T00:00:02Z","completedAt":"2026-09-16T00:00:03Z"}]},{"name":"Execute on aliyun","startedAt":"2026-09-16T00:00:09Z","steps":[{"name":"Run actions/checkout@v6","startedAt":"2026-09-16T00:00:09Z","completedAt":"2026-09-16T00:00:11Z"}]}]}'
    exit 0
  fi
  if [[ " $* " == *" --json status"* ]]; then echo completed; exit 0; fi
  if [[ " $* " == *"startswith("* ]]; then
    if [ "$(<"$MOCK_STATE")" = hosted ]; then echo 'Execute on github-hosted'; else echo 'Execute on aliyun'; fi
    exit 0
  fi
  if [[ " $* " == *" --json jobs"* ]]; then
    if [ "$MOCK_MODE" = started ]; then echo 1; else echo 0; fi
    exit 0
  fi
fi
exit 1
`);
  const sleep = join(directory, 'sleep');
  await writeFile(sleep, '#!/usr/bin/env bash\nexit 0\n');
  await Promise.all([chmod(gh, 0o755), chmod(sleep, 0o755)]);
  try {
    const result = await execFileAsync('bash', [dispatcher, 'release', sourceSha, 'identity-api', 'hbbtzn-l1'], {
      cwd: root,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, MOCK_LOG: log, MOCK_STATE: state, MOCK_MODE: mode, ZDT_DELIVERY_STARTED_MS: String(Math.floor(Date.now() / 1000) * 1000) },
    });
    return { output: result.stdout, calls: await readFile(log, 'utf8') };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('an unstarted Aliyun job is cancelled before one Hosted dispatch', async () => {
  const { output, calls } = await simulate('queued');
  assert.match(calls, /run cancel 101/);
  assert.match(calls, /execution_location=github-hosted/);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 2);
  assert.match(output, /Hosted fallback run: 102/);
  assert.match(output, /DELIVERY_END_TO_END_MS=\d+/);
  assert.match(output, /DELIVERY_PRE_CORE_TIMINGS=/);
});

test('an already-started Aliyun job never creates a Hosted dispatch', async () => {
  const { calls } = await simulate('started');
  assert.doesNotMatch(calls, /run cancel/);
  assert.doesNotMatch(calls, /execution_location=github-hosted/);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 1);
});

test('GitHub timeline separates queue, routing, and checkout without counting fallback twice', () => {
  const result = githubTimings({
    createdAt: '2026-09-16T00:00:00Z',
    jobs: [
      { name: 'Choose execution location', startedAt: '2026-09-16T00:00:02Z', completedAt: '2026-09-16T00:00:06Z', steps: [{ name: 'Run actions/checkout@v6', startedAt: '2026-09-16T00:00:02Z', completedAt: '2026-09-16T00:00:03Z' }] },
      { name: 'Execute on aliyun', startedAt: '2026-09-16T00:00:09Z', steps: [{ name: 'Run actions/checkout@v6', startedAt: '2026-09-16T00:00:09Z', completedAt: '2026-09-16T00:00:11Z' }] },
    ],
  });
  assert.equal(result.queueMs, 5_000);
  assert.equal(result.routingMs, 3_000);
  assert.equal(result.checkoutMs, 3_000);
});

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { githubTimings, releaseLogTimings } from '../../../scripts/delivery-timings.mjs';

const execFileAsync = promisify(execFile);
const root = resolve(new URL('../../..', import.meta.url).pathname);
const dispatcher = join(root, 'scripts/delivery-dispatch.sh');
const sourceSha = 'a'.repeat(40);

async function simulate(mode, argumentsForDelivery = ['release', sourceSha, 'identity-api', 'hbbtzn-l1'], executeName = 'Execute on aliyun') {
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
    request_id="$(<"$MOCK_STATE.request")"
    [[ "$*" == *"Runner 1.7 [$request_id] "* ]] || { echo 999; exit 0; }
    if [ "$(<"$MOCK_STATE")" = hosted ]; then echo 102; else echo 101; fi
  else echo 100; fi
  exit 0
fi
if [ "$1" = workflow ] && [ "$2" = run ]; then
  for arg in "$@"; do
    if [[ "$arg" == request_id=* ]]; then printf '%s' "$arg" | sed 's/^request_id=//' > "$MOCK_STATE.request"; fi
  done
  if [[ " $* " == *"execution_location=github-hosted"* ]]; then echo hosted > "$MOCK_STATE"; fi
  if [[ "$MOCK_MODE" == *-url ]]; then
    if [ "$(<"$MOCK_STATE")" = hosted ]; then echo 'https://github.com/Ethan7586/zhudatuan/actions/runs/102'; else echo 'https://github.com/Ethan7586/zhudatuan/actions/runs/101'; fi
  fi
  exit 0
fi
if [ "$1" = run ] && [ "$2" = cancel ]; then
  echo cancelled > "$MOCK_STATE"
  exit 0
fi
if [ "$1" = run ] && [ "$2" = watch ]; then
  if [ "$MOCK_MODE" = hosted-precore ] || [ "$MOCK_MODE" = hosted-failed ]; then exit 1; fi
  exit 0
fi
if [ "$1" = run ] && [ "$2" = view ]; then
  if [[ " $* " == *" --log"* ]]; then echo 'RUNNER_1_6_RESULT={"state":"HEALTHY"}'; exit 0; fi
  if [[ " $* " == *" --json createdAt,jobs"* ]]; then
    echo '{"createdAt":"2026-09-16T00:00:00Z","jobs":[{"name":"Choose execution location","startedAt":"2026-09-16T00:00:02Z","completedAt":"2026-09-16T00:00:06Z","steps":[{"name":"Run actions/checkout@v6","startedAt":"2026-09-16T00:00:02Z","completedAt":"2026-09-16T00:00:03Z"}]},{"name":"Execute on aliyun","startedAt":"2026-09-16T00:00:09Z","steps":[{"name":"Run actions/checkout@v6","startedAt":"2026-09-16T00:00:09Z","completedAt":"2026-09-16T00:00:11Z"}]}]}'
    exit 0
  fi
  if [[ " $* " == *" --json status,jobs"* ]]; then
    if [ "$(<"$MOCK_STATE")" = cancelled ]; then status=completed; else status=in_progress; fi
    if [[ "$MOCK_MODE" == started* ]] || [ "$MOCK_MODE" = hosted-core ] || { [ "$MOCK_MODE" = raced ] && [ "$status" = completed ]; }; then core_steps=1; else core_steps=0; fi
    if [ "$MOCK_MODE" = precore ] || [ "$MOCK_MODE" = hosted-precore ] || [[ "$MOCK_MODE" == started* ]]; then started_steps=1; else started_steps=0; fi
    printf '%s\\t%s\\t%s\\n' "$status" "$core_steps" "$started_steps"
    exit 0
  fi
  if [[ " $* " == *" --json status"* ]]; then
    if [ "$(<"$MOCK_STATE")" = cancelled ]; then echo completed; else echo in_progress; fi
    exit 0
  fi
  if [[ " $* " == *" | .name"* ]]; then
    if [ "$(<"$MOCK_STATE")" = hosted ]; then echo 'Execute on github-hosted'; else echo "$MOCK_EXECUTE_NAME"; fi
    exit 0
  fi
  if [[ " $* " == *" --json jobs"* ]]; then
    if [[ " $* " == *"Retry pre-core startup on GitHub Hosted"* ]] && [[ " $* " == *".conclusion == \\"success\\""* ]]; then
      if [ "$MOCK_MODE" = hosted-precore ]; then echo 1; else echo 0; fi
    elif [[ " $* " == *"Mark shared release core started"* ]]; then
      if [[ "$MOCK_MODE" == started* ]] || [ "$MOCK_MODE" = hosted-core ] || { [ "$MOCK_MODE" = raced ] && [ "$(<"$MOCK_STATE")" = cancelled ]; }; then echo 1; else echo 0; fi
    elif [[ " $* " == *".conclusion == \\"failure\\""* ]]; then
      if [ "$MOCK_MODE" = hosted-precore ] || [ "$MOCK_MODE" = hosted-failed ]; then echo 1; else echo 0; fi
    elif [[ " $* " == *"shared release core"* ]]; then
      if [ "$MOCK_MODE" = precore ]; then echo 1; else echo 0; fi
    elif [ "$MOCK_MODE" = precore ] || [ "$MOCK_MODE" = hosted-precore ] || [[ "$MOCK_MODE" == started* ]]; then echo 1; else echo 0; fi
    exit 0
  fi
fi
exit 1
`);
  const sleep = join(directory, 'sleep');
  await writeFile(sleep, '#!/usr/bin/env bash\nexit 0\n');
  await Promise.all([chmod(gh, 0o755), chmod(sleep, 0o755)]);
  try {
    const result = await execFileAsync('bash', [dispatcher, ...argumentsForDelivery], {
      cwd: root,
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, MOCK_LOG: log, MOCK_STATE: state, MOCK_MODE: mode, MOCK_EXECUTE_NAME: executeName, ZDT_DELIVERY_STARTED_MS: String(Math.floor(Date.now() / 1000) * 1000), ZDT_DELIVERY_QUEUE_WAIT_SECONDS: '0' },
    });
    return { output: result.stdout, calls: await readFile(log, 'utf8') };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('an unstarted Aliyun job is cancelled before one Hosted dispatch', async () => {
  const { output, calls } = await simulate('queued');
  const requestIds = [...calls.matchAll(/-f request_id=([0-9a-f]{24})/g)].map((match) => match[1]);
  assert.equal(requestIds.length, 2);
  assert.notEqual(requestIds[0], requestIds[1], 'each dispatch needs its own run identity');
  for (const requestId of requestIds) assert.match(calls, new RegExp(`Runner 1\\.7 \\[${requestId}\\] `));
  assert.match(calls, /run cancel 101/);
  assert.match(calls, /execution_location=github-hosted/);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 2);
  assert.equal((calls.match(/run view 101 --json status,jobs/g) ?? []).length, 1, 'one observation covers status, core start, and queued steps');
  assert.ok((calls.match(/Mark shared release core started/g) ?? []).length <= 2, 'queue timeout should not depend on repeated API polls');
  assert.match(output, /Hosted fallback run: 102/);
  assert.match(output, /DELIVERY_COMMAND_RETURN_MS=\d+/);
  assert.match(output, /DELIVERY_PRE_CORE_TIMINGS=/);
});

test('an unstarted portable Runner job uses the same Hosted takeover', async () => {
  const { output, calls } = await simulate('queued', ['release', sourceSha, 'identity-api', 'hbbtzn-l1'], 'Execute on self-hosted');
  assert.match(calls, /run cancel 101/);
  assert.match(calls, /execution_location=github-hosted/);
  assert.match(output, /Hosted fallback run: 102/);
});

test('a portable Runner that entered the core is not cancelled', async () => {
  const { calls } = await simulate('started', ['release', sourceSha, 'identity-api', 'hbbtzn-l1'], 'Execute on self-hosted');
  assert.doesNotMatch(calls, /run cancel|execution_location=github-hosted/);
});

test('dispatch uses the exact returned run URL without searching same-title runs', async () => {
  const { output, calls } = await simulate('started-url');
  assert.match(output, /GitHub run: 101/);
  assert.match(output, /https:\/\/github\.com\/Ethan7586\/zhudatuan\/actions\/runs\/101/);
  assert.doesNotMatch(calls, /run list .*--event workflow_dispatch/);
  assert.doesNotMatch(calls, /run cancel/);
});

test('one dispatch carries exact database and service placements without expanding their nodes', async () => {
  const placements = ['identity-api', 'hbbtzn-l1', 'database-migration', 'zhudatuan-l0'];
  const { calls } = await simulate('started-url', ['release', sourceSha, ...placements]);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 1);
  assert.match(calls, /release_target=identity-api,database-migration/);
  assert.match(calls, /physical_node=hbbtzn-l1,zhudatuan-l0/);
  const retry = await simulate('started-url', ['retry', `r16-${sourceSha}`, ...placements]);
  assert.match(retry.calls, /release_target=identity-api,database-migration/);
  assert.match(retry.calls, /physical_node=hbbtzn-l1,zhudatuan-l0/);
});

test('Hosted fallback also uses its own returned run URL', async () => {
  const { output, calls } = await simulate('queued-url');
  assert.match(output, /GitHub run: 101/);
  assert.match(output, /Hosted fallback run: 102/);
  assert.doesNotMatch(calls, /run list .*--event workflow_dispatch/);
  assert.match(calls, /run cancel 101/);
});

test('an already-started Aliyun job never creates a Hosted dispatch', async () => {
  const { calls } = await simulate('started');
  assert.doesNotMatch(calls, /run cancel/);
  assert.doesNotMatch(calls, /execution_location=github-hosted/);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 1);
});

test('a started composite still in pre-core checkout is cancelled before Hosted takes over', async () => {
  const { calls } = await simulate('precore');
  assert.match(calls, /run cancel 101/);
  assert.match(calls, /execution_location=github-hosted/);
  assert.match(calls, /Mark shared release core started/);
});

test('live status dispatches without requiring a Source SHA', async () => {
  const { calls, output } = await simulate('started', ['status']);
  assert.match(calls, /workflow run delivery-1-6.yml --ref zdt-next -f operation=status -f identifier=/);
  assert.match(output, /Runner 1.7 status/);
});

test('a core that starts while cancellation is pending blocks Hosted dispatch', async () => {
  await assert.rejects(simulate('raced'), (error) => {
    assert.match(error.stderr, /shared core started before cancellation/);
    return true;
  });
});

test('same-run Hosted core is observed without cancelling or dispatching a second run', async () => {
  const { calls } = await simulate('hosted-core');
  assert.doesNotMatch(calls, /run cancel/);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 1);
});

test('same-run Hosted preparation is left to finish after Aliyun failed', async () => {
  const { calls, output } = await simulate('hosted-precore');
  assert.doesNotMatch(calls, /run cancel/);
  assert.equal((calls.match(/workflow run /g) ?? []).length, 1);
  assert.match(output, /等待同一次 GitHub 运行中的 Hosted 接管/);
  assert.match(output, /Hosted 接管已成功/);
});

test('a failed Hosted takeover keeps the command failed', async () => {
  await assert.rejects(simulate('hosted-failed'));
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

test('GitHub timeline ignores a skipped Hosted fallback job', () => {
  const result = githubTimings({
    createdAt: '2026-09-16T00:00:00Z',
    jobs: [
      { name: 'Choose execution location', startedAt: '2026-09-16T00:00:02Z', completedAt: '2026-09-16T00:00:06Z', steps: [] },
      { name: 'Execute on aliyun', startedAt: '2026-09-16T00:00:09Z', steps: [] },
      { name: 'Retry pre-core startup on GitHub Hosted', startedAt: '2026-09-16T00:00:12Z', conclusion: 'skipped', steps: [] },
    ],
  });
  assert.equal(result.queueMs, 5_000);
});

test('GitHub timeline uses the Hosted job when same-run startup fallback executes', () => {
  const result = githubTimings({
    createdAt: '2026-09-16T00:00:00Z',
    jobs: [
      { name: 'Choose execution location', startedAt: '2026-09-16T00:00:02Z', completedAt: '2026-09-16T00:00:06Z', steps: [] },
      { name: 'Execute on aliyun', startedAt: '2026-09-16T00:00:09Z', steps: [{ name: 'Run actions/checkout@v6', startedAt: '2026-09-16T00:00:09Z', completedAt: '2026-09-16T00:00:11Z' }] },
      { name: 'Retry pre-core startup on GitHub Hosted', startedAt: '2026-09-16T00:00:12Z', steps: [{ name: 'Run actions/checkout@v6', startedAt: '2026-09-16T00:00:12Z', completedAt: '2026-09-16T00:00:15Z' }] },
    ],
  });
  assert.equal(result.queueMs, 8_000);
  assert.equal(result.checkoutMs, 3_000);
});

test('log timing reports real target health separately from workflow completion', () => {
  const log = [
    'Execute on aliyun\tRun shared release core\t2026-09-16T23:17:27.917Z ##[start-action display=Load exact source;id=release.checkout]',
    'Execute on aliyun\tRun shared release core\t2026-09-16T23:17:37.842Z ##[start-action display=Mark shared release core started;id=release.started]',
    'Execute on aliyun\tRun shared release core\t2026-09-16T23:18:42.854Z RUNNER_1_6_RESULT={"state":"HEALTHY","targets":[{"health":{"status":"ready"}}]}',
  ].join('\n');
  const result = releaseLogTimings(log, Date.parse('2026-09-16T23:16:47Z'), 'release');
  assert.equal(result.sourceCheckoutMs, 9_925);
  assert.equal(result.targetHealthMs, 115_854);
  assert.equal(result.targetCurrentMs, null);
  assert.match(result.resultLine, /^RUNNER_1_6_RESULT=/);
  assert.equal(releaseLogTimings(log, Date.parse('2026-09-16T23:16:47Z'), 'status').sourceCheckoutMs, null);
});

test('source checkout timing survives the top-level core-start marker', () => {
  const log = [
    'Execute on aliyun\tPrepare shared release core\t2026-09-16T23:17:27.917Z ##[start-action display=Load exact source;id=release.checkout]',
    'Execute on aliyun\tMark shared release core started\t2026-09-16T23:17:37.842Z ##[group]Run echo value=true',
    'Execute on aliyun\tRun shared release core\t2026-09-16T23:17:38.100Z ##[start-action display=Load exact source;id=skipped.checkout]',
    'Execute on aliyun\tRun shared release core\t2026-09-16T23:17:38.842Z RUNNER_1_6_RESULT={"state":"DEPLOYED","targets":[]}',
  ].join('\n');
  assert.equal(releaseLogTimings(log, Date.parse('2026-09-16T23:16:47Z'), 'release').sourceCheckoutMs, 9_925);
});

test('unchecked static target reports command-to-current time, never command-to-health time', () => {
  const log = 'Execute on aliyun\tRun shared release core\t2026-09-16T23:18:42.854Z RUNNER_1_6_RESULT={"state":"DEPLOYED","targets":[{"current":"/opt/zhudatuan/targets/console/releases/example","health":{"status":"not-checked","checks":[]}}]}';
  const result = releaseLogTimings(log, Date.parse('2026-09-16T23:16:47Z'), 'release');
  assert.equal(result.targetCurrentMs, 115_854);
  assert.equal(result.targetHealthMs, null);
});

test('migration plus healthy service reports the whole command-to-health interval', () => {
  const log = 'Execute on aliyun\tRun shared release core\t2026-09-16T23:18:42.854Z RUNNER_1_6_RESULT={"state":"DEPLOYED","targets":[{"target":"database-migration","current":"migration-current","health":{"status":"not-checked"}},{"target":"identity-api","current":"service-current","health":{"status":"ready"}}]}';
  const result = releaseLogTimings(log, Date.parse('2026-09-16T23:16:47Z'), 'release');
  assert.equal(result.targetHealthMs, 115_854);
  assert.equal(result.targetCurrentMs, 115_854);
});

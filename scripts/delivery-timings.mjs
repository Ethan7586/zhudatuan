import { pathToFileURL } from 'node:url';

// Read-only GitHub timeline display. These intervals are not release decisions.
export function githubTimings(run) {
  const jobs = run.jobs ?? [];
  const route = jobs.find((job) => job.name === 'Choose execution location');
  const execute = jobs.find((job) => job.name === 'Retry pre-core startup on GitHub Hosted' && job.startedAt && job.conclusion !== 'skipped')
    ?? jobs.find((job) => job.name?.startsWith('Execute on '));
  const span = (start, end) => {
    const a = Date.parse(start ?? '');
    const b = Date.parse(end ?? '');
    return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
  };
  const queueBeforeRouteMs = span(run.createdAt, route?.startedAt);
  const queueAfterRouteMs = span(route?.completedAt, execute?.startedAt);
  const checkoutDurations = [route, execute].filter(Boolean).flatMap((job) => job.steps ?? [])
    .filter((step) => /checkout/i.test(step.name ?? ''))
    .map((step) => span(step.startedAt, step.completedAt));
  const checkoutMs = checkoutDurations.length && checkoutDurations.every((value) => value !== null)
    ? checkoutDurations.reduce((sum, value) => sum + value, 0) : null;
  const routingWallMs = span(route?.startedAt, route?.completedAt);
  return {
    queueMs: queueBeforeRouteMs === null || queueAfterRouteMs === null ? null : queueBeforeRouteMs + queueAfterRouteMs,
    routingMs: routingWallMs === null ? null : Math.max(0, routingWallMs - (route?.steps ?? []).filter((step) => /checkout/i.test(step.name ?? '')).map((step) => span(step.startedAt, step.completedAt) ?? 0).reduce((a, b) => a + b, 0)),
    checkoutMs,
    note: 'GitHub job timestamps; earlier cancelled runs during Hosted fallback are included in end-to-end total, not these final-run stages',
  };
}

export function releaseLogTimings(log, commandStartedMs, operation) {
  const lines = log.split('\n');
  const marker = 'RUNNER_1_6_RESULT=';
  const resultIndex = lines.findLastIndex((line) => line.includes(marker));
  const resultLine = resultIndex < 0 ? null : lines[resultIndex];
  let result = null;
  try {
    if (resultLine) result = JSON.parse(resultLine.slice(resultLine.indexOf(marker) + marker.length));
  } catch {}
  const at = (line) => {
    const match = line?.match(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/);
    return match ? Date.parse(match[0]) : NaN;
  };
  const releaseOperation = ['release', 'retry'].includes(operation);
  const sourceStart = releaseOperation ? lines.slice(0, resultIndex < 0 ? undefined : resultIndex).findLastIndex((line) => line.includes('start-action display=Load exact source')) : -1;
  const sourceEnd = sourceStart < 0 ? -1 : lines.findIndex((line, index) => index > sourceStart && (line.includes('start-action display=Mark shared release core started') || line.includes('\tMark shared release core started\t')));
  const sourceCheckoutMs = sourceStart >= 0 && sourceEnd >= 0 ? at(lines[sourceEnd]) - at(lines[sourceStart]) : null;
  const commandMs = Number(commandStartedMs);
  const targetHealthMs = ['release', 'retry'].includes(operation)
    && result?.state === 'HEALTHY'
    && result.targets?.length > 0
    && result.targets.every((target) => target.health?.status === 'ready')
    ? at(resultLine) - commandMs : null;
  const targetCurrentMs = releaseOperation
    && ['HEALTHY', 'DEPLOYED'].includes(result?.state)
    && result.targets?.length > 0
    && result.targets.every((target) => target.current && ['ready', 'not-checked'].includes(target.health?.status))
    ? at(resultLine) - commandMs : null;
  return {
    resultLine: resultLine ? resultLine.slice(resultLine.indexOf(marker)) : null,
    sourceCheckoutMs: Number.isFinite(sourceCheckoutMs) && sourceCheckoutMs >= 0 ? sourceCheckoutMs : null,
    targetHealthMs: Number.isFinite(targetHealthMs) && targetHealthMs >= 0 ? targetHealthMs : null,
    targetCurrentMs: Number.isFinite(targetCurrentMs) && targetCurrentMs >= 0 ? targetCurrentMs : null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  if (process.argv[2] === 'log') {
    const result = releaseLogTimings(input, process.argv[3], process.argv[4]);
    if (result.resultLine) process.stdout.write(`${result.resultLine}\n`);
    if (result.sourceCheckoutMs !== null) process.stdout.write(`DELIVERY_SOURCE_CHECKOUT_MS=${result.sourceCheckoutMs}\n`);
    if (result.targetHealthMs !== null) process.stdout.write(`DELIVERY_END_TO_END_MS=${result.targetHealthMs}\n`);
    if (result.targetCurrentMs !== null) process.stdout.write(`DELIVERY_TARGET_CURRENT_MS=${result.targetCurrentMs}\n`);
  } else process.stdout.write(`DELIVERY_PRE_CORE_TIMINGS=${JSON.stringify(githubTimings(JSON.parse(input)))}\n`);
}

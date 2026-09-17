import { pathToFileURL } from 'node:url';

// Read-only GitHub timeline display. These intervals are not release decisions.
export function githubTimings(run) {
  const jobs = run.jobs ?? [];
  const route = jobs.find((job) => job.name === 'Choose execution location');
  const execute = jobs.find((job) => job.name?.startsWith('Execute on '))
    ?? jobs.find((job) => job.name === 'Retry pre-core startup on GitHub Hosted');
  const span = (start, end) => {
    const a = Date.parse(start ?? '');
    const b = Date.parse(end ?? '');
    return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
  };
  const queueBeforeRouteMs = span(run.createdAt, route?.startedAt);
  const queueAfterRouteMs = span(route?.completedAt, execute?.startedAt);
  const checkoutDurations = jobs.flatMap((job) => job.steps ?? [])
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  process.stdout.write(`DELIVERY_PRE_CORE_TIMINGS=${JSON.stringify(githubTimings(JSON.parse(input)))}\n`);
}

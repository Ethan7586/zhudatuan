const ALIYUN_LABEL = 'zdt-aliyun-build';
const PORTABLE_LABEL = 'zdt-build';

export function selectExecutionRunner(observation) {
  if (!observation || observation.error) return hosted('self-hosted-status-unavailable');
  const runners = Array.isArray(observation.runners) ? observation.runners : [];
  const aliyun = runners.filter((runner) => hasLabel(runner, ALIYUN_LABEL));
  const portable = runners.filter((runner) => hasLabel(runner, PORTABLE_LABEL) && !hasLabel(runner, ALIYUN_LABEL));
  const candidates = [...aliyun, ...portable];
  const available = candidates.find((runner) => runner.status === 'online' && runner.busy !== true);
  if (!available) {
    const reason = candidates.length === 0 ? 'self-hosted-runner-missing' : candidates.some((runner) => runner.status !== 'online') ? 'self-hosted-runner-offline' : 'self-hosted-runner-busy';
    return hosted(reason);
  }
  const labels = runnerLabels(available);
  const legacy = hasLabel(available, ALIYUN_LABEL);
  const routeLabel = legacy ? ALIYUN_LABEL : PORTABLE_LABEL;
  const slotPattern = legacy ? /^zdt-aliyun-build-[1-9][0-9]*$/i : /^zdt-build-[1-9][0-9]*$/i;
  const slot = labels.find((label) => slotPattern.test(label));
  const linux = labels.find((label) => label.toLowerCase() === 'linux') ?? 'linux';
  const x64 = labels.find((label) => label.toLowerCase() === 'x64') ?? 'x64';
  return {
    runnerClass: legacy ? 'aliyun' : 'self-hosted',
    runnerName: available.name,
    reason: legacy ? 'aliyun-ready' : 'self-hosted-ready',
    runsOn: ['self-hosted', linux, x64, routeLabel, ...(slot ? [slot] : [])],
  };
}

function hasLabel(runner, expected) {
  return runnerLabels(runner).some((label) => label.toLowerCase() === expected);
}

function runnerLabels(runner) {
  if (!Array.isArray(runner?.labels)) return [];
  return runner.labels.map((label) => (typeof label === 'string' ? label : label?.name)).filter((label) => typeof label === 'string');
}

function hosted(reason) {
  return { runnerClass: 'github-hosted', runnerName: 'ubuntu-24.04', reason, runsOn: ['ubuntu-24.04'] };
}

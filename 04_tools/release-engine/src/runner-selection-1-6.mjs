const PORTABLE_LABEL = 'zdt-build';

export function selectExecutionRunner(observation) {
  if (!observation || observation.error) return hosted('self-hosted-status-unavailable');
  const runners = Array.isArray(observation.runners) ? observation.runners : [];
  const candidates = runners.filter((runner) => hasLabel(runner, PORTABLE_LABEL));
  const available = candidates.find((runner) => runner.status === 'online' && runner.busy !== true);
  if (!available) {
    const reason = candidates.length === 0 ? 'self-hosted-runner-missing' : candidates.some((runner) => runner.status !== 'online') ? 'self-hosted-runner-offline' : 'self-hosted-runner-busy';
    return hosted(reason);
  }
  const labels = runnerLabels(available);
  const linux = labels.find((label) => label.toLowerCase() === 'linux') ?? 'linux';
  const x64 = labels.find((label) => label.toLowerCase() === 'x64') ?? 'x64';
  return {
    runnerClass: 'self-hosted',
    runnerName: available.name,
    reason: 'self-hosted-ready',
    runsOn: ['self-hosted', linux, x64, PORTABLE_LABEL],
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

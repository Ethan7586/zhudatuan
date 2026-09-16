const ALIYUN_LABEL = 'zdt-aliyun-build';

export function selectExecutionRunner(observation) {
  if (!observation || observation.error) return hosted('aliyun-status-unavailable');
  const runners = Array.isArray(observation.runners) ? observation.runners : [];
  const candidates = runners.filter((runner) => runnerLabels(runner).some((label) => label.toLowerCase() === ALIYUN_LABEL));
  const available = candidates.find((runner) => runner.status === 'online' && runner.busy !== true);
  if (!available) {
    const reason = candidates.length === 0 ? 'aliyun-runner-missing' : candidates.some((runner) => runner.status !== 'online') ? 'aliyun-runner-offline' : 'aliyun-runner-busy';
    return hosted(reason);
  }
  const labels = runnerLabels(available);
  const slot = labels.find((label) => /^zdt-aliyun-build-[1-9][0-9]*$/i.test(label));
  const linux = labels.find((label) => label.toLowerCase() === 'linux') ?? 'linux';
  const x64 = labels.find((label) => label.toLowerCase() === 'x64') ?? 'x64';
  return {
    runnerClass: 'aliyun',
    runnerName: available.name,
    reason: 'aliyun-ready',
    runsOn: ['self-hosted', linux, x64, ALIYUN_LABEL, ...(slot ? [slot] : [])],
  };
}

function runnerLabels(runner) {
  if (!Array.isArray(runner?.labels)) return [];
  return runner.labels.map((label) => (typeof label === 'string' ? label : label?.name)).filter((label) => typeof label === 'string');
}

function hosted(reason) {
  return { runnerClass: 'github-hosted', runnerName: 'ubuntu-24.04', reason, runsOn: ['ubuntu-24.04'] };
}

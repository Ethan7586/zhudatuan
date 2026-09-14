export function evaluateDeliveryStatus(input) {
  const committed = input.localCommit === true;
  const inMainline = input.inMainline === true;
  const sealedRun = firstSuccessful(input.sealRuns);
  const latestPrepare = input.prepareRuns?.[0];
  const latestSeal = input.sealRuns?.[0];
  const sealed = sealedRun !== undefined;
  const deployable = inMainline && sealed && input.channelConfigured === true;

  let code = 'UNKNOWN_SOURCE';
  if (committed && !inMainline && input.conflictFiles?.length > 0) code = 'MERGE_CONFLICT';
  else if (committed && input.remoteCommit !== true) code = 'LOCAL_ONLY';
  else if (committed && !inMainline) code = 'AWAITING_INTEGRATION';
  else if (inMainline && input.channelConfigured !== true) code = 'CHANNEL_MISSING';
  else if (deployable) code = 'DEPLOYABLE';
  else if (isActive(latestSeal)) code = 'SEALING';
  else if (latestSeal?.status === 'completed' && latestSeal.conclusion !== 'success') code = 'SEAL_FAILED';
  else if (isActive(latestPrepare)) code = 'PREPARING';
  else if (latestPrepare?.status === 'completed' && latestPrepare.conclusion !== 'success') code = 'PREPARE_FAILED';
  else if (latestPrepare?.conclusion === 'success') code = 'AWAITING_SEAL';
  else if (inMainline) code = 'IN_MAINLINE';

  return Object.freeze({
    schemaVersion: 'zdt-delivery-status/v1',
    code,
    states: Object.freeze({ committed, inMainline, sealed, deployable }),
    remoteCommit: input.remoteCommit === true,
    channelConfigured: input.channelConfigured === true,
    conflictFiles: Object.freeze([...(input.conflictFiles ?? [])]),
    prepare: summarizeRun(latestPrepare),
    seal: summarizeRun(latestSeal),
    sealEvidence: summarizeRun(sealedRun),
  });
}

export function parseMergeTreeConflictFiles(output) {
  const lines = String(output).split(/\r?\n/);
  const separator = lines.indexOf('');
  const candidates = lines.slice(1, separator < 0 ? lines.length : separator);
  return Object.freeze(candidates.filter((line) => line !== '' && !/^[0-9a-f]{40}$/.test(line)));
}

export function automaticClosureIncludes(closure, { sourceSha, target, node }) {
  if (closure?.schemaVersion !== 'zdt-automatic-artifact-closure/v1' || closure.sourceSha !== sourceSha) return false;
  return ['migrations', 'runtimes', 'frontends']
    .flatMap((wave) => Array.isArray(closure.waves?.[wave]) ? closure.waves[wave] : [])
    .some((entry) => entry?.target === target && entry?.node === node);
}

function firstSuccessful(runs = []) {
  return runs.find((run) => run?.status === 'completed' && run.conclusion === 'success');
}

function isActive(run) {
  return run?.status === 'queued' || run?.status === 'in_progress' || run?.status === 'waiting';
}

function summarizeRun(run) {
  if (run === undefined) return undefined;
  return Object.freeze({
    id: run.databaseId,
    status: run.status,
    conclusion: run.conclusion ?? null,
    url: run.url,
    createdAt: run.createdAt,
  });
}

import { invariant } from './errors.mjs';
import { orderTargets } from './planner.mjs';

export function exactPlacements(targets, nodes) {
  const targetNames = targets.split(',');
  const nodeNames = nodes.split(',');
  invariant(targetNames.length === nodeNames.length && targetNames.every(Boolean) && nodeNames.every(Boolean), 'EXACT_SCOPE_INCOMPLETE', 'Every exact target needs one physical node');
  const seen = new Set();
  return targetNames.flatMap((target, index) => {
    const node = nodeNames[index];
    const key = `${target}\0${node}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ target, node }];
  });
}

export function orderedExactPlacements(adapter, placements) {
  return orderTargets(adapter, placements.map(({ target }) => target))
    .flatMap((target) => placements.filter((placement) => placement.target === target));
}

export async function runExactBatch(adapter, placements, { inspect, prepare, sync, deploy }) {
  const ordered = orderedExactPlacements(adapter, placements);
  const targets = [...new Set(ordered.map(({ target }) => target))];
  const inspected = [];
  for (const target of targets) inspected.push({ target, ...(await inspect(target)) });
  const missing = inspected.filter(({ exists }) => !exists).map(({ target }) => target);
  const preparationTimings = missing.length ? await prepare(missing) : null;
  const runtimeAgent = await sync();
  const deployments = [];
  for (const placement of ordered) deployments.push(await deploy(placement, runtimeAgent, deployments.length, ordered.length));
  return { deployments, cacheStatus: missing.length ? 'built' : 'reused', preparationTimings };
}

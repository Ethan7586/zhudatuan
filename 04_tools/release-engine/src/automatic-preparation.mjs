import { invariant } from './errors.mjs';

const RECONCILIATION_PREFIX = 'merge(release): reconnect ';
const RECONCILIATION_SUBJECT = /^merge\(release\): reconnect ([A-Za-z0-9_.-]+) ([A-Za-z0-9_.-]+) production lineage$/;

export function automaticClosureSelection(adapter, { plannedTargets, changeCount, beforeSha, commit }) {
  const targets = [...new Set(plannedTargets)];
  const subject = String(commit.message ?? '').split(/\r?\n/, 1)[0].trim();
  if (!subject.startsWith(RECONCILIATION_PREFIX)) {
    return Object.freeze({ targets, sealNodesByTarget: Object.freeze({}), reconciliation: null });
  }

  const match = RECONCILIATION_SUBJECT.exec(subject);
  invariant(Boolean(match), 'AUTO_RECONCILIATION_SUBJECT_INVALID', 'Release lineage reconciliation subject is malformed');
  invariant(commit.parents.length === 2, 'AUTO_RECONCILIATION_MERGE_REQUIRED', 'Release lineage reconciliation must have exactly two parents');
  invariant(commit.parents[0] === beforeSha, 'AUTO_RECONCILIATION_FIRST_PARENT_MISMATCH', 'Release lineage reconciliation must follow the pushed mainline tip');
  invariant(changeCount === 0 && targets.length === 0, 'AUTO_RECONCILIATION_NOT_TREE_IDENTICAL', 'Release lineage reconciliation must be tree-identical to its first parent');

  const [, nodeReference, target] = match;
  invariant(Boolean(adapter.targets[target]), 'AUTO_RECONCILIATION_TARGET_UNKNOWN', `Unknown release lineage target ${target}`);
  const node = resolveNodeReference(adapter, nodeReference);
  const deployment = adapter.nodes[node].deployments?.[target];
  invariant(Boolean(deployment) && deployment.hostedBy === undefined, 'AUTO_RECONCILIATION_PLACEMENT_INVALID', `${node}/${target} is not a physical deployment`);

  return Object.freeze({
    targets: Object.freeze([target]),
    sealNodesByTarget: Object.freeze({ [target]: Object.freeze([node]) }),
    reconciliation: Object.freeze({
      mode: 'production-lineage',
      target,
      node,
      previousProductionSourceSha: commit.parents[1],
      evidence: 'strict-merge-subject',
    }),
  });
}

export function automaticPreparationMatrix(adapter, targets, sealNodesByTarget = {}) {
  const entries = [];
  for (const target of [...new Set(targets)]) {
    invariant(Boolean(adapter.targets[target]), 'AUTO_PREPARE_TARGET_UNKNOWN', `Unknown automatic preparation target ${target}`);
    const availablePhysicalNodes = Object.entries(adapter.nodes)
      .filter(([, node]) => {
        const deployment = node.deployments?.[target];
        return Boolean(deployment) && deployment.hostedBy === undefined;
      })
      .map(([node]) => node)
      .sort();
    const requestedNodes = sealNodesByTarget[target];
    const physicalNodes = requestedNodes === undefined ? availablePhysicalNodes : [...new Set(requestedNodes)].sort();
    invariant(physicalNodes.every((node) => availablePhysicalNodes.includes(node)), 'AUTO_PREPARE_PHYSICAL_NODE_INVALID', `Automatic preparation requested a non-physical deployment for ${target}`);
    invariant(physicalNodes.length > 0, 'AUTO_PREPARE_PHYSICAL_NODE_MISSING', `No physical deployment exists for ${target}`);
    entries.push({
      target,
      prepare_node: physicalNodes[0],
      seal_nodes_json: JSON.stringify(physicalNodes),
    });
  }
  return entries;
}

export function automaticClosureManifest(adapter, { sourceSha, beforeSha, targets, sealNodesByTarget = {}, reconciliation = null }) {
  const preparations = automaticPreparationMatrix(adapter, targets, sealNodesByTarget);
  const waves = { migrations: [], runtimes: [], frontends: [] };
  for (const preparation of preparations) {
    const kind = adapter.targets[preparation.target].kind;
    const wave = kind === 'migration' ? waves.migrations : kind === 'frontend' ? waves.frontends : waves.runtimes;
    for (const node of JSON.parse(preparation.seal_nodes_json)) wave.push({ target: preparation.target, node });
  }
  return Object.freeze({
    schemaVersion: 'zdt-automatic-artifact-closure/v1',
    sourceSha,
    beforeSha,
    targets: [...new Set(targets)],
    reconciliation,
    preparations,
    waves,
  });
}

function resolveNodeReference(adapter, reference) {
  const normalized = reference.toLowerCase();
  const matches = Object.entries(adapter.nodes)
    .filter(([nodeId, node]) => [nodeId, node.key, node.nodeId?.split(':').at(-1), node.realmId?.split(':').at(-1)]
      .filter(Boolean)
      .some((candidate) => candidate.toLowerCase() === normalized))
    .map(([nodeId]) => nodeId);
  invariant(matches.length === 1, 'AUTO_RECONCILIATION_NODE_UNKNOWN', `Release lineage node ${reference} does not resolve to exactly one physical node`);
  return matches[0];
}

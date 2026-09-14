import { invariant } from './errors.mjs';

export function automaticPreparationMatrix(adapter, targets) {
  const entries = [];
  for (const target of [...new Set(targets)]) {
    invariant(Boolean(adapter.targets[target]), 'AUTO_PREPARE_TARGET_UNKNOWN', `Unknown automatic preparation target ${target}`);
    const physicalNodes = Object.entries(adapter.nodes)
      .filter(([, node]) => {
        const deployment = node.deployments?.[target];
        return Boolean(deployment) && deployment.hostedBy === undefined;
      })
      .map(([node]) => node)
      .sort();
    invariant(physicalNodes.length > 0, 'AUTO_PREPARE_PHYSICAL_NODE_MISSING', `No physical deployment exists for ${target}`);
    entries.push({
      target,
      prepare_node: physicalNodes[0],
      seal_nodes_json: JSON.stringify(physicalNodes),
    });
  }
  return entries;
}

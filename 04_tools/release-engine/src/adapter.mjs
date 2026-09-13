import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

import { invariant } from './errors.mjs';

export const ADAPTER_SCHEMA = 'ai.delivery.project.v1';

export async function loadAdapter(adapterPath, invocationRoot = process.cwd()) {
  const absolutePath = isAbsolute(adapterPath) ? adapterPath : resolve(invocationRoot, adapterPath);
  const adapter = JSON.parse(await readFile(absolutePath, 'utf8'));
  validateAdapter(adapter);
  const configuredRoot = adapter.projectRoot ?? '../../..';
  const projectRoot = resolve(dirname(absolutePath), configuredRoot);
  return Object.freeze({ ...adapter, adapterPath: absolutePath, projectRoot });
}

export function validateAdapter(adapter) {
  invariant(adapter?.schema === ADAPTER_SCHEMA, 'ADAPTER_SCHEMA_INVALID', `Adapter schema must be ${ADAPTER_SCHEMA}`);
  invariant(safeIdentifier(adapter.project), 'ADAPTER_PROJECT_INVALID', 'Adapter project must be a safe identifier');
  invariant(typeof adapter.stateDirectory === 'string' && adapter.stateDirectory.length > 0, 'ADAPTER_STATE_INVALID', 'Adapter stateDirectory is required');
  invariant(adapter.targets && typeof adapter.targets === 'object', 'ADAPTER_TARGETS_INVALID', 'Adapter targets are required');
  invariant(Array.isArray(adapter.rules) && adapter.rules.length > 0, 'ADAPTER_RULES_INVALID', 'Adapter classification rules are required');
  invariant(adapter.nodes && typeof adapter.nodes === 'object', 'ADAPTER_NODES_INVALID', 'Adapter nodes are required');
  invariant(Array.isArray(adapter.productionAcceptance?.domains) && adapter.productionAcceptance.domains.length === 9, 'ADAPTER_PRODUCTION_DOMAINS_INVALID', 'Adapter requires exactly 9 retained production acceptance domains');
  invariant(new Set(adapter.productionAcceptance.domains).size === 9, 'ADAPTER_PRODUCTION_DOMAINS_DUPLICATE', 'Production acceptance domains must be unique');
  validateCommands(adapter.buildPreflight, adapter.project, 'buildPreflight');
  for (const [resolverId, resolver] of Object.entries(adapter.impactResolvers ?? {})) {
    invariant(typeof resolver?.module === 'string' && resolver.module.length > 0, 'ADAPTER_IMPACT_RESOLVER_INVALID', `Impact resolver ${resolverId} needs a module`);
  }

  for (const [targetId, target] of Object.entries(adapter.targets)) {
    invariant(safeIdentifier(targetId), 'ADAPTER_TARGET_ID_INVALID', `Target id is unsafe: ${targetId}`);
    invariant(target?.id === targetId, 'ADAPTER_TARGET_ID_MISMATCH', `Target ${targetId} must repeat its id`);
    invariant(['content', 'frontend', 'service', 'migration', 'infrastructure'].includes(target.kind), 'ADAPTER_TARGET_KIND_INVALID', `Target ${targetId} has invalid kind`);
    invariant(Array.isArray(target.artifactInputs), 'ADAPTER_TARGET_INPUTS_INVALID', `Target ${targetId} artifactInputs must be an array`);
    invariant((target.after ?? []).every((dependency) => Boolean(adapter.targets[dependency])), 'ADAPTER_TARGET_ORDER_UNKNOWN', `Target ${targetId} has an unknown ordering dependency`);
    invariant((target.requires ?? []).every((dependency) => Boolean(adapter.targets[dependency])), 'ADAPTER_TARGET_REQUIREMENT_UNKNOWN', `Target ${targetId} has an unknown required target`);
    validateCommands(target.tests, targetId, 'tests');
    validateCommands(target.typecheck, targetId, 'typecheck');
    validateCommands(target.build, targetId, 'build');
  }

  for (const rule of adapter.rules) {
    invariant(typeof rule.id === 'string' && rule.id.length > 0, 'ADAPTER_RULE_ID_INVALID', 'Every rule needs an id');
    invariant(Array.isArray(rule.include) && rule.include.length > 0, 'ADAPTER_RULE_INCLUDE_INVALID', `Rule ${rule.id} needs include patterns`);
    invariant(rule.validationOnly === undefined || typeof rule.validationOnly === 'boolean', 'ADAPTER_RULE_VALIDATION_ONLY_INVALID', `Rule ${rule.id} validationOnly must be boolean`);
    invariant((rule.touches ?? []).every((touch) => typeof touch === 'string' && touch.length > 0), 'ADAPTER_RULE_TOUCH_INVALID', `Rule ${rule.id} touches must be strings`);
    validateCommands(rule.validations, rule.id, 'validations');
    if (rule.dynamicImpact) invariant(Boolean(adapter.impactResolvers?.[rule.dynamicImpact]), 'ADAPTER_RULE_IMPACT_UNKNOWN', `Rule ${rule.id} references unknown impact resolver ${rule.dynamicImpact}`);
    for (const targetId of rule.targets ?? []) {
      invariant(Boolean(adapter.targets[targetId]), 'ADAPTER_RULE_TARGET_UNKNOWN', `Rule ${rule.id} references unknown target ${targetId}`);
    }
  }

  for (const [nodeKey, node] of Object.entries(adapter.nodes)) {
    invariant(safeIdentifier(nodeKey), 'ADAPTER_NODE_KEY_INVALID', `Node key is unsafe: ${nodeKey}`);
    invariant(node?.key === nodeKey, 'ADAPTER_NODE_KEY_MISMATCH', `Node ${nodeKey} must repeat its key`);
    invariant(typeof node.nodeId === 'string' && node.nodeId.length > 0, 'ADAPTER_NODE_ID_INVALID', `Node ${nodeKey} needs nodeId`);
    invariant(node.deployments && typeof node.deployments === 'object', 'ADAPTER_NODE_DEPLOYMENTS_INVALID', `Node ${nodeKey} needs deployments`);
    for (const [targetId, deployment] of Object.entries(node.deployments)) {
      invariant(Boolean(adapter.targets[targetId]), 'ADAPTER_NODE_TARGET_UNKNOWN', `Node ${nodeKey} references unknown target ${targetId}`);
      invariant(typeof deployment.pointerRoot === 'string' && deployment.pointerRoot.startsWith('/'), 'ADAPTER_POINTER_INVALID', `${nodeKey}/${targetId} needs an absolute pointerRoot`);
      invariant(typeof deployment.service === 'string' && deployment.service.length > 0, 'ADAPTER_SERVICE_INVALID', `${nodeKey}/${targetId} needs a service`);
      if (deployment.hostedBy !== undefined) {
        invariant(safeIdentifier(deployment.hostedBy) && deployment.hostedBy !== nodeKey,
          'ADAPTER_HOST_NODE_INVALID', `${nodeKey}/${targetId} hostedBy must name another node`);
        const hostDeployment = adapter.nodes[deployment.hostedBy]?.deployments?.[targetId];
        invariant(Boolean(hostDeployment), 'ADAPTER_HOST_NODE_TARGET_UNKNOWN', `${nodeKey}/${targetId} host does not deploy ${targetId}`);
        invariant(hostDeployment.hostedBy === undefined, 'ADAPTER_HOST_NODE_CHAIN_INVALID', `${nodeKey}/${targetId} hostedBy cannot form a chain`);
        invariant(deployment.pointerRoot === hostDeployment.pointerRoot,
          'ADAPTER_HOST_POINTER_MISMATCH', `${nodeKey}/${targetId} must use its host pointer`);
        invariant(deployment.service === hostDeployment.service,
          'ADAPTER_HOST_SERVICE_MISMATCH', `${nodeKey}/${targetId} must use its host service`);
      }
    }
  }
  return adapter;
}

export function resolveDeployment(adapter, nodeKey, targetId) {
  const requested = adapter.nodes[nodeKey]?.deployments?.[targetId];
  invariant(Boolean(requested), 'ADAPTER_NODE_TARGET_UNKNOWN', `${nodeKey} does not deploy ${targetId}`);
  const executionNode = requested.hostedBy ?? nodeKey;
  return Object.freeze({
    requestedNode: nodeKey,
    executionNode,
    node: adapter.nodes[executionNode],
    deployment: adapter.nodes[executionNode].deployments[targetId],
  });
}

function safeIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value);
}

function validateCommands(commands = [], targetId, phase) {
  invariant(Array.isArray(commands), 'ADAPTER_COMMANDS_INVALID', `${targetId}.${phase} must be an array`);
  for (const command of commands) {
    invariant(typeof command?.name === 'string' && command.name.length > 0, 'ADAPTER_COMMAND_NAME_INVALID', `${targetId}.${phase} command needs a name`);
    invariant(Array.isArray(command.argv) && command.argv.length > 0, 'ADAPTER_COMMAND_ARGV_INVALID', `${targetId}.${phase}.${command.name} needs argv`);
    invariant(command.argv.every((entry) => typeof entry === 'string' && entry.length > 0), 'ADAPTER_COMMAND_ARG_INVALID', `${targetId}.${phase}.${command.name} argv must be strings`);
  }
}

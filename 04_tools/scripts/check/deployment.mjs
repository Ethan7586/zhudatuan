#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse } from 'yaml';

import { validateAdapter } from '../../release-engine/src/adapter.mjs';

const root = resolve(import.meta.dirname, '../../..');

export function validateDeploymentContract({ adapter, policy, workflow }) {
  validateAdapter(adapter);
  assert(policy?.schema === 'ai.delivery.remote-policy.v1', 'DEPLOY_POLICY_SCHEMA_INVALID');
  assert(policy.project === adapter.project, 'DEPLOY_POLICY_PROJECT_MISMATCH');
  for (const field of ['incomingRoot', 'lockRoot', 'rollbackRoot', 'auditRoot']) {
    assert(typeof policy[field] === 'string' && policy[field].startsWith('/'), `DEPLOY_POLICY_${field.toUpperCase()}_INVALID`);
  }

  const physicalDeployments = validateDeploymentOwnership(adapter, policy);
  const workflowSummary = validateDeployWorkflow(adapter, workflow);

  return Object.freeze({
    project: adapter.project,
    targets: Object.keys(adapter.targets).length,
    channels: Object.keys(adapter.channels ?? {}).length,
    nodes: Object.keys(adapter.nodes).length,
    physicalDeployments,
    workflowCommands: workflowSummary.commands,
  });
}

function validateDeploymentOwnership(adapter, policy) {
  assert(policy.nodes && typeof policy.nodes === 'object', 'DEPLOY_POLICY_NODES_MISSING');
  const expected = new Set();
  const pointers = new Set();

  for (const [nodeKey, node] of Object.entries(adapter.nodes)) {
    for (const [target, deployment] of Object.entries(node.deployments)) {
      const owner = deployment.hostedBy ?? nodeKey;
      const remote = policy.nodes[owner]?.deployments?.[target];
      assert(remote, 'DEPLOY_POLICY_TARGET_MISSING', `${owner}/${target}`);
      assert(remote.pointerRoot === deployment.pointerRoot, 'DEPLOY_POINTER_MISMATCH', `${nodeKey}/${target}`);
      assert(remote.restart?.name === deployment.service, 'DEPLOY_PROCESS_MISMATCH', `${nodeKey}/${target}`);
      if (deployment.hostedBy === undefined) expected.add(`${owner}/${target}`);
    }
  }

  const actual = [];
  for (const [nodeKey, node] of Object.entries(policy.nodes)) {
    for (const [target, deployment] of Object.entries(node.deployments ?? {})) {
      actual.push(`${nodeKey}/${target}`);
      assert(!pointers.has(deployment.pointerRoot), 'DEPLOY_POINTER_DUPLICATE', deployment.pointerRoot);
      pointers.add(deployment.pointerRoot);
      if (deployment.restart?.kind === 'systemd') {
        assert(deployment.restart.jobMode === 'ignore-dependencies', 'DEPLOY_RESTART_SCOPE_INVALID', `${nodeKey}/${target}`);
        assert((Array.isArray(deployment.seedInputs) && deployment.seedInputs.length > 0) || deployment.baselineStrategy === 'register-current',
          'DEPLOY_ROLLBACK_BASELINE_MISSING', `${nodeKey}/${target}`);
        assert(deployment.allowFirstActivation !== true, 'DEPLOY_FIRST_ACTIVATION_FORBIDDEN', `${nodeKey}/${target}`);
        assert(Array.isArray(deployment.candidateChecks) && deployment.candidateChecks.length > 0, 'DEPLOY_CANDIDATE_CHECKS_MISSING', `${nodeKey}/${target}`);
        assert(Array.isArray(deployment.healthChecks) && deployment.healthChecks.length > 0, 'DEPLOY_HEALTH_CHECKS_MISSING', `${nodeKey}/${target}`);
      }
    }
  }
  assertSameSet(actual, [...expected], 'DEPLOY_POLICY_TARGET_SET_MISMATCH');
  return actual.length;
}

function validateDeployWorkflow(adapter, workflow) {
  const reusable = workflow?.on?.workflow_call;
  const inputs = reusable?.inputs;
  assert(inputs?.head_sha?.required === true && inputs.head_sha.type === 'string', 'DEPLOY_WORKFLOW_SHA_INPUT_INVALID');
  assert(inputs?.release_target?.required === true && inputs.release_target.type === 'string', 'DEPLOY_WORKFLOW_TARGET_INPUT_INVALID');
  assert(inputs?.release_node?.required === true && inputs.release_node.type === 'string', 'DEPLOY_WORKFLOW_NODE_INPUT_INVALID');
  assert(inputs?.operation?.required === true && inputs.operation.type === 'string', 'DEPLOY_WORKFLOW_OPERATION_INPUT_INVALID');
  assert(workflow.permissions?.contents === 'read', 'DEPLOY_WORKFLOW_PERMISSIONS_INVALID');
  const expectedLock = `${adapter.project}-prepared-` + '${{ inputs.release_node }}-${{ inputs.release_target }}';
  assert(workflow.concurrency?.group === expectedLock, 'DEPLOY_WORKFLOW_LOCK_SCOPE_INVALID');
  assert(workflow.concurrency?.['cancel-in-progress'] === false, 'DEPLOY_WORKFLOW_CANCELLATION_INVALID');
  assert(workflow.env?.RELEASE_SHA === '${{ inputs.head_sha }}', 'DEPLOY_WORKFLOW_SHA_BINDING_INVALID');
  assert(workflow.env?.RELEASE_NODE === '${{ inputs.release_node }}', 'DEPLOY_WORKFLOW_NODE_BINDING_INVALID');
  assert(workflow.env?.RELEASE_TARGET === '${{ inputs.release_target }}', 'DEPLOY_WORKFLOW_TARGET_BINDING_INVALID');
  assert(workflow.env?.RELEASE_OPERATION === '${{ inputs.operation }}', 'DEPLOY_WORKFLOW_OPERATION_BINDING_INVALID');
  assert(workflow.env?.CONTROL_SHA === '${{ github.sha }}', 'DEPLOY_WORKFLOW_CONTROL_SHA_BINDING_INVALID');
  assert(workflow.env?.CONTROL_REF === '${{ github.ref }}', 'DEPLOY_WORKFLOW_CONTROL_REF_BINDING_INVALID');

  const job = workflow.jobs?.prepared;
  const steps = job?.steps;
  assert(Array.isArray(steps), 'DEPLOY_WORKFLOW_STEPS_MISSING');
  const checkout = steps.find((step) => typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@'));
  assert(checkout?.with?.ref === '${{ github.sha }}', 'DEPLOY_WORKFLOW_CONTROL_CHECKOUT_NOT_EXACT');

  const shell = executableShell(steps);
  assert(shell.includes('[ "$CONTROL_REF" != "refs/heads/zdt-next" ]'), 'DEPLOY_WORKFLOW_DEFAULT_BRANCH_GUARD_MISSING');
  assert(shell.includes('compare/${RELEASE_SHA}...${CONTROL_SHA}'), 'DEPLOY_WORKFLOW_LINEAGE_GUARD_MISSING');
  assert(shell.includes('d.hostedBy&&d.hostedBy!==process.env.RELEASE_NODE'), 'DEPLOY_WORKFLOW_PHYSICAL_OWNER_GUARD_MISSING');
  assert(shell.includes('command=validate-prepared') && shell.includes('command=deploy-prepared'), 'DEPLOY_WORKFLOW_PREPARED_COMMANDS_MISSING');
  assert(shell.includes('npm run --silent release -- "$command"'), 'DEPLOY_WORKFLOW_PREPARED_COMMAND_BINDING_MISSING');
  assert(shell.includes('--source-sha "$RELEASE_SHA"'), 'DEPLOY_WORKFLOW_SOURCE_ARGUMENT_MISSING');
  assert(shell.includes('--node "$RELEASE_NODE"') && shell.includes('--target "$RELEASE_TARGET"'), 'DEPLOY_WORKFLOW_TARGET_ARGUMENT_MISSING');
  assert(!/npm ci|release -- (?:build|package|publish)|ssh-keyscan/.test(shell), 'DEPLOY_WORKFLOW_IMPURE');

  return { commands: 2 };
}

function releaseCommands(steps) {
  const commands = [];
  for (const step of steps) {
    if (typeof step.run !== 'string') continue;
    const shell = executableShell([step]);
    const matcher = /(?:^|\n)[ \t]*node[ \t]+04_tools\/release-engine\/cli\.mjs[ \t]+([a-z0-9-]+)([^\n]*)/g;
    for (const match of shell.matchAll(matcher)) {
      commands.push({ action: match[1], tokens: shellTokens(match[2]) });
    }
  }
  return commands;
}

function executableShell(steps) {
  return steps
    .filter((step) => typeof step.run === 'string')
    .map((step) =>
      step.run
        .split('\n')
        .map(stripShellComment)
        .join('\n')
        .replace(/\\\r?\n[ \t]*/g, ' ')
    )
    .join('\n');
}

function stripShellComment(line) {
  let quote;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '\\' && quote !== "'") {
      index += 1;
      continue;
    }
    if ((character === "'" || character === '"') && (quote === undefined || quote === character)) {
      quote = quote === character ? undefined : character;
      continue;
    }
    if (character === '#' && quote === undefined && (index === 0 || /\s/.test(line[index - 1]))) return line.slice(0, index);
  }
  return line;
}

function shellTokens(value) {
  return [...value.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)].map((match) => match[1] ?? match[2] ?? match[3]);
}

function requireCommand(commands, action, expected) {
  const matches = commands.filter((command) => command.action === action);
  assert(matches.length === 1, 'DEPLOY_WORKFLOW_COMMAND_COUNT', action);
  const tokens = matches[0].tokens;
  for (const [option, value] of Object.entries(expected)) {
    const index = tokens.indexOf(option);
    assert(index >= 0, 'DEPLOY_WORKFLOW_COMMAND_OPTION_MISSING', `${action}:${option}`);
    if (value !== true) assert(tokens[index + 1] === value, 'DEPLOY_WORKFLOW_COMMAND_OPTION_INVALID', `${action}:${option}`);
  }
}

function assertSameSet(actual, expected, code) {
  assert(Array.isArray(actual), code);
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  assert(actualSet.size === actual.length && actualSet.size === expectedSet.size && [...expectedSet].every((value) => actualSet.has(value)), code);
}

function assert(condition, code, detail) {
  if (!condition) throw new Error(detail === undefined ? code : `${code}:${detail}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = validateDeploymentContract({
    adapter: JSON.parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8')),
    policy: JSON.parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8')),
    workflow: parse(readFileSync(resolve(root, '.github/workflows/deploy-prepared-aliyun.yml'), 'utf8')),
  });
  console.log(`deployment contract: project=${summary.project} targets=${summary.targets} channels=${summary.channels} nodes=${summary.nodes} physical=${summary.physicalDeployments} commands=${summary.workflowCommands}`);
}

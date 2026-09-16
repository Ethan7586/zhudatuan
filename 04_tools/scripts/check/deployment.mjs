#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse } from 'yaml';

import { validateAdapter } from '../../release-engine/src/adapter.mjs';

const root = resolve(import.meta.dirname, '../../..');

export function validateDeploymentContract({ adapter, policy, workflow, action }) {
  validateAdapter(adapter);
  assert(policy?.schema === 'ai.delivery.remote-policy.v1', 'DEPLOY_POLICY_SCHEMA_INVALID');
  assert(policy.project === adapter.project, 'DEPLOY_POLICY_PROJECT_MISMATCH');
  for (const field of ['incomingRoot', 'rollbackRoot', 'auditRoot']) {
    assert(typeof policy[field] === 'string' && policy[field].startsWith('/'), `DEPLOY_POLICY_${field.toUpperCase()}_INVALID`);
  }
  assert(!('lockRoot' in policy) && !('staleLockSeconds' in policy), 'DEPLOY_POLICY_LOCK_AUTHORITY_FORBIDDEN');

  const physicalDeployments = validateDeploymentOwnership(adapter, policy);
  const workflowSummary = validateDeployWorkflow(adapter, workflow, action);

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
        assert((Array.isArray(deployment.seedInputs) && deployment.seedInputs.length > 0) || deployment.baselineStrategy === 'register-current', 'DEPLOY_ROLLBACK_BASELINE_MISSING', `${nodeKey}/${target}`);
        assert(deployment.allowFirstActivation !== true, 'DEPLOY_FIRST_ACTIVATION_FORBIDDEN', `${nodeKey}/${target}`);
        assert(Array.isArray(deployment.candidateChecks) && deployment.candidateChecks.length > 0, 'DEPLOY_CANDIDATE_CHECKS_MISSING', `${nodeKey}/${target}`);
        assert(Array.isArray(deployment.healthChecks) && deployment.healthChecks.length > 0, 'DEPLOY_HEALTH_CHECKS_MISSING', `${nodeKey}/${target}`);
      }
    }
  }
  assertSameSet(actual, [...expected], 'DEPLOY_POLICY_TARGET_SET_MISMATCH');
  return actual.length;
}

function validateDeployWorkflow(adapter, workflow, action) {
  const inputs = workflow?.on?.workflow_dispatch?.inputs;
  assert(inputs?.operation?.required === true && inputs.operation.type === 'choice', 'DEPLOY_WORKFLOW_OPERATION_INPUT_INVALID');
  assert(sameValues(inputs.operation.options, ['release', 'status', 'retry', 'rollback', 'control-update']), 'DEPLOY_WORKFLOW_OPERATION_OPTIONS_INVALID');
  assert(inputs?.identifier?.type === 'string', 'DEPLOY_WORKFLOW_IDENTIFIER_INPUT_INVALID');
  assert(inputs?.release_target?.type === 'string', 'DEPLOY_WORKFLOW_TARGET_INPUT_INVALID');
  assert(inputs?.physical_node?.type === 'string', 'DEPLOY_WORKFLOW_NODE_INPUT_INVALID');
  assert(workflow.permissions?.contents === 'read', 'DEPLOY_WORKFLOW_PERMISSIONS_INVALID');
  const route = workflow.jobs?.route;
  const execute = workflow.jobs?.execute;
  const fallback = workflow.jobs?.['hosted-startup-fallback'];
  assert(route?.['runs-on'] === 'ubuntu-24.04', 'DEPLOY_WORKFLOW_ROUTE_INVALID');
  assert(execute?.['runs-on'] === '${{ fromJSON(needs.route.outputs.runs_on) }}', 'DEPLOY_WORKFLOW_DYNAMIC_RUNNER_MISSING');
  assert(fallback?.['runs-on'] === 'ubuntu-24.04', 'DEPLOY_WORKFLOW_HOSTED_FALLBACK_MISSING');
  assert(String(fallback?.if).includes("core_started != 'true'"), 'DEPLOY_WORKFLOW_FALLBACK_SCOPE_INVALID');
  assert(action?.outputs?.started?.value === '${{ steps.started.outputs.value }}', 'DEPLOY_ACTION_STARTED_OUTPUT_MISSING');
  const startedStep = action?.runs?.steps?.findIndex((step) => step.id === 'started');
  const coreStep = action?.runs?.steps?.findIndex((step) => String(step.run ?? '').includes('scripts/runner-1-6.sh'));
  assert(startedStep >= 0 && coreStep > startedStep, 'DEPLOY_ACTION_STARTED_BOUNDARY_INVALID');
  const executeCore = execute?.steps?.find((step) => step.uses === './.github/actions/runner-1-6');
  const fallbackCore = fallback?.steps?.find((step) => step.uses === './.github/actions/runner-1-6');
  assert(executeCore && fallbackCore, 'DEPLOY_WORKFLOW_SHARED_CORE_MISSING');
  assert(executeCore.with.operation === '${{ inputs.operation }}' && fallbackCore.with.operation === '${{ inputs.operation }}', 'DEPLOY_WORKFLOW_OPERATION_BINDING_INVALID');
  const source = JSON.stringify(workflow);
  assert(!/final.?seal|closure|runner.?lease|writer.?lease|slot.?claim|readiness.?doctor/i.test(source), 'DEPLOY_WORKFLOW_RETIRED_AUTHORITY_PRESENT');
  return { commands: 1 };
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

function sameValues(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function assert(condition, code, detail) {
  if (!condition) throw new Error(detail === undefined ? code : `${code}:${detail}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const summary = validateDeploymentContract({
    adapter: JSON.parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.release.json'), 'utf8')),
    policy: JSON.parse(readFileSync(resolve(root, '02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json'), 'utf8')),
    workflow: parse(readFileSync(resolve(root, '.github/workflows/delivery-1-6.yml'), 'utf8')),
    action: parse(readFileSync(resolve(root, '.github/actions/runner-1-6/action.yml'), 'utf8')),
  });
  console.log(`deployment contract: project=${summary.project} targets=${summary.targets} channels=${summary.channels} nodes=${summary.nodes} physical=${summary.physicalDeployments} commands=${summary.workflowCommands}`);
}

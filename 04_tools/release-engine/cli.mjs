#!/usr/bin/env node
import { resolve } from 'node:path';

import { loadAdapter } from './src/adapter.mjs';
import { channelCommand } from './src/channel.mjs';
import { e06SovereignCommand } from './src/e06-sovereign.mjs';
import { asDeliveryError, deliveryErrorContract } from './src/errors.mjs';
import {
  baselineCommand,
  buildCommand,
  deployCommand,
  installCommand,
  packageCommand,
  planCommand,
  registerCurrentBaselineCommand,
  rollbackCommand,
  seedCommand,
  statusCommand,
  verifyCommand,
} from './src/engine.mjs';
import { layerCommand } from './src/layer.mjs';
import { classifyDeliveryFailure } from './src/retry.mjs';

const DEFAULT_ADAPTER = '02_platform_pingtai/infrastructure/release/zdt-next.release.json';
const commands = Object.freeze({
  plan: planCommand,
  install: installCommand,
  build: buildCommand,
  package: packageCommand,
  deploy: deployCommand,
  'register-current-baseline': registerCurrentBaselineCommand,
  verify: verifyCommand,
  rollback: rollbackCommand,
  baseline: baselineCommand,
  seed: seedCommand,
  status: statusCommand,
  layer: layerCommand,
  channel: channelCommand,
  'accept-e06': e06SovereignCommand,
});

let activeCommand = null;
try {
  const { command, options } = parseArguments(process.argv.slice(2));
  activeCommand = command;
  if (options.help || !command) {
    printHelp();
    process.exitCode = command ? 0 : 64;
  } else {
    const implementation = commands[command];
    if (!implementation) throw new Error(`UNKNOWN_COMMAND:${command}`);
    const loadedAdapter = await loadAdapter(options.adapter ?? process.env.AI_DELIVERY_ADAPTER ?? DEFAULT_ADAPTER, process.cwd());
    const adapter = Object.freeze({
      ...loadedAdapter,
      ...(options.projectRoot ? { projectRoot: resolve(options.projectRoot) } : {}),
      ...(options.stateDirectory ? { stateDirectory: options.stateDirectory } : {}),
    });
    const result = await implementation(adapter, options);
    printResult(result, options.format ?? 'human');
  }
} catch (unknown) {
  const error = asDeliveryError(unknown);
  const classification = classifyDeliveryFailure(error, commandStage(activeCommand));
  process.stderr.write(`${JSON.stringify({ ok: false, error: deliveryErrorContract(error, {
    stage: classification.stage, retryable: classification.retryable,
    attempts: Number(error.details?.attempts ?? 1), nextSafeAction: error.details?.nextSafeAction ?? classification.nextSafeAction,
    affectedCapability: activeCommand ?? 'argument-parsing', secretValues: Object.values(process.env),
  }) }, null, 2)}\n`);
  process.exitCode = 1;
}

function commandStage(command) {
  if (command === 'build') return 'build';
  return command ?? 'argument-parsing';
}

export function parseArguments(args) {
  const [command, ...rest] = args;
  const options = { nodes: [], files: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`ARGUMENT_INVALID:${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['direct', 'prepare', 'dryRun', 'externalBaseline', 'help'].includes(key)) {
      options[key] = true;
      continue;
    }
    const value = rest[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`ARGUMENT_VALUE_REQUIRED:${token}`);
    if (key === 'node') options.nodes.push(value);
    else if (key === 'file') {
      // Plans may accept repeated --file filters, while publish-evidence consumes
      // one exact evidence file. Preserve both representations so an evidence
      // upload does not silently lose its file argument.
      options.files.push(value);
      options.file = value;
    }
    else options[key] = value;
  }
  if (options.nodes.length === 1) options.node = options.nodes[0];
  return { command, options };
}

function printResult(result, format) {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify({ ok: true, result }, null, 2)}\n`);
    return;
  }
  const lines = [`AI 发布引擎：${result.schema}`, `项目：${result.project}`];
  if (result.runId) lines.push(`运行编号：${result.runId}`);
  if (result.targets) lines.push(`目标：${result.targets.map((target) => (typeof target === 'string' ? target : target.target)).join(', ') || '无'}`);
  if (result.selectedNodes) lines.push(`节点：${result.selectedNodes.join(', ') || '尚未选择（部署前必须显式指定）'}`);
  if (result.selectedRealms?.length) lines.push(`身份域：${result.selectedRealms.join(', ')}`);
  if (result.impactFlags?.length) lines.push(`核心影响：${result.impactFlags.join(', ')}`);
  if (result.requiredValidations) lines.push(`必需验证：${result.requiredValidations.map((item) => item.name).join(', ') || '无'}`);
  if (result.deploymentOrder) lines.push(`部署顺序：${result.deploymentOrder.join(' → ') || '无'}`);
  if (result.estimates) lines.push(`预计：${result.estimates.estimatedSeconds} 秒`);
  if (result.planPath) lines.push(`计划：${resolve(result.planPath)}`);
  if (result.buildPath) lines.push(`构建证据：${resolve(result.buildPath)}`);
  if (result.packagePath) lines.push(`制品清单：${resolve(result.packagePath)}`);
  if (result.timings)
    lines.push(
      `计时：${Object.entries(result.timings)
        .map(([name, milliseconds]) => `${name}=${milliseconds}ms`)
        .join(', ')}`
    );
  if (result.traffic)
    lines.push(
      `流量：${Object.entries(result.traffic)
        .map(([name, bytes]) => `${name}=${bytes}`)
        .join(', ')}`
    );
  process.stdout.write(`${lines.join('\n')}\n`);
}

function printHelp() {
  process.stdout.write(
    `Legacy recovery engine\n\nUsage:\n  node 04_tools/release-engine/cli.mjs <plan|install|build|package|deploy|verify|rollback|status|register-current-baseline|seed|baseline|layer|channel|accept-e06> [options]\n\nNormal releases use zdt-delivery release and never call this recovery CLI.\n`
  );
}

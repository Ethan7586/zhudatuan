#!/usr/bin/env node
import { resolve } from 'node:path';

import { loadAdapter } from './src/adapter.mjs';
import { asDeliveryError } from './src/errors.mjs';
import { buildCommand, deployCommand, installCommand, packageCommand, planCommand, rollbackCommand, seedCommand, statusCommand, verifyCommand } from './src/engine.mjs';
import { layerCommand } from './src/layer.mjs';

const DEFAULT_ADAPTER = '02_platform_pingtai/infrastructure/release/zdt-next.release.json';
const commands = Object.freeze({
  plan: planCommand,
  install: installCommand,
  build: buildCommand,
  package: packageCommand,
  deploy: deployCommand,
  verify: verifyCommand,
  rollback: rollbackCommand,
  seed: seedCommand,
  status: statusCommand,
  layer: layerCommand,
});

try {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (options.help || !command) {
    printHelp();
    process.exitCode = command ? 0 : 64;
  } else {
    const implementation = commands[command];
    if (!implementation) throw new Error(`UNKNOWN_COMMAND:${command}`);
    const adapter = await loadAdapter(options.adapter ?? process.env.AI_DELIVERY_ADAPTER ?? DEFAULT_ADAPTER, process.cwd());
    const result = await implementation(adapter, options);
    printResult(result, options.format ?? 'human');
  }
} catch (unknown) {
  const error = asDeliveryError(unknown);
  process.stderr.write(`${JSON.stringify({ ok: false, error: { code: error.code, message: error.message, details: error.details } }, null, 2)}\n`);
  process.exitCode = 1;
}

export function parseArguments(args) {
  const [command, ...rest] = args;
  const options = { nodes: [], files: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) throw new Error(`ARGUMENT_INVALID:${token}`);
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['dryRun', 'help'].includes(key)) {
      options[key] = true;
      continue;
    }
    const value = rest[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`ARGUMENT_VALUE_REQUIRED:${token}`);
    if (key === 'node') options.nodes.push(value);
    else if (key === 'file') options.files.push(value);
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
  const lines = [
    `AI 发布引擎：${result.schema}`,
    `项目：${result.project}`,
  ];
  if (result.lane) lines.push(`发布等级：${result.lane}`);
  if (result.runId) lines.push(`运行编号：${result.runId}`);
  if (result.targets) lines.push(`目标：${result.targets.map((target) => typeof target === 'string' ? target : target.target).join(', ') || '无'}`);
  if (result.selectedNodes) lines.push(`节点：${result.selectedNodes.join(', ') || '尚未选择（部署前必须显式指定）'}`);
  if (result.selectedRealms?.length) lines.push(`身份域：${result.selectedRealms.join(', ')}`);
  if (result.impactFlags?.length) lines.push(`核心影响：${result.impactFlags.join(', ')}`);
  if (result.estimates) lines.push(`预计：${result.estimates.minSeconds}–${result.estimates.maxSeconds} 秒`);
  if (result.planPath) lines.push(`计划：${resolve(result.planPath)}`);
  if (result.buildPath) lines.push(`构建证据：${resolve(result.buildPath)}`);
  if (result.packagePath) lines.push(`制品清单：${resolve(result.packagePath)}`);
  if (result.timings) lines.push(`计时：${Object.entries(result.timings).map(([name, milliseconds]) => `${name}=${milliseconds}ms`).join(', ')}`);
  if (result.traffic) lines.push(`流量：${Object.entries(result.traffic).map(([name, bytes]) => `${name}=${bytes}`).join(', ')}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function printHelp() {
  process.stdout.write(`统一 AI 发布引擎\n\n用法：\n  node 04_tools/release-engine/cli.mjs <plan|install|build|package|deploy|verify|rollback|status|seed|layer> [选项]\n\n关键选项：\n  --adapter <path>             项目适配器\n  --from <git-ref>             差异起点\n  --to <git-ref>               差异终点\n  --node <node-key>            目标节点，可重复\n  --plan <plan.json>           构建所用计划\n  --build <build.json>         打包所用构建证据\n  --package <package.json>     部署所用制品集合\n  --environment <candidate|production>\n  --approve-production <project:sha>\n  --mode <agent-candidate|agent|runtime-candidate|verify>\n  --approve-install <project:install:sha>\n  --target <target-id>         状态、回滚、初始登记或依赖层目标\n  --source-sha <sha>           安装或初始登记所对应的提交\n  --approve-seed <project:seed-layout:sha>\n  --source-node-modules <path> 依赖层来源（只在 A3 初始化使用）\n  --destination <path>         依赖层安装根目录\n  --dry-run                    只展示部署意图\n  --format <human|json>\n`);
}

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
  deployPreparedCommand,
  inspectPreparedCommand,
  installCommand,
  packageCommand,
  planCommand,
  publishCommand,
  publishEvidenceCommand,
  recoverPreparedCommand,
  registerCurrentBaselineCommand,
  rollbackCommand,
  runnerFinishedCommand,
  runnerStartedCommand,
  seedCommand,
  selectRunnerCommand,
  statusCommand,
  validatePreparedCommand,
  verifyCommand,
} from './src/engine.mjs';
import { layerCommand } from './src/layer.mjs';
import { verifyReproducibilityCommand } from './src/reproducibility.mjs';
import { classifyDeliveryFailure } from './src/retry.mjs';

const DEFAULT_ADAPTER = '02_platform_pingtai/infrastructure/release/zdt-next.release.json';
async function doctorCommand(adapter, options) {
  const doctor = await import('./src/doctor.mjs');
  return doctor.doctorCommand(adapter, options);
}

const commands = Object.freeze({
  plan: planCommand,
  install: installCommand,
  build: buildCommand,
  package: packageCommand,
  publish: publishCommand,
  'recover-prepared': recoverPreparedCommand,
  'inspect-prepared': inspectPreparedCommand,
  'publish-evidence': publishEvidenceCommand,
  'select-runner': selectRunnerCommand,
  'runner-started': runnerStartedCommand,
  'runner-finished': runnerFinishedCommand,
  'verify-reproducibility': verifyReproducibilityCommand,
  'validate-prepared': validatePreparedCommand,
  deploy: deployCommand,
  'deploy-prepared': deployPreparedCommand,
  'register-current-baseline': registerCurrentBaselineCommand,
  verify: verifyCommand,
  rollback: rollbackCommand,
  baseline: baselineCommand,
  seed: seedCommand,
  status: statusCommand,
  layer: layerCommand,
  channel: channelCommand,
  'accept-e06': e06SovereignCommand,
  doctor: doctorCommand,
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
    if (command === 'doctor' && result.readyForPrepare !== true) process.exitCode = 1;
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
  if (['select-runner', 'runner-started', 'runner-finished'].includes(command)) return 'runner-selection';
  if (command === 'publish') return 'oss-publication';
  if (command === 'build') return 'build';
  if (command === 'verify-reproducibility') return 'artifact-verification';
  if (command === 'validate-prepared') return 'candidate-validation';
  if (command === 'deploy-prepared') return 'deploy';
  if (command === 'doctor') return 'doctor';
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
    `统一 AI 发布引擎\n\n用法：\n  node 04_tools/release-engine/cli.mjs <plan|install|build|package|publish|verify-reproducibility|validate-prepared|deploy-prepared|register-current-baseline|deploy|verify|rollback|status|seed|baseline|layer|channel|accept-e06> [选项]\n\n关键选项：\n  --adapter <path>             项目适配器\n  --state-directory <path>     本次运行的隔离状态根\n  --from <git-ref>             差异起点；accept-e06 的制品 A\n  --to <git-ref>               差异终点；accept-e06 的制品 B\n  --node <node-key>            目标节点，可重复\n  --plan <plan.json>           构建所用计划\n  --build <build.json>         打包所用构建证据\n  --package <package.json>     部署或 Prepare 发布所用制品集合\n  --left-package <package.json>  确定性证明的第一个冷制品\n  --right-package <package.json> 确定性证明的第二个冷制品\n  --prepare                    强制单目标 Prepare，保留测试与类型检查\n  --environment <candidate|production>\n  --approve-production <project:sha>\n  --mode <agent-candidate|agent|runtime-candidate|runtime|verify>\n  --approve-install <project:install:sha>\n  --target <target-id>         计划、部署、状态、回滚、初始登记、依赖层或通道目标\n  --action <status|establish|deploy|rollback>\n  --source-sha <sha>           完整来源、安装、初始登记、基线导入或通道部署提交\n  --control-sha <sha>          当前发布控制面完整提交\n  --github-run-id <id>         GitHub Actions 运行编号\n  --github-run-attempt <n>     GitHub Actions 重试编号\n  --expected-remote-agent-sha256 <sha256>  预期远端 Agent 文件摘要\n  --expected-remote-policy-sha256 <sha256> 预期远端策略文件摘要\n  --legacy-run-id <id>         旧发布成功运行编号\n  --legacy-run-attempt <n>     旧发布运行尝试编号\n  --legacy-artifact-sha256 <sha256> 旧发布制品摘要（不带前缀）\n  --expected-current <path>    预期现役发布目录\n  --approve-seed <project:seed-layout:sha>\n  --approve-baseline <project:baseline:sha>\n  --source-node-modules <path> 依赖层来源\n  --destination <path>         依赖层安装根目录\n  --output <path>              输出回执或 accept-e06 证据目录\n  --summary <path>             accept-e06 的总验收回执\n  --image <image>              accept-e06 使用的本地 Docker 镜像\n  --dry-run                    只展示部署意图\n  --format <human|json>\n`
  );
  process.stdout.write('生产体检：doctor；需要 --source-sha、--control-sha、--target、--node、--repository，推荐 --format json。\n');
  process.stdout.write('Runner 路由：select-runner、runner-started、runner-finished；使用 --runner-observation、--runner-class、--lease-generation 和 --selected-runner-name。\n');
}

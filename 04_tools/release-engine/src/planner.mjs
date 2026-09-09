import { matchesAny } from './glob.mjs';
import { digest } from './stable.mjs';
import { changedFiles, currentHead, resolveGitRef } from './git.mjs';
import { invariant } from './errors.mjs';

const rank = Object.freeze({ NONE: -1, A0: 0, A1: 1, A2: 2, A3: 3 });

export async function createPlan(adapter, options = {}) {
  const fromRef = options.from ?? adapter.defaultBaseRef ?? 'HEAD^';
  const toRef = options.to ?? 'HEAD';
  const [fromSha, toSha] = await Promise.all([
    resolveGitRef(adapter.projectRoot, fromRef),
    resolveGitRef(adapter.projectRoot, toRef),
  ]);
  const changes = await changedFiles(adapter.projectRoot, fromSha, toSha, options.files ?? []);
  const initialClassification = classifyChanges(adapter, changes);
  const classification = await refineDynamicImpact(adapter, initialClassification, changes, { fromSha, toSha });
  const requestedNodes = options.nodes ?? [];
  for (const node of requestedNodes) invariant(Boolean(adapter.nodes[node]), 'PLAN_NODE_UNKNOWN', `Unknown node ${node}`);
  const eligibleNodes = eligibleNodesForTargets(adapter, classification.targets);
  const selectedNodes = requestedNodes.length === 0 ? [] : requestedNodes;
  for (const node of selectedNodes) {
    for (const target of classification.targets) {
      invariant(Boolean(adapter.nodes[node].deployments[target]), 'PLAN_NODE_TARGET_UNSUPPORTED', `${node} does not deploy ${target}`);
    }
  }
  const actions = materializeActions(adapter, classification.targets, selectedNodes, changes);
  const plan = {
    schema: 'ai.delivery.plan.v1',
    engineVersion: 1,
    project: adapter.project,
    adapter: adapter.adapterPath,
    from: { ref: fromRef, sha: fromSha },
    to: { ref: toRef, sha: toSha },
    lane: classification.lane,
    deployRequired: classification.lane !== 'NONE',
    changes,
    classifications: classification.files,
    reasons: classification.reasons,
    targets: classification.targets,
    eligibleNodes,
    selectedNodes,
    selectedRealms: selectedNodes.map((node) => adapter.nodes[node].realmId).filter(Boolean),
    impactFlags: classification.touches,
    actions,
    prohibitedRestarts: selectedNodes.flatMap((nodeKey) => Object.entries(adapter.nodes[nodeKey].deployments)
      .filter(([target]) => !classification.targets.includes(target))
      .map(([target, deployment]) => ({ node: nodeKey, target, service: deployment.service }))),
    productionApproval: { required: true, token: `${adapter.project}:${toSha}` },
    estimates: estimate(adapter, classification.lane, classification.targets),
    generatedAt: new Date().toISOString(),
  };
  return Object.freeze({ ...plan, planDigest: digest(plan) });
}

export function classifyChanges(adapter, changes) {
  if (changes.length === 0) return Object.freeze({ lane: 'NONE', targets: [], files: [], reasons: ['no changes'], touches: [], ambiguous: false });
  const files = [];
  const targets = new Set();
  const reasons = new Set();
  const touches = new Set();
  let lane = 'NONE';
  let ambiguous = false;

  for (const change of changes) {
    const paths = [change.path, change.sourcePath].filter(Boolean);
    const matched = adapter.rules.filter((rule) =>
      paths.some((path) => matchesAny(path, rule.include) && !matchesAny(path, rule.exclude ?? [])));
    if (matched.length === 0) {
      lane = 'A3';
      ambiguous = true;
      reasons.add(`unclassified:${change.path}`);
      files.push({ ...change, lane: 'A3', targets: [], rules: [], reason: 'unclassified path; fail-closed to A3' });
      continue;
    }
    const winningRank = Math.max(...matched.map((rule) => rank[rule.lane]));
    const winning = matched.filter((rule) => rank[rule.lane] === winningRank);
    const fileLane = winning[0].lane;
    if (winning.some((rule) => rule.lane !== fileLane)) ambiguous = true;
    if (rank[fileLane] > rank[lane]) lane = fileLane;
    for (const rule of winning) {
      for (const target of rule.targets ?? []) targets.add(target);
      for (const touch of rule.touches ?? []) touches.add(touch);
      reasons.add(rule.reason ?? rule.id);
    }
    files.push({
      ...change,
      lane: fileLane,
      targets: [...new Set(winning.flatMap((rule) => rule.targets ?? []))].sort(),
      rules: winning.map((rule) => rule.id).sort(),
      dynamicImpact: [...new Set(winning.map((rule) => rule.dynamicImpact).filter(Boolean))],
    });
  }

  const dependencyKeys = new Set(Object.values(adapter.targets)
    .flatMap((target) => target.dependencyLayer?.keyFiles ?? []));
  const changedDependencyKeys = changes
    .flatMap((change) => [change.path, change.sourcePath].filter(Boolean))
    .filter((path) => dependencyKeys.has(path));
  if (changedDependencyKeys.length > 0) {
    lane = 'A3';
    touches.add('dependency-layer');
    for (const path of [...new Set(changedDependencyKeys)].sort()) reasons.add(`dependency-layer-key:${path}`);
  }

  if (lane === 'NONE' && targets.size > 0) {
    lane = 'A3';
    ambiguous = true;
    reasons.add('non-deploying rules selected deploy targets');
  }
  if (lane === 'A2' && targets.size !== 1) {
    lane = 'A3';
    reasons.add(`A2 requires exactly one target; found ${targets.size}`);
  }
  if (lane === 'A1' && targets.size !== 1) {
    lane = 'A3';
    reasons.add(`A1 requires exactly one client target; found ${targets.size}`);
  }
  if ((lane === 'A0' || lane === 'A1') && [...targets].some((target) => adapter.targets[target]?.lane !== lane)) {
    lane = 'A3';
    reasons.add('mixed target lanes require A3');
  }
  if (lane === 'A3') {
    targets.clear();
    targets.add(adapter.fallbackTarget);
    for (let index = 0; index < files.length; index += 1) {
      if (files[index].lane !== 'NONE') files[index] = { ...files[index], lane: 'A3', targets: [adapter.fallbackTarget] };
    }
  }
  return Object.freeze({ lane, targets: [...targets].sort(), files, reasons: [...reasons].sort(), touches: [...touches].sort(), ambiguous });
}

async function refineDynamicImpact(adapter, classification, changes, refs) {
  const runtimeFiles = classification.files.filter((file) => file.lane !== 'NONE');
  const resolvers = [...new Set(runtimeFiles.flatMap((file) => file.dynamicImpact ?? []))];
  if (runtimeFiles.length === 0 || resolvers.length !== 1 || runtimeFiles.some((file) => (file.dynamicImpact ?? []).length !== 1)) return classification;
  const resolverId = resolvers[0];
  const definition = adapter.impactResolvers?.[resolverId];
  if (!definition) return classification;
  if (refs.toSha !== await currentHead(adapter.projectRoot)) {
    return { ...classification, reasons: [...classification.reasons, `dynamic impact ${resolverId} requires target commit checked out`] };
  }
  const resolver = await import(new URL(definition.module, `file://${adapter.adapterPath}`).href);
  invariant(typeof resolver.resolveImpact === 'function', 'IMPACT_RESOLVER_INVALID', `${resolverId} must export resolveImpact`);
  const impact = await resolver.resolveImpact({ adapter, changes, refs, definition });
  invariant(impact?.lane === 'A2' || impact?.lane === 'A3', 'IMPACT_RESULT_INVALID', `${resolverId} returned invalid lane`);
  if (impact.lane === 'A2') {
    invariant(Array.isArray(impact.targets) && impact.targets.length === 1 && adapter.targets[impact.targets[0]]?.lane === 'A2', 'IMPACT_TARGET_INVALID', `${resolverId} must select exactly one A2 target`);
  }
  return {
    ...classification,
    lane: impact.lane,
    targets: impact.lane === 'A2' ? impact.targets : [adapter.fallbackTarget],
    reasons: [...new Set([...(impact.reasons ?? [`dynamic:${resolverId}`])])].sort(),
    touches: classification.touches,
    files: classification.files.map((file) => file.lane === 'NONE' ? file : { ...file, lane: impact.lane, targets: impact.lane === 'A2' ? impact.targets : [adapter.fallbackTarget] }),
    ambiguous: impact.lane === 'A3',
  };
}

function eligibleNodesForTargets(adapter, targets) {
  if (targets.length === 0) return [];
  return Object.entries(adapter.nodes)
    .filter(([, node]) => targets.every((target) => Boolean(node.deployments[target])))
    .map(([key]) => key)
    .sort();
}

function materializeActions(adapter, targets, selectedNodes, changes) {
  const changed = changes.map((change) => change.path);
  const preflight = targets.some((target) => adapter.targets[target]?.lane !== 'A0')
    ? decorateCommands(adapter.buildPreflight ?? [], 'workspace', changed)
    : [];
  const tests = [];
  const typecheck = [];
  const build = [];
  const artifactInputs = [];
  for (const targetId of targets) {
    const target = adapter.targets[targetId];
    tests.push(...decorateCommands(target.tests, targetId, changed));
    typecheck.push(...decorateCommands(target.typecheck, targetId, changed));
    build.push(...decorateCommands(target.build, targetId, changed));
    artifactInputs.push(...target.artifactInputs.map((input) => ({ ...input, target: targetId })));
  }
  const deployments = selectedNodes.flatMap((nodeKey) => targets.map((targetId) => {
    const deployment = adapter.nodes[nodeKey].deployments[targetId];
    return {
      node: nodeKey,
      nodeId: adapter.nodes[nodeKey].nodeId,
      realmId: adapter.nodes[nodeKey].realmId,
      target: targetId,
      pointerRoot: deployment.pointerRoot,
      currentPointer: `${deployment.pointerRoot}/current`,
      previousPointer: `${deployment.pointerRoot}/previous`,
      service: deployment.service,
      restart: deployment.restart ?? 'systemd',
      health: deployment.health ?? [],
      productionEnabled: deployment.productionEnabled ?? true,
      productionDisabledReason: deployment.productionDisabledReason ?? null,
    };
  }));
  return { preflight, tests, typecheck, build, artifactInputs, deployments };
}

function decorateCommands(commands = [], target, changedFiles) {
  return commands.map((command) => ({ ...command, target, changedFiles }));
}

function estimate(adapter, lane, targets) {
  const laneEstimate = adapter.laneEstimates?.[lane] ?? { minSeconds: 0, maxSeconds: 0 };
  return {
    lane,
    minSeconds: laneEstimate.minSeconds,
    maxSeconds: laneEstimate.maxSeconds,
    targetCount: targets.length,
  };
}

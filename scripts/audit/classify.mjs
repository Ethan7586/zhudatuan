/**
 * Three-way classification for merging a working branch back into a clean baseline.
 *
 *   NEW       exists only on the branch            -> carry over
 *   NEWER     branch adds exports the base lacks   -> human judgement
 *   DEGRADED  base has exports the branch lost     -> discard the branch version
 *   TRIVIAL   identical export surface             -> low risk, diff review only
 *
 * Export surface is the signal because a directory-copy merge silently drops
 * whole functions; line count alone cannot tell a refactor from a truncation.
 */
import { execSync } from 'node:child_process';

const BASE = process.argv[2] ?? '77b0500';
const BRANCH = process.argv[3] ?? 'recovery/baseline-20260820';

function run(command) {
  try {
    return execSync(command, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function exportsOf(source) {
  const names = new Set();
  let match;
  const declaration = /export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;
  while ((match = declaration.exec(source)) !== null) names.add(match[1]);
  const list = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((match = list.exec(source)) !== null) {
    for (const piece of match[1].split(',')) {
      const parts = piece
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0]).trim();
      if (name) names.add(name);
    }
  }
  return names;
}

const files = run(`git diff --name-only ${BASE} ${BRANCH}`)
  .split('\n')
  .filter((file) => /\.(ts|tsx|sql)$/.test(file));

const buckets = { NEW: [], NEWER: [], DEGRADED: [], TRIVIAL: [] };

for (const file of files) {
  const before = run(`git show ${BASE}:"${file}"`);
  const after = run(`git show ${BRANCH}:"${file}"`);
  if (!before && after) {
    buckets.NEW.push({ file, lines: after.split('\n').length });
    continue;
  }
  if (!after) continue; // deleted on the branch; handled separately
  const baseExports = exportsOf(before);
  const branchExports = exportsOf(after);
  const lost = [...baseExports].filter((name) => !branchExports.has(name));
  const gained = [...branchExports].filter((name) => !baseExports.has(name));
  const entry = { file, lost, gained, delta: after.split('\n').length - before.split('\n').length };
  if (gained.length > 0) buckets.NEWER.push(entry);
  else if (lost.length > 0 || entry.delta < -20) buckets.DEGRADED.push(entry);
  else buckets.TRIVIAL.push(entry);
}

const LABELS = {
  NEW: '仅分支有 → 带过去',
  NEWER: '分支新增导出 → 需裁决',
  DEGRADED: '分支退化 → 丢弃分支版本',
  TRIVIAL: '导出面相同 → 低风险',
};

for (const key of ['NEW', 'NEWER', 'DEGRADED', 'TRIVIAL']) {
  const group = buckets[key];
  console.log(`\n=== ${key} (${group.length})  ${LABELS[key]} ===`);
  for (const entry of group) {
    if (key === 'NEW') {
      console.log(`  ${entry.file}  (${entry.lines} 行)`);
      continue;
    }
    console.log(`  ${entry.file}  (${entry.delta > 0 ? '+' : ''}${entry.delta})`);
    if (entry.gained.length > 0) console.log(`      新增: ${entry.gained.join(', ')}`);
    if (entry.lost.length > 0) console.log(`      丢失: ${entry.lost.join(', ')}`);
  }
}

console.log(`\n总计 ${files.length} 个差异文件`);

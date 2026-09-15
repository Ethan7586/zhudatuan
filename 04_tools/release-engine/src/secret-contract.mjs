import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { parse } from 'yaml';

export async function loadWorkflowDocuments(root) {
  const directory = join(root, '.github/workflows');
  const names = (await readdir(directory)).filter((name) => /\.ya?ml$/.test(name));
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, parse(await readFile(join(directory, name), 'utf8'))])));
}

export function auditWorkflowSecretContracts(workflows) {
  const issues = [];
  const graph = [];
  for (const [name, workflow] of Object.entries(workflows)) {
    const declared = workflow?.on?.workflow_call?.secrets ?? {};
    const used = secretReferences(workflow);
    if (workflow?.on?.workflow_call) {
      for (const secret of used) if (!declared[secret]) issues.push(issue('SECRET_USED_BUT_NOT_DECLARED', name, secret));
    }
    for (const [jobName, job] of Object.entries(workflow?.jobs ?? {})) {
      if (typeof job?.uses !== 'string' || !job.uses.startsWith('./.github/workflows/')) continue;
      const calleeName = basename(job.uses);
      const callee = workflows[calleeName];
      if (!callee) { issues.push(issue('SECRET_CALLEE_MISSING', name, calleeName, jobName)); continue; }
      const required = Object.entries(callee?.on?.workflow_call?.secrets ?? {}).filter(([, spec]) => spec?.required === true).map(([secret]) => secret);
      const passed = job.secrets && job.secrets !== 'inherit' ? job.secrets : {};
      if (job.secrets === 'inherit') issues.push(issue('SECRET_INHERIT_FORBIDDEN', name, '*', jobName));
      for (const secret of required) {
        if (workflow?.on?.workflow_call && !declared[secret]) issues.push(issue('SECRET_CALLER_DECLARATION_MISSING', name, secret, jobName));
        if (passed[secret] !== `\${{ secrets.${secret} }}`) issues.push(issue('SECRET_EXPLICIT_PASS_MISSING', name, secret, jobName));
      }
      for (const [target, expression] of Object.entries(passed)) {
        const match = String(expression).match(/^\$\{\{ secrets\.([A-Z0-9_]+) \}\}$/);
        if (!match || match[1] !== target) issues.push(issue('SECRET_NAME_DRIFT', name, target, jobName));
      }
      graph.push({ caller: name, job: jobName, callee: calleeName, required, passed: Object.keys(passed).sort() });
    }
    const identity = workflowIdentity(name);
    if (identity === 'build' && used.has('ZDT_RELEASE_SSH_KEY')) issues.push(issue('SECRET_IDENTITY_ROLE_MISMATCH', name, 'ZDT_RELEASE_SSH_KEY'));
  }
  return Object.freeze({ ok: issues.length === 0, issues, graph });
}

function secretReferences(value) {
  const found = new Set();
  for (const match of JSON.stringify(value).matchAll(/secrets\.([A-Z0-9_]+)/g)) found.add(match[1]);
  return found;
}

function workflowIdentity(name) {
  if (name === 'prepare-artifact-aliyun.yml') return 'build';
  if (name === 'deploy-prepared-aliyun.yml') return 'release';
  return 'orchestrator';
}

function issue(code, workflow, secret, job = null) {
  return Object.freeze({ code, workflow, job, secret });
}

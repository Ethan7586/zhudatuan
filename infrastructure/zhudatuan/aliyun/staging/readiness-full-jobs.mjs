import { readFile } from 'node:fs/promises';
import { FULL_ROOT, digest, matchEvidence, systemdState } from './readiness-common.mjs';

export async function verifyLiveFullJobs(evidence, observed) {
  const missing = ['live:full-jobs:provider-sandbox-not-integrated'];
  try {
    const unit = await readFile(`${FULL_ROOT}/current/infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-jobs.service`, 'utf8');
    if (!unit.includes('ExecCondition=/usr/bin/false') || /^\[Install\]$/mu.test(unit)) {
      missing.push('live:full-jobs:fail-closed-unit-contract');
    }
    const state = await systemdState('zhudatuan-staging-full-jobs.service');
    if (state.active !== 'inactive' || state.sub !== 'dead' || state.unitFile !== 'static') {
      missing.push('live:systemd:full-jobs-must-remain-inactive');
    }
    matchEvidence(evidence, 'fullJobs.systemdStateSha256', digest(state.line), missing, observed);
  } catch {
    missing.push('live:systemd:full-jobs');
  }
  return [...new Set(missing)];
}

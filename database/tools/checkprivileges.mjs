import { join } from 'node:path';
import { repositoryRoot } from '../../scripts/lib/RepositoryRoot.mjs';
import { businessNumber, emitEvidence, requestId, runNode } from './Evidence.mjs';

const root = repositoryRoot;
const startedAt = performance.now();
const result = await runNode(root, join(root, 'scripts', 'audit', 'database-contracts.mjs'), ['--privileges']);
const marker = result.stdout
  .split('\n')
  .find((line) => line.startsWith('PRIVILEGE_EVIDENCE:'));

if (result.code !== 0 || !marker) {
  const source = result.stderr || result.stdout || 'privilege verification failed';
  const code = source.match(/(MODULE_WRITER_CROSS_SCHEMA|MODULE_READER_CAN_WRITE|PUBLIC_DATABASE_PRIVILEGE|MODULE_ROLE_UNSAFE)/)?.[1] ?? 'DATABASE_PRIVILEGE_ASSERT_FAILED';
  emitEvidence(
    {
      status: 'failed',
      requestId: requestId(),
      failure: {
        table: 'database.privilege',
        constraint: code,
        sampleBusinessNumber: businessNumber(code),
      },
      secretValuesEmitted: false,
      durationMs: Math.round(performance.now() - startedAt),
    },
    1
  );
} else {
  emitEvidence({
    status: 'passed',
    requestId: requestId(),
    ...JSON.parse(marker.slice('PRIVILEGE_EVIDENCE:'.length)),
    secretValuesEmitted: false,
    durationMs: Math.round(performance.now() - startedAt),
  });
}

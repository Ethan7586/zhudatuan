import { describe, expect, it } from 'vitest';
import { createConsoleStaticTransferPlan } from './ConsoleStaticTransfer';

describe('console static transfer', () => {
  it('uploads hashed assets before switching entry files', () => {
    const plan = createConsoleStaticTransferPlan('/workspace/dist', 'root@example.test', '/srv/console');

    expect(plan.map((step) => step.label)).toEqual(['assets', 'entry']);
    expect(plan[0]?.args).toEqual([
      '--archive',
      '--compress',
      '/workspace/dist/assets/',
      'root@example.test:/srv/console/assets/',
    ]);
    expect(plan[1]?.args).toEqual([
      '--archive',
      '--compress',
      '--exclude',
      'assets/',
      '/workspace/dist/',
      'root@example.test:/srv/console/',
    ]);
  });

  it('keeps prior hashed assets available for already-open pages', () => {
    const plan = createConsoleStaticTransferPlan('/workspace/dist', 'root@example.test', '/srv/console');

    expect(plan.flatMap((step) => step.args)).not.toContain('--delete');
  });
});

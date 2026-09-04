import { describe, expect, it, vi } from 'vitest';
import type { JobsEnvironment } from '@shop/config/server';
import { runJobs } from './JobsEntrypoint';

describe('Jobs entrypoint', () => {
  it.each([
    ['full', 'full'],
    ['identity-notification-only', 'identityNotificationOnly'],
  ] as const)('loads only the %s runtime', async (profile, selected) => {
    const full = vi.fn(async () => undefined);
    const identityNotificationOnly = vi.fn(async () => undefined);
    const environment: JobsEnvironment = { JOB_RUNTIME_PROFILE: profile };
    await runJobs(environment, { full, identityNotificationOnly });
    expect({ full, identityNotificationOnly }[selected]).toHaveBeenCalledOnce();
    expect({ full, identityNotificationOnly }[selected === 'full' ? 'identityNotificationOnly' : 'full']).not.toHaveBeenCalled();
  });

  it('fails closed instead of defaulting to the full runtime', async () => {
    const runners = { full: vi.fn(async () => undefined), identityNotificationOnly: vi.fn(async () => undefined) };
    await expect(runJobs({}, runners)).rejects.toThrow('JOB_RUNTIME_PROFILE_INVALID');
    expect(runners.full).not.toHaveBeenCalled();
    expect(runners.identityNotificationOnly).not.toHaveBeenCalled();
  });
});

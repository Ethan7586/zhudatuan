import { describe, expect, it, vi } from 'vitest';
import { PublishExperience, type ExperiencePublishRequest } from './PublishExperience';

const request: ExperiencePublishRequest = Object.freeze({
  event: 'event:one',
  application: 'application:one',
  release: 'release:one',
  version: 'version:one',
  path: 'experience/one.json',
  hash: 'a'.repeat(64),
  scope: 'tenant:one',
  trace: 'trace:one',
  signal: new AbortController().signal,
  deadline: Date.now() + 10_000,
});

describe('PublishExperience', () => {
  it('completes the inbox only after the entry cache is precisely invalidated', async () => {
    const complete = vi.fn(async () => undefined);
    const activate = vi.fn(async () => ({ active: true, malls: ['mall:one'], handles: ['mall-one'] }));
    const remove = vi.fn().mockRejectedValueOnce(new Error('REDIS_UNAVAILABLE')).mockResolvedValue(undefined);
    const process = new PublishExperience(
      {
        read: async (_options: unknown, work: (context: never) => Promise<unknown>) => work({} as never),
        write: async (_options: unknown, work: (context: never) => Promise<unknown>) => work({} as never),
      } as never,
      {
        target: async () => ({ application: request.application, configuration: { version: 2 }, hash: request.hash, effectiveAt: '2026-09-01T00:00:00.000Z', release: request.release, state: 'active', version: request.version }),
        activate,
        complete,
      },
      { publish: async () => ({ reference: 'object:one', sha256: request.hash, size: 42 }) } as never,
      { get: vi.fn(), put: vi.fn(async () => true), remove } as never,
      { publication: vi.fn(), resolve: vi.fn(), states: vi.fn() }
    );

    await expect(process.execute(request)).rejects.toThrow('REDIS_UNAVAILABLE');
    expect(complete).not.toHaveBeenCalled();

    await expect(process.execute(request)).resolves.toBeUndefined();
    expect(activate).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

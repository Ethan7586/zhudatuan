import { describe, expect, it, vi } from 'vitest';
import { createKeyedActionCoordinator } from './KeyedActionCoordinator';

describe('KeyedActionCoordinator', () => {
  it('deduplicates repeated starts for one key', async () => {
    const coordinator = createKeyedActionCoordinator<string>();
    const action = vi.fn(async () => 'done');
    const first = coordinator.start('login', action);
    const duplicates = Array.from({ length: 4 }, () => coordinator.start('login', action));

    expect(first.started).toBe(true);
    expect(duplicates.every((attempt) => !attempt.started)).toBe(true);
    await expect(Promise.all([first.promise, ...duplicates.map((attempt) => attempt.promise)])).resolves.toEqual(
      Array(5).fill('done'),
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('runs unrelated keys independently', async () => {
    const coordinator = createKeyedActionCoordinator<string>();
    const pending = new Map<string, () => void>();
    const action = (key: string) => coordinator.start(key, async () => new Promise<string>((resolve) => pending.set(key, () => resolve(key))));
    const login = action('login');
    const code = action('code');
    await Promise.resolve();

    expect(coordinator.isRunning('login')).toBe(true);
    expect(coordinator.isRunning('code')).toBe(true);
    pending.get('code')?.();
    await expect(code.promise).resolves.toBe('code');
    expect(coordinator.isRunning('login')).toBe(true);
    pending.get('login')?.();
    await expect(login.promise).resolves.toBe('login');
  });

  it('marks a cancelled late response as stale', async () => {
    const coordinator = createKeyedActionCoordinator<string>();
    let resolve!: (value: string) => void;
    const attempt = coordinator.start('login', async () => new Promise<string>((done) => {
      resolve = done;
    }));
    await Promise.resolve();
    coordinator.cancel('login');
    resolve('late');

    await expect(attempt.promise).resolves.toBe('late');
    expect(coordinator.isLatest('login', attempt.revision)).toBe(false);
  });

  it('aborts active actions and rejects new work after disposal', async () => {
    const coordinator = createKeyedActionCoordinator<string>();
    let signal!: AbortSignal;
    const attempt = coordinator.start('login', async (context) => {
      signal = context.signal;
      return 'done';
    });
    await Promise.resolve();
    coordinator.dispose();

    expect(signal.aborted).toBe(true);
    expect(coordinator.isLatest('login', attempt.revision)).toBe(false);
    expect(() => coordinator.start('login', async () => 'again')).toThrow('KEYED_ACTION_COORDINATOR_DISPOSED');
    await attempt.promise;
  });
});

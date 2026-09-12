import { describe, expect, it, vi } from 'vitest';
import {
  clearDynamicImportRecoveryAfterStableBoot,
  isDynamicImportFailure,
  recoverFromDynamicImportFailure,
  type DynamicImportRecoveryRuntime,
} from './DynamicImportRecovery';

describe('dynamic import recovery', () => {
  it('recognizes browser and bundler dynamic import failures', () => {
    expect(isDynamicImportFailure(new TypeError('Failed to fetch dynamically imported module: https://console.example/assets/Route.js'))).toBe(true);
    expect(isDynamicImportFailure(new Error('ChunkLoadError: Loading chunk AccessRoute failed'))).toBe(true);
    expect(isDynamicImportFailure(new Error('REQUEST_FAILED'))).toBe(false);
  });

  it('reloads only once inside the recovery window', () => {
    const runtime = fixtureRuntime(1_000);
    const failure = new TypeError('Failed to fetch dynamically imported module: /assets/AccessRoute.js');

    expect(recoverFromDynamicImportFailure(failure, runtime)).toBe(true);
    expect(recoverFromDynamicImportFailure(failure, runtime)).toBe(false);
    expect(runtime.reload).toHaveBeenCalledTimes(1);
  });

  it('clears the reload marker only after a stable boot', () => {
    const runtime = fixtureRuntime(1_000);
    const failure = new TypeError('Importing a module script failed');
    expect(recoverFromDynamicImportFailure(failure, runtime)).toBe(true);

    clearDynamicImportRecoveryAfterStableBoot(runtime);
    expect(runtime.storage.getItem('console.dynamic-import-recovery-at')).toBe('1000');
    expect(runtime.later).toHaveBeenCalledWith(expect.any(Function), 15_000);
    runtime.runLater();
    expect(runtime.storage.getItem('console.dynamic-import-recovery-at')).toBeNull();
  });
});

function fixtureRuntime(now: number): DynamicImportRecoveryRuntime & Readonly<{ runLater: () => void }> {
  const values = new Map<string, string>();
  let callback: (() => void) | undefined;
  return {
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    now: () => now,
    reload: vi.fn(),
    later: vi.fn((next) => {
      callback = next;
    }),
    runLater: () => callback?.(),
  };
}

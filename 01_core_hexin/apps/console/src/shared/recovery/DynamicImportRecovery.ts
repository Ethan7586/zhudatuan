const RECOVERY_MARKER = 'console.dynamic-import-recovery-at';
const RECOVERY_WINDOW_MS = 60_000;
const STABLE_BOOT_MS = 15_000;
const DYNAMIC_IMPORT_FAILURE = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .* failed|chunkloaderror/i;

export interface DynamicImportRecoveryRuntime {
  readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  readonly now: () => number;
  readonly reload: () => void;
  readonly later: (callback: () => void, delay: number) => void;
}

export function isDynamicImportFailure(cause: unknown): boolean {
  let current = cause;
  const visited = new Set<unknown>();
  for (let depth = 0; depth < 4 && current !== undefined && current !== null && !visited.has(current); depth += 1) {
    visited.add(current);
    const message = current instanceof Error ? current.message : typeof current === 'string' ? current : '';
    if (DYNAMIC_IMPORT_FAILURE.test(message)) return true;
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return false;
}

export function recoverFromDynamicImportFailure(
  cause: unknown,
  runtime: DynamicImportRecoveryRuntime = browserRuntime(),
): boolean {
  if (!isDynamicImportFailure(cause)) return false;
  const now = runtime.now();
  try {
    const recoveredAt = Number(runtime.storage.getItem(RECOVERY_MARKER));
    if (Number.isFinite(recoveredAt) && recoveredAt > 0 && now - recoveredAt < RECOVERY_WINDOW_MS) return false;
    runtime.storage.setItem(RECOVERY_MARKER, String(now));
  } catch {
    return false;
  }
  runtime.reload();
  return true;
}

export function clearDynamicImportRecoveryAfterStableBoot(
  runtime: DynamicImportRecoveryRuntime = browserRuntime(),
): void {
  runtime.later(() => {
    try {
      runtime.storage.removeItem(RECOVERY_MARKER);
    } catch {
      // Storage may be unavailable; keeping the marker is safer than a reload loop.
    }
  }, STABLE_BOOT_MS);
}

function browserRuntime(): DynamicImportRecoveryRuntime {
  return {
    storage: window.sessionStorage,
    now: Date.now,
    reload: () => window.location.reload(),
    later: (callback, delay) => {
      window.setTimeout(callback, delay);
    },
  };
}

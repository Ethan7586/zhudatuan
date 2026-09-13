const SESSION_HINT_KEY = 'morvia:console-session:v1';
const RESUME_ATTEMPT_KEY = 'morvia:console-resume-attempt:v1';
const SESSION_HINT_TTL_MS = 12 * 60 * 60 * 1_000;
const RESUME_LOOP_WINDOW_MS = 20_000;

interface StoredConsoleResume {
  readonly origin: string;
  readonly recordedAt: number;
}

export function rememberConsoleSession(origin: string, now = Date.now()): void {
  write(window.localStorage, SESSION_HINT_KEY, { origin, recordedAt: now });
}

export function markConsoleResumeAttempt(origin: string, now = Date.now()): void {
  write(window.sessionStorage, RESUME_ATTEMPT_KEY, { origin, recordedAt: now });
}

export function claimRecentConsoleSession(origin: string, now = Date.now()): boolean {
  const hint = read(window.localStorage, SESSION_HINT_KEY);
  if (hint === null || hint.origin !== origin || now - hint.recordedAt > SESSION_HINT_TTL_MS) {
    remove(window.localStorage, SESSION_HINT_KEY);
    return false;
  }
  const attempt = read(window.sessionStorage, RESUME_ATTEMPT_KEY);
  if (attempt !== null && attempt.origin === origin && now - attempt.recordedAt < RESUME_LOOP_WINDOW_MS) {
    remove(window.localStorage, SESSION_HINT_KEY);
    remove(window.sessionStorage, RESUME_ATTEMPT_KEY);
    return false;
  }
  markConsoleResumeAttempt(origin, now);
  return true;
}

function read(storage: Storage, key: string): StoredConsoleResume | null {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? 'null') as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = parsed as Partial<StoredConsoleResume>;
    if (typeof value.origin !== 'string' || typeof value.recordedAt !== 'number' || !Number.isFinite(value.recordedAt)) return null;
    return { origin: value.origin, recordedAt: value.recordedAt };
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: StoredConsoleResume): void {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* Storage is an optional acceleration hint. */ }
}

function remove(storage: Storage, key: string): void {
  try { storage.removeItem(key); } catch { /* Storage is an optional acceleration hint. */ }
}

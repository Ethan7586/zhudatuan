import type { WorkerEnv } from './types';

const MAX_BYPASS_IPS = 32;
const MAX_BYPASS_DURATION_MS = 24 * 60 * 60 * 1000;
const ISO_WITH_TIMEZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Reads the client address that the origin proxy overwrites after validating
 * its trusted proxy chain. Never fall back to a browser-supplied forwarding
 * header here.
 */
export function readTrustedClientIp(request: Request): string | null {
  return normalizeClientIp(request.headers.get('x-real-ip'));
}

export function normalizeClientIp(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input || input.toLowerCase() === 'unknown' || /[\s,/\[\]%]/.test(input)) return null;

  const ipv4 = normalizeIpv4(input);
  if (ipv4) return ipv4;
  if (!input.includes(':')) return null;

  try {
    const hostname = new URL(`http://[${input}]/`).hostname;
    if (!hostname.startsWith('[') || !hostname.endsWith(']')) return null;
    const ipv6 = hostname.slice(1, -1).toLowerCase();
    return ipv6.includes(':') ? ipv6 : null;
  } catch {
    return null;
  }
}

/**
 * Test-only, exact-address bypass for the login failure limiter. Invalid,
 * ambiguous or expired configuration fails closed.
 */
export function isTestLoginRateLimitBypassed(clientIp: string | null, env: WorkerEnv, nowMs = Date.now()): boolean {
  if (env.APP_ENV !== 'test' || env.AUTH_MODE !== 'test') return false;
  const normalizedClientIp = normalizeClientIp(clientIp);
  if (!normalizedClientIp) return false;

  const expiresAt = parseExpiry(env.TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL);
  const startsAt = parseExpiry(env.TEST_LOGIN_RATE_LIMIT_BYPASS_FROM);
  if (startsAt === null || expiresAt === null || nowMs < startsAt || nowMs >= expiresAt || expiresAt <= startsAt || expiresAt - startsAt > MAX_BYPASS_DURATION_MS) return false;

  const allowlist = parseAllowlist(env.TEST_LOGIN_RATE_LIMIT_BYPASS_IPS);
  return allowlist?.has(normalizedClientIp) ?? false;
}

function normalizeIpv4(input: string): string | null {
  const parts = input.split('.');
  if (parts.length !== 4) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    numbers.push(value);
  }
  return numbers.join('.');
}

function parseAllowlist(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const entries = raw.split(',');
  if (entries.length === 0 || entries.length > MAX_BYPASS_IPS) return null;

  const normalized = new Set<string>();
  for (const entry of entries) {
    const ip = normalizeClientIp(entry);
    if (!ip) return null;
    normalized.add(ip);
  }
  return normalized.size > 0 ? normalized : null;
}

function parseExpiry(raw: string | undefined): number | null {
  const input = raw?.trim();
  const match = input?.match(ISO_WITH_TIMEZONE);
  if (!input || !match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', , , , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText ?? '0');
  const offsetMinute = Number(offsetMinuteText ?? '0');
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) || hour > 23 || minute > 59 || second > 59 || offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;

  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

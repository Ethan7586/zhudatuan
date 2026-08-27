import type { AuthTarget } from '@shop/config/server';
import { reject, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationUsecase } from '../../foundation/application/OperationHandler';
import type { RiskGate } from '../../foundation/security/RiskGate';

export async function assertPublicRisk(risk: RiskGate, request: Parameters<OperationUsecase['invoke']>[0], subject: string, client: string): Promise<void> {
  const { outcome } = await risk.evaluate({
    actor: { id: `public:${subject.slice(0, 24)}`, session: `public:${client.slice(0, 24)}`, membership: 'public', credentialVersion: 0,
      accessVersion: 0, target: 'storefront', assurance: { level: 0 } },
    operation: request.type, scope: { kind: 'self', id: 'identity', path: [] },
    trace: request.input.headers['x-trace-id'] ?? request.input.idempotency ?? `public:${client.slice(0, 24)}`,
    signals: { 'login.attempt': 1 },
  });
  if (outcome !== 'allow') reject(outcome === 'review' ? 423 : 403,
    outcome === 'challenge' ? 'STEPUP_REQUIRED' : outcome === 'review' ? 'RISK_REVIEW_REQUIRED' : 'RISK_DENIED');
}

export function sessionCookies(token: string, csrf: string, maxAge: number): Readonly<Record<string, string>> {
  const expiry = maxAge === 0 ? '; Expires=Thu, 01 Jan 1970 00:00:00 GMT' : '';
  return Object.freeze({
    'set-cookie': `shop_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax${expiry}`,
    'x-set-cookie': `shop_csrf=${encodeURIComponent(csrf)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Strict${expiry}`,
  });
}

export function requestCookie(value: string | undefined, name: string): string | undefined {
  for (const part of value?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function authTarget(value: string): AuthTarget {
  const target = value === 'operator' ? 'console' : value;
  if (!['console', 'storefront', 'store', 'supplier'].includes(target)) throw new Error('AUTH_RETURN_TARGET_INVALID');
  return target as AuthTarget;
}

export async function assertLoginAllowed(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void> {
  for (const [subject, client] of keys) {
    const result = await database.query<{ locked: boolean }>(`select locked_until>clock_timestamp() locked from identity.loginattempt
      where subject_hash=$1 and client_hash=$2 for update`, [subject, client]);
    if (result.rows[0]?.locked) reject(429, 'RATE_LIMITED');
  }
}

export async function recordLoginFailure(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void> {
  for (const [subject, client] of keys) await database.query(`insert into identity.loginattempt(subject_hash,client_hash,window_started_at,failures,locked_until)
    values($1,$2,clock_timestamp(),1,null) on conflict(subject_hash,client_hash) do update set
      failures=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '15 minutes' then 1 else identity.loginattempt.failures+1 end,
      window_started_at=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '15 minutes' then clock_timestamp() else identity.loginattempt.window_started_at end,
      locked_until=case when (case when identity.loginattempt.window_started_at<clock_timestamp()-interval '15 minutes' then 1 else identity.loginattempt.failures+1 end)>=5
        then clock_timestamp()+interval '15 minutes' else identity.loginattempt.locked_until end`, [subject, client]);
}

export async function consumeChallengeRate(database: OperationDatabase, keys: readonly (readonly [string, string])[]): Promise<void> {
  for (const [subject, client] of keys) {
    const result = await database.query<{ failures: number }>(`insert into identity.loginattempt(subject_hash,client_hash,window_started_at,failures,locked_until)
      values($1,$2,clock_timestamp(),1,null) on conflict(subject_hash,client_hash) do update set
        failures=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '10 minutes' then 1 else identity.loginattempt.failures+1 end,
        window_started_at=case when identity.loginattempt.window_started_at<clock_timestamp()-interval '10 minutes' then clock_timestamp() else identity.loginattempt.window_started_at end
      returning failures`, [subject, client]);
    if ((result.rows[0]?.failures ?? 0) > 5) reject(429, 'RATE_LIMITED');
  }
}

export async function consumeChallenge(database: OperationDatabase, challenge: string, code: string,
  digest: (id: string, code: string) => string, principal?: string): Promise<{ principal_id: string | null }> {
  const result = await database.query<{ principal_id: string | null }>(`update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
    where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp() and attempts<10
      and ($3::text is null or principal_id=$3) returning principal_id`, [challenge, digest(challenge, code), principal ?? null]);
  if (!result.rows[0]) {
    await database.query('update identity.challenge set attempts=least(10,attempts+1) where id=$1 and consumed_at is null', [challenge]);
    reject(400, 'CHALLENGE_INVALID');
  }
  return result.rows[0]!;
}

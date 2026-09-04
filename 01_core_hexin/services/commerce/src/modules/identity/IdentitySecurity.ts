import type { AuthTarget } from '@shop/config/server';
import { reject, type OperationDatabase } from '../../foundation/application/ModuleOperations';

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

export async function consumeChallenge(database: OperationDatabase, challenge: string, code: string,
  digest: (id: string, code: string) => string, principal?: string,
  expected: Readonly<{ purpose?: string; destinationHash?: string; sessionHash?: string }> = {}): Promise<{ principal_id: string | null }> {
  const result = await database.query<{ principal_id: string | null }>(`update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
    where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp()
      and ($3::text is null or principal_id=$3)
      and ($4::text is null or purpose=$4)
      and ($5::text is null or destination_hash=$5)
      and ($6::text is null or session_hash=$6)
    returning principal_id`, [challenge, digest(challenge, code), principal ?? null, expected.purpose ?? null,
    expected.destinationHash ?? null, expected.sessionHash ?? null]);
  if (!result.rows[0]) {
    await database.query('update identity.challenge set attempts=attempts+1 where id=$1 and consumed_at is null', [challenge]);
    reject(400, 'CHALLENGE_INVALID');
  }
  return result.rows[0]!;
}

import type { AuthTarget } from '@shop/config/server';
import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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

export function authMembershipTarget(target: AuthTarget): AuthTarget {
  return target;
}

export async function consumeChallenge(database: OperationDatabase, challenge: string, code: string,
  digest: (id: string, code: string) => string, principal?: string,
  expected: Readonly<{ purpose?: string; destinationHash?: string; sessionHash?: string; realmId?: string; accountId?: string }> = {}
): Promise<{ principal_id: string | null; realm_id: string | null; account_id: string | null }> {
  const result = await database.query<{ principal_id: string | null; realm_id: string | null; account_id: string | null }>(`update identity.challenge set consumed_at=clock_timestamp(),attempts=attempts+1
    where id=$1 and code_hash=$2 and consumed_at is null and expires_at>clock_timestamp()
      and ($3::text is null or principal_id=$3)
      and ($4::text is null or purpose=$4)
      and ($5::text is null or destination_hash=$5)
      and ($6::text is null or session_hash=$6)
      and ($7::text is null or realm_id=$7)
      and ($8::text is null or account_id=$8)
    returning principal_id,realm_id,account_id`, [challenge, digest(challenge, code), principal ?? null, expected.purpose ?? null,
    expected.destinationHash ?? null, expected.sessionHash ?? null, expected.realmId ?? null, expected.accountId ?? null]);
  if (!result.rows[0]) {
    await database.query(`update identity.challenge set attempts=attempts+1
      where id=$1 and consumed_at is null
        and ($2::text is null or principal_id=$2)
        and ($3::text is null or purpose=$3)
        and ($4::text is null or destination_hash=$4)
        and ($5::text is null or session_hash=$5)
        and ($6::text is null or realm_id=$6)
        and ($7::text is null or account_id=$7)`, [challenge, principal ?? null, expected.purpose ?? null,
      expected.destinationHash ?? null, expected.sessionHash ?? null, expected.realmId ?? null, expected.accountId ?? null]);
    reject(400, 'CHALLENGE_INVALID');
  }
  return result.rows[0]!;
}

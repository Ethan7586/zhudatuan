import { DomainError } from '../error/DomainError';
import { isOperationTarget } from '@shop/contract';
import { createHash } from 'node:crypto';
import type { DatabasePool } from '../database/Pool';
import type { Actor } from './AccessContext';
import type { SessionResolver } from './SessionResolver';

interface SessionRow {
  readonly actor_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly credential_version: number;
  readonly access_version: number;
  readonly target: Actor['target'];
  readonly assurance_level: number;
  readonly assurance_verified_at: Date | null;
}

export class PgSessionResolver implements SessionResolver {
  constructor(private readonly pool: DatabasePool) {}

  async resolve(headers: Readonly<Record<string, string>>, _operation: string): Promise<Actor> {
    const target = headers['x-client-target'];
    if (target !== undefined && !isOperationTarget(target)) throw new Error('AUTH_TARGET_INVALID');
    const token = bearer(headers.authorization) ?? (target === undefined ? null : cookie(headers.cookie, `__Host-${target}-session`));
    if (!token) throw new DomainError('AUTHENTICATION_REQUIRED');
    const result = await this.pool.query<SessionRow>('select actor_id,session_id,membership_id,credential_version,access_version,target,assurance_level,assurance_verified_at from identity.resolve_session($1)', [
      createHash('sha256').update(token).digest('hex'),
    ]);
    const row = result.rows[0];
    if (!row) throw new DomainError('AUTHENTICATION_REQUIRED');
    if (target !== undefined && row.target !== target) throw new Error('AUTH_TARGET_MISMATCH');
    return Object.freeze({
      id: row.actor_id,
      session: row.session_id,
      membership: row.membership_id,
      credentialVersion: Number(row.credential_version),
      accessVersion: Number(row.access_version),
      target: row.target,
      assurance: Object.freeze({ level: Number(row.assurance_level), ...(row.assurance_verified_at === null ? {} : { verified: row.assurance_verified_at }) }),
    });
  }
}

function bearer(value: string | undefined): string | null {
  const match = /^Bearer ([A-Za-z0-9._~-]{32,2048})$/.exec(value ?? '');
  return match?.[1] ?? null;
}

function cookie(value: string | undefined, name: string): string | null {
  for (const part of value?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

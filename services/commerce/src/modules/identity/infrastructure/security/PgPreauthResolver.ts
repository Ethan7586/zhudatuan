import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash } from 'node:crypto';
import { isOperationTarget, type Operation } from '@shop/contract';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { PreauthResolver } from '../../../../foundation/security/PreauthResolver';
import type { PreauthPurpose, PreauthSecurityContext } from '../../../../foundation/security/OperationSecurityContext';
import { requestCookie } from './SessionCookie';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import { Preauth } from '../../domain/model/Preauth';

interface PreauthRow {
  readonly id: string;
  readonly purpose: PreauthPurpose;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly principal_id: string | null;
  readonly reference_id: string;
  readonly version: number;
  readonly expires_at: Date;
  readonly auth_state_hash: string | null;
  readonly auth_nonce_hash: string | null;
  readonly auth_pkce_challenge: string | null;
  readonly return_target: string | null;
}

export class PgPreauthResolver implements PreauthResolver {
  constructor(
    private readonly pool: DatabasePool,
    private readonly protector: FederationProtector
  ) {}

  async resolve(headers: Readonly<Record<string, string>>, operation: Operation): Promise<PreauthSecurityContext> {
    const token = requestCookie(headers.cookie, '__Host-preauth');
    const target = headers['x-client-target'];
    if (!token || !/^[A-Za-z0-9_-]{64}$/.test(token) || !isOperationTarget(target)) {
      throw new DomainError('AUTHENTICATION_REQUIRED');
    }
    const purpose = purposeOf(operation.id);
    const peer = headers['x-peer-address'] ?? 'unknown';
    const agent = headers['user-agent'] ?? 'unknown';
    const device = headers['x-device-id'] ?? 'browser';
    const result = await this.pool.query<PreauthRow>(
      `select id,purpose,target,principal_id,reference_id,version,expires_at,
      auth_state_hash,auth_nonce_hash,auth_pkce_challenge,return_target
      from identity.resolve_preauth($1,$2,$3,$4,$5)`,
      [createHash('sha256').update(token).digest(), this.protector.browser(peer, agent, device), this.protector.device(device), purpose, target]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('AUTHENTICATION_REQUIRED');
    const preauth = new Preauth({ id: row.id, purpose: row.purpose, target: row.target, principal: row.principal_id, reference: row.reference_id, version: Number(row.version), expiresAt: row.expires_at });
    preauth.assertActive(new Date(), purpose, target);
    return Object.freeze({
      kind: 'preauth',
      id: preauth.id,
      purpose: preauth.purpose,
      target: preauth.target,
      principal: preauth.principal,
      reference: preauth.reference,
      version: preauth.version,
      expires: preauth.expiresAt,
      trace: headers['x-trace-id'] ?? `preauth:${preauth.id}`,
      authorization:
        row.auth_state_hash && row.auth_nonce_hash && row.auth_pkce_challenge
          ? Object.freeze({ stateHash: row.auth_state_hash, nonceHash: row.auth_nonce_hash, challenge: row.auth_pkce_challenge })
          : null,
      returnTarget: row.return_target,
    });
  }
}

function purposeOf(operation: string): PreauthPurpose {
  if (operation.startsWith('identity.federations.')) return 'federationselection';
  if (operation.startsWith('identity.enrollments.')) return 'enrollment';
  return 'invitationproof';
}

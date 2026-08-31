import { DomainError } from '../../../../foundation/domain/DomainError';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { Actor } from '../../../../foundation/security/AccessContext';
import type { AuthorizationSnapshot, AuthorizationSnapshotResolver } from '../../../../foundation/security/AuthorizationSnapshot';
import type { AuthorizationRepository } from '../port/AuthorizationRepository';
import type { Telemetry } from '@shop/telemetry';

export class ReadAuthorizationSnapshot implements AuthorizationSnapshotResolver {
  constructor(
    private readonly repository: AuthorizationRepository,
    private readonly database: DatabasePool,
    private readonly telemetry: Telemetry
  ) {}

  async resolve(actor: Actor, operation: string, resource?: string): Promise<AuthorizationSnapshot> {
    const started = performance.now();
    let result = 'failure';
    try {
      const row = await this.repository.snapshot(this.database, { membership: actor.membership, target: actor.target, operation, resource: resource ?? null });
      if (!row) throw new DomainError('MEMBERSHIP_INACTIVE');
      result = 'success';
      return Object.freeze({
        membership: Object.freeze({
          id: row.membership,
          active: row.active,
          accessVersion: row.accessVersion,
          permissions: Object.freeze({ allows: new Set(row.allows), denies: new Set(row.denies) }),
          scopes: Object.freeze(row.scopes.map((scope) => Object.freeze({ ...scope, scope: Object.freeze(scope.scope) }))),
        }),
        credentialVersion: row.credentialVersion,
        organization: row.organization,
        target: row.target,
        roles: Object.freeze(row.roles.map((role) => Object.freeze(role))),
        scope: Object.freeze(row.resource),
        capabilities: new Set(row.operations),
        capabilityVersion: row.capabilityVersion,
      });
    } finally {
      this.telemetry.metrics.duration('access_authorization_snapshot_duration_ms', performance.now() - started, { requestId: actor.session, traceId: actor.session, module: 'access', operation, membershipId: actor.membership, result });
    }
  }
}

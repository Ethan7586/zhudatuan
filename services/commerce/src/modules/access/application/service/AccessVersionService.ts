import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { AccessRepository, VersionChange } from '../port/AccessRepository';

export class AccessVersionService {
  constructor(private readonly repository: AccessRepository) {}

  async bump(context: WriteTransactionContext, membership: string, reason: string, trace: string): Promise<number> {
    const row = await this.repository.incrementVersion(context, membership);
    if (!row) throw new DomainError('MEMBERSHIP_INACTIVE');
    await this.publish(context, [row], reason, trace);
    return row.version;
  }

  async bumpRole(context: WriteTransactionContext, role: string, reason: string, trace: string): Promise<void> {
    await this.publish(context, await this.repository.incrementRoleVersions(context, role), reason, trace);
  }

  async activate(context: WriteTransactionContext, membership: string, trace: string, evidence: Readonly<{ invitation: string; target: 'storefront'; grantDigest: string }>): Promise<number> {
    const row = await this.repository.activate(context, membership);
    if (!row) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    await this.publish(context, [row], 'membershipactivated', trace);
    await this.repository.membershipActivated(context, { change: row, invitation: evidence.invitation, target: evidence.target, grantDigest: evidence.grantDigest, trace });
    return row.version;
  }

  private async publish(context: WriteTransactionContext, rows: readonly VersionChange[], reason: string, trace: string): Promise<void> {
    await this.repository.versionChanged(context, rows, reason, trace);
  }
}

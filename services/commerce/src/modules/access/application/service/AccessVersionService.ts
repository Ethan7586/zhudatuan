import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { AccessRepository, VersionChange } from '../port/AccessRepository';

export class AccessVersionService {
  constructor(private readonly repository: AccessRepository) {}

  async bump(database: OperationDatabase, membership: string, reason: string, trace: string): Promise<number> {
    const row = await this.repository.incrementVersion(database, membership);
    if (!row) throw new DomainError('MEMBERSHIP_INACTIVE');
    await this.publish(database, [row], reason, trace);
    return row.version;
  }

  async bumpRole(database: OperationDatabase, role: string, reason: string, trace: string): Promise<void> {
    await this.publish(database, await this.repository.incrementRoleVersions(database, role), reason, trace);
  }

  async activate(database: OperationDatabase, membership: string, trace: string, evidence: Readonly<{ invitation: string; target: 'storefront'; grantDigest: string }>): Promise<number> {
    const row = await this.repository.activate(database, membership);
    if (!row) throw new DomainError('MEMBERSHIP_NOT_INVITED');
    await this.publish(database, [row], 'membershipactivated', trace);
    await this.repository.membershipActivated(database, { change: row, invitation: evidence.invitation, target: evidence.target, grantDigest: evidence.grantDigest, trace });
    return row.version;
  }

  private async publish(database: OperationDatabase, rows: readonly VersionChange[], reason: string, trace: string): Promise<void> {
    await this.repository.versionChanged(database, rows, reason, trace);
  }
}

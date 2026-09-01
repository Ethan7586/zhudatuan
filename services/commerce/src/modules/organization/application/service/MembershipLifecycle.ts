import { createHash } from 'node:crypto';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { IdentityAccessPort } from '../../../access/public';

export class MembershipLifecycle {
  constructor(private readonly access: IdentityAccessPort) {}
  async apply(context: WriteTransactionContext, input: Readonly<{ membership: string; organization: string; department: string | null; action: 'freeze' | 'restore' | 'update'; explicitdeparture: boolean; trace: string }>): Promise<number> {
    const status = input.action === 'freeze' ? (input.explicitdeparture ? 'left' : 'suspended') : 'active';
    return this.access.applyDirectoryLifecycle(context, {
      membership: input.membership,
      status,
      department: input.department,
      grant: `directorygrant:${digest(`${input.membership}:${input.department ?? 'none'}`)}`,
      scope: input.organization,
      trace: input.trace,
      reason: input.action === 'freeze' ? 'directoryfreeze' : input.action === 'restore' ? 'directoryrestore' : 'directoryupdate',
    });
  }
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

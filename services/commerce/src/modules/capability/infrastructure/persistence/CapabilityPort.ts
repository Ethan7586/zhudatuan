import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ManageEntitlement } from '../../application/service/ManageEntitlement';
import type { EntitlementInput } from '../../public/Entitlement';

export class CapabilityPort {
  constructor(private readonly manage: ManageEntitlement) {}

  async save(context: WriteTransactionContext, input: EntitlementInput) {
    if (input.expectedVersion === null) return null;
    const expiresAt = expiry(input.expiresAt);
    const result = await this.manage.execute(context, {
      id: input.id,
      scope: input.scope,
      capability: input.capability,
      state: input.state,
      quota: input.quota,
      expiresAt,
      expectedVersion: input.expectedVersion,
      actor: context.membership,
      reason: 'channelquota',
      trace: context.trace,
      now: new Date(),
    });
    if (result.effectiveAt === null) throw new Error('CAPABILITY_EFFECTIVE_TIME_MISSING');
    return Object.freeze({
      id: result.id,
      scopeId: result.scopeId,
      capabilityId: result.capabilityId,
      state: result.state,
      quota: result.quota,
      effectiveAt: result.effectiveAt,
      expiresAt: result.expiresAt,
      version: result.version,
    });
  }
}

function expiry(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('CAPABILITY_TIME_INVALID');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('CAPABILITY_TIME_INVALID');
  return parsed;
}

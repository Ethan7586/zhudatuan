import { checkScope, precheck } from '@shop/authz';
import { OperationCatalog } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { TaskAuthorizationPort } from '../../public/TaskAuthorizationPort';
import type { AuthorizationRepository } from '../port/AuthorizationRepository';

export class TaskAuthorization implements TaskAuthorizationPort {
  constructor(private readonly repository: Pick<AuthorizationRepository, 'snapshot'>) {}

  async assert(context: Parameters<TaskAuthorizationPort['assert']>[0], evidence: Readonly<Record<string, unknown>>): Promise<void> {
    const now = new Date();
    const membership = text(evidence.membership);
    const scope = text(evidence.scope);
    const organization = text(evidence.organization);
    text(evidence.actor);
    const operation = text(evidence.operation);
    const target = evidence.target;
    if (target !== 'console' && target !== 'storefront' && target !== 'miniapp' && target !== 'store' && target !== 'supplier') deny();
    const accessVersion = version(evidence.accessVersion);
    const credentialVersion = version(evidence.credentialVersion);
    const capabilityVersion = version(evidence.capabilityVersion);
    const captured = Date.parse(text(evidence.capturedAt));
    if (!Number.isFinite(captured) || captured > now.getTime() + 5_000 || scope !== context.scope) deny();
    let definition;
    try {
      definition = OperationCatalog.get(operation);
    } catch {
      deny();
    }
    if (definition.permission === null || !(definition.targets as readonly string[]).includes(target)) deny();

    // The authoritative snapshot includes principal and membership status, effective
    // roles/overrides/scopes and current entitlements. Do not cache this across pages.
    const current = await this.repository.snapshot(context, { membership, target, operation, resource: scope });
    if (
      !current ||
      !current.active ||
      current.membership !== membership ||
      current.target !== target ||
      current.organization !== organization ||
      current.credentialVersion !== credentialVersion ||
      current.capabilityVersion !== capabilityVersion ||
      current.resource.id !== scope ||
      !current.operations.includes(operation)
    )
      deny();
    const member = { id: current.membership, active: current.active, accessVersion: current.accessVersion, permissions: { allows: new Set(current.allows), denies: new Set(current.denies) }, scopes: current.scopes };
    if (precheck(member, definition.permission, { expectedAccessVersion: accessVersion, now }) !== null || 'reason' in checkScope(member, definition.permission, current.resource, now)) deny();
  }
}

function deny(): never {
  throw new DomainError('AUTHORIZATION_DENIED');
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) deny();
  return value;
}
function version(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) deny();
  return value;
}

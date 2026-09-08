import { DomainError } from '../../../../platform/error/DomainError';

export class PartnerPolicy {
  identifier(value: string): string {
    const normalized = value.normalize('NFKC').trim().replaceAll(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9.-]{4,63}$/.test(normalized)) throw new DomainError('VALIDATION_FAILED', { field: 'identifier' });
    return normalized;
  }

  tenant(scope: Readonly<{ id: string; kind: string; tenant?: string }>): string {
    const tenant = scope.kind === 'tenant' ? scope.id : scope.tenant;
    if (!tenant) throw new DomainError('SCOPE_DENIED');
    return tenant;
  }

  assertContactVisible(masked: boolean): void {
    if (!masked) throw new DomainError('AUTHORIZATION_DENIED');
  }

  maskedIdentifier(value: string): string {
    return value.length <= 8 ? `${value.slice(0, 2)}***` : `${value.slice(0, 4)}****${value.slice(-4)}`;
  }
}

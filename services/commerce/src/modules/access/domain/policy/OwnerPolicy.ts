import { DomainError } from '../../../../platform/error/DomainError';

export interface OwnerTransferState {
  readonly actorMembership: string;
  readonly currentMembership: string;
  readonly targetMembership: string;
  readonly scope: string;
  readonly currentOrganization: string;
  readonly targetOrganization: string;
  readonly currentClient: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly targetClient: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly currentStatus: string;
  readonly targetStatus: string;
  readonly roleKind: string;
  readonly currentVersion: number;
  readonly expectedCurrentVersion: number;
  readonly targetVersion: number;
  readonly expectedTargetVersion: number;
}

export class OwnerPolicy {
  assertDelegatable(kinds: readonly string[]): void {
    if (kinds.some((kind) => kind === 'owner')) throw new DomainError('OWNER_TRANSFER_REQUIRED');
  }

  assertTransfer(state: OwnerTransferState): void {
    if (state.roleKind !== 'owner' || state.actorMembership !== state.currentMembership || state.targetMembership === state.currentMembership) {
      throw new DomainError('OWNER_TRANSFER_REQUIRED');
    }
    if (state.currentOrganization !== state.scope || state.targetOrganization !== state.scope || state.currentClient !== 'console' || state.targetClient !== 'console' || state.currentStatus !== 'active' || state.targetStatus !== 'active') {
      throw new DomainError('OWNER_TRANSFER_REQUIRED');
    }
    if (state.currentVersion !== state.expectedCurrentVersion || state.targetVersion !== state.expectedTargetVersion) {
      throw new DomainError('VERSION_CONFLICT');
    }
  }
}

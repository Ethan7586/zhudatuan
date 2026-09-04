export type OwnerAction = 'create' | 'accept' | 'cancel';
export type FormerOwnerMode = 'retain_admin' | 'remove_admin';

export interface OwnerActionProofPayload {
  readonly v: 1;
  readonly nonce: string;
  readonly action: OwnerAction;
  readonly actor: string;
  readonly session: string;
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole: string | null;
  readonly formerOwnerRoleVersion: number | null;
  readonly ownershipVersion: number;
  readonly transferVersion: number | null;
  readonly targetAccessVersion: number;
  readonly reasonHash: string | null;
  readonly expiresAt: string;
}

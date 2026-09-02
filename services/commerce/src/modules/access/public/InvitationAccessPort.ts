import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface InvitationGrantPlan {
  readonly organization: string;
  readonly membership: string | null;
  readonly principal: string | null;
  readonly issuerAccessVersion: number;
  readonly grantDigest: string;
  readonly minimumAssurance: 1 | 2 | 3;
}

export interface InvitationCampaignValidation {
  readonly issuer: string;
  readonly issuerAccessVersion: number;
  readonly grantDigest: string;
  readonly organization: string;
  readonly policy: string | null;
  readonly termsHash: string | null;
  readonly expiresAt: Date;
}

export interface InvitationCampaignActivation extends InvitationCampaignValidation {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
}

export interface EmployeeInvitationPreparation {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly organization: string;
  readonly employeeNo: string | null;
  readonly department: string | null;
  readonly issuer: string;
  readonly issuerAccessVersion: number;
  readonly policy: string;
  readonly termsHash: string;
  readonly expiresAt: Date;
}

export interface PendingEmployeeAccess {
  readonly member: string;
  readonly employeeNo: string | null;
  readonly departmentName: string | null;
}

export interface InvitationAccessPort {
  plan(
    context: ReadTransactionContext,
    input: Readonly<{
      issuer: string;
      membership: string | null;
      organization: string | null;
      target: 'console' | 'storefront';
      kind: 'signin' | 'enrollment' | 'campaign';
      policy: string | null;
      termsHash: string | null;
      expectedVersion?: number;
      expiresAt?: Date;
    }>
  ): Promise<InvitationGrantPlan>;
  validate(
    context: ReadTransactionContext,
    invitation: Readonly<{
      kind: 'signin' | 'enrollment';
      issuer: string;
      issuerAccessVersion: number;
      membership: string;
      grantDigest: string;
      organization: string;
      target: 'console' | 'storefront';
      policy: string | null;
      termsHash: string | null;
      expiresAt: Date;
    }>
  ): Promise<void>;
  validateCampaign(context: ReadTransactionContext, input: InvitationCampaignValidation): Promise<void>;
  createCampaign(context: WriteTransactionContext, input: InvitationCampaignActivation): Promise<Readonly<{ activationDigest: string }>>;
  prepareEmployee(context: WriteTransactionContext, input: EmployeeInvitationPreparation): Promise<Readonly<{ grantDigest: string }>>;
  activate(
    context: WriteTransactionContext,
    input: Readonly<{
      issuer: string;
      issuerAccessVersion: number;
      membership: string;
      principal: string;
      grantDigest: string;
      organization: string;
      target: 'storefront';
      invitation: string;
      policy: string | null;
      termsHash: string | null;
      trace: string;
    }>
  ): Promise<number>;
  pending(context: ReadTransactionContext, membership: string): Promise<string>;
  pendingEmployee(context: ReadTransactionContext, membership: string): Promise<PendingEmployeeAccess>;
}

export const INVITATION_ACCESS_PORT = publicPort<InvitationAccessPort>('access', 'identityinvitation');

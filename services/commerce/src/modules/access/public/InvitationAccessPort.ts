import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

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

export interface InvitationAccessPort {
  plan(
    database: OperationDatabase,
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
  validate(database: OperationDatabase, invitation: Readonly<{ issuer: string; issuerAccessVersion: number; membership: string; grantDigest: string; organization: string; target: 'console' | 'storefront' }>): Promise<void>;
  validateCampaign(database: OperationDatabase, input: InvitationCampaignValidation): Promise<void>;
  createCampaign(database: OperationDatabase, input: InvitationCampaignActivation): Promise<Readonly<{ activationDigest: string }>>;
  activate(
    database: OperationDatabase,
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
  pending(database: OperationDatabase, membership: string): Promise<string>;
}

export const INVITATION_ACCESS_PORT = publicPort<InvitationAccessPort>('access', 'identityinvitation');

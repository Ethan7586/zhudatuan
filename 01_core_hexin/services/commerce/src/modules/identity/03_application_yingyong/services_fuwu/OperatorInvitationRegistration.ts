import { reject, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { bindExistingOperatorAccount, createOperatorRegistration, currentOperatorMembership,
  type OperatorRegistrationMembership } from '../../04_adapters_shixian/persistence_cunchu/OperatorRegistrationStore';

export interface ExistingOperatorSource {
  readonly sourceSecretHash: string | null;
  readonly generatedCredential: string;
  readonly generatedAssurance: string;
  readonly mobileCiphertext: string;
  readonly mobileFingerprint: string;
  readonly subject: string;
  readonly subjectHash: string;
}

export async function registerInvitedOperator(database: OperationDatabase, input: OperatorRegistrationMembership,
  existing?: ExistingOperatorSource): Promise<Readonly<{
    membership: Readonly<Record<string, unknown>>; account: string; realm: string; credentialVersion: number;
  }>> {
  const binding = existing === undefined
    ? { account: input.account, realm: input.realm, credentialVersion: 1 }
    : await bindExistingOperatorAccount(database, {
        realm: input.realm, principal: input.principal, generatedAccount: input.account,
        generatedCredential: existing.generatedCredential, generatedAssurance: existing.generatedAssurance,
        sourceSecretHash: existing.sourceSecretHash, mobileCiphertext: existing.mobileCiphertext,
        mobileFingerprint: existing.mobileFingerprint, subject: existing.subject, subjectHash: existing.subjectHash,
      });
  if (existing !== undefined) {
    const current = await currentOperatorMembership(database, input.member, input.operatorOrganization,
      binding.realm, binding.account);
    if (current && current.status !== 'active') reject(403, 'MEMBERSHIP_INACTIVE');
    if (current) reject(409, 'IDENTITY_SUBJECT_EXISTS');
  }
  const membership = await createOperatorRegistration(database,
    { ...input, realm: binding.realm, account: binding.account });
  return { membership, ...binding };
}

import { createHash, createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion, type OperationId } from '@shop/contract';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, pageResult, reject, requireAccess, rowResult, type OperationActions, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, secretField, textField } from '../../../../foundation/interface/Validation';
import type { OperationRequest, OperationUsecase } from '../../../../foundation/application/OperationHandler';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { requireGovernanceContext } from '../../../../foundation/security/AccessContext';
import { StepupPolicy } from '../../../../foundation/security/StepupPolicy';
import { IDENTITY_SECURITY_KEYS } from '../../../../foundation/infrastructure/SecretStore';
import { PasswordPolicy } from '../../02_domain_yewu/policies_guize/PasswordPolicy';
import { atomicIdentityMutation, bindWechat, completeWechatBinding, prepareWechatBinding, publishIdentityEvent, tokenHash } from '../../04_adapters_shixian/persistence_cunchu/IdentityPersistence';
import { AuthTransaction } from '../../02_domain_yewu/models_moxing/AuthTransaction';
import { PgAuthTicket } from '../../04_adapters_shixian/persistence_cunchu/PgAuthTicket';
import { RETURN_TARGETS } from '../../04_adapters_shixian/providers_waibu/ReturnTargetCatalog';
import { ReturnTargetSigner } from '../../04_adapters_shixian/providers_waibu/ReturnTargetSigner';
import { authMembershipTarget, authTarget, consumeChallenge, requestCookie, sessionCookies } from './IdentitySecurity';
import { accessPort } from '../../../access';
import { memberPort, type MemberInvite } from '../../../member';
import { organizationPort } from '../../../organization';
import { canonicalIdentitySubject, canonicalMobile } from '../../02_domain_yewu/models_moxing/IdentitySubject';
import { consumeSmsLoginChallenge, recordInvalidSmsLoginChallenge, resolveBoundMobileAccount, resolvePasswordLoginCredential, verifySmsLoginChallenge } from '../../03_application_yingyong/services_fuwu/SmsLogin';
import { currentRealmAccount, resolveRealmApplication, resolveRealmContext, resolveRealmNode } from '../../03_application_yingyong/services_fuwu/RealmAccount';

import {
  IDENTITY_CORE_OPERATION_IDS,
  IDENTITY_REGISTRATION_OPERATION_IDS,
  identityRegistrationCoreOperationIds,
} from './IdentityOperationCatalog';
import { createRealmOperationContext, maskMobile } from './RealmOperationContext';
import { credentialOperations } from './CredentialOperations';
import { membershipInvitationOperations } from './MembershipInvitationOperations';
import { mobileWechatOperations } from './MobileWechatOperations';
import { registrationOperations } from './RegistrationOperations';
import { sessionTicketOperations } from './SessionTicketOperations';

export { IDENTITY_CORE_OPERATION_IDS, IDENTITY_REGISTRATION_OPERATION_IDS } from './IdentityOperationCatalog';

export function identityRegistrationOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, identityRegistrationCoreOperationIds(), true);
}

export function identityOperations(context: ModuleContext): OperationUsecase {
  return identityCoreOperations(context, IDENTITY_CORE_OPERATION_IDS, false);
}

function identityCoreOperations(context: ModuleContext, ownedOperations: readonly OperationId[], registrationOnly: boolean): OperationUsecase {
  const runtime = createRealmOperationContext(context, registrationOnly);
  const { audit, codeDigest, digest, keys, kms, passwords, pool, sessionDigest, tickets } = runtime;
  const stepup = new StepupPolicy();
  const actions: OperationActions = {
      ...sessionTicketOperations(runtime),
      ...registrationOperations(runtime),
      ...membershipInvitationOperations(runtime),
      ...credentialOperations(runtime),
      ...mobileWechatOperations(runtime),
    };
  const selected = Object.fromEntries(ownedOperations.map((operationId) => {
    const action = actions[operationId];
    if (!action) throw new Error(`IDENTITY_OPERATION_NOT_AVAILABLE:${operationId}`);
    return [operationId, action];
  })) as OperationActions;
  return new ModuleOperations('identity', pool, audit, selected, ownedOperations);
}

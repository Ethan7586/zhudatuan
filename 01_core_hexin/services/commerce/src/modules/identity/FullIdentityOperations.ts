import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import type { OperationUsecase } from '../../foundation/application/OperationHandler';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { WECHAT_IDENTITY } from './application/port/WechatIdentity';
import { identityOperations, identityRegistrationOperations } from './IdentityOperations';
import { PgAuthTicket } from './infrastructure/PgAuthTicket';
import { RETURN_TARGETS } from './infrastructure/ReturnTargetCatalog';
import { ReturnTargetSigner } from './infrastructure/ReturnTargetSigner';
import { WechatOperations } from './WechatOperations';

export function fullIdentityOperations(context: ModuleContext): OperationUsecase {
  return wechatIdentityOperations(context, identityOperations(context));
}

export function registrationWechatIdentityOperations(context: ModuleContext): OperationUsecase {
  return wechatIdentityOperations(context, identityRegistrationOperations(context));
}

function wechatIdentityOperations(context: ModuleContext, core: OperationUsecase): OperationUsecase {
  const pool = context.container.get(DATABASE_POOL);
  const audit = context.container.get(AUDIT_SINK);
  const keys = context.container.get(IDENTITY_SECURITY_KEYS);
  const kms = context.container.get(KMS_CLIENT);
  const tickets = new PgAuthTicket(new ReturnTargetSigner(context.container.get(RETURN_TARGETS), keys.session));
  return new WechatOperations(core, pool.workload('command'), context.container.get(WECHAT_IDENTITY), kms, audit,
    keys.identity, keys.session, tickets);
}

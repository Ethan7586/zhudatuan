import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { MEMBER_STOREFRONT_CUSTOM_PROFILE_OPERATION_IDS, memberCustomProfileActions } from '../03_application_yingyong/MemberCustomProfileOperations';
import { MEMBER_OPERATOR_READ_OPERATION_IDS, memberOperatorReadActions } from '../03_application_yingyong/MemberReadOperations';

export const MEMBER_IDENTITY_OPERATOR_OPERATION_IDS = Object.freeze([
  ...MEMBER_OPERATOR_READ_OPERATION_IDS,
  ...MEMBER_STOREFRONT_CUSTOM_PROFILE_OPERATION_IDS,
]);

function identityOperatorMemberOperations(context: ModuleContext): ModuleOperations {
  return new ModuleOperations(
    'member',
    context.container.get(DATABASE_POOL),
    context.container.get(AUDIT_SINK),
    { ...memberOperatorReadActions(context.container.get(KMS_CLIENT)), ...memberCustomProfileActions() },
    MEMBER_IDENTITY_OPERATOR_OPERATION_IDS,
  );
}

export const IdentityOperatorMemberModule = defineSelectedModule(
  'member', MEMBER_IDENTITY_OPERATOR_OPERATION_IDS, identityOperatorMemberOperations, ['identity'],
);

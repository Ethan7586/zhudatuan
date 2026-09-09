import {
  OP_ORDER_DETAIL_READ,
  OP_SUPPORT_ACCOUNTS_MANAGE,
  OP_SUPPORT_ACCOUNTS_READ,
  OP_SUPPORT_AGENTS_MANAGE,
  OP_SUPPORT_AGENTS_READ,
  OP_SUPPORT_ASSIGNMENTS_MANAGE,
  OP_SUPPORT_ATTACHMENTS_CREATE,
  OP_SUPPORT_CASES_CLOSE,
  OP_SUPPORT_CASES_REOPEN,
  OP_SUPPORT_EVENTS_READ,
  OP_SUPPORT_HISTORY_READ,
  OP_SUPPORT_RULES_MANAGE,
  OP_SUPPORT_RULES_READ,
  OP_SUPPORT_SLAS_MANAGE,
  OP_SUPPORT_SLAS_READ,
} from '@shop/contract/ids';
import type { OperationId } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';

export const supportSettingOperations = Object.freeze({
  agents: Object.freeze({ read: OP_SUPPORT_AGENTS_READ, write: OP_SUPPORT_AGENTS_MANAGE }),
  accounts: Object.freeze({ read: OP_SUPPORT_ACCOUNTS_READ, write: OP_SUPPORT_ACCOUNTS_MANAGE }),
  rules: Object.freeze({ read: OP_SUPPORT_RULES_READ, write: OP_SUPPORT_RULES_MANAGE }),
  slas: Object.freeze({ read: OP_SUPPORT_SLAS_READ, write: OP_SUPPORT_SLAS_MANAGE }),
});

export function supportAccess(context: ConsoleContext) {
  const can = (operation: OperationId) => canUseOperation(context, operation);
  const ready = (operation: OperationId) => can(operation) && context.session.assurance.level >= requiredAssurance(operation);
  const settings = Object.values(supportSettingOperations).some(({ read }) => can(read));
  return Object.freeze({
    settings,
    agentNames: ready(OP_SUPPORT_AGENTS_READ),
    upload: can(OP_SUPPORT_ATTACHMENTS_CREATE),
    assign: can(OP_SUPPORT_ASSIGNMENTS_MANAGE) && can(OP_SUPPORT_AGENTS_READ),
    assignmentReady: ready(OP_SUPPORT_ASSIGNMENTS_MANAGE) && ready(OP_SUPPORT_AGENTS_READ),
    close: can(OP_SUPPORT_CASES_CLOSE),
    reopen: can(OP_SUPPORT_CASES_REOPEN),
    history: can(OP_SUPPORT_HISTORY_READ),
    order: can(OP_ORDER_DETAIL_READ),
    realtime: can(OP_SUPPORT_EVENTS_READ),
    verify: (operation: OperationId) => ready(operation),
  });
}

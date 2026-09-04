import { OP_NOTIFICATION_TEMPLATES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { TemplateChange } from '../model/Template';
import type { NotificationPort } from '../public';

export class ManageTemplate {
  constructor(private readonly port: NotificationPort) {}
  execute(context: ConsoleContext, change: TemplateChange, proof: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_NOTIFICATION_TEMPLATES_MANAGE, proof);
    return this.port.manageTemplate(context, change, proof, identity, signal);
  }
}

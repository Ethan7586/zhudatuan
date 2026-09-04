import { OP_APPROVAL_TEMPLATES_CREATE, OP_APPROVAL_TEMPLATES_DISABLE, OP_APPROVAL_TEMPLATES_ENABLE, OP_APPROVAL_TEMPLATES_REVISE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ApprovalCommand } from '../model/Approval';
import type { ApprovalPort } from '../public';
import { assertApprovalCommand } from './ApprovalGuard';

type TemplateCommand = Extract<ApprovalCommand, Readonly<{ kind: 'create' | 'revise' | 'enable' | 'disable' }>>;

export class ManageApprovalTemplate {
  constructor(private readonly port: Pick<ApprovalPort, 'execute'>) {}

  execute(context: ConsoleContext, command: TemplateCommand, identity: string, signal?: AbortSignal) {
    const operation = command.kind === 'create' ? OP_APPROVAL_TEMPLATES_CREATE : command.kind === 'revise' ? OP_APPROVAL_TEMPLATES_REVISE : command.kind === 'enable' ? OP_APPROVAL_TEMPLATES_ENABLE : OP_APPROVAL_TEMPLATES_DISABLE;
    assertApprovalCommand(context, operation, identity);
    return this.port.execute(context, command, identity, signal);
  }
}

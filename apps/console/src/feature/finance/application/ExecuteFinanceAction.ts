import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinanceAction, FinanceActionDraft } from '../model/FinanceCommand';
import { createFinanceCommand } from '../model/FinanceCommand';
import type { FinancePort } from '../public';

export class ExecuteFinanceAction {
  constructor(private readonly port: Pick<FinancePort, 'execute'>) {}

  execute(context: ConsoleContext, action: FinanceAction, draft: FinanceActionDraft, identity: string, signal?: AbortSignal) {
    const command = createFinanceCommand(action, draft);
    assertOperationAccess(context, command.operation, draft.proof);
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    return this.port.execute(context, command, draft.proof, identity, signal);
  }
}

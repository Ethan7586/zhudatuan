import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { VoucherCommand, VoucherReceipt } from '../model/Voucher';
import type { VoucherPort } from '../public';

export class ExecuteVoucher {
  constructor(private readonly port: Pick<VoucherPort, 'execute'>) {}
  execute(context: ConsoleContext, command: VoucherCommand, signal?: AbortSignal): Promise<VoucherReceipt> {
    assertOperationAccess(context, command.operation, command.options?.proof);
    return this.port.execute(context, command, signal);
  }
}

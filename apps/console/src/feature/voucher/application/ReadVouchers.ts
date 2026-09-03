import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherView } from '../model/Voucher';
import type { VoucherPort } from '../public';

export class ReadVouchers {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, view: VoucherView, cursor?: string, signal?: AbortSignal) {
    return this.port.read(context, view, cursor, signal);
  }
}

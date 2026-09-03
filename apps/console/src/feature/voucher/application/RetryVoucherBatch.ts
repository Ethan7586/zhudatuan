import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class RetryVoucherBatch {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, input: Readonly<{ batch: string; version: number; proof: string; identity: string }>, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.issue', 'voucher.batches.retry', true, input.proof);
    return this.port.retryBatch(context, input, signal);
  }
}

import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class CreateCardLibrary {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, prefix: string, identity: string, signal?: AbortSignal) {
    assertVoucherAccess(context, 'voucher.cardlibrary.create', 'voucher.cardlibraries.create');
    const value = prefix.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,16}$/.test(value)) throw new Error('卡号前缀须为 2–16 位英文字母或数字。');
    return this.port.createLibrary(context, value, identity, signal);
  }
}

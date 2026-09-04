import { OP_VOUCHER_CARDLIBRARIES_CREATE } from '@shop/contract/ids';
import { PERM_VOUCHER_CARDLIBRARY_CREATE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertVoucherAccess } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class CreateCardLibrary {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, prefix: string, identity: string, signal?: AbortSignal) {
    assertVoucherAccess(context, PERM_VOUCHER_CARDLIBRARY_CREATE, OP_VOUCHER_CARDLIBRARIES_CREATE);
    const value = prefix.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,16}$/.test(value)) throw new Error('卡号前缀须为 2–16 位英文字母或数字。');
    return this.port.createLibrary(context, value, identity, signal);
  }
}

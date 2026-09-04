import { OP_VOUCHER_PROGRAMS_MANAGE } from '@shop/contract/ids';
import { PERM_VOUCHER_PROGRAM_MANAGE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherProgramDraft } from '../model/Voucher';
import { assertVoucherAccess, positiveInteger } from '../model/VoucherPolicy';
import type { VoucherPort } from '../public';

export class SaveVoucherProgram {
  constructor(private readonly port: VoucherPort) {}
  execute(context: ConsoleContext, draft: VoucherProgramDraft, identity: string, signal?: AbortSignal) {
    assertVoucherAccess(context, PERM_VOUCHER_PROGRAM_MANAGE, OP_VOUCHER_PROGRAMS_MANAGE);
    const name = draft.name.trim();
    if (!name || name.length > 80) throw new Error('卡券名称须为 1–80 个字符。');
    return this.port.saveProgram(context, { ...draft, name, valueMinor: positiveInteger(draft.valueMinor, '面值', 99_999_999), validityDays: positiveInteger(draft.validityDays, '有效天数', 3650) }, identity, signal);
  }
}

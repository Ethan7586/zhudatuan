import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherChoiceKind, VoucherChoicePage, VoucherCommand, VoucherFacets, VoucherProgress, VoucherProgressKind, VoucherReadQuery, VoucherReceipt, VoucherRecord, VoucherRecordPage, VoucherTimeline, VoucherView } from '../model/Voucher';

export interface VoucherPort {
  read(context: ConsoleContext, view: VoucherView, query: VoucherReadQuery, signal?: AbortSignal): Promise<VoucherRecordPage>;
  detail(context: ConsoleContext, view: VoucherView, id: string, signal?: AbortSignal): Promise<VoucherRecord>;
  choices(context: ConsoleContext, kind: VoucherChoiceKind, signal?: AbortSignal): Promise<VoucherChoicePage>;
  facets(context: ConsoleContext, query: VoucherReadQuery, signal?: AbortSignal): Promise<VoucherFacets>;
  byNumber(context: ConsoleContext, number: string, signal?: AbortSignal): Promise<VoucherRecord>;
  timeline(context: ConsoleContext, voucher: string, cursor?: string, signal?: AbortSignal): Promise<VoucherTimeline>;
  progress(context: ConsoleContext, kind: VoucherProgressKind, id: string, signal?: AbortSignal): Promise<VoucherProgress>;
  execute(context: ConsoleContext, command: VoucherCommand, signal?: AbortSignal): Promise<VoucherReceipt>;
}

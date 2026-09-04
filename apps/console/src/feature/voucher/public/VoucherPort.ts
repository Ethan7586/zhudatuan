import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherProgramDraft, VoucherRecordPage, VoucherView } from '../model/Voucher';

export interface VoucherPort {
  read(context: ConsoleContext, view: VoucherView, cursor?: string, signal?: AbortSignal): Promise<VoucherRecordPage>;
  createLibrary(context: ConsoleContext, prefix: string, identity: string, signal?: AbortSignal): Promise<void>;
  allocateLibrary(context: ConsoleContext, input: Readonly<{ library: string; version: number; scope: string; count: number; proof: string; identity: string }>, signal?: AbortSignal): Promise<void>;
  saveProgram(context: ConsoleContext, draft: VoucherProgramDraft, identity: string, signal?: AbortSignal): Promise<void>;
  requestReserve(context: ConsoleContext, input: Readonly<{ program: string; count: number; reason: string; identity: string }>, signal?: AbortSignal): Promise<void>;
  decideReserve(context: ConsoleContext, input: Readonly<{ reserve: string; version: number; decision: 'approved' | 'rejected'; reason: string; proof: string; identity: string }>, signal?: AbortSignal): Promise<void>;
  issueBatch(context: ConsoleContext, input: Readonly<{ program: string; version: number; cardpool: string; count: number; reserve?: string; proof: string; identity: string }>, signal?: AbortSignal): Promise<void>;
  retryBatch(context: ConsoleContext, input: Readonly<{ batch: string; version: number; proof: string; identity: string }>, signal?: AbortSignal): Promise<void>;
  changeStatus(
    context: ConsoleContext,
    input: Readonly<{ ids: readonly string[]; version: number; action: 'activate' | 'disable' | 'extend' | 'void'; reason: string; expiresAt?: string; proof: string; identity: string }>,
    signal?: AbortSignal
  ): Promise<void>;
  bind(context: ConsoleContext, input: Readonly<{ voucher: string; version: number; member: string; reason: string; identity: string }>, signal?: AbortSignal): Promise<void>;
  reverse(context: ConsoleContext, input: Readonly<{ redemption: string; version: number; reason: string; proof: string; identity: string }>, signal?: AbortSignal): Promise<void>;
}

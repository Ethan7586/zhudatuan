import type { VoucherProgramDraft } from './Voucher';

type VoucherCommandData =
  | Readonly<{ kind: 'createlibrary'; prefix: string }>
  | Readonly<{ kind: 'allocatelibrary'; library: string; version: number; scope: string; count: number; proof: string }>
  | Readonly<{ kind: 'saveprogram'; draft: VoucherProgramDraft }>
  | Readonly<{ kind: 'requestreserve'; program: string; count: number; reason: string }>
  | Readonly<{ kind: 'decidereserve'; reserve: string; version: number; decision: 'approved' | 'rejected'; reason: string; proof: string }>
  | Readonly<{ kind: 'issuebatch'; program: string; version: number; cardpool: string; count: number; reserve?: string; proof: string }>
  | Readonly<{ kind: 'retrybatch'; batch: string; version: number; proof: string }>
  | Readonly<{ kind: 'statusbatch'; ids: readonly string[]; version: number; action: 'activate' | 'disable' | 'extend' | 'void'; reason: string; expiresAt?: string; proof: string }>
  | Readonly<{ kind: 'bind'; voucher: string; version: number; member: string; reason: string }>
  | Readonly<{ kind: 'reverse'; redemption: string; version: number; reason: string; proof: string }>;

/** A command keeps one identity across an explicit retry. */
export type VoucherCommand = VoucherCommandData & Readonly<{ identity: string }>;

import type { VoucherRecord } from './Voucher';

export type VoucherAction =
  | Readonly<{ kind: 'createlibrary' }>
  | Readonly<{ kind: 'allocatelibrary'; record: VoucherRecord }>
  | Readonly<{ kind: 'createprogram' }>
  | Readonly<{ kind: 'editprogram'; record: VoucherRecord }>
  | Readonly<{ kind: 'requestreserve' }>
  | Readonly<{ kind: 'decidereserve'; record: VoucherRecord }>
  | Readonly<{ kind: 'issuebatch' }>
  | Readonly<{ kind: 'retrybatch'; record: VoucherRecord }>
  | Readonly<{ kind: 'statusbatch'; records: readonly VoucherRecord[] }>
  | Readonly<{ kind: 'bind'; record: VoucherRecord }>
  | Readonly<{ kind: 'reverse'; record: VoucherRecord }>;

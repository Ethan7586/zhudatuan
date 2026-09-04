export const VOUCHER_CAPABILITIES = Object.freeze({
  read: 'voucher.read',
  manage: 'voucher.manage',
} as const);

export type VoucherCapability = (typeof VOUCHER_CAPABILITIES)[keyof typeof VOUCHER_CAPABILITIES];

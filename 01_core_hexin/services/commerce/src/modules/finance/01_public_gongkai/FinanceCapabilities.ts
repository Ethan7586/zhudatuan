export const FINANCE_CAPABILITIES = Object.freeze({
  read: 'finance.read',
  manage: 'finance.manage',
} as const);

export type FinanceCapability = (typeof FINANCE_CAPABILITIES)[keyof typeof FINANCE_CAPABILITIES];

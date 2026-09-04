export const RISK_CAPABILITIES = Object.freeze({
  read: 'risk.read',
  manage: 'risk.manage',
} as const);

export type RiskCapability = (typeof RISK_CAPABILITIES)[keyof typeof RISK_CAPABILITIES];

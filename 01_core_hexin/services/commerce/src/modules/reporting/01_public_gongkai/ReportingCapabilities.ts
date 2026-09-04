export const REPORTING_CAPABILITIES = Object.freeze({
  read: 'reporting.read',
  manage: 'reporting.manage',
} as const);

export type ReportingCapability = (typeof REPORTING_CAPABILITIES)[keyof typeof REPORTING_CAPABILITIES];

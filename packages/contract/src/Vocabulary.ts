export const APPROVAL_SUBJECT_KINDS = Object.freeze([
  'voucherstock',
  'voucherissue',
  'financerepair',
  'reconciliation',
  'withdrawal',
  'refund',
  'experiencepublish',
  'riskexception',
  'riskaction',
  'inventoryadjustment',
] as const);

export const ACCESS_ROLE_TEMPLATE_CODES = Object.freeze([
  'malloperator',
  'catalogoperator',
  'ordersupport',
  'financeoperator',
  'financereviewer',
  'storeoperator',
  'supplieroperator',
  'administrator',
  'custom',
] as const);
export type AccessRoleTemplateCode = (typeof ACCESS_ROLE_TEMPLATE_CODES)[number];

export const FINANCE_RECONCILIATION_STATES = Object.freeze(['received', 'matching', 'balanced', 'difference', 'approved'] as const);
export const FINANCE_REPAIR_DECISIONS = Object.freeze(['approve', 'reject'] as const);
export type FinanceRepairDecision = (typeof FINANCE_REPAIR_DECISIONS)[number];

export const NOTIFICATION_CHANNELS = Object.freeze(['sms', 'email', 'wechat', 'inapp'] as const);
export const NOTIFICATION_VARIABLE_TYPES = Object.freeze(['string', 'number', 'boolean', 'date', 'money'] as const);
export const NOTIFICATION_KINDS = Object.freeze(['dispatch', 'announcement'] as const);
export const NOTIFICATION_AUTHORIZATIONS = Object.freeze(['unknown', 'accepted', 'rejected'] as const);
export const NOTIFICATION_CONSENT_SOURCES = Object.freeze(['member', 'provider', 'operator', 'system'] as const);
export const NOTIFICATION_TEMPLATE_STATES = Object.freeze(['draft', 'active', 'retired'] as const);
export const NOTIFICATION_PURPOSES = Object.freeze(['transactional', 'marketing'] as const);
export const NOTIFICATION_ANNOUNCEMENT_STATES = Object.freeze(['draft', 'published', 'retired'] as const);

export const REPORT_VIEWS = Object.freeze(['sales', 'products', 'malls', 'categories', 'channels', 'members', 'voucher'] as const);
export const REPORT_PERIODS = Object.freeze(['realtime', 'yesterday', '7days', '30days'] as const);

export const RUNTIME_TASK_TYPES = Object.freeze(['job', 'import', 'export'] as const);
export const RUNTIME_TASK_STATES = Object.freeze(['queued', 'validating', 'ready', 'running', 'completed', 'failed', 'cancelled', 'expired'] as const);
export const RUNTIME_IMPORT_OWNERS = Object.freeze(['member', 'catalog', 'inventory', 'voucher', 'finance', 'order'] as const);

export const RISK_POLICY_STATES = Object.freeze(['draft', 'active', 'retired'] as const);
export const RISK_REPLAY_STATES = Object.freeze(['queued', 'running', 'passed', 'review', 'failed'] as const);
export const RISK_CASE_STATES = Object.freeze(['open', 'reviewing', 'cleared', 'confirmed', 'closed'] as const);
export const RISK_CASE_OUTCOMES = Object.freeze(['review', 'deny'] as const);
export const RISK_CASE_REASONS = Object.freeze(['policy', 'amount', 'velocity', 'signal', 'list'] as const);
export const RISK_CASE_ACTIONS = Object.freeze(['accept', 'clear', 'confirm', 'close'] as const);

export const ORDER_AFTERSALE_STATES = Object.freeze(['applied', 'reviewing', 'approved', 'returning', 'received', 'refunding', 'resolved', 'rejected'] as const);
export const ORDER_AFTERSALE_REASONS = Object.freeze(['quality', 'damaged', 'wrongitem', 'notneeded', 'service'] as const);
export const ORDER_AFTERSALE_DECISIONS = Object.freeze(['approve', 'reject'] as const);
export const ORDER_AFTERSALE_ATTACHMENT_TYPES = Object.freeze(['image/jpeg', 'image/png', 'application/pdf'] as const);
export type OrderAfterSaleState = (typeof ORDER_AFTERSALE_STATES)[number];
export type OrderAfterSaleReason = (typeof ORDER_AFTERSALE_REASONS)[number];
export type OrderAfterSaleDecision = (typeof ORDER_AFTERSALE_DECISIONS)[number];
export type OrderAfterSaleAttachmentType = (typeof ORDER_AFTERSALE_ATTACHMENT_TYPES)[number];
export const FULFILLMENT_RETURN_STATES = Object.freeze(['authorized', 'intransit', 'received', 'accepted', 'rejected'] as const);
export const SUPPORT_ATTACHMENT_TYPES = Object.freeze([...ORDER_AFTERSALE_ATTACHMENT_TYPES, 'text/plain'] as const);
export type SupportAttachmentType = (typeof SUPPORT_ATTACHMENT_TYPES)[number];
export const SUPPORT_PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent'] as const);
export const SUPPORT_STATES = Object.freeze(['open', 'assigned', 'waiting', 'resolved', 'closed'] as const);
export const SUPPORT_CHANNELS = Object.freeze(['inapp', 'wechat', 'email', 'sms'] as const);

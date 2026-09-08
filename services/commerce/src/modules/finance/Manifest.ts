import { CAPABILITY_CODES_BY_OWNER } from '@shop/contract';
import { defineModuleManifest } from '../../composition/ModuleManifest';
import { BENEFIT_ACCOUNTING_PORT, BENEFIT_SETTLEMENT_READ_PORT, CHECKOUT_INVOICE_PORT, ORDER_IMPORT_FINANCE_PORT, PROVIDER_FINANCE_PORT, REFERRAL_FINANCE_PORT, VOUCHER_ACCOUNTING_PORT } from './public';

export const FinanceCapabilities = CAPABILITY_CODES_BY_OWNER.finance;

export const Manifest = defineModuleManifest({
  id: 'finance',
  dependencies: ['access', 'approval', 'organization', 'runtime', 'channel', 'audit', 'order', 'payment'],
  bindings: [],
  services: ['database.pool', 'kms.client', 'object.store', 'security.keys'],
  ports: [CHECKOUT_INVOICE_PORT, BENEFIT_ACCOUNTING_PORT, BENEFIT_SETTLEMENT_READ_PORT, VOUCHER_ACCOUNTING_PORT, REFERRAL_FINANCE_PORT, ORDER_IMPORT_FINANCE_PORT],
  workloads: {
    jobs: {
      dependencies: ['access', 'approval', 'payment', 'order', 'channel', 'fulfillment', 'runtime'],
      services: ['database.pool', 'object.store', 'kms.client', 'finance.invoiceissuer', 'finance.payoutgateway'],
      ports: [BENEFIT_ACCOUNTING_PORT, VOUCHER_ACCOUNTING_PORT, REFERRAL_FINANCE_PORT, ORDER_IMPORT_FINANCE_PORT],
    },
    provider: { dependencies: ['channel'], ports: [PROVIDER_FINANCE_PORT] },
  },
  capabilities: FinanceCapabilities,
});

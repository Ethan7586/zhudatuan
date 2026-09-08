import { CAPABILITY_CODES_BY_OWNER, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { FinanceCapabilities, Manifest } from '../Manifest';
import { FinanceModule } from '../Module';
import { FinanceEventSubscriptions } from '../interface/event/FinanceEventSubscriptions';
import { createJobs } from '../interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../../generated/EventSubscriptions';

describe('finance module assembly', () => {
  it('publishes every canonical Finance capability with an explicit permission', () => {
    const operations = OperationCatalog.all().filter(({ module }) => module === 'finance');
    expect(FinanceCapabilities).toBe(CAPABILITY_CODES_BY_OWNER.finance);
    expect(FinanceModule.capabilities).toEqual(FinanceCapabilities);
    expect(new Set(FinanceCapabilities)).toEqual(new Set(operations.map(({ capability }) => capability)));
    expect(operations.every(({ permission }) => permission !== null)).toBe(true);
  });

  it('declares isolated API, job and provider dependencies and mandatory provider adapters', () => {
    expect(Manifest.workloads.api.dependencies).toEqual(['access', 'approval', 'organization', 'runtime', 'channel', 'audit', 'order', 'payment']);
    expect(Manifest.workloads.jobs.dependencies).toEqual(['access', 'approval', 'payment', 'order', 'channel', 'fulfillment', 'runtime']);
    expect(Manifest.workloads.jobs.services).toContain('finance.invoiceissuer');
    expect(Manifest.workloads.jobs.services).toContain('finance.payoutgateway');
    expect(Manifest.workloads.provider.dependencies).toEqual(['channel']);
  });

  it('registers statement import, reconciliation, settlement and invoice processors', () => {
    const requestedServices: string[] = [];
    const jobs = createJobs({
      workload: 'jobs',
      handlers: {} as never,
      events: {} as never,
      ports: { get: (token) => (token.key === 'runtime.importbatchfactory' ? { create: () => ({}) } : {}) as never },
      service: (token) => {
        requestedServices.push(token.key);
        return {} as never;
      },
    });
    expect(jobs.map(({ id }) => id)).toEqual(['financeimport', 'reconciliation', 'settlement', 'invoice']);
    expect(requestedServices).toEqual(expect.arrayContaining(['database.pool', 'object.store', 'kms.client', 'finance.invoiceissuer', 'finance.payoutgateway']));
  });

  it('subscribes only the canonical accounting fact events', () => {
    expect(FinanceEventSubscriptions).toEqual([{ handler: 'reconciliation', events: EVENT_SUBSCRIPTIONS.reconciliation }]);
    expect(FinanceEventSubscriptions[0]?.events).toEqual(['payment.captured', 'refund.completed', 'payment.late.detected', 'payment.autorefund.requested']);
  });
});

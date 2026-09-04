import { describe, expect, it } from 'vitest';
import * as reportingPublic from '..';
import { REPORTING_CAPABILITIES, reportingManifest } from '..';

describe('reporting module manifest', () => {
  it('keeps the stable reporting identity and lightweight public entry', () => {
    expect(reportingManifest.id).toBe('reporting');
    expect(reportingManifest.publicEntry).toBe('./index.ts');
    expect(reportingManifest.provides).toEqual([REPORTING_CAPABILITIES.read, REPORTING_CAPABILITIES.manage]);
    expect(reportingPublic).toHaveProperty('createReportingExport');
    expect(reportingPublic).not.toHaveProperty('ReportingModule');
    expect(reportingPublic).not.toHaveProperty('IdentityOperatorReportingModule');
    expect(reportingPublic).not.toHaveProperty('reportingRoutes');
    expect(reportingPublic).not.toHaveProperty('PgReportingRepository');
    expect(reportingPublic).not.toHaveProperty('ProjectionJobProcessor');
    expect(reportingPublic).not.toHaveProperty('ExportJobRunner');
  });

  it('declares reporting dependencies, layers, and entrypoints', () => {
    expect(reportingManifest.requires).toEqual([]);
    expect(reportingManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(reportingManifest.entrypoints.http).toEqual(['reportingRoutes', 'reportingOperatorReadOperations']);
    expect(reportingManifest.entrypoints.jobs).toEqual(['projection', 'export']);
  });

  it('declares the reporting operation inventory', () => {
    expect(reportingManifest.operations).toEqual([
      'reporting.dashboard.read',
      'reporting.sales.read',
      'reporting.products.read',
      'reporting.malls.read',
      'reporting.categories.read',
      'reporting.channels.read',
      'reporting.powderclass.read',
      'reporting.voucherconsumption.read',
      'reporting.exports.create',
      'reporting.exports.read',
    ]);
  });

  it('declares reporting event ownership', () => {
    expect(reportingManifest.publishes).toEqual([]);
    expect(reportingManifest.consumes).toEqual([
      'identity.session.created',
      'identity.member.registered',
      'access.version.changed',
      'catalog.listing.published',
      'inventory.stock.changed',
      'inventory.stock.reserved',
      'experience.published',
      'checkout.quote.confirmed',
      'voucher.issued',
      'benefit.granted',
      'benefit.expired',
      'benefit.revoked',
      'finance.entry.posted',
      'finance.settlement.approved',
      'finance.settlement.adjusted',
      'finance.withdrawal.paid',
      'invoice.issued',
      'invoice.red.issued',
      'support.message.sent',
      'support.ticket.assigned',
      'channel.sync.completed',
      'channel.webhook.applied',
      'channel.refund.changed',
      'notification.delivered',
      'risk.policy.activated',
      'order.placed',
      'order.paid',
      'order.cancelled',
      'fulfillment.shipped',
      'payment.refunded',
      'voucher.redeemed',
      'finance.period.closed',
    ]);
  });
});

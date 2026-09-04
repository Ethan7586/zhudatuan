import { journey } from './JourneyHarness';
journey('MVPGROUPVOUCHER', {
  workstation: 'groupvoucher',
  operations: ['partner.customers.create', 'voucher.products.create', 'voucher.stockrequests.create', 'voucher.stockrequests.submit', 'approval.tasks.approve', 'voucher.issueorders.create', 'voucher.issueorders.submit', 'voucher.issuebatches.get', 'voucher.actionbatches.create', 'voucher.vouchers.timeline'],
  tables: ['partner.customer', 'voucher.product', 'voucher.stockrequest', 'voucher.issueorder', 'voucher.voucher'],
  event: 'voucher.issued',
});

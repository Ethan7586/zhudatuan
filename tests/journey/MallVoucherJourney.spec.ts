import { journey } from './JourneyHarness';
journey('MVPMALLVOUCHER', {
  workstation: 'mallvoucher',
  operations: ['voucher.search.read', 'voucher.issueorders.submit', 'voucher.actionbatches.create', 'voucher.tenderholds.create', 'voucher.redemptions.create', 'voucher.redemptions.get', 'voucher.refunds.create', 'voucher.vouchers.timeline'],
  tables: ['voucher.voucher', 'voucher.tenderhold', 'voucher.redemption', 'voucher.refund'],
  event: 'voucher.redeemed',
});

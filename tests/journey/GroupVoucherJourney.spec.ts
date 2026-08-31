import { journey } from './JourneyHarness';
journey('MVPGROUPVOUCHER', {
  workstation: 'groupvoucher',
  operations: ['voucher.programs.manage', 'voucher.reserves.request', 'voucher.reserves.decide', 'voucher.batches.issue', 'voucher.status.batch'],
  tables: ['voucher.program', 'voucher.reserverequest', 'voucher.voucher'],
  event: 'voucher.issued',
});

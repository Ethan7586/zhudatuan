import { journey } from './JourneyHarness';
journey('MVP18', { workstation: 'mallvoucher', operations: ['voucher.bindings.read', 'voucher.batches.issue', 'voucher.status.batch', 'voucher.redemptions.read', 'voucher.redemptions.reverse'], tables: ['voucher.voucher', 'voucher.redemption', 'voucher.reversal'], event: 'voucher.redeemed' });

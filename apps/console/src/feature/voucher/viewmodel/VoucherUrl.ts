import { defineQueryState, enumQuery, optionalQuery, stringQuery } from '../../../shared/query/QueryState';
import { voucherViews } from '../model/Voucher';

export const voucherUrl = defineQueryState({
  q: stringQuery('', 255),
  view: enumQuery(voucherViews, 'products'),
  cursor: optionalQuery(),
  status: stringQuery('all', 128),
  selected: optionalQuery(255),
});

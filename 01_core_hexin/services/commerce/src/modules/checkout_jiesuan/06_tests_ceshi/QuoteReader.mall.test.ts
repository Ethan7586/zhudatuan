import { describe, expect, it } from 'vitest';
import type { QueryResult, QueryResultRow } from 'pg';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { CheckoutSelection } from '../02_domain_yewu/models_moxing/CheckoutQuote';
import { BenefitPort } from '../../benefit/BenefitPort';
import { VoucherPort } from '../../voucher/VoucherPort';
import { QuoteReader } from '../03_application_yingyong/queries_duqu/QuoteReader';

const selection: CheckoutSelection = Object.freeze({
  address: null,
  invoice: null,
  delivery: Object.freeze({}),
  vouchers: Object.freeze([]),
  benefits: Object.freeze([]),
});

describe('QuoteReader mall purchase history isolation', () => {
  it('counts the same member purchase history only inside the current mall', async () => {
    const historyQueries: unknown[][] = [];
    const historySql: string[] = [];
    const database = quoteDatabase(historyQueries, historySql);
    const reader = new QuoteReader(new BenefitPort(), new VoucherPort());

    const mallA = await reader.read(database, 'membership:mall-a', selection);
    const mallB = await reader.read(database, 'membership:mall-b', selection);

    expect(mallA.lines[0]).toMatchObject({ accepted: false, reasons: ['QUALIFICATION_DENIED:policy:limit-one'] });
    expect(mallB.lines[0]).toMatchObject({ accepted: true, reasons: [] });
    expect(historyQueries).toEqual([
      ['mall:a', 'member:one'],
      ['mall:b', 'member:one'],
    ]);
    expect(historySql).toHaveLength(2);
    expect(historySql.every((text) => text.includes('where orders.mall_id=$1 and orders.member_id=$2'))).toBe(true);
  });
});

function quoteDatabase(historyQueries: unknown[][], historySql: string[]): OperationDatabase {
  return {
    async query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []): Promise<QueryResult<R>> {
      let rows: readonly QueryResultRow[];
      if (text.includes('from access.membership membership')) {
        const mall = values[0] === 'membership:mall-a' ? 'mall:a' : 'mall:b';
        rows = [{
          id: `cart:${mall}`, member_id: 'member:one', mall_id: mall, application_id: `application:${mall}`, version: 1,
          profile_status: 'active', profile_version: 1, city_code: null, address_version: null, address_region: null,
          invoice_version: null, experience_version: 'experience:1', experience_hash: 'hash:1',
        }];
      } else if (text.startsWith('select item.listing_id')) {
        rows = [{
          listing_id: 'listing:one', sku_id: 'sku:one', quantity: 1, cart_listing_version: '1', listing_title: '商品',
          listing_version: 1, listing_status: 'published', product_id: 'product:one', product_type: 'digital', category_id: 'category:one',
          product_version: 1, sku_version: 1, unit_minor: 100, price_version: 'price:1', stockitem_id: 'stock:one',
          onhand: 10, safety: 0, reserved: 0, stock_version: 1, provider: null, partner_id: null,
          supplier_relationship_id: null, contract_id: null, contract_hash: null, fulfillment_party_id: null,
          settlement_party_id: null, invoice_party_id: null,
        }];
      } else if (text.includes('from qualification.policy policy')) {
        rows = [{
          id: 'policy:limit-one', version: 1, rule_hash: 'rule:1', rule: {}, resources: [], subjects: [],
          period: 'lifetime', quantity: 1, amount_minor: null,
        }];
      } else if (text.includes('from ordering.orderrecord orders')) {
        historySql.push(text);
        historyQueries.push([...values]);
        rows = values[0] === 'mall:a' ? [{
          listing_id: 'listing:one', day_quantity: 1, week_quantity: 1, month_quantity: 1, lifetime_quantity: 1,
          day_minor: 100, week_minor: 100, month_minor: 100, lifetime_minor: 100,
        }] : [];
      } else {
        rows = [];
      }
      return { rows } as QueryResult<R>;
    },
  };
}

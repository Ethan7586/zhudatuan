import type { AfterSalePage } from '../model/AfterSale';
import type { OrderPage, OrderRecord } from '../model/Order';
import { deepFreeze } from '../../../shared/model/Immutable';
import { AfterSalePageSchema } from './AfterSaleSchema';
import { OrderPageSchema } from './OrderSchema';

export class OrderMapper {
  page(value: unknown): OrderPage {
    const page = OrderPageSchema.parse(value);
    return deepFreeze({
      items: page.items.map((item) => {
        const { scope_id: scope, member_id: member, mall_id: mall, lines, ...order } = item;
        return {
          ...order,
          ...(scope === undefined ? {} : { scope_id: scope }),
          ...(member === undefined ? {} : { member_id: member }),
          ...(mall === undefined ? {} : { mall_id: mall }),
          lines: lines.map((line) => {
            const { provider, partner, ...product } = line;
            return {
              ...product,
              ...(provider === undefined ? {} : { provider }),
              ...(partner === undefined ? {} : { partner }),
            };
          }),
        };
      }),
      count: page.count,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  order(value: unknown): OrderRecord | undefined {
    return this.page(value).items[0];
  }

  aftersales(value: unknown): AfterSalePage {
    const page = AfterSalePageSchema.parse(value);
    return deepFreeze({
      items: page.items,
      count: page.count,
      availableLines: page.availableLines,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }
}

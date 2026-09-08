import type { StorefrontSession } from '../../../entity/session';
import type { BenefitReader } from '../../benefit';
import type { VoucherPort } from '../../voucher/public';

type Voucher = Awaited<ReturnType<VoucherPort['list']>>['items'][number];

export class ReadCheckoutOptions {
  constructor(
    private readonly benefits: BenefitReader,
    private readonly vouchers: Pick<VoucherPort, 'list'>
  ) {}

  async execute(session: StorefrontSession, signal?: AbortSignal) {
    const [benefits, vouchers] = await Promise.all([this.benefits.accounts(session, signal), this.readVouchers(session, signal)]);
    return Object.freeze({ benefits, vouchers });
  }

  private async readVouchers(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> {
    const values: Voucher[] = [];
    const visited = new Set<string>();
    let cursor: string | null = null;
    do {
      const page = await this.vouchers.list(session, cursor, signal);
      values.push(...page.items);
      if (!page.nextCursor || visited.has(page.nextCursor)) break;
      visited.add(page.nextCursor);
      cursor = page.nextCursor;
    } while (!signal?.aborted);
    return Object.freeze(values);
  }
}

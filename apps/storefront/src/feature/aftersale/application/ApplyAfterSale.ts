import type { AfterSalePort } from '../public/AfterSalePort';
import type { ApplyAfterSaleInput } from '../model/AfterSale';
import type { StorefrontSession } from '../../../entity/session';

export class ApplyAfterSale {
  private key = `aftersale:${crypto.randomUUID()}`;
  constructor(private readonly gateway: Pick<AfterSalePort, 'apply'>) {}

  async execute(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput): Promise<Readonly<{ id: string; state: 'reviewing' }>> {
    const result = await this.gateway.apply(session, orderId, input, this.key);
    this.key = `aftersale:${crypto.randomUUID()}`;
    return result;
  }
}

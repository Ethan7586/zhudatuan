import { AfterSaleGateway } from '../infrastructure/AfterSaleGateway';
import type { ApplyAfterSaleInput } from '../model/AfterSale';
import type { StorefrontSession } from '../../../shared/api/Session';

export class ApplyAfterSale {
  private key = `aftersale:${crypto.randomUUID()}`;

  async execute(session: StorefrontSession, orderId: string, input: ApplyAfterSaleInput): Promise<Readonly<{ id: string; state: 'reviewing' }>> {
    const result = await AfterSaleGateway.apply(session, orderId, input, this.key);
    this.key = `aftersale:${crypto.randomUUID()}`;
    return result;
  }
}

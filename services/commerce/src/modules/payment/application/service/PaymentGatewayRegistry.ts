import type { PaymentScene } from '../../public';
import type { PaymentGateway, PaymentGatewayCapability } from '../port/PaymentGateway';

export class PaymentGatewayRegistry {
  private readonly gateways: ReadonlyMap<string, PaymentGateway>;

  constructor(gateways: readonly PaymentGateway[]) {
    this.gateways = new Map(gateways.map((gateway) => [gateway.manifest.id, gateway]));
    if (gateways.length === 0 || this.gateways.size !== gateways.length) throw new Error('PAYMENT_GATEWAY_MANIFEST_INVALID');
    for (const gateway of gateways) {
      if (!gateway.manifest.id || gateway.manifest.scenes.length === 0 || gateway.manifest.capabilities.length === 0) throw new Error('PAYMENT_GATEWAY_MANIFEST_INVALID');
      if (new Set(gateway.manifest.scenes).size !== gateway.manifest.scenes.length || new Set(gateway.manifest.capabilities).size !== gateway.manifest.capabilities.length) throw new Error('PAYMENT_GATEWAY_MANIFEST_INVALID');
    }
  }

  require(capability: PaymentGatewayCapability, scene: PaymentScene): PaymentGateway {
    const gateway = [...this.gateways.values()].find((candidate) => candidate.manifest.scenes.includes(scene) && candidate.manifest.capabilities.includes(capability));
    if (!gateway) throw new Error('PAYMENT_GATEWAY_CAPABILITY_UNAVAILABLE');
    return gateway;
  }
}

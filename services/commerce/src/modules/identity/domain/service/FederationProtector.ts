import { createHmac, timingSafeEqual } from 'node:crypto';
export class FederationProtector {
  constructor(private readonly key: string) {
    if (key.length < 32) throw new Error('FEDERATION_KEY_INVALID');
  }
  browser(peer: string, agent: string, device: string): Buffer {
    return this.digest(['browser', peer, agent, device].join('\u001f'));
  }
  device(device: string): Buffer {
    return this.digest(['device', device].join('\u001f'));
  }
  risk(peer: string, agent: string): Buffer {
    return this.digest(['risk', peer, agent].join('\u001f'));
  }
  returnTarget(value: string): Buffer {
    return this.digest(['return', value].join('\u001f'));
  }
  equal(left: Buffer, right: Buffer): boolean {
    return left.length === right.length && timingSafeEqual(left, right);
  }
  private digest(value: string): Buffer {
    return createHmac('sha256', this.key).update(value).digest();
  }
}

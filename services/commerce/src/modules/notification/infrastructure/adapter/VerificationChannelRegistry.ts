import type { VerificationChannelBinding, VerificationChannelId, VerificationChannelPort } from '../../public';

const bindings: readonly VerificationChannelBinding[] = Object.freeze([
  Object.freeze({ id: 'qrcode', delivery: 'inline', provider: 'qrcode' }),
  Object.freeze({ id: 'sms', delivery: 'notification', provider: 'sms' }),
  Object.freeze({ id: 'app', delivery: 'notification', provider: 'inapp' }),
]);

export class VerificationChannelRegistry implements VerificationChannelPort {
  private readonly channels = new Map<VerificationChannelId, VerificationChannelBinding>(bindings.map((binding) => [binding.id, binding]));

  require(id: VerificationChannelId): VerificationChannelBinding {
    const channel = this.channels.get(id);
    if (!channel) throw new Error('VERIFICATION_CHANNEL_UNAVAILABLE');
    return channel;
  }
}

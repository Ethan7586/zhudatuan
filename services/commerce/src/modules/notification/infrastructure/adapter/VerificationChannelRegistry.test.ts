import { describe, expect, it } from 'vitest';
import { VerificationChannelRegistry } from './VerificationChannelRegistry';

describe('verification notification channel registry', () => {
  it('owns the complete mapping from verification channels to delivery adapters', () => {
    const channels = new VerificationChannelRegistry();
    expect(channels.require('qrcode')).toEqual({ id: 'qrcode', delivery: 'inline', provider: 'qrcode' });
    expect(channels.require('sms')).toEqual({ id: 'sms', delivery: 'notification', provider: 'sms' });
    expect(channels.require('app')).toEqual({ id: 'app', delivery: 'notification', provider: 'inapp' });
  });
});

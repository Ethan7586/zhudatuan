import { describe, expect, it } from 'vitest';

import { WechatPaymentManifest } from './Manifest';

describe('WeChat payment extension manifest', () => {
  it('declares the complete payment contract without optional placeholders', () => {
    expect(WechatPaymentManifest.operations).toEqual(['Create', 'Query', 'Close', 'Refund', 'Webhook']);
    expect(WechatPaymentManifest.capabilities).toEqual(['prepay', 'query', 'close', 'refund', 'webhook']);
    expect(WechatPaymentManifest.scenes).toEqual(['miniapp', 'jsapi']);
    expect(WechatPaymentManifest.secretRefs).toEqual(['WECHAT_APPLICATION_CONFIG_REF', 'WECHAT_PAYMENT_CONFIG_REF']);
    expect(WechatPaymentManifest.webhook).toMatchObject({ signature: 'RSA-SHA256', replayWindowSeconds: 300 });
  });
});

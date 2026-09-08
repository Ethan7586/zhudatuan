import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '../miniprogram/platform/Clipboard';
import { requestWechatPayment } from '../miniprogram/platform/Payment';
import { PrivacyBridge } from '../miniprogram/platform/Privacy';
import { scanMiniappCode } from '../miniprogram/platform/Scanner';

const requirePrivacyAuthorize = vi.fn((options: { success(): void }) => options.success());

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { wx: {
    getPrivacySetting: (options: { success(value: { needAuthorization: boolean }): void }) => options.success({ needAuthorization: true }),
    requirePrivacyAuthorize,
    requestPayment: (options: { success(): void }) => options.success(),
    scanCode: (options: { success(value: { result: string }): void }) => options.success({ result: 'zhudatuan://redemption?id=redemption%3Aone' }),
    setClipboardData: (options: { success(): void }) => options.success(),
  } });
});

describe('miniapp platform bridges', () => {
  it('requests privacy authorization once per runtime', async () => {
    const bridge = new PrivacyBridge();
    await bridge.ensure();
    await bridge.ensure();
    expect(requirePrivacyAuthorize).toHaveBeenCalledOnce();
  });

  it('validates payment fields, scan results and clipboard payloads', async () => {
    await expect(requestWechatPayment({ timeStamp: '1', nonceStr: 'n', package: 'prepay_id=one', signType: 'RSA', paySign: 'signature' })).resolves.toBeUndefined();
    await expect(requestWechatPayment({ timeStamp: '1' })).rejects.toThrow('MINIAPP_PAYMENT_ACTION_INVALID');
    await expect(scanMiniappCode()).resolves.toContain('redemption');
    await expect(copyText('https://mall.example/referral')).resolves.toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { parseWechatConfiguration } from './Config';
import { WechatManifest } from './Manifest';

describe('WeChat notification configuration', () => {
  it('declares subscription authorization and parses a strict template mapping', () => {
    const configuration = parseWechatConfiguration({
      appId: 'wx1234567890abcdef', credentialRef: 'secret/notification/wechat', page: 'pages/orders/index', priority: 10, state: 'formal',
      templates: { paid: { id: 'template_12345678', variables: { order: 'character_string1' } } },
    });
    expect(configuration.templates.paid).toEqual({ id: 'template_12345678', variables: { order: 'character_string1' } });
    expect(WechatManifest.authorization).toEqual({ required: true, source: 'wechat-subscribe-message', scope: 'template' });
  });

  it('rejects unknown configuration and duplicate provider variable slots', () => {
    const base = { appId: 'wx1234567890abcdef', credentialRef: 'secret/notification/wechat', page: null, priority: 10, state: 'formal' };
    expect(() => parseWechatConfiguration({ ...base, templates: { paid: { id: 'template_12345678', variables: { order: 'thing1', amount: 'thing1' } } } }))
      .toThrow('WECHAT_TEMPLATE_MAPPING_INVALID');
    expect(() => parseWechatConfiguration({ ...base, templates: { paid: { id: 'template_12345678', variables: { order: 'thing1' } } }, appSecret: 'inline' }))
      .toThrow('WECHAT_DELIVERY_CONFIGURATION_INVALID');
  });
});

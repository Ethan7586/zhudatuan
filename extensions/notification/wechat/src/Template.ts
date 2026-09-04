import type { DeliveryRequest } from '@shop/contract';

import type { WechatConfiguration } from './Config';

export class WechatTemplateCatalog {
  constructor(private readonly templates: WechatConfiguration['templates']) {}

  resolve(request: DeliveryRequest): Readonly<{ id: string; data: Readonly<Record<string, Readonly<{ value: string }>>> }> {
    if (request.purpose === 'verification') throw new Error('WECHAT_VERIFICATION_UNSUPPORTED');
    if (request.authorization !== 'accepted') throw new Error('WECHAT_SUBSCRIPTION_AUTHORIZATION_REQUIRED');
    const alias = request.providerTemplate;
    if (!alias) throw new Error('WECHAT_TEMPLATE_REQUIRED');
    const template = this.templates[alias];
    if (!template) throw new Error('WECHAT_TEMPLATE_UNKNOWN');
    const expected = Object.keys(template.variables).sort();
    if (Object.keys(request.variables).sort().join(',') !== expected.join(',')) throw new Error('WECHAT_TEMPLATE_VARIABLES_INVALID');
    return Object.freeze({
      id: template.id,
      data: Object.freeze(Object.fromEntries(expected.map((name) => [template.variables[name]!, Object.freeze({ value: wechatValue(request.variables[name]!) })]))),
    });
  }
}

function wechatValue(value: string | number | boolean): string {
  const normalized = String(value).trim();
  if (!normalized || Array.from(normalized).length > 20 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error('WECHAT_VARIABLE_INVALID');
  return normalized;
}

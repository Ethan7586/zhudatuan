export const SmsCatalog = Object.freeze({
  id: 'sms',
  name: '短信通知',
  business: '登录验证、订单进度、权益到账与经授权的营销通知',
  clients: Object.freeze(['auth', 'console', 'storefront', 'miniapp'] as const),
  capabilities: Object.freeze(['Delivery', 'TemplateMapping', 'OptOut', 'Receipt'] as const),
  settings: Object.freeze([
    Object.freeze({ key: 'signName', label: '短信签名', secret: false }),
    Object.freeze({ key: 'verificationTemplate', label: '验证码模板', secret: false }),
    Object.freeze({ key: 'templates.transactional', label: '业务通知模板', secret: false }),
    Object.freeze({ key: 'templates.marketing', label: '营销通知模板', secret: false }),
    Object.freeze({ key: 'optOut', label: '营销退订规则', secret: false }),
    Object.freeze({ key: 'credentialRef', label: '访问凭据', secret: true }),
  ] as const),
  help: '验证码、业务和营销模板必须分开配置；营销短信自动附加退订文案，访问密钥只保存 Secret 引用或使用运行角色。',
} as const);

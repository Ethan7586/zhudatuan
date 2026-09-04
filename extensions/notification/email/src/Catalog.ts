export const EmailCatalog = Object.freeze({
  id: 'email',
  name: '邮件通知',
  business: '订单、财务、权益与服务进度邮件',
  clients: Object.freeze(['console', 'storefront'] as const),
  capabilities: Object.freeze(['Delivery', 'ProviderReceipt'] as const),
  settings: Object.freeze([
    Object.freeze({ key: 'provider', label: '服务商标识', secret: false }),
    Object.freeze({ key: 'endpoint', label: '服务地址', secret: false }),
    Object.freeze({ key: 'sender', label: '发件地址', secret: false }),
    Object.freeze({ key: 'credentialRef', label: '访问凭据', secret: true }),
  ] as const),
  help: '邮件由通知任务统一投递，服务商凭据只保存 Secret 引用；接收地址、正文和凭据不会写入日志。',
} as const);

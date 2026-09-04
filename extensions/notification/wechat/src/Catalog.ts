export const WechatNotificationCatalog = Object.freeze({
  id: 'wechat',
  name: '微信订阅消息',
  business: '订单、福利、卡券和服务进度订阅通知',
  clients: Object.freeze(['miniapp'] as const),
  capabilities: Object.freeze(['Delivery', 'Template', 'SubscriptionMessage'] as const),
  authorization: Object.freeze({ required: true, source: 'wechat-subscribe-message', scope: 'template', revocable: true }),
  settings: Object.freeze([
    Object.freeze({ key: 'appId', label: '小程序 AppID', secret: false }),
    Object.freeze({ key: 'credentialRef', label: '小程序密钥', secret: true }),
    Object.freeze({ key: 'templates', label: '订阅模板映射', secret: false }),
    Object.freeze({ key: 'state', label: '投递环境', secret: false }),
  ] as const),
  help: '用户须先在微信侧同意对应订阅模板；拒绝、撤回或未授权时不发送，也不会降级绕过用户选择。',
} as const);

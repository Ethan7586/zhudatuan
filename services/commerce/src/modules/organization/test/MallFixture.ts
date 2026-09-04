import type { MallOpeningValue } from '../domain/model/MallOpening';

export const completeOpening = Object.freeze({
  state: 'complete',
  subject: Object.freeze({
    type: 'enterprise',
    companyName: '主打团科技有限公司',
    creditCode: '91310000MA1K123456',
    legalRepresentative: '张三',
    contactName: '李四',
    contactMobile: '+8613812345678',
    licenseObjectRef: 'object:license',
  }),
  business: Object.freeze({ storeType: 'general', primaryCategory: '员工福利', mode: 'selfoperated', region: '上海市', address: '上海市浦东新区示范路一号', servicePhone: '+862112345678' }),
  certificateMode: 'managed',
  certificateObjectRef: null,
  channels: Object.freeze({ miniProgramMode: 'later', miniProgramAppId: null, miniProgramOriginalId: null, officialAccountMode: 'later', officialAccountAppId: null, videoChannelId: null }),
  payment: Object.freeze({ plan: 'later', wechatMerchantId: null }),
  fulfillment: Object.freeze({ deliveryMode: 'express', warehouseRegion: '上海市', returnContact: '王五 +8613912345678', returnAddress: '上海市浦东新区退货路二号' }),
  invoiceMode: 'later',
  notificationContact: 'ops@example.com',
} satisfies MallOpeningValue);

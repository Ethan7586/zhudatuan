import { useEffect, useState } from 'react';
import type { MallCreationViewModel } from '../viewmodel/MallCreationViewModel';
import { JourneySelect, JourneyText } from './JourneyField';

type Section = keyof MallCreationViewModel['contentValidation'] & ('subject' | 'channel' | 'delivery');

export function ContentStep({ model }: Readonly<{ model: MallCreationViewModel }>) {
  const [section, setSection] = useState<Section>('subject');
  useEffect(() => {
    if (model.validationRequest > 0 && model.contentValidation.first) setSection(model.contentValidation.first);
  }, [model.contentValidation.first, model.validationRequest]);
  return (
    <section className="malljourneystep" aria-labelledby="mallcontentstep">
      <header>
        <p>第三步</p>
        <h3 id="mallcontentstep">补齐开店资料</h3>
        <span>按任务分成三组逐步填写；所有字段随商城一次持久化，后续模块直接读取权威配置。</span>
      </header>
      <nav className="malljourneysections" aria-label="开店资料分组">
        <button type="button" data-state={model.contentValidation.subject ? 'incomplete' : 'complete'} aria-pressed={section === 'subject'} onClick={() => setSection('subject')}>
          主体与经营 <small>{model.contentValidation.subject ? '待完善' : '已完成'}</small>
        </button>
        <button type="button" data-state={model.contentValidation.channel ? 'incomplete' : 'complete'} aria-pressed={section === 'channel'} onClick={() => setSection('channel')}>
          域名与微信 <small>{model.contentValidation.channel ? '待完善' : '已完成'}</small>
        </button>
        <button type="button" data-state={model.contentValidation.delivery ? 'incomplete' : 'complete'} aria-pressed={section === 'delivery'} onClick={() => setSection('delivery')}>
          支付与履约 <small>{model.contentValidation.delivery ? '待完善' : '已完成'}</small>
        </button>
      </nav>
      {section === 'subject' ? <SubjectFields model={model} /> : section === 'channel' ? <ChannelFields model={model} /> : <DeliveryFields model={model} />}
    </section>
  );
}

function SubjectFields({ model }: Readonly<{ model: MallCreationViewModel }>) {
  const draft = model.draft;
  return (
    <div className="malljourneygrid">
      <JourneySelect
        label="主体类型"
        field="subjectType"
        value={draft.subjectType}
        onChange={model.actions.change}
        options={[
          { value: 'enterprise', label: '企业' },
          { value: 'individual', label: '个体工商户' },
          { value: 'organization', label: '其他组织' },
          { value: 'personal', label: '个人经营者' },
        ]}
      />
      <JourneyText label="主体名称" field="companyName" value={draft.companyName} onChange={model.actions.change} placeholder="营业执照上的完整名称" maxLength={160} />
      {draft.subjectType === 'personal' ? null : (
        <JourneyText
          label="统一社会信用代码"
          field="creditCode"
          value={draft.creditCode}
          onChange={(patch) => model.actions.change({ ...patch, creditCode: String(patch.creditCode ?? '').toUpperCase() })}
          placeholder="15 至 18 位代码"
          maxLength={18}
        />
      )}
      {draft.subjectType === 'personal' ? null : <JourneyText label="法定代表人" field="legalRepresentative" value={draft.legalRepresentative} onChange={model.actions.change} placeholder="证照登记姓名" maxLength={80} />}
      <JourneyText label="业务联系人" field="contactName" value={draft.contactName} onChange={model.actions.change} placeholder="负责开店事项的联系人" maxLength={80} />
      <JourneyText label="联系人手机" field="contactMobile" value={draft.contactMobile} onChange={model.actions.change} placeholder="中国大陆手机号或国际格式" inputMode="tel" maxLength={16} />
      {draft.subjectType === 'personal' ? null : (
        <JourneyText label="营业执照资料编号（选填）" field="licenseObjectRef" value={draft.licenseObjectRef} onChange={model.actions.change} placeholder="在安全资料库上传后获得，例如 object:license" maxLength={512} />
      )}
      <JourneySelect
        label="店铺类型"
        field="storeType"
        value={draft.storeType}
        onChange={model.actions.change}
        options={[
          { value: 'general', label: '综合商城' },
          { value: 'specialty', label: '专营店' },
          { value: 'franchise', label: '品牌授权店' },
          { value: 'government', label: '政企福利店' },
        ]}
      />
      <JourneyText label="主营类目" field="primaryCategory" value={draft.primaryCategory} onChange={model.actions.change} placeholder="例如：食品、生鲜、员工关怀" maxLength={120} />
      <JourneySelect
        label="经营模式"
        field="businessMode"
        value={draft.businessMode}
        onChange={model.actions.change}
        options={[
          { value: 'selfoperated', label: '自营' },
          { value: 'marketplace', label: '平台撮合' },
          { value: 'hybrid', label: '自营 + 平台' },
        ]}
      />
      <JourneyText label="经营地区" field="businessRegion" value={draft.businessRegion} onChange={model.actions.change} placeholder="省 / 市 / 区" maxLength={120} />
      <JourneyText label="经营地址" field="businessAddress" value={draft.businessAddress} onChange={model.actions.change} placeholder="完整经营地址" maxLength={240} />
      <JourneyText label="客服电话（选填）" field="servicePhone" value={draft.servicePhone} onChange={model.actions.change} placeholder="国际格式，例如 +862112345678" maxLength={32} />
    </div>
  );
}

function ChannelFields({ model }: Readonly<{ model: MallCreationViewModel }>) {
  const draft = model.draft;
  return (
    <div className="malljourneygrid">
      <JourneySelect
        label="HTTPS 证书"
        field="certificateMode"
        value={draft.certificateMode}
        onChange={model.actions.change}
        options={[
          { value: 'managed', label: '平台自动申请和续期' },
          { value: 'self', label: '使用已有证书' },
          { value: 'later', label: '稍后配置域名证书' },
        ]}
      />
      {draft.certificateMode === 'self' ? (
        <JourneyText label="证书资料编号" field="certificateObjectRef" value={draft.certificateObjectRef} onChange={model.actions.change} placeholder="在安全资料库上传后获得，例如 object:certificate" maxLength={512} />
      ) : null}
      <JourneySelect
        label="微信小程序"
        field="miniProgramMode"
        value={draft.miniProgramMode}
        onChange={model.actions.change}
        options={[
          { value: 'later', label: '稍后接入' },
          { value: 'authorize', label: '授权已有小程序' },
          { value: 'register', label: '申请新小程序' },
        ]}
      />
      {draft.miniProgramMode === 'authorize' ? (
        <>
          <JourneyText label="小程序 AppID" field="miniProgramAppId" value={draft.miniProgramAppId} onChange={model.actions.change} placeholder="wx 开头的 AppID" maxLength={128} />
          <JourneyText label="小程序原始 ID" field="miniProgramOriginalId" value={draft.miniProgramOriginalId} onChange={model.actions.change} placeholder="gh_ 开头的原始 ID" maxLength={128} />
        </>
      ) : null}
      <JourneySelect
        label="微信公众号"
        field="officialAccountMode"
        value={draft.officialAccountMode}
        onChange={model.actions.change}
        options={[
          { value: 'later', label: '稍后接入' },
          { value: 'authorize', label: '授权已有公众号' },
          { value: 'register', label: '申请新公众号' },
        ]}
      />
      {draft.officialAccountMode === 'authorize' ? <JourneyText label="公众号 AppID" field="officialAccountAppId" value={draft.officialAccountAppId} onChange={model.actions.change} placeholder="公众号 AppID" maxLength={128} /> : null}
      <JourneyText label="视频号 ID（选填）" field="videoChannelId" value={draft.videoChannelId} onChange={model.actions.change} placeholder="用于后续直播与商品接入" maxLength={128} />
    </div>
  );
}

function DeliveryFields({ model }: Readonly<{ model: MallCreationViewModel }>) {
  const draft = model.draft;
  return (
    <div className="malljourneygrid">
      <JourneySelect
        label="收款方案"
        field="paymentPlan"
        value={draft.paymentPlan}
        onChange={model.actions.change}
        options={[
          { value: 'later', label: '稍后开通' },
          { value: 'wechat', label: '微信支付' },
          { value: 'multi', label: '微信 + 支付宝' },
          { value: 'offline', label: '线下收款' },
        ]}
      />
      {draft.paymentPlan === 'wechat' || draft.paymentPlan === 'multi' ? (
        <JourneyText label="微信支付商户号" field="wechatMerchantId" value={draft.wechatMerchantId} onChange={model.actions.change} placeholder="已有商户号" maxLength={64} />
      ) : null}
      <JourneySelect
        label="履约方式"
        field="deliveryMode"
        value={draft.deliveryMode}
        onChange={model.actions.change}
        options={[
          { value: 'express', label: '快递发货' },
          { value: 'local', label: '同城配送' },
          { value: 'pickup', label: '到店自提' },
          { value: 'digital', label: '虚拟商品' },
          { value: 'mixed', label: '多种履约方式' },
        ]}
      />
      {draft.deliveryMode === 'digital' ? null : (
        <>
          <JourneyText label="默认发货地区" field="warehouseRegion" value={draft.warehouseRegion} onChange={model.actions.change} placeholder="仓库所在省 / 市 / 区" maxLength={120} />
          <JourneyText label="退货联系人" field="returnContact" value={draft.returnContact} onChange={model.actions.change} placeholder="售后收件人及电话" maxLength={120} />
          <JourneyText label="默认退货地址" field="returnAddress" value={draft.returnAddress} onChange={model.actions.change} placeholder="完整退货地址" maxLength={240} />
        </>
      )}
      <JourneySelect
        label="发票能力"
        field="invoiceMode"
        value={draft.invoiceMode}
        onChange={model.actions.change}
        options={[
          { value: 'later', label: '稍后配置' },
          { value: 'electronic', label: '电子发票' },
          { value: 'paper', label: '纸质发票' },
          { value: 'both', label: '电子 + 纸质' },
        ]}
      />
      <JourneyText label="经营通知接收人" field="notificationContact" value={draft.notificationContact} onChange={model.actions.change} placeholder="手机号或邮箱" maxLength={240} />
    </div>
  );
}

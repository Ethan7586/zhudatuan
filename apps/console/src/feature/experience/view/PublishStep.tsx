import type { MallCreationViewModel } from '../viewmodel/MallCreationViewModel';
import { themePreset } from '../model/ThemePreset';
import { JourneySelect } from './JourneyField';

export function PublishStep({ model }: Readonly<{ model: MallCreationViewModel }>) {
  const draft = model.draft;
  const parent = model.parents.find((candidate) => candidate.id === draft.parentId);
  return (
    <section className="malljourneystep" aria-labelledby="mallpublishstep">
      <header>
        <p>第四步</p>
        <h3 id="mallpublishstep">{model.mode === 'create' ? '核对并创建空商城' : '核对并保存商城资料'}</h3>
        <span>{model.mode === 'create' ? '创建成功后由事件异步初始化独立商品池、应用和所选主题草稿；任何失败都可安全重试。' : '保存采用版本校验；成功后通过可靠事件同步应用资料，不直接跨模块写表。'}</span>
      </header>
      <div className="malljourneysummary">
        <Summary label="商城与归属" value={draft.name || '尚未填写'} detail={`${parent?.name ?? '未选择组织'} · ${draft.code || '—'}`} />
        <Summary label="公开入口" value={draft.domainMode === 'custom' ? draft.customDomain || '尚未填写域名' : `平台域名 / ${draft.publicSlug || '—'}`} detail={draft.certificateMode === 'managed' ? '平台托管证书' : '稍后配置证书'} />
        <Summary label="品牌主题" value={themePreset(draft.themePreset).name} detail={`${draft.primaryColor} · ${draft.accentColor}`} />
        <Summary label="经营主体" value={draft.companyName || '尚未填写'} detail={`${draft.primaryCategory || '未选类目'} · ${businessLabel(draft.businessMode)}`} />
        <Summary label="微信生态" value={`${channelLabel(draft.miniProgramMode)} / ${channelLabel(draft.officialAccountMode)}`} detail={draft.videoChannelId ? '已填写视频号' : '未接入视频号'} />
        <Summary label="支付与履约" value={`${paymentLabel(draft.paymentPlan)} · ${deliveryLabel(draft.deliveryMode)}`} detail={`${invoiceLabel(draft.invoiceMode)} · 通知 ${draft.notificationContact || '未填写'}`} />
      </div>
      {model.mode === 'update' ? (
        <div className="malljourneygrid malljourneygridcompact">
          <JourneySelect
            label="经营状态"
            field="status"
            value={draft.status}
            onChange={model.actions.change}
            options={[
              { value: 'draft', label: '草稿' },
              { value: 'active', label: '经营中' },
              { value: 'disabled', label: '已停用' },
            ]}
          />
        </div>
      ) : null}
      <div className="malljourneyconfirm">
        <input id="malljourneyconfirm" type="checkbox" checked={model.confirmed} onChange={(event) => model.actions.confirmed(event.target.checked)} />
        <label htmlFor="malljourneyconfirm">
          我已核对商城归属、主体资料、公开域名和履约配置
          <small>提交会写入完整商城资料并生成不可重复的操作回执。</small>
        </label>
      </div>
    </section>
  );
}

function Summary({ label, value, detail }: Readonly<{ label: string; value: string; detail: string }>) {
  return (
    <article>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}
function businessLabel(value: string) {
  return ({ selfoperated: '自营', marketplace: '平台撮合', hybrid: '混合经营' } as Record<string, string>)[value] ?? value;
}
function channelLabel(value: string) {
  return ({ later: '稍后接入', authorize: '授权已有账号', register: '申请新账号' } as Record<string, string>)[value] ?? value;
}
function paymentLabel(value: string) {
  return ({ later: '稍后收款', wechat: '微信支付', multi: '多渠道支付', offline: '线下收款' } as Record<string, string>)[value] ?? value;
}
function deliveryLabel(value: string) {
  return ({ express: '快递', local: '同城配送', pickup: '到店自提', digital: '虚拟履约', mixed: '多种履约' } as Record<string, string>)[value] ?? value;
}
function invoiceLabel(value: string) {
  return ({ later: '发票稍后配置', electronic: '电子发票', paper: '纸质发票', both: '电子与纸质发票' } as Record<string, string>)[value] ?? value;
}

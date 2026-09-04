import type { MallCreationViewModel } from '../viewmodel/MallCreationViewModel';
import { JourneyField, JourneySelect, JourneyText } from './JourneyField';

export function ScopeStep({ model }: Readonly<{ model: MallCreationViewModel }>) {
  const parent = model.parents.find((candidate) => candidate.id === model.draft.parentId);
  return (
    <section className="malljourneystep" aria-labelledby="mallscopestep">
      <header>
        <p>第二步</p>
        <h3 id="mallscopestep">确定商城归属与公开入口</h3>
        <span>只显示当前账号有权管理的上级组织，代码和公开路径创建后保持稳定。</span>
      </header>
      {model.parentsPending ? (
        <p role="status" className="malljourneynotice">
          正在读取可建店组织…
        </p>
      ) : null}
      {model.parentsError ? (
        <p role="alert" className="malljourneyerror">
          {model.parentsError}
        </p>
      ) : null}
      <div className="malljourneygrid">
        {model.mode === 'update' ? (
          <JourneyField label="所属组织" hint="归属关系创建后不可在商城资料中修改。">
            <output>{parent?.name ?? '既有上级组织'}</output>
          </JourneyField>
        ) : (
          <JourneyField label="所属组织" hint={parent ? `默认时区：${parent.timezone}` : '请选择可管理的集团或企业'}>
            <select
              aria-label="所属组织"
              value={model.draft.parentId}
              onChange={(event) => {
                const selected = model.parents.find((candidate) => candidate.id === event.target.value);
                model.actions.change({ parentId: event.target.value, ...(selected ? { timezone: selected.timezone, companyName: model.draft.companyName || selected.name } : {}) });
              }}
            >
              <option value="">请选择所属组织</option>
              {model.parents.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {kindLabel(candidate.kind)}
                </option>
              ))}
            </select>
          </JourneyField>
        )}
        <JourneyText label="商城名称" field="name" value={model.draft.name} onChange={model.actions.change} placeholder="例如：主打团员工福利商城" maxLength={120} />
        <JourneyText
          label="商城代码"
          field="code"
          value={model.draft.code}
          onChange={(patch) => model.actions.change({ ...patch, code: String(patch.code ?? '').toUpperCase() })}
          placeholder="例如：ZHUDATUAN_EMPLOYEE"
          maxLength={32}
          disabled={model.mode === 'update'}
          {...(model.mode === 'update' ? { hint: '代码用于稳定集成，创建后不可修改。' } : {})}
        />
        <JourneyText
          label="公开路径"
          field="publicSlug"
          value={model.draft.publicSlug}
          onChange={(patch) => model.actions.change({ ...patch, publicSlug: String(patch.publicSlug ?? '').toLowerCase() })}
          placeholder="例如：zhudatuan-employee"
          maxLength={48}
          disabled={model.mode === 'update'}
          {...(model.mode === 'update' ? { hint: '公开路径保持稳定；如需自有域名，请修改“访问域名”。' } : {})}
        />
        <JourneyText label="品牌名称" field="brandName" value={model.draft.brandName} onChange={model.actions.change} placeholder="消费者看到的品牌名称" maxLength={120} />
        <JourneySelect
          label="访问域名"
          field="domainMode"
          value={model.draft.domainMode}
          onChange={model.actions.change}
          options={[
            { value: 'platform', label: '使用平台安全域名' },
            { value: 'custom', label: '绑定自有域名' },
          ]}
        />
        {model.draft.domainMode === 'custom' ? <JourneyText label="自有域名" field="customDomain" value={model.draft.customDomain} onChange={model.actions.change} placeholder="shop.example.com" maxLength={253} /> : null}
        <JourneySelect
          label="时区"
          field="timezone"
          value={model.draft.timezone}
          onChange={model.actions.change}
          options={[
            { value: 'Asia/Shanghai', label: '中国标准时间（上海）' },
            { value: 'Asia/Hong_Kong', label: '香港时间' },
            { value: 'Asia/Singapore', label: '新加坡时间' },
          ]}
        />
        <JourneySelect
          label="结算币种"
          field="currency"
          value={model.draft.currency}
          onChange={model.actions.change}
          options={[
            { value: 'CNY', label: '人民币 CNY' },
            { value: 'HKD', label: '港币 HKD' },
            { value: 'SGD', label: '新加坡元 SGD' },
          ]}
        />
        <JourneyField label="商城负责人" hint="负责人变更请在权限中心按双边确认流程完成。">
          <output>{model.draft.ownerMembershipId === '' ? '尚未配置负责人' : '已配置负责人'}</output>
        </JourneyField>
      </div>
    </section>
  );
}

function kindLabel(kind: string): string {
  return ({ platform: '平台', distributor: '分销层', tenant: '租户', enterprise: '企业' } as Record<string, string>)[kind] ?? '组织';
}

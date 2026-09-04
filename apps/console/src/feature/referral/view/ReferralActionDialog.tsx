import { Button, Dialog } from '@shop/design';
import type { ReferralViewModel } from '../viewmodel/ReferralViewModel';

type ActionModel = NonNullable<ReferralViewModel['action']>;

export function ReferralActionDialog({ model, actions }: Readonly<{ model: ActionModel; actions: ReferralViewModel['actions'] }>) {
  const { target, draft } = model;
  return (
    <Dialog open title={target.label} eyebrow="预览 · 确认 · 二次验证 · 双人复核" onClose={actions.close} dismissable={!model.busy}>
      <form
        className="referralactionform"
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        <section className="referralactionsummary" aria-label="操作目标">
          <strong>{target.label}</strong>
          <span>目标版本：第 {target.item.version} 版</span>
          <p>服务端会同时校验当前版本、商城范围、会话权限、能力、一次性复核凭证与幂等键。</p>
        </section>
        {target.kind === 'setting' ? (
          <>
            <div className="referralfieldgrid">
              <SelectField label="绑定方式" value={draft.bindingMode} options={[['days', '按天有效'], ['permanent', '永久绑定']]} onChange={actions.bindingMode} />
              <NumberField label="首次归因天数" value={draft.firstTouchDays} maximum={3650} onChange={actions.days} disabled={draft.bindingMode === 'permanent'} />
              <SelectField label="结算触发点" value={draft.settlementTrigger} options={[['paid', '付款后'], ['received', '确认收货后']]} onChange={actions.settlementTrigger} />
              <NumberField label="触发后冻结天数" value={draft.freezeDays} maximum={3650} onChange={actions.freezeDays} />
              <NumberField label="默认返佣基点" value={draft.rateBasisPoints} maximum={10_000} onChange={actions.rate} />
              <NumberField label="最低提现分" value={draft.minimumWithdrawalMinor} maximum={Number.MAX_SAFE_INTEGER} onChange={actions.minimum} />
              <OptionalNumberField label="每月最多提现次数（留空不限）" value={draft.monthlyWithdrawalLimit} maximum={1000} onChange={actions.monthlyLimit} />
            </div>
            <label className="referralcheck">
              <input type="checkbox" checked={draft.recruitEnabled} onChange={(event) => actions.recruitEnabled(event.target.checked)} />
              开放会员申请成为推广员
            </label>
            <label className="referralcheck">
              <input type="checkbox" checked={draft.reviewRequired} onChange={(event) => actions.reviewRequired(event.target.checked)} disabled={!draft.recruitEnabled} />
              推广员申请需要人工审核
            </label>
          </>
        ) : null}
        {target.kind === 'product' ? (
          <div className="referralfieldgrid">
            <NumberField label="商品返佣基点" value={draft.rateBasisPoints} maximum={10_000} onChange={actions.rate} />
            <NumberField label="客户奖励基点" value={draft.rewardBasisPoints} maximum={10_000} onChange={actions.rewardRate} />
          </div>
        ) : null}
        {target.kind === 'setting' || target.kind === 'product' ? (
          <label className="referralcheck">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => actions.enabled(event.target.checked)} />
            启用该返佣策略
          </label>
        ) : null}
        {target.kind === 'setting' ? (
          <label className="referralcheck">
            <input type="checkbox" checked={draft.rewardEnabled} onChange={(event) => actions.rewardEnabled(event.target.checked)} />
            启用客户奖励（仅奖励直接推广人的即时邀请人一层）
          </label>
        ) : null}
        <label>
          审计原因
          <textarea value={draft.reason} maxLength={500} onChange={(event) => actions.reason(event.target.value)} placeholder="说明业务依据和预期结果" required />
        </label>
        <section className="referralapproval" aria-label="双人复核请求">
          <div>
            <strong>双人复核</strong>
            <span>操作人与复核人必须是不同会员。</span>
          </div>
          <Button onPress={actions.requestApproval} isDisabled={model.approvalBusy || model.approvalValidation !== undefined}>
            {model.approvalBusy ? '正在绑定请求…' : '生成复核请求码'}
          </Button>
          {model.approval ? (
            <>
              <label>
                复核请求码
                <textarea value={model.approval} readOnly />
              </label>
              <Button onPress={() => void navigator.clipboard?.writeText(model.approval)}>复制请求码</Button>
              <p>请将请求码交给另一位具备同一操作权限的复核人，由其签发一次性操作凭证。</p>
            </>
          ) : null}
          {model.approvalError ? (
            <p className="referralnotice iserror" role="alert">
              {model.approvalError}
            </p>
          ) : null}
        </section>
        <label>
          一次性操作凭证
          <input type="password" value={draft.proof} autoComplete="off" spellCheck={false} onChange={(event) => actions.proof(event.target.value)} required />
        </label>
        <label className="referralcheck">
          <input type="checkbox" checked={draft.confirmed} onChange={(event) => actions.confirmed(event.target.checked)} />
          我已核对操作目标、第 {target.item.version} 版数据与变更内容
        </label>
        {model.assurance < 3 ? (
          <div className="referralstepup">
            <p>执行前必须完成高强度二次验证。</p>
            <Button onPress={actions.stepup}>进行身份验证</Button>
          </div>
        ) : null}
        {model.error ? (
          <p className="referralnotice iserror" role="alert">
            {model.error}
          </p>
        ) : model.validation ? (
          <p className="referralvalidation">{model.validation}</p>
        ) : null}
        <footer>
          <Button onPress={actions.close} isDisabled={model.busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={model.busy || model.validation !== undefined}>
            {model.busy ? '正在执行并回读…' : '确认执行'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function NumberField({ label, value, maximum, onChange, disabled = false }: Readonly<{ label: string; value: number; maximum: number; onChange: (value: number) => void; disabled?: boolean }>) {
  return (
    <label>
      {label}
      <input type="number" min="0" max={maximum} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} disabled={disabled} required />
    </label>
  );
}

function OptionalNumberField({ label, value, maximum, onChange }: Readonly<{ label: string; value: number | null; maximum: number; onChange: (value: number | null) => void }>) {
  return (
    <label>
      {label}
      <input type="number" min="1" max={maximum} step="1" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
    </label>
  );
}

function SelectField<T extends string>({ label, value, options, onChange }: Readonly<{ label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }>) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

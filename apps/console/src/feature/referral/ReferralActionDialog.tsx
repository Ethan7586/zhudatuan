import { Button, Dialog } from '@shop/design';
import { useEffect, useState } from 'react';
import { createActionRequest } from '../../shared/security/ActionRequest';
import { referralActionEnvelope, type ReferralActionInput } from './ReferralCommand';
import type { ReferralAction } from './ReferralSchema';

export function ReferralActionDialog({
  action,
  assurance,
  makerMembership,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{ action: ReferralAction; assurance: number; makerMembership: string; busy: boolean; error: string | undefined; onClose: () => void; onSubmit: (input: ReferralActionInput) => void }>) {
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(7);
  const [rate, setRate] = useState(0);
  const [minimum, setMinimum] = useState(0);
  const [approval, setApproval] = useState('');
  const [approvalBusy, setApprovalBusy] = useState(false);
  useEffect(() => {
    setReason('');
    setProof('');
    setApproval('');
    setEnabled(action.setting?.enabled ?? action.product?.enabled ?? true);
    setDays(action.setting?.firstTouchDays ?? 7);
    setRate(action.setting?.rateBasisPoints ?? action.product?.rateBasisPoints ?? 0);
    setMinimum(action.setting?.minimumWithdrawalMinor ?? 0);
  }, [action]);
  useEffect(() => {
    setApproval('');
    setProof('');
  }, [reason, enabled, days, rate, minimum]);
  const proofReady = /^[A-Za-z0-9_-]{43,128}$/.test(proof);
  const requestApproval = async () => {
    setApprovalBusy(true);
    try {
      const envelope = referralActionEnvelope({ action, reason: reason.trim(), enabled, firstTouchDays: days, rateBasisPoints: rate, minimumWithdrawalMinor: minimum, currency: action.setting?.currency ?? 'CNY' });
      setApproval(await createActionRequest(envelope.operation, envelope.input, action.version, makerMembership));
    } finally {
      setApprovalBusy(false);
    }
  };
  return (
    <Dialog open title={action.label} eyebrow="二次验证 · 操作凭证 · 版本校验" onClose={onClose} dismissable={!busy}>
      <form
        className="referralactionform"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ action, reason: reason.trim(), proof, enabled, firstTouchDays: days, rateBasisPoints: rate, minimumWithdrawalMinor: minimum, currency: action.setting?.currency ?? 'CNY' });
        }}
      >
        <p>{assurance >= 3 ? '当前账号已完成高强度二次验证。最终操作仍需另一位复核人签发、与请求和版本完全绑定的一次性复核凭证。' : '请先使用页面右上角“完成二次验证”提高当前账号安全等级，再提交复核凭证。'}</p>
        {action.kind === 'setting' ? (
          <>
            <NumberField label="首次归因天数" value={days} onChange={setDays} />
            <NumberField label="默认返佣基点" value={rate} onChange={setRate} />
            <NumberField label="最低提现分" value={minimum} onChange={setMinimum} />
          </>
        ) : null}
        {action.kind === 'product' ? <NumberField label="商品返佣基点" value={rate} onChange={setRate} /> : null}
        {action.kind === 'setting' || action.kind === 'product' ? (
          <label>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            启用
          </label>
        ) : null}
        <label>
          审计原因
          <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} required />
        </label>
        <section aria-label="双人复核请求">
          <Button onPress={() => void requestApproval()} isDisabled={approvalBusy || reason.trim().length === 0}>
            {approvalBusy ? '正在绑定请求…' : '生成复核请求码'}
          </Button>
          {approval ? (
            <>
              <label>
                复核请求码
                <textarea value={approval} readOnly />
              </label>
              <Button onPress={() => void navigator.clipboard.writeText(approval)}>复制请求码</Button>
              <p>请交给另一位具备同一操作权限的复核人，由其在“完成二次验证”中签发一次性证明。</p>
            </>
          ) : null}
        </section>
        <label>
          一次性复核凭证
          <input value={proof} autoComplete="off" spellCheck={false} onChange={(event) => setProof(event.target.value.trim())} required />
        </label>
        <p>目标版本第 {action.version} 版；版本冲突、证明不匹配或已消费时不会重试写入。</p>
        {error === undefined ? null : (
          <p className="referralnotice iserror" role="alert">
            {error}
          </p>
        )}
        <footer>
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy || assurance < 3 || reason.trim().length === 0 || !proofReady}>
            {busy ? '正在提交…' : '确认执行'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}

function NumberField({ label, value, onChange }: Readonly<{ label: string; value: number; onChange: (value: number) => void }>) {
  return (
    <label>
      {label}
      <input type="number" min="0" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} required />
    </label>
  );
}

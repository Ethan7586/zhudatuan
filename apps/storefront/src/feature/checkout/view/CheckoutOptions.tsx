import { CheckSquare, Gift, Square, TicketCheck } from 'lucide-react';
import type { useCheckoutOptions } from '../viewmodel/CheckoutOptionsViewModel';
import { formatMinor } from '../../../shared/format/Money';

export function CheckoutOptions({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useCheckoutOptions> }>) {
  if (viewmodel.state === 'loading') return <section role="status" className="rounded-lg border bg-surface p-4 text-xs text-muted">正在读取可用福利和卡券…</section>;
  if (viewmodel.state === 'failed') return (
    <section role="alert" className="rounded-lg border border-danger bg-danger-surface p-4 text-xs text-danger-strong">
      福利和卡券读取失败。为避免遗漏权益，恢复前不能报价。
      <button type="button" onClick={() => void viewmodel.actions.refresh()} className="ml-3 min-h-11 rounded border px-3 font-bold">重新读取</button>
    </section>
  );
  return (
    <section className="space-y-4 rounded-lg border border-edge bg-surface p-3 text-xs shadow-2xs">
      <OptionGroup icon={<Gift size={16} />} title="福利账户" empty="暂无可用福利账户">
        {viewmodel.benefits.map((item) => {
          const enabled = item.status === 'active' && item.availableMinor > 0;
          return <Choice key={item.id} checked={viewmodel.selectedBenefits.includes(item.id)} disabled={!enabled} onClick={() => viewmodel.actions.toggleBenefit(item.id)} label={`${benefitName(item.kind)} · 可用 ¥${formatMinor(item.availableMinor)}`} />;
        })}
      </OptionGroup>
      <OptionGroup icon={<TicketCheck size={16} />} title="卡券" empty="暂无可抵扣卡券">
        {viewmodel.vouchers.map((item) => {
          const enabled = item.state === 'active' && item.remainingMinor > 0 && Date.parse(item.expiresAt) > Date.now();
          return <Choice key={item.id} checked={viewmodel.selectedVouchers.includes(item.id)} disabled={!enabled} onClick={() => viewmodel.actions.toggleVoucher(item.id)} label={`${item.productName} · 余额 ¥${formatMinor(item.remainingMinor)} · ${enabled ? '服务端试算后确认' : '当前不可用'}`} />;
        })}
      </OptionGroup>
      <p className="rounded bg-subtle p-2 text-[11px] leading-5 text-muted">活动优惠自动参与服务端试算；所选福利和卡券仅代表使用意愿，实际抵扣、顺序与应付金额以 Quote 为准。</p>
    </section>
  );
}

function OptionGroup({ icon, title, empty, children }: Readonly<{ icon: React.ReactNode; title: string; empty: string; children: React.ReactNode }>) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div><h2 className="mb-2 flex items-center gap-2 font-black">{icon}{title}</h2><div className="grid gap-2 sm:grid-cols-2">{hasChildren ? children : <span className="text-muted">{empty}</span>}</div></div>;
}

function Choice({ checked, disabled, onClick, label }: Readonly<{ checked: boolean; disabled: boolean; onClick: () => void; label: string }>) {
  return <button type="button" disabled={disabled} aria-pressed={checked} onClick={onClick} className="flex min-h-11 items-center gap-2 rounded border p-2 text-left disabled:opacity-45">{checked ? <CheckSquare className="shrink-0 text-brand" size={16} /> : <Square className="shrink-0 text-muted" size={16} />}<span>{label}</span></button>;
}

function benefitName(kind: string): string {
  return kind === 'meal' ? '餐补账户' : kind === 'welfare' ? '福利账户' : kind === 'allowance' ? '补贴账户' : '其他福利';
}

import { FileText, MapPin } from 'lucide-react';
import type { Address } from '../../account';

export function AddressPanel({
  addresses,
  address,
  invoiceHeader,
  onAddress,
  onManage,
  onInvoices,
}: {
  readonly addresses: readonly Address[];
  readonly address?: Address;
  readonly invoiceHeader: string;
  readonly onAddress: (id: string) => void;
  readonly onManage: () => void;
  readonly onInvoices: () => void;
}) {
  return (
    <section className="space-y-2.5 rounded-lg border border-edge bg-surface p-3 text-xs shadow-2xs">
      <h2 className="flex items-center gap-1.5 border-b border-edge pb-1.5 font-bold text-content">
        <MapPin className="h-4 w-4 text-[var(--sw-brand)]" />
        配送地址与开票信息
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-brand bg-brand-light/60 p-2">
        <div>
          <div className="font-bold text-content">{address ? `${address.recipient} ${address.mobile}` : '暂无收货人'}</div>
          <div className="text-[11px] text-secondary">{address ? `${address.province}${address.city}${address.district}${address.detail}` : '请先在个人中心新增收货地址'}</div>
        </div>
        <div className="flex items-center gap-2">
          {addresses.length > 1 ? (
            <select aria-label="选择收货地址" value={address?.id ?? ''} onChange={(event) => onAddress(event.target.value)} className="max-w-40 rounded border bg-surface px-2 py-1 text-[10px]">
              {addresses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.recipient} · {item.mobile}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" onClick={onManage} className="rounded border border-brand bg-surface px-2 py-1 text-[10px] font-bold text-brand">
            管理地址
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between rounded border border-edge bg-subtle p-2">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-muted" />
          <b>开票归属：</b>
          <span className="text-[11px] text-secondary">{invoiceHeader}</span>
        </div>
        <button type="button" onClick={onInvoices} className="min-h-11 rounded bg-success-surface px-3 py-2 text-[10px] font-bold text-success-strong">
          查看开票记录
        </button>
      </div>
    </section>
  );
}

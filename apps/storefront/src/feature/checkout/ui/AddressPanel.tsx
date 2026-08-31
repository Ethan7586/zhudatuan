import { FileText, MapPin } from 'lucide-react';
import type { AddressView } from '../../../shared/runtime/StorefrontPort';

export function AddressPanel({
  addresses,
  address,
  invoiceHeader,
  onAddress,
  onManage,
  onInvoices,
}: {
  readonly addresses: readonly AddressView[];
  readonly address?: AddressView;
  readonly invoiceHeader: string;
  readonly onAddress: (id: string) => void;
  readonly onManage: () => void;
  readonly onInvoices: () => void;
}) {
  return (
    <section className="space-y-2.5 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-2xs">
      <h2 className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5 font-bold text-gray-800">
        <MapPin className="h-4 w-4 text-[var(--sw-brand)]" />
        配送地址与开票信息
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-blue-200 bg-blue-50/60 p-2">
        <div>
          <div className="font-bold text-gray-800">{address ? `${address.recipient} ${address.mobile}` : '暂无收货人'}</div>
          <div className="text-[11px] text-gray-600">{address ? `${address.province}${address.city}${address.district}${address.detail}` : '请先在个人中心新增收货地址'}</div>
        </div>
        <div className="flex items-center gap-2">
          {addresses.length > 1 ? (
            <select aria-label="选择收货地址" value={address?.id ?? ''} onChange={(event) => onAddress(event.target.value)} className="max-w-40 rounded border bg-white px-2 py-1 text-[10px]">
              {addresses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.recipient} · {item.mobile}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" onClick={onManage} className="rounded border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-700">
            管理地址
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-gray-500" />
          <b>开票归属：</b>
          <span className="text-[11px] text-gray-600">{invoiceHeader}</span>
        </div>
        <button type="button" onClick={onInvoices} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600">
          查看开票记录
        </button>
      </div>
    </section>
  );
}

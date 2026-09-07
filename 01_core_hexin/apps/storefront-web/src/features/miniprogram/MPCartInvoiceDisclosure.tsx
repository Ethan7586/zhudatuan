import React from 'react';
import { ChevronDown, FileText, MapPin, SlidersHorizontal } from 'lucide-react';
import type { DeliveryAddress } from '../../types';

interface MPCartInvoiceDisclosureProps {
  defaultAddress?: DeliveryAddress;
  expanded: boolean;
  importingWechatAddress: boolean;
  onEditAddress: () => void;
  onEdit: () => void;
  onImportWechatAddress: () => void;
  onToggle: () => void;
}

export function MPCartInvoiceDisclosure({
  defaultAddress,
  expanded,
  importingWechatAddress,
  onEditAddress,
  onEdit,
  onImportWechatAddress,
  onToggle,
}: Readonly<MPCartInvoiceDisclosureProps>) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white/80">
      <button
        type="button"
        aria-controls="cart-invoice-options"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between px-3 text-left active:bg-gray-50"
      >
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-medium text-gray-500">
          <SlidersHorizontal className="h-3.5 w-3.5 flex-none text-gray-400" />
          <span className="truncate">配送等</span>
        </span>
        <span className="ml-3 flex flex-none items-center gap-1 text-[10px] text-gray-400">
          选填
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div id="cart-invoice-options" className="mx-3 divide-y divide-gray-100 border-t border-gray-100">
          <section className="py-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-50 text-[var(--sw-brand)]">
                <MapPin className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-800">
                  收货地址
                  {defaultAddress && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[8px] text-[var(--sw-brand)]">默认</span>}
                </div>
                {defaultAddress ? (
                  <>
                    <div className="mt-0.5 truncate text-[10px] font-medium text-gray-600">{defaultAddress.name} · {defaultAddress.phone}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-gray-400">
                      {[defaultAddress.province, defaultAddress.city, defaultAddress.district, defaultAddress.detail].filter(Boolean).join(' ')}
                    </div>
                  </>
                ) : (
                  <div className="mt-0.5 text-[10px] text-gray-400">填写默认地址，或直接读取微信地址</div>
                )}
              </div>
            </div>
            <div className="mt-2 flex gap-2 pl-10">
              <button type="button" onClick={onEditAddress} className="min-h-8 flex-1 rounded-lg bg-gray-100 px-3 text-[10px] font-bold text-gray-600 active:bg-gray-200">
                {defaultAddress ? '管理地址' : '填写地址'}
              </button>
              <button
                type="button"
                onClick={onImportWechatAddress}
                disabled={importingWechatAddress}
                className="min-h-8 flex-1 rounded-lg bg-blue-50 px-3 text-[10px] font-bold text-[var(--sw-brand)] active:bg-blue-100 disabled:text-gray-400"
              >
                {importingWechatAddress ? '获取中…' : '获取微信地址'}
              </button>
            </div>
          </section>

          <section className="flex items-center justify-between py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-gray-800">电子发票 <span className="font-normal text-gray-400">（选填）</span></div>
                <div className="truncate text-[10px] text-gray-400">默认不开具，需要时再添加</div>
              </div>
            </div>
            <button type="button" onClick={onEdit} className="ml-2 min-h-8 flex-none rounded-lg bg-blue-50 px-3 text-[10px] font-bold text-[var(--sw-brand)] active:bg-blue-100">
              添加
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

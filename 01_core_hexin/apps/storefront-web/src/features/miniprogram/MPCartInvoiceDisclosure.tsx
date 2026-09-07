import React from 'react';
import { ChevronDown, FileText, SlidersHorizontal } from 'lucide-react';

interface MPCartInvoiceDisclosureProps {
  expanded: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

export function MPCartInvoiceDisclosure({ expanded, onEdit, onToggle }: Readonly<MPCartInvoiceDisclosureProps>) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-xs">
      <button
        type="button"
        aria-controls="cart-invoice-options"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-gray-400" />
          <span>
            <span className="block text-xs font-medium text-gray-700">更多结算服务</span>
            <span className="block text-[10px] font-normal text-gray-400">有特殊要求时再设置</span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--sw-brand)]">
          {expanded ? '收起' : '展开'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div id="cart-invoice-options" className="mt-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 flex-none text-gray-400" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-800">电子发票</div>
              <div className="truncate text-[10px] text-gray-400">默认不开具</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="ml-2 flex-none rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-[var(--sw-brand)] shadow-xs"
          >
            添加
          </button>
        </div>
      )}
    </div>
  );
}

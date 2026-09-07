import React from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

interface MPCartInvoiceDisclosureProps {
  expanded: boolean;
  invoiceHeader: string;
  onEdit: () => void;
  onToggle: () => void;
}

export function MPCartInvoiceDisclosure({ expanded, invoiceHeader, onEdit, onToggle }: Readonly<MPCartInvoiceDisclosureProps>) {
  return (
    <div className="border-t border-gray-100 pt-2">
      <button
        type="button"
        aria-controls="cart-invoice-options"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400" />
          <span>
            <span className="block font-medium text-gray-700">需要发票</span>
            <span className="block text-[10px] font-normal text-gray-400">默认不开票，有需要时再添加</span>
          </span>
        </span>
        <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--sw-brand)]">
          {expanded ? '收起' : '按需添加'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div id="cart-invoice-options" className="mt-2 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] text-gray-400">电子普通发票抬头</div>
            <div className="truncate text-[11px] font-bold text-gray-800">{invoiceHeader}</div>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="ml-2 flex flex-none items-center text-[10px] font-bold text-[var(--sw-brand)]"
          >
            修改
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { ChevronDown, FileText, SlidersHorizontal } from 'lucide-react';

interface MPCartInvoiceDisclosureProps {
  expanded: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

export function MPCartInvoiceDisclosure({ expanded, onEdit, onToggle }: Readonly<MPCartInvoiceDisclosureProps>) {
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
          <span className="truncate">配送与发票等特殊需求</span>
        </span>
        <span className="ml-3 flex flex-none items-center gap-1 text-[10px] text-gray-400">
          选填
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {expanded && (
        <div id="cart-invoice-options" className="mx-3 flex items-center justify-between border-t border-gray-100 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-gray-800">电子发票</div>
              <div className="truncate text-[10px] text-gray-400">默认不开具，需要时再添加</div>
            </div>
          </div>
          <button type="button" onClick={onEdit} className="ml-2 min-h-8 flex-none rounded-lg bg-blue-50 px-3 text-[10px] font-bold text-[var(--sw-brand)] active:bg-blue-100">
            添加
          </button>
        </div>
      )}
    </div>
  );
}

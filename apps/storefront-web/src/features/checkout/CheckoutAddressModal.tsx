import React from 'react';
import type { CheckoutModel } from './useCheckoutModel';

export const CheckoutAddressModal: React.FC<{ model: CheckoutModel }> = ({ model }) => {
  const { showAddAddrModal, setShowAddAddrModal, newAddrForm, setNewAddrForm, handleAddNewAddress } = model;
  if (!showAddAddrModal) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleAddNewAddress} className="bg-white rounded-md p-6 w-full max-w-lg space-y-4 shadow-2xl">
        <div className="font-bold text-base border-b border-gray-100 pb-3">新增收货地址</div>
        <div className="grid grid-cols-2 gap-3">
          <input value={newAddrForm.name} onChange={(event) => setNewAddrForm({ ...newAddrForm, name: event.target.value })} placeholder="收货人" className="border border-gray-300 rounded px-3 py-2 text-xs" />
          <input value={newAddrForm.phone} onChange={(event) => setNewAddrForm({ ...newAddrForm, phone: event.target.value })} placeholder="手机号" className="border border-gray-300 rounded px-3 py-2 text-xs" />
          <input value={newAddrForm.province} onChange={(event) => setNewAddrForm({ ...newAddrForm, province: event.target.value })} placeholder="省份/省市自治区" className="border border-gray-300 rounded px-3 py-2 text-xs" />
          <input value={newAddrForm.city} onChange={(event) => setNewAddrForm({ ...newAddrForm, city: event.target.value })} placeholder="城市" className="border border-gray-300 rounded px-3 py-2 text-xs" />
          <input value={newAddrForm.district} onChange={(event) => setNewAddrForm({ ...newAddrForm, district: event.target.value })} placeholder="区县" className="border border-gray-300 rounded px-3 py-2 text-xs" />
          <input value={newAddrForm.detail} onChange={(event) => setNewAddrForm({ ...newAddrForm, detail: event.target.value })} placeholder="详细地址" className="col-span-2 border border-gray-300 rounded px-3 py-2 text-xs" />
          <input
            value={newAddrForm.tag || ''}
            onChange={(event) => setNewAddrForm({ ...newAddrForm, tag: event.target.value })}
            placeholder="地址标签（如：公司/家庭）"
            className="col-span-2 border border-gray-300 rounded px-3 py-2 text-xs"
          />
          <label className="col-span-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={newAddrForm.isDefault} onChange={(event) => setNewAddrForm({ ...newAddrForm, isDefault: event.target.checked })} className="w-4 h-4 text-[var(--sw-brand)]" />
            设为默认配送地址
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setShowAddAddrModal(false)} className="border border-gray-300 rounded px-4 py-2 text-xs">
            取消
          </button>
          <button type="submit" className="bg-[var(--sw-brand)] text-white rounded px-4 py-2 text-xs font-bold">
            保存地址
          </button>
        </div>
      </form>
    </div>
  );
};

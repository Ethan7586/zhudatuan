import React, { useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { useMall } from '../../context/MallContext';

const EMPTY_ADDRESS = Object.freeze({ name: '', phone: '', province: '', city: '', district: '', detail: '' });

export const MPAddressPage: React.FC = () => {
  const { addresses, addAddress, mpAddressReturnPage, setMpPage } = useMall();
  const [form, setForm] = useState({ ...EMPTY_ADDRESS });
  const [saving, setSaving] = useState(false);

  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const valid = form.name.trim().length > 0 && /^1[3-9]\d{9}$/.test(form.phone.trim())
    && form.province.trim().length > 0 && form.city.trim().length > 0 && form.district.trim().length > 0 && form.detail.trim().length > 0;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      const saved = await addAddress({ ...form, isDefault: addresses.length === 0, tag: '收货地址' });
      if (saved) setMpPage(mpAddressReturnPage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F5F7FA] pb-8 text-gray-800">
      <WeChatCapsule title="收货地址" showBack onBack={() => setMpPage(mpAddressReturnPage)} />
      <main className="space-y-3 p-3">
        {addresses.map((address) => (
          <div key={address.id} className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold"><span>{address.name}</span><span>{address.phone}</span></div>
                <p className="mt-1 text-[11px] leading-5 text-gray-500">{[address.province, address.city, address.district, address.detail].filter(Boolean).join(' ')}</p>
              </div>
              {address.isDefault && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-[var(--sw-brand)]">默认</span>}
            </div>
          </div>
        ))}

        <form onSubmit={save} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <MapPin className="h-4 w-4 text-[var(--sw-brand)]" />
            <div><h1 className="text-sm font-black">新增真实收货地址</h1><p className="text-[10px] text-gray-400">联系人、手机号和详细地址将由服务端加密保存</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="收货人" value={form.name} onChange={(value) => update('name', value)} placeholder="姓名" />
            <Field label="手机号" value={form.phone} onChange={(value) => update('phone', value)} placeholder="11 位手机号" inputMode="tel" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="省" value={form.province} onChange={(value) => update('province', value)} placeholder="广东省" />
            <Field label="市" value={form.city} onChange={(value) => update('city', value)} placeholder="深圳市" />
            <Field label="区" value={form.district} onChange={(value) => update('district', value)} placeholder="南山区" />
          </div>
          <Field label="详细地址" value={form.detail} onChange={(value) => update('detail', value)} placeholder="街道、楼栋、门牌号" />
          <button type="submit" disabled={!valid || saving} className="w-full rounded-xl bg-[var(--sw-brand)] py-3 text-xs font-black text-white shadow-md disabled:cursor-not-allowed disabled:bg-gray-300">
            {saving ? '加密保存中…' : '保存并返回结算'}
          </button>
        </form>
      </main>
    </div>
  );
};

function Field({ label, value, onChange, placeholder, inputMode }: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}>) {
  return (
    <label className="block text-[10px] font-bold text-gray-600">
      <span className="mb-1 block">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-medium text-gray-900 outline-none focus:border-blue-400 focus:bg-white" />
    </label>
  );
}

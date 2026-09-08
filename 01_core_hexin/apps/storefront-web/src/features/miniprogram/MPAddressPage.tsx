import React from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardPaste,
  MapPin,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { useMall } from '../../context/MallContext';
import type { DeliveryAddress } from '../../types';
import { readAddressClipboard } from './address/addressClipboard';
import type { RegionSelection } from './address/regionSelection';

const AddressRegionPicker = React.lazy(() => import('./address/AddressRegionPicker').then((module) => ({ default: module.AddressRegionPicker })));

type AddressForm = Pick<DeliveryAddress, 'name' | 'phone' | 'province' | 'city' | 'district' | 'detail'>;

const EMPTY_ADDRESS: Readonly<AddressForm> = Object.freeze({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  detail: '',
});

export const MPAddressPage: React.FC = () => {
  const { addresses, addAddress, setDefaultAddress, mpAddressReturnPage, setMpPage, showToast } = useMall();
  const [form, setForm] = React.useState<AddressForm>({ ...EMPTY_ADDRESS });
  const [rawAddress, setRawAddress] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [parsing, setParsing] = React.useState(false);
  const [importingWechat, setImportingWechat] = React.useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = React.useState(false);
  const [switchingDefaultId, setSwitchingDefaultId] = React.useState<string>();
  const pasteAreaRef = React.useRef<HTMLTextAreaElement>(null);

  const update = (field: keyof AddressForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const valid = form.name.trim().length > 0 && /^1[3-9]\d{9}$/.test(form.phone.trim())
    && form.province.trim().length > 0 && form.city.trim().length > 0 && form.district.trim().length > 0 && form.detail.trim().length > 0;

  const fillRecognizedAddress = React.useCallback(async (text: string) => {
    const value = text.trim();
    if (!value || parsing) return;
    setParsing(true);
    try {
      const [{ parseAddressText, missingAddressFields }, { loadChinaRegions }] = await Promise.all([
        import('./address/addressTextParser'),
        import('./address/chinaRegions'),
      ]);
      const recognized = parseAddressText(value, await loadChinaRegions());
      setRawAddress(value);
      setForm((current) => ({
        name: recognized.name || current.name,
        phone: recognized.phone || current.phone,
        province: recognized.province || current.province,
        city: recognized.city || current.city,
        district: recognized.district || current.district,
        detail: recognized.detail || current.detail,
      }));
      const missing = missingAddressFields(recognized);
      showToast(missing.length ? `已识别，请补充${missing.slice(0, 3).join('、')}` : '地址已识别，请确认后保存', missing.length ? 'info' : 'success');
    } catch {
      showToast('暂未识别完整，请检查后手动补充', 'warning');
    } finally {
      setParsing(false);
    }
  }, [parsing, showToast]);

  const pasteAndRecognize = async () => {
    try {
      await fillRecognizedAddress(await readAddressClipboard());
    } catch {
      pasteAreaRef.current?.focus();
      showToast('请长按粘贴', 'info');
    }
  };

  const importFromWechat = async () => {
    if (importingWechat) return;
    setImportingWechat(true);
    try {
      const { requestWechatDeliveryAddress } = await import('../../services/wechatDeliveryAddress');
      const imported = await requestWechatDeliveryAddress();
      setForm(imported);
      showToast('微信地址已带入，请确认后保存', 'success');
    } catch (error) {
      const { WechatAddressRequestError } = await import('../../services/wechatDeliveryAddress');
      if (error instanceof WechatAddressRequestError && error.code === 'cancelled') return;
      if (error instanceof WechatAddressRequestError && error.code === 'incomplete' && error.partialAddress) {
        setForm((current) => ({
          name: error.partialAddress?.name || current.name,
          phone: error.partialAddress?.phone || current.phone,
          province: error.partialAddress?.province || current.province,
          city: error.partialAddress?.city || current.city,
          district: error.partialAddress?.district || current.district,
          detail: error.partialAddress?.detail || current.detail,
        }));
        showToast('已带入微信地址，请补齐缺少内容', 'info');
        return;
      }
      pasteAreaRef.current?.focus();
      showToast(error instanceof Error ? error.message : '暂时无法读取微信地址，请手动填写', 'info');
    } finally {
      setImportingWechat(false);
    }
  };

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

  const selectedRegion = [form.province, form.city, form.district].filter(Boolean).join(' / ');

  const chooseDefault = async (addressId: string) => {
    if (switchingDefaultId) return;
    setSwitchingDefaultId(addressId);
    try {
      await setDefaultAddress(addressId);
    } finally {
      setSwitchingDefaultId(undefined);
    }
  };

  return (
    <div className="min-h-full overflow-x-hidden bg-[#F5F7FA] pb-8 text-slate-800">
      <WeChatCapsule title="收货地址" showBack onBack={() => setMpPage(mpAddressReturnPage)} />
      <main className="space-y-3 p-3">
        {addresses.length > 0 && (
          <section aria-label="已保存地址" className="space-y-2.5">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                switching={switchingDefaultId === address.id}
                onSetDefault={() => void chooseDefault(address.id)}
              />
            ))}
          </section>
        )}

        <form onSubmit={save} className="space-y-4 rounded-[24px] border border-white bg-white p-4 shadow-[0_12px_38px_rgba(30,64,120,0.08)]">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-[var(--sw-brand)]"><MapPin className="h-[18px] w-[18px]" /></span>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-slate-950">新增收货地址</h1>
              <p className="mt-0.5 text-[10px] text-slate-400">从一整段地址开始，也可以逐项填写</p>
            </div>
          </div>

          <section className="rounded-2xl border border-blue-100/80 bg-gradient-to-br from-[#F4F8FF] via-white to-[#F7FAFF] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-800"><Sparkles className="h-3.5 w-3.5 text-[var(--sw-brand)]" />智能填写</div>
              <div className="flex gap-1.5">
                <UtilityButton icon={ClipboardPaste} label={parsing ? '识别中' : '粘贴并识别'} disabled={parsing} onClick={() => void pasteAndRecognize()} />
                <UtilityButton icon={MessageCircle} label={importingWechat ? '等待微信' : '从微信选择地址'} disabled={importingWechat} onClick={() => void importFromWechat()} />
              </div>
            </div>
            <textarea
              ref={pasteAreaRef}
              value={rawAddress}
              rows={2}
              onChange={(event) => setRawAddress(event.target.value)}
              onPaste={(event) => {
                const text = event.clipboardData.getData('text/plain');
                if (!text) return;
                event.preventDefault();
                setRawAddress(text);
                void fillRecognizedAddress(text);
              }}
              placeholder="可长按粘贴：张三 13800138000 湖北省武汉市武昌区中北路 88 号"
              aria-label="整段收货地址"
              className="mt-2.5 block w-full resize-none rounded-xl border border-blue-100/70 bg-white/90 px-3 py-2.5 text-[11px] leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </section>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="收货人" value={form.name} onChange={(value) => update('name', value)} placeholder="姓名" autoComplete="name" />
            <Field label="手机号" value={form.phone} onChange={(value) => update('phone', value)} placeholder="11 位手机号" inputMode="tel" autoComplete="tel" />
          </div>

          <div>
            <span className="mb-1.5 block text-[10px] font-bold text-slate-600">所在地区</span>
            <button
              type="button"
              onClick={() => setRegionPickerOpen(true)}
              className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 text-left transition active:scale-[0.995] active:bg-blue-50"
            >
              <span className={`text-xs font-medium ${selectedRegion ? 'text-slate-900' : 'text-slate-400'}`}>{selectedRegion || '请选择省 / 市 / 区'}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </div>

          <Field label="详细地址" value={form.detail} onChange={(value) => update('detail', value)} placeholder="街道、楼栋、门牌号" autoComplete="street-address" />

          <button
            type="submit"
            disabled={!valid || saving}
            aria-label={saving ? '正在保存地址' : '保存并返回结算'}
            className="mt-1 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--sw-brand)] text-xs font-black text-white shadow-[0_10px_26px_rgba(37,99,235,0.24)] transition active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            {saving ? <FrostDewLoader /> : '保存并返回结算'}
          </button>
        </form>
      </main>

      {regionPickerOpen && (
        <React.Suspense fallback={null}>
          <AddressRegionPicker
            value={form}
            onCancel={() => setRegionPickerOpen(false)}
            onConfirm={(region: RegionSelection) => {
              setForm((current) => ({ ...current, ...region }));
              setRegionPickerOpen(false);
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
};

function AddressCard({ address, switching, onSetDefault }: Readonly<{
  address: DeliveryAddress;
  switching: boolean;
  onSetDefault: () => void;
}>) {
  return (
    <article className={`rounded-[22px] border bg-white p-3.5 shadow-[0_8px_28px_rgba(30,64,120,0.07)] ${address.isDefault ? 'border-blue-100' : 'border-slate-100'}`}>
      <div className="flex items-start gap-2.5">
        {address.isDefault
          ? <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--sw-brand)]" />
          : <Circle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-slate-300" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black text-slate-900">
            <span>{address.name}</span><span>{address.phone}</span>
            {address.isDefault && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-[var(--sw-brand)]">默认</span>}
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{[address.province, address.city, address.district, address.detail].filter(Boolean).join(' ')}</p>
          {!address.isDefault && (
            <button type="button" disabled={switching} onClick={onSetDefault} className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[9px] font-bold text-slate-500 transition active:scale-95 active:bg-blue-50 active:text-[var(--sw-brand)] disabled:text-slate-300">
              {switching ? '轻轻切换中…' : '设为默认'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function UtilityButton({ icon: Icon, label, disabled, onClick }: Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2 text-[9px] font-bold text-[var(--sw-brand)] shadow-sm transition active:scale-95 disabled:text-slate-400">
      <Icon className="h-3 w-3" />{label}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, inputMode, autoComplete }: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
}>) {
  return (
    <label className="block text-[10px] font-bold text-slate-600">
      <span className="mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}

function FrostDewLoader() {
  return (
    <span className="sw-auth-frost-dew h-8 w-20" aria-hidden="true">
      <span className="sw-auth-frost-dew-ring" />
      <span className="sw-auth-frost-dew-orb" />
    </span>
  );
}

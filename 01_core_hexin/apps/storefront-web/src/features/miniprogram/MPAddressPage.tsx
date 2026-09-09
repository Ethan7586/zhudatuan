import React from 'react';
import {
  ChevronRight,
  ClipboardPaste,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import { WeChatCapsule } from '../../components/mobile/WeChatCapsule';
import { useMall } from '../../context/MallContext';
import type { DeliveryAddress } from '../../types';
import {
  prepareWechatDeliveryAddress,
  requestWechatDeliveryAddress,
  WechatAddressRequestError,
  type WechatAddressFlowState,
} from '../../services/wechatDeliveryAddress';
import { AddressRegionPicker } from './address/AddressRegionPicker';
import { readAddressClipboard } from './address/addressClipboard';
import { loadChinaRegions } from './address/chinaRegions';
import type { RegionSelection } from './address/regionSelection';

type AddressForm = Pick<DeliveryAddress, 'name' | 'phone' | 'province' | 'city' | 'district' | 'detail'>;
type WechatAddressUiState = 'idle' | WechatAddressFlowState;

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
  const [wechatAddressState, setWechatAddressState] = React.useState<WechatAddressUiState>('idle');
  const [regionPickerOpen, setRegionPickerOpen] = React.useState(false);
  const [switchingDefaultId, setSwitchingDefaultId] = React.useState<string>();
  const pasteAreaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    // This page is itself lazy-loaded. Starting the sole region-data request
    // here keeps it out of the home entry while making the picker warm before use.
    void loadChinaRegions();
  }, []);

  React.useEffect(() => {
    const warmWechatAddress = () => {
      void prepareWechatDeliveryAddress().catch(() => undefined);
    };
    if (window.requestIdleCallback && window.cancelIdleCallback) {
      const handle = window.requestIdleCallback(warmWechatAddress, { timeout: 500 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(warmWechatAddress, 120);
    return () => window.clearTimeout(handle);
  }, []);

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
    if (isWechatAddressBusy(wechatAddressState)) return;
    setWechatAddressState('preparing');
    try {
      const imported = await requestWechatDeliveryAddress({ onStateChange: setWechatAddressState });
      setForm(imported);
      setWechatAddressState('filled');
      showToast('微信地址已带入，请确认后保存', 'success');
    } catch (error) {
      if (error instanceof WechatAddressRequestError && error.code === 'cancelled') {
        setWechatAddressState('cancelled');
        return;
      }
      if (error instanceof WechatAddressRequestError && error.code === 'incomplete' && error.partialAddress) {
        setForm((current) => ({
          name: error.partialAddress?.name || current.name,
          phone: error.partialAddress?.phone || current.phone,
          province: error.partialAddress?.province || current.province,
          city: error.partialAddress?.city || current.city,
          district: error.partialAddress?.district || current.district,
          detail: error.partialAddress?.detail || current.detail,
        }));
        setWechatAddressState('filled');
        showToast('已带入微信地址，请补齐缺少内容', 'info');
        return;
      }
      setWechatAddressState('failed');
      pasteAreaRef.current?.focus();
      showToast(error instanceof Error ? error.message : '暂时无法读取微信地址，请手动填写', 'info');
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
  const orderedAddresses = React.useMemo(() => {
    const defaultIndex = addresses.findIndex((address) => address.isDefault);
    if (defaultIndex <= 0) return addresses;
    return [addresses[defaultIndex], ...addresses.slice(0, defaultIndex), ...addresses.slice(defaultIndex + 1)];
  }, [addresses]);

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
          <section
            aria-label="默认收货地址"
            className="space-y-2.5"
            role="radiogroup"
            onKeyDown={handleAddressRadioGroupKeyDown}
          >
            {orderedAddresses.map((address) => (
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
                <UtilityButton
                  icon={isWechatAddressBusy(wechatAddressState) ? LoaderCircle : MessageCircle}
                  label={wechatAddressButtonLabel(wechatAddressState)}
                  disabled={isWechatAddressBusy(wechatAddressState)}
                  busy={isWechatAddressBusy(wechatAddressState)}
                  state={wechatAddressState}
                  onClick={() => void importFromWechat()}
                />
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
        <AddressRegionPicker
          value={form}
          onCancel={() => setRegionPickerOpen(false)}
          onConfirm={(region: RegionSelection) => {
            setForm((current) => ({ ...current, ...region }));
            setRegionPickerOpen(false);
          }}
        />
      )}
    </div>
  );
};

function AddressCard({ address, switching, onSetDefault }: Readonly<{
  address: DeliveryAddress;
  switching: boolean;
  onSetDefault: () => void;
}>) {
  const addressLine = [address.province, address.city, address.district, address.detail].filter(Boolean).join(' ');
  const chooseFromCard = (event: React.MouseEvent<HTMLElement>) => {
    if (address.isDefault || switching || isInteractiveAddressTarget(event.target)) return;
    onSetDefault();
  };

  return (
    <article
      data-address-card={address.id}
      onClick={chooseFromCard}
      className={`rounded-[22px] border bg-white p-3.5 shadow-[0_8px_28px_rgba(30,64,120,0.07)] transition-[border-color,background-color,box-shadow,transform] duration-75 ${address.isDefault ? 'border-blue-200 bg-blue-50/20 shadow-[0_10px_30px_rgba(30,64,120,0.1)]' : 'cursor-pointer touch-manipulation border-slate-100 active:scale-[0.995] active:border-blue-100'}`}
    >
      <div className="flex items-start gap-1.5">
        <label
          data-address-action="default-radio"
          className="relative grid h-11 w-11 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full"
        >
          <input
            type="radio"
            name="default-delivery-address"
            role="radio"
            checked={address.isDefault}
            aria-checked={address.isDefault}
            aria-label={`设为默认地址：${address.name} ${address.phone}，${addressLine}`}
            aria-busy={switching || undefined}
            onChange={() => {
              if (!address.isDefault && !switching) onSetDefault();
            }}
            onKeyDown={(event) => {
              if ((event.key === ' ' || event.key === 'Enter') && !address.isDefault && !switching) {
                event.preventDefault();
                onSetDefault();
              }
            }}
            className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className={`grid h-5 w-5 place-items-center rounded-full border-2 transition-colors duration-75 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--sw-brand)] peer-focus-visible:ring-offset-2 ${address.isDefault ? 'border-[var(--sw-brand)] bg-[var(--sw-brand)]' : 'border-slate-300 bg-white peer-hover:border-blue-300'}`}
          >
            {address.isDefault && <span className="h-2 w-2 rounded-full bg-white" />}
          </span>
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black text-slate-900">
            <span>{address.name}</span><span>{address.phone}</span>
            {address.isDefault && <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-[var(--sw-brand)]">默认</span>}
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{addressLine}</p>
        </div>
      </div>
    </article>
  );
}

function isInteractiveAddressTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest('a, button, input, select, textarea, [role="button"], [data-address-action]'));
}

function handleAddressRadioGroupKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'radio') return;
  const step = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    ? 1
    : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
      ? -1
      : 0;
  if (!step) return;

  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[name="default-delivery-address"]'));
  const currentIndex = radios.indexOf(event.target);
  if (currentIndex < 0 || radios.length < 2) return;
  event.preventDefault();
  const nextRadio = radios[(currentIndex + step + radios.length) % radios.length];
  nextRadio?.focus();
  if (nextRadio && !nextRadio.checked) nextRadio.click();
}

function UtilityButton({ icon: Icon, label, disabled, busy = false, state, onClick }: Readonly<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled: boolean;
  busy?: boolean;
  state?: WechatAddressUiState;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy || undefined}
      data-wechat-address-state={state}
      onClick={onClick}
      className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-[var(--sw-radius-md)] border border-[var(--sw-border)] bg-white px-2.5 text-[10px] font-bold text-[var(--sw-brand)] shadow-[var(--sw-shadow-card)] transition-[color,transform,border-color] duration-[var(--sw-duration-fast)] outline-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--sw-brand)] focus-visible:ring-offset-2 disabled:text-slate-400"
    >
      <Icon className={`h-3.5 w-3.5 ${busy ? 'motion-safe:animate-spin' : ''}`} />
      <span aria-live={state ? 'polite' : undefined}>{label}</span>
    </button>
  );
}

function isWechatAddressBusy(state: WechatAddressUiState): boolean {
  return state === 'preparing' || state === 'launching' || state === 'returned';
}

function wechatAddressButtonLabel(state: WechatAddressUiState): string {
  if (state === 'preparing') return '正在准备微信';
  if (state === 'launching') return '正在拉起微信';
  if (state === 'returned') return '正在读取地址';
  if (state === 'filled') return '已回填，可重选';
  if (state === 'failed') return '重新选择微信地址';
  return '从微信选择地址';
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

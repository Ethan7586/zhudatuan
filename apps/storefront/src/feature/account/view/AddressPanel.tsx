import { ArrowLeft, CircleAlert, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useState, type FormEvent } from 'react';
import type { Address, AddressDraft } from '../model/Address';
import { StorefrontStepup } from '../../security';

interface AddressPanelProps {
  readonly addresses: readonly Address[];
  readonly save: (addressId: string | null, draft: AddressDraft, expectedVersion?: number) => Promise<void>;
  readonly remove: (addressId: string, expectedVersion: number) => Promise<void>;
  readonly notify: (text: string, type?: 'success' | 'error' | 'info') => void;
  readonly back: () => void;
}

const EMPTY: AddressDraft = Object.freeze({ recipient: '', mobile: '', province: '', city: '', district: '', detail: '' });

export function AddressPanel({ addresses, save, remove, notify, back }: AddressPanelProps) {
  const [editing, setEditing] = useState<Readonly<{ id: string | null; version: number }> | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const change = (field: keyof AddressDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const start = (address?: Address) => {
    setEditing({ id: address?.id ?? null, version: address?.version ?? 0 });
    setDraft(EMPTY);
    setConfirming(null);
    setError(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await save(editing.id, draft, editing.version);
      setEditing(null);
      setDraft(EMPTY);
      notify(editing.id ? '收货地址已安全更新' : '收货地址已新增', 'success');
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        setVerification(true);
        setError(null);
      } else setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  }
  async function erase(item: Address) {
    setBusy(true);
    setError(null);
    try {
      await remove(item.id, item.version);
      setConfirming(null);
      notify('收货地址已删除', 'success');
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-3 p-3 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={back} className="inline-flex items-center gap-1 text-sm font-bold text-brand">
          <ArrowLeft size={16} />
          返回个人中心
        </button>
        <button type="button" onClick={() => start()} className="inline-flex items-center gap-1 rounded-xl bg-[var(--sw-brand)] px-4 py-2 text-xs font-bold text-inverse">
          <Plus size={15} />
          新增收货地址
        </button>
      </header>
      <section className="rounded-2xl bg-surface p-4 shadow-sm">
        <h1 className="flex items-center gap-2 text-lg font-black">
          <MapPin size={19} />
          收货地址
        </h1>
        <p className="mt-1 text-xs text-muted">敏感字段由服务端加密保存，列表仅返回脱敏信息。</p>
      </section>
      {error ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-danger-surface p-3 text-xs font-bold text-danger-strong">
          <CircleAlert size={16} />
          {error}
        </div>
      ) : null}
      <StorefrontStepup
        open={verification}
        onClose={() => setVerification(false)}
        onVerified={() => {
          setVerification(false);
          notify('二次验证已完成，请再次点击“安全保存”', 'success');
        }}
      />
      {editing ? (
        <form onSubmit={(event) => void submit(event)} className="grid gap-3 rounded-2xl border border-brand-light bg-surface p-4 shadow-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="font-black">{editing.id ? '更新收货地址' : '新增收货地址'}</h2>
            {editing.id ? <p className="mt-1 text-xs text-muted">为避免泄露原始敏感信息，请重新填写全部字段。</p> : null}
          </div>
          <Field label="收货人" value={draft.recipient} onChange={(value) => change('recipient', value)} autoComplete="name" />
          <Field label="手机号" value={draft.mobile} onChange={(value) => change('mobile', value)} autoComplete="tel" />
          <Field label="省" value={draft.province} onChange={(value) => change('province', value)} autoComplete="address-level1" />
          <Field label="市" value={draft.city} onChange={(value) => change('city', value)} autoComplete="address-level2" />
          <Field label="区/县" value={draft.district} onChange={(value) => change('district', value)} autoComplete="address-level3" />
          <Field label="详细地址" value={draft.detail} onChange={(value) => change('detail', value)} autoComplete="street-address" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" disabled={busy} onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-xs font-bold">
              取消
            </button>
            <button disabled={busy} className="rounded-lg bg-[var(--sw-brand)] px-4 py-2 text-xs font-bold text-inverse disabled:opacity-50">
              {busy ? '保存中…' : '安全保存'}
            </button>
          </div>
        </form>
      ) : null}
      <section className="space-y-2">
        {addresses.map((item) => (
          <article key={item.id} className="rounded-2xl border bg-surface p-4 text-xs shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <b className="text-sm">
                  {item.recipient} · {item.mobile}
                </b>
                <p className="mt-2 text-secondary">
                  {item.province}
                  {item.city}
                  {item.district}
                  {item.detail}
                </p>
                <p className="mt-1 text-muted">
                  {item.tag} · 版本 {item.version}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => start(item)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-bold text-brand">
                  <Pencil size={14} />
                  更新
                </button>
                {confirming === item.id ? (
                  <button type="button" disabled={busy} onClick={() => void erase(item)} className="rounded-lg bg-danger px-3 py-2 font-bold text-inverse">
                    确认删除
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => setConfirming(item.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-bold text-danger">
                    <Trash2 size={14} />
                    删除
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {addresses.length === 0 ? <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed bg-surface text-sm text-muted">尚未维护收货地址</div> : null}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, autoComplete }: { readonly label: string; readonly value: string; readonly onChange: (value: string) => void; readonly autoComplete: string }) {
  return (
    <label className="text-xs font-bold">
      {label}
      <input required maxLength={label === '详细地址' ? 500 : 64} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
    </label>
  );
}

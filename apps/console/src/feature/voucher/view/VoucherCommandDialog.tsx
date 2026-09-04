import { Dialog } from '@shop/design';
import { useEffect, useMemo, useState } from 'react';
import type { VoucherAction } from '../model/VoucherAction';
import type { VoucherChoice, VoucherChoiceKind, VoucherChoicePage } from '../model/Voucher';
import { voucherOperationMeta } from '../model/VoucherOperationCatalog';
import { DialogFooter } from './DialogFooter';

export function VoucherCommandDialog({ action, busy, choices, choiceBusy, choiceError, remoteError, onSubmit, onClose }: Readonly<{ action: VoucherAction | null; busy: boolean; choices: Readonly<Partial<Record<VoucherChoiceKind, VoucherChoicePage>>>; choiceBusy: boolean; choiceError?: string; remoteError?: string; onSubmit: (values: Readonly<Record<string, string>>) => void; onClose: () => void }>) {
  const meta = action ? voucherOperationMeta(action.operation) : undefined;
  const initial = useMemo(() => action && meta ? initialValues(action, meta) : {}, [action, meta]);
  const [values, setValues] = useState<Readonly<Record<string, string>>>(initial);
  const [error, setError] = useState<string>();
  useEffect(() => { setValues(initial); setError(undefined); }, [initial]);
  if (!action || !meta) return null;
  const fields = [...(!action.record && meta.targetLabel ? [{ key: 'target', label: meta.targetLabel, type: 'text' as const, required: true }] : []), ...meta.fields];
  const invalid = Boolean(fields.some((field) => field.required && !field.label.includes('（可选）') && !values[field.key]?.trim()) || (meta.expectedVersion && !values.expectedVersion?.trim()) || (meta.proof && !values.proof?.trim()));
  return <Dialog open title={meta.label} eyebrow="卡券中心 · 权威业务命令" onClose={onClose} dismissable={!busy}>
    <form onSubmit={(event) => { event.preventDefault(); if (invalid) { setError('请完整填写所有必填项。'); return; } setError(undefined); onSubmit(values); }}>
      <div className="vouchercreatorbody">
        <p className="vouchercreatornotice">{meta.description}</p>
        {action.record ? <section className="voucherwriteboundary"><strong>当前操作对象</strong><p>{action.record.name} · {action.record.id} · 第 {action.record.version ?? '—'} 版</p></section> : null}
        {choiceBusy ? <p className="vouchercreatorloading" role="status">正在读取当前范围内的可选业务对象…</p> : null}
        {choiceError ? <p className="vouchercreatorwarning" role="note">可选项暂时不可用，仍可填写已知业务编号：{choiceError}</p> : null}
        <div className="vouchercreatorgrid">{fields.map((field) => <VoucherField key={field.key} field={field} {...(field.source && choices[field.source] ? { choices: choices[field.source]!.items } : {})} value={values[field.key] ?? ''} onChange={(value, fill) => setValues((current) => Object.freeze({ ...current, ...fill, [field.key]: value }))} />)}</div>
        {meta.expectedVersion ? <VoucherField field={{ key: 'expectedVersion', label: '预期版本', type: 'number', required: true, hint: '用于阻止覆盖其他人刚刚完成的修改。' }} value={values.expectedVersion ?? ''} onChange={(value) => setValues((current) => Object.freeze({ ...current, expectedVersion: value }))} /> : null}
        {meta.proof ? <VoucherField field={{ key: 'proof', label: '审批与二次核验证明', type: 'text', required: true, hint: '高敏感操作必须使用当前动作对应的一次性证明。' }} value={values.proof ?? ''} onChange={(value) => setValues((current) => Object.freeze({ ...current, proof: value }))} /> : null}
        {error || remoteError ? <p role="alert">{error ?? remoteError}</p> : null}
      </div>
      <DialogFooter busy={busy} disabled={invalid} label="确认提交" onClose={onClose} />
    </form>
  </Dialog>;
}

function VoucherField({ field, choices, value, onChange }: Readonly<{ field: Readonly<{ key: string; label: string; type: string; required?: boolean; hint?: string; source?: VoucherChoiceKind; options?: readonly Readonly<{ value: string; label: string }>[] }>; choices?: readonly VoucherChoice[]; value: string; onChange: (value: string, fill?: Readonly<Record<string, string>>) => void }>) {
  if (field.type === 'checkbox') return <label className="vouchercreatorchoice"><input aria-label={field.label} type="checkbox" checked={value === 'true'} onChange={(event) => onChange(String(event.target.checked))} /><span><strong>{field.label}</strong>{field.hint ? <small>{field.hint}</small> : null}</span></label>;
  const selected = choices?.find((choice) => choice.id === value);
  return <label className="vouchercreatorfield"><span>{field.label}{field.required && !field.label.includes('（可选）') ? ' *' : ''}</span>
    {field.source && choices ? <select aria-label={field.label} value={value} onChange={(event) => { const choice = choices.find((candidate) => candidate.id === event.target.value); onChange(event.target.value, choice?.fill); }}><option value="">请选择</option>{choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}</select>
      : field.type === 'select' && field.options?.length ? <select aria-label={field.label} value={value} onChange={(event) => onChange(event.target.value)}>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : <input aria-label={field.label} type={field.type === 'number' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'} min={field.type === 'number' ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} />}
    {selected ? <small>{selected.detail}</small> : field.hint ? <small>{field.hint}</small> : null}
  </label>;
}

function initialValues(action: VoucherAction, meta: ReturnType<typeof voucherOperationMeta>): Readonly<Record<string, string>> {
  const now = new Date(); now.setSeconds(0, 0);
  const later = new Date(now.getTime() + 365 * 86_400_000);
  const entries = [
    ...meta.fields.map((field) => [field.key, field.initial ?? (field.key === 'startsAt' ? local(now) : field.key === 'expiresAt' ? local(later) : field.key === 'watermark' ? now.toISOString() : '')] as const),
    ...(meta.expectedVersion ? [['expectedVersion', String(action.record?.version ?? '')] as const] : []),
    ...(meta.proof ? [['proof', ''] as const] : []),
  ];
  return Object.freeze(Object.fromEntries(entries));
}
function local(value: Date): string { const offset = value.getTimezoneOffset() * 60_000; return new Date(value.getTime() - offset).toISOString().slice(0, 16); }

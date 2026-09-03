import { hasFailureCode, presentError } from '@shop/presentation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ApplyAfterSale } from '../application/ApplyAfterSale';
import { ReadAfterSale } from '../application/ReadAfterSale';
import { UploadAfterSaleAttachment } from '../application/UploadAfterSaleAttachment';
import type { AfterSaleAttachmentDraft, AfterSalePage } from '../model/AfterSale';

export const afterSaleReasons = Object.freeze([
  ['quality', '商品质量问题'],
  ['damaged', '运输破损'],
  ['wrongitem', '错发或漏发'],
  ['notneeded', '不再需要'],
  ['service', '服务未按约完成'],
] as const);

export function useAfterSaleViewModel(orderId: string) {
  const dependencies = useDependencies();
  const runtime = useSession();
  const navigate = useNavigate();
  const reader = useRef(new ReadAfterSale(dependencies.aftersale));
  const command = useRef(new ApplyAfterSale(dependencies.aftersale));
  const uploader = useRef(new UploadAfterSaleAttachment(dependencies.aftersale));
  const [page, setPage] = useState<AfterSalePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verification, setVerification] = useState(false);
  const [reason, setReason] = useState<string>(afterSaleReasons[0][0]);
  const [description, setDescription] = useState('');
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [attachments, setAttachments] = useState<readonly AfterSaleAttachmentDraft[]>([]);
  const load = useCallback(async () => {
    setError(null);
    try {
      if (!runtime.session) throw new Error('AUTHENTICATION_REQUIRED');
      setPage(await reader.current.execute(runtime.session, orderId));
    } catch (cause) { setError(presentError(cause).message); }
  }, [orderId, runtime.session]);
  useEffect(() => { void load(); }, [load]);
  const selected = useMemo(() => Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([lineId, quantity]) => ({ lineId, quantity })), [quantities]);
  const expectedMinor = useMemo(() => page?.availableLines.reduce((total, line) => {
    const quantity = quantities[line.lineId] ?? 0;
    return total + (line.maximumQuantity === 0 ? 0 : Math.floor((line.expectedRefundMinor * quantity) / line.maximumQuantity));
  }, 0) ?? 0, [page, quantities]);

  async function upload(files: FileList | null): Promise<void> {
    if (!files || !runtime.session) return;
    const incoming = [...files];
    if (attachments.length + incoming.length > 6 || incoming.some((file) => file.size < 1 || file.size > 1_000_000) || attachments.reduce((sum, item) => sum + item.sizeBytes, 0) + incoming.reduce((sum, file) => sum + file.size, 0) > 1_250_000) {
      setError('最多上传 6 个 JPG、PNG 或 PDF，单个不超过 1 MB、合计不超过 1.25 MB');
      return;
    }
    if (incoming.some((file) => !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type))) {
      setError('附件仅支持 JPG、PNG 和 PDF');
      return;
    }
    setError(null);
    const tasks = incoming.map((file) => Object.freeze({ id: `upload:${crypto.randomUUID()}`, file }));
    setAttachments((current) => [...current, ...tasks.map(({ id, file }) => ({ id, name: file.name, sizeBytes: file.size, state: 'uploading' as const }))]);
    await parallel(tasks, 2, async ({ id, file }) => {
      try {
        const receipt = await uploader.current.execute(runtime.session!, orderId, file);
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, state: 'ready', receipt } : item));
      } catch (cause) {
        setAttachments((current) => current.map((item) => item.id === id ? { ...item, state: 'failed', error: presentError(cause).message } : item));
      }
    });
  }

  async function submit(): Promise<void> {
    if (busy) return;
    if (selected.length === 0 || description.trim().length < 5) { setError('请选择可售后商品并填写至少 5 个字的问题说明'); return; }
    if (attachments.some(({ state }) => state !== 'ready')) { setError('请等待附件上传完成，或移除上传失败的附件'); return; }
    setBusy(true);
    setError(null);
    try {
      if (!runtime.session) throw new Error('AUTHENTICATION_REQUIRED');
      await command.current.execute(runtime.session, orderId, { lines: selected, reason, description: description.trim(), attachments: attachments.flatMap(({ receipt }) => receipt ? [receipt] : []) });
      setDescription(''); setQuantities({}); setAttachments([]);
      await load();
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) setVerification(true);
      else setError(presentError(cause).message);
    } finally { setBusy(false); }
  }

  return Object.freeze({
    orderId,
    state: page === null && error === null ? ('loading' as const) : error && page === null ? ('failed' as const) : page?.items.length ? ('ready' as const) : ('empty' as const),
    page,
    error,
    busy,
    verification,
    reason,
    description,
    quantities,
    attachments,
    selected,
    expectedMinor,
    actions: Object.freeze({
      back: () => void navigate(`/orders/${encodeURIComponent(orderId)}`),
      refresh: () => void load(),
      changeReason: setReason,
      changeDescription: setDescription,
      changeQuantity: (lineId: string, quantity: number) => setQuantities((current) => ({ ...current, [lineId]: quantity })),
      upload: (files: FileList | null) => void upload(files),
      removeAttachment: (id: string) => setAttachments((current) => current.filter((item) => item.id !== id)),
      submit: () => void submit(),
      closeVerification: () => setVerification(false),
      verified: () => { setVerification(false); runtime.showToast('二次验证已完成，请再次确认提交售后申请', 'success'); },
    }),
  });
}

async function parallel<T>(items: readonly T[], limit: number, execute: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const item = items[cursor++]; if (item !== undefined) await execute(item); }
  }));
}

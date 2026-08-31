import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { formatDate } from '../../shared/ui/Format';
import { formatRecordAmount } from './VoucherTable';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';
import type { VoucherRecord, VoucherView } from './VoucherSchema';

export function VoucherRecordDrawer({
  record,
  view,
  onClose,
}: Readonly<{
  record: VoucherRecord | undefined;
  view: VoucherView;
  onClose: () => void;
}>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(record !== undefined, onClose, closeRef);
  if (record === undefined) return null;
  return (
    <div className="voucheroverlay is-drawer">
      <button className="voucherdialogbackdrop" type="button" onClick={onClose} aria-label="关闭卡券摘要" />
      <aside className="voucherdrawer" role="dialog" aria-modal="true" aria-labelledby="voucherdrawertitle">
        <header>
          <div>
            <p>{voucherViewMeta[view].label} · 只读摘要</p>
            <h2 id="voucherdrawertitle">{record.name}</h2>
            <code>{record.id}</code>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭卡券摘要">
            ×
          </button>
        </header>
        <div className="voucherdrawerbody">
          <section className="voucherdrawerstatus" aria-label="当前状态">
            <span className={`voucherstate is-${voucherStateTone(record.state)}`}>
              <i aria-hidden="true" />
              {voucherStateLabel(record.state)}
            </span>
            <p>数据来自当前网站范围的服务端读模型；这里只展示已返回字段，不推断未返回的规则。</p>
          </section>
          <dl className="voucherfacts">
            <div>
              <dt>业务详情</dt>
              <dd>{record.detail}</dd>
            </div>
            <div>
              <dt>数量</dt>
              <dd>{record.quantity === null ? '—' : new Intl.NumberFormat('zh-CN').format(record.quantity)}</dd>
            </div>
            <div>
              <dt>金额</dt>
              <dd>{formatRecordAmount(record)}</dd>
            </div>
            <div>
              <dt>服务端时间</dt>
              <dd>{formatDate(record.occurredAt)}</dd>
            </div>
            <div>
              <dt>版本</dt>
              <dd>{record.version === null ? '—' : `v${record.version}`}</dd>
            </div>
          </dl>
          <section className="voucherwriteboundary" role="note">
            <strong>操作边界</strong>
            <p>编辑、审批、发行、暂停和冲正必须等待完整 Preview / proof 流程，本页不会直接提交写入。</p>
          </section>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </footer>
      </aside>
    </div>
  );
}

export function VoucherCreatorPreview({ open, busy, error, onCreate, onClose }: Readonly<{ open: boolean; busy: boolean; error?: string; onCreate: (prefix: string) => void; onClose: () => void }>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [prefix, setPrefix] = useState('SW');
  useDialogKeyboard(open, onClose, closeRef);
  if (!open) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (/^[A-Za-z0-9]{2,16}$/.test(prefix.trim())) onCreate(prefix.trim().toUpperCase());
  };
  return (
    <div className="voucheroverlay">
      <button className="voucherdialogbackdrop" type="button" onClick={onClose} aria-label="关闭新建卡号库" />
      <section className="vouchercreatordialog" role="dialog" aria-modal="true" aria-labelledby="vouchercreatortitle">
        <header>
          <div>
            <p>CREATE CARD LIBRARY</p>
            <h2 id="vouchercreatortitle">新建卡号库</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭新建卡号库">
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="vouchercreatorbody">
            <p className="vouchercreatornotice">创建一个由系统安全生成卡号的卡号库。卡号内容不会在列表或日志中显示。</p>
            <label>
              <span>卡号前缀</span>
              <input aria-label="卡号前缀" value={prefix} onChange={(event) => setPrefix(event.target.value)} maxLength={16} autoComplete="off" />
            </label>
            <p>请输入 2–16 位英文字母或数字，例如 SW2026。</p>
            {error === undefined ? null : <p role="alert">{error}</p>}
            <section className="voucherwriteboundary" role="note">
              <strong>安全校验</strong>
              <p>提交会校验当前权限版本、双因素登录状态、数据范围、幂等键与审计记录。</p>
            </section>
          </div>
          <footer>
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button type="submit" disabled={busy || !/^[A-Za-z0-9]{2,16}$/.test(prefix.trim())}>
              {busy ? '正在创建…' : '确认创建'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function useDialogKeyboard(open: boolean, onClose: () => void, focusRef: RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      previous?.focus();
    };
  }, [focusRef, onClose, open]);
}

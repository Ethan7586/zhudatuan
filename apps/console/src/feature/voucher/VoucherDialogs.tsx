import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { chineseReference } from '@shop/presentation';
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
            <code>{chineseReference(voucherViewMeta[view].short, record.id)}</code>
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
              <dd>{record.version === null ? '—' : `第 ${record.version} 版`}</dd>
            </div>
          </dl>
          <section className="voucherwriteboundary" role="note">
            <strong>操作边界</strong>
            <p>编辑、审批、发行、暂停和冲正必须等待完整的操作预览与凭证流程，本页不会直接提交写入。</p>
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

export function CardLibraryCreator({ open, busy, error, onCreate, onClose }: Readonly<{ open: boolean; busy: boolean; error?: string; onCreate: (prefix: string) => void; onClose: () => void }>) {
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
            <p>创建卡号库</p>
            <h2 id="vouchercreatortitle">新建卡号库</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭新建卡号库">
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="vouchercreatorbody">
            <p className="vouchercreatornotice">创建一个由系统安全生成卡号的卡号库。卡号内容不会在列表或日志中显示。</p>
            <label className="vouchercreatorfield">
              <span>卡号前缀</span>
              <input aria-label="卡号前缀" value={prefix} onChange={(event) => setPrefix(event.target.value)} maxLength={16} autoComplete="off" />
              <small>请输入 2–16 位英文字母或数字，例如 SW2026。</small>
            </label>
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

export type VoucherProgramDraft = Readonly<{
  name: string;
  valueMinor: number;
  validityDays: number;
  approvalRequired: boolean;
}>;

export function VoucherProgramCreator({ open, busy, error, onCreate, onClose }: Readonly<{ open: boolean; busy: boolean; error?: string; onCreate: (draft: VoucherProgramDraft) => void; onClose: () => void }>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState('员工福利券');
  const [value, setValue] = useState('100');
  const [validityDays, setValidityDays] = useState('365');
  const [approvalRequired, setApprovalRequired] = useState(true);
  useDialogKeyboard(open, onClose, closeRef);
  if (!open) return null;
  const valueMinor = parseMinor(value);
  const days = parseDays(validityDays);
  const valid = name.trim().length > 0 && valueMinor !== null && days !== null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid || valueMinor === null || days === null) return;
    onCreate({ name: name.trim(), valueMinor, validityDays: days, approvalRequired });
  };
  return (
    <div className="voucheroverlay">
      <button className="voucherdialogbackdrop" type="button" onClick={onClose} aria-label="关闭新建卡券" />
      <section className="vouchercreatordialog" role="dialog" aria-modal="true" aria-labelledby="voucherprogramcreatortitle">
        <header>
          <div>
            <p>创建卡券方案</p>
            <h2 id="voucherprogramcreatortitle">新建卡券</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭新建卡券">
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="vouchercreatorbody">
            <p className="vouchercreatornotice">先创建安全的卡券草稿；审批、备券和发行仍在各自独立流程中完成。</p>
            <label className="vouchercreatorfield">
              <span>卡券名称</span>
              <input aria-label="卡券名称" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoComplete="off" />
              <small>使用员工容易理解的名称，创建后仍可在草稿阶段调整。</small>
            </label>
            <div className="vouchercreatorgrid">
              <label className="vouchercreatorfield">
                <span>面值（元）</span>
                <input aria-label="面值（元）" value={value} onChange={(event) => setValue(event.target.value)} inputMode="decimal" autoComplete="off" />
                <small>最多两位小数，金额必须大于零。</small>
              </label>
              <label className="vouchercreatorfield">
                <span>有效天数</span>
                <input aria-label="有效天数" value={validityDays} onChange={(event) => setValidityDays(event.target.value)} inputMode="numeric" autoComplete="off" />
                <small>自发行之日起 1–3650 天。</small>
              </label>
            </div>
            <label className="vouchercreatorchoice">
              <input aria-label="发行前需要审批" type="checkbox" checked={approvalRequired} onChange={(event) => setApprovalRequired(event.target.checked)} />
              <span>
                <strong>发行前需要审批</strong>
                <small>保留经办与复核分离，避免卡券被直接发行。</small>
              </span>
            </label>
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
            <button type="submit" disabled={busy || !valid}>
              {busy ? '正在创建…' : '创建草稿'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function parseMinor(value: string): number | null {
  const match = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (match === null) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return minor > 0 ? minor : null;
}

function parseDays(value: string): number | null {
  if (!/^\d{1,4}$/.test(value.trim())) return null;
  const days = Number(value);
  return days >= 1 && days <= 3650 ? days : null;
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

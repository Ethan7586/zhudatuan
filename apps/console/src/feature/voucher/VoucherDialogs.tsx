import { useEffect, useRef, type RefObject } from 'react';
import { formatDate } from '../../shared/ui/Format';
import { formatRecordAmount } from './VoucherTable';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';
import type { VoucherRecord, VoucherView } from './VoucherSchema';

export function VoucherRecordDrawer({ record, view, onClose }: Readonly<{
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
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭卡券摘要">×</button>
        </header>
        <div className="voucherdrawerbody">
          <section className="voucherdrawerstatus" aria-label="当前状态">
            <span className={`voucherstate is-${voucherStateTone(record.state)}`}><i aria-hidden="true" />{voucherStateLabel(record.state)}</span>
            <p>数据来自当前网站范围的服务端读模型；这里只展示已返回字段，不推断未返回的规则。</p>
          </section>
          <dl className="voucherfacts">
            <div><dt>业务详情</dt><dd>{record.detail}</dd></div>
            <div><dt>数量</dt><dd>{record.quantity === null ? '—' : new Intl.NumberFormat('zh-CN').format(record.quantity)}</dd></div>
            <div><dt>金额</dt><dd>{formatRecordAmount(record)}</dd></div>
            <div><dt>服务端时间</dt><dd>{formatDate(record.occurredAt)}</dd></div>
            <div><dt>版本</dt><dd>{record.version === null ? '—' : `v${record.version}`}</dd></div>
          </dl>
          <section className="voucherwriteboundary" role="note">
            <strong>操作边界</strong>
            <p>编辑、审批、发行、暂停和冲正必须等待完整 Preview / proof 流程，本页不会直接提交写入。</p>
          </section>
        </div>
        <footer><button type="button" onClick={onClose}>关闭</button></footer>
      </aside>
    </div>
  );
}

export function VoucherCreatorPreview({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(open, onClose, closeRef);
  if (!open) return null;
  const steps = [
    ['1', '基础规则', '代金券面值、门槛、领取限制'],
    ['2', '适用范围', '网站、商城、商品与会员人群'],
    ['3', '发放设置', '有效期、批次、入口与配额'],
    ['4', '审核发布', '风险检查、管理员复核与审计留痕'],
  ] as const;
  return (
    <div className="voucheroverlay">
      <button className="voucherdialogbackdrop" type="button" onClick={onClose} aria-label="关闭新建卡券安全预览" />
      <section className="vouchercreatordialog" role="dialog" aria-modal="true" aria-labelledby="vouchercreatortitle">
        <header>
          <div><p>WRITE FLOW PREVIEW</p><h2 id="vouchercreatortitle">新建卡券 · 安全预览</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭新建卡券安全预览">×</button>
        </header>
        <div className="vouchercreatorbody">
          <p className="vouchercreatornotice">流程沿用已确认的四步设计，但当前不会创建方案、占用卡号、申请额度或发行卡券。</p>
          <ol>
            {steps.map(([number, title, description]) => <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}
          </ol>
          <section className="voucherwriteboundary" role="note">
            <strong>为什么暂时关闭提交</strong>
            <p>服务端已有卡券读模型，但创建、审批与发行仍需补齐权限确认、幂等键、预算校验和操作证明。</p>
          </section>
        </div>
        <footer><button type="button" onClick={onClose}>返回卡券治理台</button></footer>
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

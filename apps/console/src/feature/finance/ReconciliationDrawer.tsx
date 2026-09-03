import { useState } from 'react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { formatMinor } from '../../shared/ui/Format';
import { FinanceIcon } from './FinanceIcon';
import type { FinanceReconciliation, FinanceReconciliationItem } from './FinanceWorkspaceSchema';

export function ReconciliationDrawer({ row, onClose }: Readonly<{ row: FinanceReconciliation | undefined; onClose: () => void }>) {
  return (
    <ModalOverlay
      className="financedraweroverlay"
      isOpen={row !== undefined}
      isDismissable
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="financedrawermodal">
        <AriaDialog className="financedrawer" aria-label="差异处理 · 复核预览">
          {row === undefined ? null : <ReconciliationDrawerContent key={row.id} row={row} onClose={onClose} />}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ReconciliationDrawerContent({ row, onClose }: Readonly<{ row: FinanceReconciliation; onClose: () => void }>) {
  const item = differenceItem(row.items);
  const [copied, setCopied] = useState(false);
  const copyId = () => {
    if (item === undefined || navigator.clipboard === undefined) return;
    void navigator.clipboard
      .writeText(item.id)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => setCopied(false));
  };
  return (
    <>
      <header className="financedrawerheader">
        <button className="financedrawerback" type="button" onClick={onClose}>
          <FinanceIcon name="arrowLeft" />
          返回差异详情
        </button>
        <button className="financedrawerclose" type="button" onClick={onClose} aria-label="关闭复核预览">
          <FinanceIcon name="close" />
        </button>
        <div className="financedrawertitle">
          <Heading slot="title">差异处理 · 复核预览</Heading>
          <div>
            <strong>{chineseReference('差异记录', item?.id ?? row.id)}</strong>
            <button type="button" onClick={copyId} disabled={item === undefined} aria-label={copied ? '差异编号已复制' : '复制差异编号'}>
              <FinanceIcon name={copied ? 'check' : 'copy'} />
            </button>
          </div>
          <span className="financedrawerbadges">
            <i>权威对账事实</i>
            <i>只读</i>
          </span>
          <small>第 {row.version} 版 · 修复预览未接入</small>
        </div>
        <section className="financeimmutablealert">
          <FinanceIcon name="alert" />
          <p>服务端未返回可验证的修复预览，最终动作保持关闭。</p>
        </section>
      </header>
      <div className="financedrawerbody" role="region" aria-label="复核预览内容">
        <section className="financeunavailablepreview" role="status">
          <FinanceIcon name="shield" />
          <h3>最终动作未接入</h3>
          <p>当前仅展示通过契约校验的服务端对账事实，不伪造修复方案、预览哈希、拟生成分录或校验结果。</p>
          <dl>
            <Detail label="对账状态" value={chineseDomainLabel(row.state)} />
            <Detail label="差异金额" value={formatMinor(row.difference_minor)} />
            <Detail label="差异原因" value={item?.reasonCode ? chineseDomainLabel(item.reasonCode, '其他差异原因') : '服务端未提供'} />
            <Detail label="来源校验摘要" value={row.statement_hash ? chineseReference('校验摘要', row.statement_hash) : '服务端未提供'} />
          </dl>
        </section>
      </div>
      <footer className="financedrawerfooter">
        <p id="financereviewboundary">
          <FinanceIcon name="info" />
          修复需调用独立的服务端操作预览，再经过三级身份验证、操作绑定凭证、版本重读与执行回执。
        </p>
        <div>
          <button type="button" onClick={onClose}>
            返回
          </button>
          <button type="button" disabled aria-describedby="financereviewboundary">
            保存草稿
          </button>
          <button className="financesubmitreview" type="button" disabled aria-describedby="financereviewboundary">
            提交财务复核
          </button>
        </div>
      </footer>
    </>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function differenceItem(items: readonly FinanceReconciliationItem[]): FinanceReconciliationItem | undefined {
  return items.find((item) => item.state === 'difference' || item.state === 'resolutionpending') ?? items[0];
}

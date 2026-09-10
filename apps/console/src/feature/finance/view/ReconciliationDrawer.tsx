import { useState } from 'react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { FinanceReconciliation, FinanceReconciliationItem } from '../model/Finance';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';
import { FinanceIcon } from './FinanceIcon';
import { ReconciliationActions } from './ReconciliationActions';
import { ReconciliationFacts } from './ReconciliationFacts';

export function ReconciliationDrawer({
  row,
  item,
  command,
  actions,
  onClose,
}: Readonly<{ row: FinanceReconciliation | undefined; item: FinanceReconciliationItem | undefined; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions']; onClose: () => void }>) {
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
        <AriaDialog className="financedrawer" aria-label="对账差异详情">
          {row === undefined ? null : <ReconciliationDrawerContent key={`${row.id}:${item?.id ?? 'batch'}`} row={row} item={item} command={command} actions={actions} onClose={onClose} />}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ReconciliationDrawerContent({
  row,
  item,
  command,
  actions,
  onClose,
}: Readonly<{ row: FinanceReconciliation; item: FinanceReconciliationItem | undefined; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions']; onClose: () => void }>) {
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
          返回对账列表
        </button>
        <button className="financedrawerclose" type="button" onClick={onClose} aria-label="关闭差异详情">
          <FinanceIcon name="close" />
        </button>
        <div className="financedrawertitle">
          <Heading slot="title">对账差异详情</Heading>
          <div>
            <strong>{chineseReference(item ? '差异记录' : '对账批次', item?.id ?? row.id)}</strong>
            {item === undefined ? null : (
              <button type="button" onClick={copyId} aria-label={copied ? '差异编号已复制' : '复制差异编号'}>
                <FinanceIcon name={copied ? 'check' : 'copy'} />
              </button>
            )}
          </div>
          <span className="financedrawerbadges">
            <i>权威对账事实</i>
            <i>{chineseDomainLabel(item?.state ?? row.state)}</i>
          </span>
          <small>
            第 {row.version} 版 · 批次最后更新于 {formatTime(row.updatedAt)}
          </small>
        </div>
      </header>
      <div className="financedrawerbody" role="region" aria-label="对账差异事实">
        <section className="financereviewsections">
          <ReconciliationFacts row={row} item={item} actions={actions} />
          <ReconciliationActions row={row} item={item} command={command} actions={actions} />
        </section>
      </div>
      <footer className="financedrawerfooter">
        <div>
          <button type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </footer>
    </>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

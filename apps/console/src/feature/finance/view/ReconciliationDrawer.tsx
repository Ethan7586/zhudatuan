import { useState } from 'react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { ReceiptPanel } from '@shop/design';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { formatMinor } from '../../../shared/ui/Format';
import { FinanceIcon } from './FinanceIcon';
import type { FinanceReconciliation, FinanceReconciliationItem } from '../model/Finance';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';

export function ReconciliationDrawer({ row, command, actions, onClose }: Readonly<{ row: FinanceReconciliation | undefined; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions']; onClose: () => void }>) {
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
          {row === undefined ? null : <ReconciliationDrawerContent key={row.id} row={row} command={command} actions={actions} onClose={onClose} />}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ReconciliationDrawerContent({ row, command, actions, onClose }: Readonly<{ row: FinanceReconciliation; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions']; onClose: () => void }>) {
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
        <button className="financedrawerclose" type="button" onClick={onClose} aria-label="关闭差异详情">
          <FinanceIcon name="close" />
        </button>
        <div className="financedrawertitle">
          <Heading slot="title">对账差异详情</Heading>
          <div>
            <strong>{chineseReference('差异记录', item?.id ?? row.id)}</strong>
            {item === undefined ? null : (
              <button type="button" onClick={copyId} aria-label={copied ? '差异编号已复制' : '复制差异编号'}>
                <FinanceIcon name={copied ? 'check' : 'copy'} />
              </button>
            )}
          </div>
          <span className="financedrawerbadges">
            <i>权威对账事实</i>
            <i>{chineseDomainLabel(row.state)}</i>
          </span>
          <small>
            第 {row.version} 版 · 更新于 {formatTime(row.updatedAt)}
          </small>
        </div>
      </header>
      <div className="financedrawerbody" role="region" aria-label="对账差异事实">
        <section className="financereviewsections">
          <div className="financereviewsection">
            <h3>
              <span>1</span>批次事实
            </h3>
            <dl className="financedetailgrid">
              <Detail label="对账状态" value={chineseDomainLabel(row.state)} />
              <Detail label="账期" value={row.period} />
              <Detail label="渠道金额" value={formatMinor(row.debitMinor)} />
              <Detail label="账本金额" value={formatMinor(row.creditMinor)} />
              <Detail label="差异金额" value={formatMinor(row.differenceMinor)} />
              <Detail label="合作方" value={chineseReference('合作方', row.partnerId)} />
            </dl>
          </div>
          <div className="financereviewsection">
            <h3>
              <span>2</span>差异证据
            </h3>
            <dl className="financedetailgrid">
              <Detail label="外部金额" value={item ? formatMinor(item.externalMinor) : '无差异项'} />
              <Detail label="内部金额" value={item ? formatMinor(item.internalMinor) : '无差异项'} />
              <Detail label="差异原因" value={item?.reasonCode ? chineseDomainLabel(item.reasonCode, '其他差异原因') : '未标注'} />
              <Detail label="处理状态" value={item ? chineseDomainLabel(item.state) : chineseDomainLabel(row.state)} />
              <Detail label="渠道账单" value={row.statementRef ? chineseReference('渠道账单', row.statementRef) : '未关联'} />
              <Detail label="校验摘要" value={row.statementHash ? chineseReference('校验摘要', row.statementHash) : '未生成'} />
            </dl>
          </div>
          {command.allowed && command.options.length > 0 ? (
            <div className="financereviewsection">
              <h3>
                <span>3</span>安全处置
              </h3>
              {command.receipt ? (
                <div className="financecommandreceipt">
                  <ReceiptPanel receipt={command.receipt} />
                  <button type="button" onClick={actions.dismissReceipt}>
                    继续处理
                  </button>
                </div>
              ) : (
                <form
                  className="financecommandform"
                  onSubmit={(event) => {
                    event.preventDefault();
                    actions.submit();
                  }}
                >
                  <label>
                    处理方式
                    <select value={command.value} onChange={(event) => actions.command(event.target.value as typeof command.value)}>
                      {command.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    处理原因
                    <textarea value={command.reason} maxLength={1000} rows={3} onChange={(event) => actions.reason(event.target.value)} placeholder="说明证据、判断依据和预期结果" />
                  </label>
                  <label>
                    一次性操作凭证
                    <input type="password" autoComplete="off" value={command.proof} onChange={(event) => actions.proof(event.target.value)} placeholder="完成 Step-up 后粘贴操作绑定凭证" />
                  </label>
                  <label className="financecommandconfirm">
                    <input type="checkbox" checked={command.confirmed} onChange={(event) => actions.confirmed(event.target.checked)} />
                    我已核对批次、差异金额和处理方式；批准人与提交人必须不同。
                  </label>
                  {command.error ? <p role="alert">{command.error}</p> : command.validation ? <p>{command.validation}</p> : null}
                  <div>
                    {command.assurance < 3 ? (
                      <button type="button" onClick={actions.stepup}>
                        进行身份验证
                      </button>
                    ) : null}
                    <button className="financesubmitreview" type="submit" disabled={command.busy || command.validation !== undefined}>
                      {command.busy ? '正在执行…' : (command.options.find((option) => option.value === command.value)?.label ?? '提交')}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
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

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

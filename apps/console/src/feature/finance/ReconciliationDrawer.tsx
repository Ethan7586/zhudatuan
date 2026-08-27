import { useState, type ReactNode } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { formatMinor } from '../../shared/ui/Format';
import { FinanceIcon } from './FinanceIcon';
import type { FinanceReconciliation, FinanceReconciliationItem, FinanceRepairPreview } from './FinanceWorkspaceSchema';

export function ReconciliationDrawer({
  row,
  previewEnabled,
  onClose,
}: Readonly<{
  row: FinanceReconciliation | undefined;
  previewEnabled: boolean;
  onClose: () => void;
}>) {
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
          {row === undefined ? null : <ReconciliationDrawerContent key={row.id} row={row} previewEnabled={previewEnabled} onClose={onClose} />}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ReconciliationDrawerContent({
  row,
  previewEnabled,
  onClose,
}: Readonly<{
  row: FinanceReconciliation;
  previewEnabled: boolean;
  onClose: () => void;
}>) {
  const item = differenceItem(row.items);
  const preview = previewEnabled && item?.preview?.source === 'local-preview' ? item.preview : undefined;
  const [notice, setNotice] = useState<string>();
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
            <strong>{item?.id ?? row.id}</strong>
            <button type="button" onClick={copyId} disabled={item === undefined} aria-label={copied ? '差异 ID 已复制' : '复制差异 ID'}>
              <FinanceIcon name={copied ? 'check' : 'copy'} />
            </button>
          </div>
          <span className="financedrawerbadges">
            <i>服务端预览</i>
            <i>{preview?.status === 'pending-review' ? '等待复核' : '待提交复核'}</i>
          </span>
          <small>
            版本 v{row.version}
            {preview === undefined ? ' · 安全预览未接入' : ` · 预览有效至 ${formatDateTime(preview.expiresAt)}`}
          </small>
        </div>
        <section className="financeimmutablealert">
          <FinanceIcon name="alert" />
          <p>{preview === undefined ? '服务端未返回可验证的修复预览，最终动作保持关闭。' : '本方案将重放缺失记账事件；不修改或删除原支付、渠道账单及历史账本。'}</p>
        </section>
      </header>
      {/* A scrollable region needs a sequential focus target for keyboard-only Safari users. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="financedrawerbody" role="region" tabIndex={0} aria-label="复核预览内容">
        {preview === undefined ? <UnavailablePreview row={row} item={item} /> : <RepairPreview preview={preview} />}
      </div>
      <footer className="financedrawerfooter">
        <p id="financereviewboundary">
          <FinanceIcon name="info" />
          发起人不能审批自己的处理方案；最终由另一位财务复核人批准。 正式执行仍需 Level 3、action-bound proof、版本重读与 Operation 回执。
        </p>
        {notice === undefined ? null : (
          <span className="financepreviewnotice" role="status">
            {notice}
          </span>
        )}
        <div>
          <button type="button" onClick={onClose}>
            返回
          </button>
          <button type="button" disabled={preview === undefined} aria-describedby="financereviewboundary" onClick={() => setNotice('本地安全预览：草稿未写入，服务端尚无 draft Operation。')}>
            保存草稿
          </button>
          <button className="financesubmitreview" type="button" disabled={preview === undefined} aria-describedby="financereviewboundary" onClick={() => setNotice('提交已安全拦截：尚未闭合二次验证、proof、幂等与权威回读。')}>
            提交财务复核
          </button>
        </div>
      </footer>
    </>
  );
}

function RepairPreview({ preview }: Readonly<{ preview: FinanceRepairPreview }>) {
  return (
    <div className="financereviewsections">
      <ReviewSection number="1" title="修复方案（服务端生成）">
        <dl className="financedetailgrid">
          <Detail label="处理动作" value={preview.plan.operation} />
          <Detail label="关联支付" value={preview.plan.relatedPayment} />
          <Detail label="记账日期" value={preview.plan.accountingDate} />
          <Detail label="Scope" value={preview.plan.scope} />
        </dl>
        <p className="financeplandescription">
          <strong>{preview.plan.title}</strong>
          {preview.plan.description}
        </p>
      </ReviewSection>
      <ReviewSection number="2" title="拟生成分录">
        <table className="financeentrypreview">
          <thead>
            <tr>
              <th>方向</th>
              <th>账户</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            {preview.entries.map((entry, index) => (
              <tr key={`${entry.side}:${entry.account}:${index}`}>
                <td>{entry.side === 'debit' ? '借' : '贷'}</td>
                <td>{entry.account}</td>
                <td>{formatMinor(entry.amountMinor, entry.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="financebalanced">
          <FinanceIcon name="check" />
          借贷平衡由服务端快照验证
        </p>
      </ReviewSection>
      <ReviewSection number="3" title="预计处理结果">
        <dl className="financeresultgrid">
          <Result label="账本净额" before={preview.result.ledgerBeforeMinor} after={preview.result.ledgerAfterMinor} />
          <Result label="对账差异" before={preview.result.differenceBeforeMinor} after={preview.result.differenceAfterMinor} />
          <div>
            <dt>结算影响</dt>
            <dd>{preview.result.settlementImpact}</dd>
          </div>
        </dl>
      </ReviewSection>
      <ReviewSection number="4" title="提交前校验">
        <ul className="financechecklist">
          {preview.checks.map((check) => (
            <li key={check.label} data-state={check.state}>
              <FinanceIcon name={check.state === 'passed' ? 'check' : 'alert'} />
              <span>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </span>
            </li>
          ))}
        </ul>
      </ReviewSection>
      <ReviewSection number="5" title="处理依据">
        <dl className="financeevidence">
          <Detail label="Reason" value={preview.reason} />
          {preview.evidence.map((evidence) => (
            <Detail key={evidence.label} label={evidence.label} value={evidence.value} />
          ))}
          <Detail label="previewHash" value={preview.previewHash} />
          <Detail label="Idempotency-Key" value={preview.idempotencyKey} />
          <Detail label="sourceHash" value={preview.sourceHash} />
          <Detail label="版本约束" value={`item v${preview.itemVersion} / preview v${preview.previewVersion}`} />
        </dl>
      </ReviewSection>
    </div>
  );
}

function UnavailablePreview({ row, item }: Readonly<{ row: FinanceReconciliation; item: FinanceReconciliationItem | undefined }>) {
  return (
    <section className="financeunavailablepreview" role="status">
      <FinanceIcon name="shield" />
      <h3>最终动作未接入</h3>
      <p>当前仅展示通过 Zod 校验的服务端对账事实，未收到 previewHash、有效期、拟生成分录或提交前校验。</p>
      <dl>
        <Detail label="对账状态" value={row.state} />
        <Detail label="差异金额" value={formatMinor(row.difference_minor)} />
        <Detail label="差异原因" value={item?.reasonCode ?? '服务端未提供'} />
        <Detail label="sourceHash" value={row.statement_hash ?? '服务端未提供'} />
      </dl>
    </section>
  );
}

function ReviewSection({ number, title, children }: Readonly<{ number: string; title: string; children: ReactNode }>) {
  return (
    <section className="financereviewsection">
      <h3>
        <span>{number}</span>
        {title}
      </h3>
      {children}
    </section>
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
function Result({ label, before, after }: Readonly<{ label: string; before: number; after: number }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span>{formatMinor(before)}</span>
        <FinanceIcon name="arrowRight" />
        <strong>{formatMinor(after)}</strong>
      </dd>
    </div>
  );
}
function differenceItem(items: readonly FinanceReconciliationItem[]): FinanceReconciliationItem | undefined {
  return items.find((item) => item.state === 'difference' || item.state === 'resolutionpending') ?? items[0];
}
function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

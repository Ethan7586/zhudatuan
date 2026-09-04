import { useState } from 'react';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import { formatMinor } from '../../../shared/ui/Format';
import type { FinanceReconciliation, FinanceReconciliationItem } from '../model/Finance';
import { reconciliationEvidence, reconciliationResolution, reconciliationSuggestion, reconciliationTimeline, type ReconciliationEvidenceFact } from '../model/ReconciliationReview';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';
import { FinanceIcon } from './FinanceIcon';

export function ReconciliationDrawer({ row, item, command, actions, onClose }: Readonly<{ row: FinanceReconciliation | undefined; item: FinanceReconciliationItem | undefined; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions']; onClose: () => void }>) {
  return (
    <ModalOverlay className="financedraweroverlay" isOpen={row !== undefined} isDismissable onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal className="financedrawermodal">
        <AriaDialog className="financedrawer" aria-label="对账差异详情">
          {row === undefined ? null : <ReconciliationDrawerContent key={`${row.id}:${item?.id ?? 'batch'}`} row={row} item={item} command={command} actions={actions} onClose={onClose} />}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ReconciliationDrawerContent({ row, item, command, actions, onClose }: Readonly<{ row: FinanceReconciliation; item: FinanceReconciliationItem | undefined; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions']; onClose: () => void }>) {
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const evidence = item ? reconciliationEvidence(row, item) : [];
  const businessEvidence = evidence.filter((fact) => !fact.technical);
  const technicalEvidence = evidence.filter((fact) => fact.technical);
  const resolution = item ? reconciliationResolution(item) : [];
  const suggestion = item ? reconciliationSuggestion(item) : undefined;
  const timeline = item ? reconciliationTimeline(row, item) : [];
  const copyId = () => {
    if (item === undefined || navigator.clipboard === undefined) return;
    void navigator.clipboard.writeText(item.id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }).catch(() => setCopied(false));
  };
  return (
    <>
      <header className="financedrawerheader">
        <button className="financedrawerback" type="button" onClick={onClose}><FinanceIcon name="arrowLeft" />返回对账列表</button>
        <button className="financedrawerclose" type="button" onClick={onClose} aria-label="关闭差异详情"><FinanceIcon name="close" /></button>
        <div className="financedrawertitle">
          <Heading slot="title">对账差异详情</Heading>
          <div>
            <strong>{chineseReference(item ? '差异记录' : '对账批次', item?.id ?? row.id)}</strong>
            {item === undefined ? null : <button type="button" onClick={copyId} aria-label={copied ? '差异编号已复制' : '复制差异编号'}><FinanceIcon name={copied ? 'check' : 'copy'} /></button>}
          </div>
          <span className="financedrawerbadges"><i>权威对账事实</i><i>{chineseDomainLabel(item?.state ?? row.state)}</i></span>
          <small>第 {row.version} 版 · 批次最后更新于 {formatTime(row.updatedAt)}</small>
        </div>
      </header>
      <div className="financedrawerbody" role="region" aria-label="对账差异事实">
        <section className="financereviewsections">
          <div className="financereviewsection">
            <h3><span>1</span>批次与匹配事实</h3>
            <dl className="financedetailgrid">
              <Detail label="对账状态" value={chineseDomainLabel(row.state)} />
              <Detail label="账期" value={row.period} />
              <Detail label="渠道金额" value={formatMinor(row.debitMinor)} />
              <Detail label="账本金额" value={formatMinor(row.creditMinor)} />
              <Detail label="差异金额" value={formatMinor(row.differenceMinor)} />
              <Detail label="已匹配" value={`${row.itemCounts.matched ?? 0} 笔`} />
              <Detail label="差异明细" value={`${row.itemCounts.difference ?? row.items.length} 笔`} />
              <Detail label="合作方" value={chineseReference('合作方', row.partnerId)} />
              <Detail label="渠道账单" value={chineseReference('渠道账单', row.statementRef)} />
            </dl>
          </div>

          <div className="financereviewsection">
            <h3><span>2</span>差异明细与匹配证据</h3>
            {row.items.length === 0 ? <p className="financereviewempty">本批次没有差异明细，批次事实仍可通过业务审计核验。</p> : (
              <div className="financedifferencepicker" role="list" aria-label="对账差异明细">
                {row.items.map((candidate, index) => (
                  <button key={candidate.id} type="button" role="listitem" data-active={candidate.id === item?.id} aria-current={candidate.id === item?.id ? 'true' : undefined} onClick={() => actions.item(candidate.id)}>
                    <span>明细 {index + 1}</span><strong>{formatMinor(candidate.differenceMinor)}</strong><small>{chineseDomainLabel(candidate.state)}</small>
                  </button>
                ))}
              </div>
            )}
            {item === undefined ? null : <>
              <dl className="financedetailgrid financedifferencefacts">
                <Detail label="外部金额" value={formatMinor(item.externalMinor)} />
                <Detail label="内部金额" value={formatMinor(item.internalMinor)} />
                <Detail label="差异金额" value={formatMinor(item.differenceMinor)} />
                <Detail label="差异原因" value={item.reasonCode ? chineseDomainLabel(item.reasonCode, '其他差异原因') : '未标注'} />
                <Detail label="处理状态" value={chineseDomainLabel(item.state)} />
                <Detail label="处理人" value={item.resolvedBy ? chineseReference('成员', item.resolvedBy) : '尚未提交处理'} />
                <Detail label="复核人" value={item.approvedBy ? chineseReference('成员', item.approvedBy) : '尚未复核'} />
              </dl>
              <Evidence title="匹配证据" facts={businessEvidence} empty="服务端尚未返回可读匹配证据，请先核对渠道原始账单。" />
              {technicalEvidence.length === 0 ? null : <details className="financetechnicalevidence"><summary>查看证据校验信息</summary><Evidence title="技术校验信息" facts={technicalEvidence} /></details>}
              {resolution.length === 0 ? null : <Evidence title="已提交处理依据" facts={resolution} />}
            </>}
          </div>

          {suggestion === undefined ? null : <div className="financereviewsection">
            <h3><span>3</span>处理建议预览</h3>
            <p className="financepreviewnotice">预览只解释建议，不会提交、审批、记账或改变当前状态。</p>
            <button className="financepreviewbutton" type="button" aria-expanded={previewOpen} aria-controls="reconciliationsuggestion" onClick={() => setPreviewOpen((open) => !open)}>{previewOpen ? '收起处理建议' : '预览处理建议'}</button>
            {previewOpen ? <div id="reconciliationsuggestion" className="financesuggestion" role="region" aria-label="处理建议预览"><strong>{suggestion.title}</strong><p>{suggestion.summary}</p><ul>{suggestion.checks.map((check) => <li key={check}><FinanceIcon name="check" />{check}</li>)}</ul></div> : null}
          </div>}

          {item === undefined ? null : <div className="financereviewsection">
            <h3><span>4</span>审批与修复状态轨迹</h3>
            <p className="financetimelinehint">轨迹由当前权威状态投影，不虚构服务端未提供的事件时间。</p>
            <ol className="financetimeline">{timeline.map((step) => <li key={step.key} data-state={step.state}><i aria-hidden="true" /><div><strong>{step.label}</strong><p>{step.detail}</p>{step.actor ? <small>{chineseReference('成员', step.actor)}</small> : null}</div><span>{step.state === 'done' ? '已完成' : step.state === 'current' ? '当前步骤' : '等待中'}</span></li>)}</ol>
          </div>}

          {command.allowed && command.options.length > 0 ? <div className="financereviewsection">
            <h3><span>5</span>安全处置</h3>
            {command.receipt ? <div className="financecommandreceipt"><ActionReceipt state={{ kind: 'success', receipt: command.receipt, objectLabel: '对账批次', impact: '差异处置、审批证据与批次版本已按权威结果更新。' }} dismiss={{ label: '继续处理', onPress: actions.dismissReceipt }} /></div> : (
              <form className="financecommandform" onSubmit={(event) => { event.preventDefault(); actions.submit(); }}>
                <label>处理方式<select value={command.value} onChange={(event) => actions.command(event.target.value as typeof command.value)}>{command.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <label>处理原因<textarea value={command.reason} maxLength={1000} rows={3} onChange={(event) => actions.reason(event.target.value)} placeholder="说明证据、判断依据和预期结果" /></label>
                <label>一次性操作凭证<input type="password" autoComplete="off" value={command.proof} onChange={(event) => actions.proof(event.target.value)} placeholder="完成身份验证后粘贴操作绑定凭证" /></label>
                <label className="financecommandconfirm"><input type="checkbox" checked={command.confirmed} onChange={(event) => actions.confirmed(event.target.checked)} />我已核对批次、所选差异、金额和处理方式；批准人与提交人必须不同。</label>
                {command.error ? <p role="alert">{command.error}</p> : command.validation ? <p>{command.validation}</p> : null}
                <div>{command.assurance < 3 ? <button type="button" onClick={actions.stepup}>进行身份验证</button> : null}<button className="financesubmitreview" type="submit" disabled={command.busy || command.validation !== undefined}>{command.busy ? '正在执行并回读…' : (command.options.find((option) => option.value === command.value)?.label ?? '提交')}</button></div>
              </form>
            )}
          </div> : null}
        </section>
      </div>
      <footer className="financedrawerfooter"><div><button type="button" onClick={onClose}>关闭</button></div></footer>
    </>
  );
}

function Detail({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function Evidence({ title, facts, empty }: Readonly<{ title: string; facts: readonly ReconciliationEvidenceFact[]; empty?: string }>) {
  return <section className="financeevidencegroup" aria-label={title}><h4>{title}</h4>{facts.length === 0 ? <p>{empty ?? '暂无记录'}</p> : <dl className="financeevidence">{facts.map((fact) => <Detail key={fact.key} label={fact.label} value={evidenceValue(fact.value)} />)}</dl>}</section>;
}

function evidenceValue(value: string): string {
  if (value === 'true') return '是';
  if (value === 'false') return '否';
  const date = new Date(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())) return date.toLocaleString('zh-CN', { hour12: false });
  return value.includes(':') && !value.includes('://') ? chineseReference('证据', value) : value;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

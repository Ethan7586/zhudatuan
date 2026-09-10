import { useState } from 'react';
import { chineseReference } from '@shop/presentation';
import { ActionReceipt } from '../../../shared/action/ActionReceipt';
import type { FinanceReconciliation, FinanceReconciliationItem } from '../model/Finance';
import { reconciliationSuggestion, reconciliationTimeline } from '../model/ReconciliationReview';
import type { ReconciliationViewModel } from '../viewmodel/ReconciliationViewModel';
import { FinanceIcon } from './FinanceIcon';

export function ReconciliationActions({
  row,
  item,
  command,
  actions,
}: Readonly<{ row: FinanceReconciliation; item: FinanceReconciliationItem | undefined; command: ReconciliationViewModel['command']; actions: ReconciliationViewModel['actions'] }>) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const suggestion = item ? reconciliationSuggestion(item) : undefined;
  const timeline = item ? reconciliationTimeline(row, item) : [];
  return (
    <>
      {suggestion === undefined ? null : (
        <div className="financereviewsection">
          <h3>
            <span>3</span>处理建议预览
          </h3>
          <p className="financepreviewnotice">预览只解释建议，不会提交、审批、记账或改变当前状态。</p>
          <button className="financepreviewbutton" type="button" aria-expanded={previewOpen} aria-controls="reconciliationsuggestion" onClick={() => setPreviewOpen((open) => !open)}>
            {previewOpen ? '收起处理建议' : '预览处理建议'}
          </button>
          {previewOpen ? (
            <div id="reconciliationsuggestion" className="financesuggestion" role="region" aria-label="处理建议预览">
              <strong>{suggestion.title}</strong>
              <p>{suggestion.summary}</p>
              <ul>
                {suggestion.checks.map((check) => (
                  <li key={check}>
                    <FinanceIcon name="check" />
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {item === undefined ? null : (
        <div className="financereviewsection">
          <h3>
            <span>4</span>审批与修复状态轨迹
          </h3>
          <p className="financetimelinehint">轨迹由当前权威状态投影，不虚构服务端未提供的事件时间。</p>
          <ol className="financetimeline">
            {timeline.map((step) => (
              <li key={step.key} data-state={step.state}>
                <i aria-hidden="true" />
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                  {step.actor ? <small>{chineseReference('成员', step.actor)}</small> : null}
                </div>
                <span>{step.state === 'done' ? '已完成' : step.state === 'current' ? '当前步骤' : '等待中'}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {command.allowed && command.options.length > 0 ? (
        <div className="financereviewsection">
          <h3>
            <span>5</span>安全处置
          </h3>
          {command.receipt ? (
            <div className="financecommandreceipt">
              <ActionReceipt state={{ kind: 'success', receipt: command.receipt, objectLabel: '对账批次', impact: '差异处置、审批证据与批次版本已按权威结果更新。' }} dismiss={{ label: '继续处理', onPress: actions.dismissReceipt }} />
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
                <input type="password" autoComplete="off" value={command.proof} onChange={(event) => actions.proof(event.target.value)} placeholder="完成身份验证后粘贴操作绑定凭证" />
              </label>
              <label className="financecommandconfirm">
                <input type="checkbox" checked={command.confirmed} onChange={(event) => actions.confirmed(event.target.checked)} />
                我已核对批次、所选差异、金额和处理方式；批准人与提交人必须不同。
              </label>
              {command.error ? <p role="alert">{command.error}</p> : command.validation ? <p>{command.validation}</p> : null}
              <div>
                {command.assurance < 3 ? (
                  <button type="button" onClick={actions.stepup}>
                    进行身份验证
                  </button>
                ) : null}
                <button className="financesubmitreview" type="submit" disabled={command.busy || command.validation !== undefined}>
                  {command.busy ? '正在执行并回读…' : (command.options.find((option) => option.value === command.value)?.label ?? '提交')}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </>
  );
}

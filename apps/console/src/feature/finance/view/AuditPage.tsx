import { Button, ResourcePanel } from '@shop/design';
import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import { useState } from 'react';
import { AssurancePrompt } from '../../../entity/session/AssurancePrompt';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { FinanceAuditEvidence, FinanceAuditEvent, FinanceAuditFact } from '../model/Finance';
import type { AuditViewModel } from '../viewmodel/AuditViewModel';
import { FinanceTabs } from './FinanceTabs';
import './FinanceWorkspace.css';

export function AuditPage({ title, model }: Readonly<{ title: string; model: AuditViewModel }>) {
  if (model.needsStepup) return <AssurancePrompt title={title} description="财务证据链包含账本、结算、发票与审计信息。请先完成短信二次验证，成功后会自动返回并加载查询页。" />;
  const data = model.data;
  return (
    <section className="financeprofessionalworkspace financeauditworkspace">
      <FinanceTabs model={model.navigation} />
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('财务管理')}
        description="输入订单号、支付单号、渠道流水号、账单号或财务业务编号，沿同一证据链核对账务、结算、发票和修复。"
        condition={model.condition}
        {...(model.error === undefined ? {} : { error: model.error })}
        retry={model.refresh}
        actions={<AuditSearch model={model} />}
      >
        {model.reference === undefined ? <AuditGuide /> : data === undefined ? null : <AuditResult data={data} />}
      </ResourcePanel>
    </section>
  );
}

function AuditSearch({ model }: Readonly<{ model: AuditViewModel }>) {
  return (
    <form
      className="financeauditsearch"
      role="search"
      aria-label="查询财务证据链"
      onSubmit={(event) => {
        event.preventDefault();
        model.search();
      }}
    >
      <label htmlFor="financeauditreference">业务编号</label>
      <input id="financeauditreference" name="reference" value={model.draft} maxLength={200} autoComplete="off" placeholder="例如：订单号、支付单号或渠道流水号" onChange={(event) => model.setDraft(event.target.value)} />
      <Button type="submit" tone="primary" isDisabled={model.draft.trim().length === 0}>
        查询证据链
      </Button>
      {model.reference === undefined ? null : <Button onPress={model.clear}>清除</Button>}
    </form>
  );
}

function AuditGuide() {
  return (
    <div className="financeauditguide" role="note">
      <strong>从一个业务编号开始</strong>
      <span>系统只查询当前授权范围，并按发生顺序关联来源事件、不可变分录、对账、结算、提现、发票、修复和审计记录。</span>
    </div>
  );
}

function AuditResult({ data }: Readonly<{ data: NonNullable<AuditViewModel['data']> }>) {
  return (
    <div className="financeauditresult">
      <header className="financeauditsummary">
        <div>
          <span>查询编号</span>
          <strong>{chineseReference('业务', data.reference)}</strong>
        </div>
        <div>
          <span>关联事实</span>
          <strong>{data.facts.length.toLocaleString('zh-CN')} 条</strong>
        </div>
        <div>
          <span>来源事件</span>
          <strong>{data.events.length.toLocaleString('zh-CN')} 条</strong>
        </div>
        <div>
          <span>审计证据</span>
          <strong>{data.records.length.toLocaleString('zh-CN')} 条</strong>
        </div>
        <div>
          <span>证据水位</span>
          <strong>{formatDate(data.watermark)}</strong>
        </div>
      </header>
      <AuditFacts facts={data.facts} />
      <AuditEvents events={data.events} />
      <AuditRecords records={data.records} />
    </div>
  );
}

function AuditFacts({ facts }: Readonly<{ facts: readonly FinanceAuditFact[] }>) {
  return (
    <section className="financeauditsection" aria-labelledby="financeauditfacts">
      <header>
        <h2 id="financeauditfacts">业务事实链</h2>
        <p>金额和状态来自各自权威业务表；页面不补算、不改写。</p>
      </header>
      <ol className="financeaudittimeline">
        {facts.map((fact) => (
          <li key={`${fact.kind}:${fact.id}`}>
            <i aria-hidden="true" />
            <article>
              <header>
                <div>
                  <span>{kindLabel(fact.kind)}</span>
                  <strong>{fact.label}</strong>
                </div>
                <time dateTime={fact.occurredAt ?? undefined}>{formatDate(fact.occurredAt)}</time>
              </header>
              <dl>
                <div>
                  <dt>业务编号</dt>
                  <dd>{chineseReference(kindLabel(fact.kind), fact.businessReference)}</dd>
                </div>
                <div>
                  <dt>状态</dt>
                  <dd>{fact.state === null ? '不适用' : chineseDomainLabel(fact.state)}</dd>
                </div>
                <div>
                  <dt>金额</dt>
                  <dd>{fact.amountMinor === null || fact.currency === null ? '不适用' : formatMinor(fact.amountMinor, fact.currency)}</dd>
                </div>
                <div>
                  <dt>版本</dt>
                  <dd>{fact.version === null ? '不可变记录' : `第 ${fact.version} 版`}</dd>
                </div>
              </dl>
              <TechnicalDetails title="查看事实技术信息" values={{ resourceId: fact.id, resourceType: fact.kind }} trace={null} />
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}

function AuditEvents({ events }: Readonly<{ events: readonly FinanceAuditEvent[] }>) {
  return (
    <section className="financeauditsection" aria-labelledby="financeauditevents">
      <header>
        <h2 id="financeauditevents">来源事件</h2>
        <p>展示事实写入后形成的事件信封和投递终态，不展示事件正文中的敏感字段。</p>
      </header>
      {events.length === 0 ? (
        <p className="financeauditempty">当前热存储中没有可关联的来源事件；业务事实仍然有效。</p>
      ) : (
        <ol className="financeauditcards">
          {events.map((event) => (
            <li key={event.id}>
              <header>
                <strong>{eventLabel(event.type)}</strong>
                <span className={`financeauditeventstate state-${event.state}`}>{eventState(event.state)}</span>
              </header>
              <p>
                {formatDate(event.occurredAt)} · 第 {event.eventVersion} 版事件
              </p>
              <TechnicalDetails title="查看事件技术信息" values={{ eventId: event.id, eventType: event.type, aggregateType: event.aggregateType, aggregateId: event.aggregateId }} trace={event.traceId} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AuditRecords({ records }: Readonly<{ records: readonly FinanceAuditEvidence[] }>) {
  return (
    <section className="financeauditsection" aria-labelledby="financeauditrecords">
      <header>
        <h2 id="financeauditrecords">不可变审计证据</h2>
        <p>命令与访问记录按证据时间倒序展示，哈希用于验证记录链完整性。</p>
      </header>
      {records.length === 0 ? (
        <p className="financeauditempty">当前热存储中没有关联审计记录；归档证据需由审计中心按保留策略读取。</p>
      ) : (
        <ol className="financeauditcards">
          {records.map((record) => (
            <li key={record.id}>
              <header>
                <strong>{record.kind === 'command' ? '业务操作证据' : '数据访问证据'}</strong>
                <span>{chineseDomainLabel(record.action)}</span>
              </header>
              <p>
                {formatDate(record.occurredAt)} · {actorLabel(record.actorType)}
              </p>
              <TechnicalDetails
                title="查看审计技术信息"
                values={{
                  auditId: record.id,
                  action: record.action,
                  resourceType: record.resourceType,
                  resourceId: record.resourceId,
                  actorId: record.actorId,
                  beforeHash: record.beforeHash,
                  afterHash: record.afterHash,
                  recordHash: record.recordHash,
                  evidence: record.evidence,
                }}
                trace={record.traceId}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function TechnicalDetails({ title, values, trace }: Readonly<{ title: string; values: Readonly<Record<string, unknown>>; trace: string | null }>) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (trace === null || navigator.clipboard === undefined) return;
    void navigator.clipboard
      .writeText(trace)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => setCopied(false));
  };
  return (
    <details className="financeaudittechnical">
      <summary>{title}</summary>
      {trace === null ? null : (
        <div className="financeaudittrace">
          <code>{trace}</code>
          <button type="button" onClick={copy}>
            {copied ? '已复制' : '复制追踪编号'}
          </button>
          <span className="sr-only" aria-live="polite">
            {copied ? '追踪编号已复制' : ''}
          </span>
        </div>
      )}
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </details>
  );
}

function kindLabel(kind: FinanceAuditFact['kind']): string {
  return ({ journal: '账本凭证', entry: '会计分录', statement: '账单', reconciliation: '对账', settlement: '结算', withdrawal: '提现', invoice: '发票', repair: '修复' } as const)[kind];
}

function eventState(state: FinanceAuditEvent['state']): string {
  return ({ pending: '等待投递', published: '已投递', failed: '投递失败' } as const)[state];
}

function eventLabel(type: string): string {
  const labels: Readonly<Record<string, string>> = {
    'finance.entry.posted': '账务分录已入账',
    'finance.reconciliation.difference': '对账差异已生成',
    'finance.settlement.approved': '结算单已复核',
    'finance.withdrawal.paid': '提现已支付',
    'finance.withdrawal.uncertain': '提现结果待核实',
    'invoice.issued': '发票已开具',
    'invoice.red.issued': '红字发票已开具',
  };
  return labels[type] ?? '财务来源事件';
}

function actorLabel(actorType: string): string {
  return actorType === 'system' ? '系统自动记录' : actorType === 'service' ? '服务自动记录' : '已授权操作人';
}

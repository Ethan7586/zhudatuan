import type { FinanceAuditPage, FinanceAuditRecord, FinancePolicy, FinancePolicyPage } from './FinanceAuthoritySchema';
import { FinanceIcon } from './FinanceIcon';

export function PolicyTable({ page }: Readonly<{ page: FinancePolicyPage }>) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard focus is required for the horizontally scrollable table region.
    <div className="financetablewrap financeauthoritytablewrap" tabIndex={0} aria-label="对账规则表格横向滚动区域">
      <table className="financetable financeauthoritytable">
        <caption className="sr-only">对账规则</caption>
        <thead>
          <tr>
            <th>规则 / 类型</th>
            <th>所属范围</th>
            <th>规则摘要（服务端 JSON）</th>
            <th>状态</th>
            <th>版本</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((policy) => (
            <PolicyRow key={policy.id} policy={policy} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyRow({ policy }: Readonly<{ policy: FinancePolicy }>) {
  return (
    <tr>
      <td>
        <span className="financecellpair">
          <strong>{policy.id}</strong>
          <small>{policy.kind}</small>
        </span>
      </td>
      <td>{policy.scope_id}</td>
      <td className="financejsoncell">
        <code>{JSON.stringify(policy.rule)}</code>
      </td>
      <td>
        <span className="financereadstate" data-state={policy.state}>
          {policy.state}
        </span>
      </td>
      <td>v{policy.version}</td>
      <td>
        <button type="button" className="financeviewbutton" disabled aria-label={`编辑规则 ${policy.id}（未启用）`}>
          未启用
        </button>
      </td>
    </tr>
  );
}

export function AuditTable({ page }: Readonly<{ page: FinanceAuditPage }>) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard focus is required for the horizontally scrollable table region.
    <div className="financetablewrap financeauthoritytablewrap" tabIndex={0} aria-label="审计记录表格横向滚动区域">
      <table className="financetable financeauthoritytable financeaudittable">
        <caption className="sr-only">审计记录</caption>
        <thead>
          <tr>
            <th>记录时间</th>
            <th>动作 / Actor</th>
            <th>资源 / 范围</th>
            <th>对象哈希</th>
            <th>审计链</th>
            <th>Evidence / Trace</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {page.items.map((record) => (
            <AuditRow key={record.id} record={record} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditRow({ record }: Readonly<{ record: FinanceAuditRecord }>) {
  return (
    <tr>
      <td>
        <span className="financecellpair">
          <time dateTime={record.recorded_at}>{formatRecordedAt(record.recorded_at)}</time>
          <small>{record.id}</small>
        </span>
      </td>
      <td>
        <span className="financecellpair">
          <strong>{record.action}</strong>
          <small>
            {record.actor_type} · {record.actor_id ?? 'system'}
          </small>
        </span>
      </td>
      <td>
        <span className="financecellpair">
          <strong>
            {record.resource_type}:{record.resource_id ?? '—'}
          </strong>
          <small>{record.scope_id}</small>
        </span>
      </td>
      <td className="financehashcell">
        <HashPair firstLabel="before" first={record.before_hash} secondLabel="after" second={record.after_hash} />
      </td>
      <td className="financehashcell">
        <HashPair firstLabel="previous" first={record.previous_hash} secondLabel="record" second={record.record_hash} />
      </td>
      <td className="financejsoncell">
        <span className="financecellpair">
          <code>{JSON.stringify(record.evidence)}</code>
          <small>trace · {record.trace_id}</small>
        </span>
      </td>
      <td>
        <button type="button" className="financeviewbutton" disabled aria-label={`审计记录 ${record.id} 不可变`}>
          不可变
        </button>
      </td>
    </tr>
  );
}

function HashPair({ firstLabel, first, secondLabel, second }: Readonly<{ firstLabel: string; first: string | null; secondLabel: string; second: string | null }>) {
  return (
    <span className="financehashpair">
      <span>
        {firstLabel} · <code>{first ?? 'GENESIS / NONE'}</code>
      </span>
      <span>
        {secondLabel} · <code>{second ?? 'NONE'}</code>
      </span>
    </span>
  );
}

export function AuthorityPagination({ page, limit, onLimit, onCursor }: Readonly<{ page: FinancePolicyPage | FinanceAuditPage; limit: number; onLimit: (limit: number) => void; onCursor: (cursor?: string) => void }>) {
  const preview = page.preview?.source === 'local-preview' ? page.preview : undefined;
  const start = preview === undefined || page.count === 0 ? undefined : (preview.page - 1) * limit + 1;
  const end = start === undefined ? undefined : start + page.count - 1;
  return (
    <footer className="financepagination">
      <span>{preview === undefined ? `本页 ${page.count} 条` : `${start}–${end} / 共 ${preview.total} 条`}</span>
      <label>
        每页{' '}
        <select value={limit} onChange={(event) => onLimit(Number(event.target.value))}>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </label>
      <div>
        <button type="button" aria-label="上一页" disabled={preview?.previousCursor === undefined} onClick={() => onCursor(preview?.previousCursor)}>
          <FinanceIcon name="arrowLeft" />
        </button>
        <span aria-label={`第 ${preview?.page ?? 1} 页`}>{preview?.page ?? 1}</span>
        <button type="button" aria-label="下一页" disabled={page.nextCursor === undefined} onClick={() => onCursor(page.nextCursor)}>
          <FinanceIcon name="arrowRight" />
        </button>
      </div>
    </footer>
  );
}

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

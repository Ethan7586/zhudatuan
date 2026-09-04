import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { financeAuditKey, financePoliciesKey, readFinanceAudit, readFinancePolicies, type FinanceAuthorityQuery } from './FinanceAuthorityQuery';
import { AuditTable, AuthorityPagination } from './FinanceAuthorityTables';
import { FinanceIcon } from './FinanceIcon';
import { financePolicyWritesAvailable } from './FinancePolicyCommand';
import { FinancePolicyEditor } from './FinancePolicyEditor';

export function FinanceAuthorityTab({
  context,
  tab,
  queryInput,
  previewContext,
  onLimit,
  onCursor,
}: Readonly<{
  context: ConsoleContext;
  tab: 'rules' | 'audit';
  queryInput: FinanceAuthorityQuery;
  previewContext: boolean;
  onLimit: (limit: number) => void;
  onCursor: (cursor?: string) => void;
}>) {
  return tab === 'rules' ? (
    <PolicyTab context={context} queryInput={queryInput} previewContext={previewContext} onLimit={onLimit} onCursor={onCursor} />
  ) : (
    <AuditTab context={context} queryInput={queryInput} previewContext={previewContext} onLimit={onLimit} onCursor={onCursor} />
  );
}

function PolicyTab({ context, queryInput, previewContext, onLimit, onCursor }: AuthorityTabProps) {
  const writesAvailable = !previewContext && financePolicyWritesAvailable(context);
  const query = useQuery({
    queryKey: financePoliciesKey(context, queryInput),
    queryFn: ({ signal }) => readFinancePolicies(context, queryInput, signal),
  });
  return (
    <AuthoritySurface
      title="对账规则"
      description="读取当前范围内服务端生效或留存的对账、税务与字段策略；正式变更必须通过 Preview、Level 3、动作证明及四眼审批。"
      actionLabel={writesAvailable ? '权威工作流已启用' : '当前会话只读'}
      preview={previewContext && query.data?.preview?.source === 'local-preview'}
      productionMessage={
        writesAvailable
          ? '当前会话已具备 typed preview/manage 权限；所有写动作仍须逐次完成 Level 3、action-bound proof、expectedVersion、四眼审批与权威回读。'
          : '当前页面只展示通过 Zod 校验的服务端响应；没有演示 fallback，缺少 manage 权限、capability 或 CSRF 时所有写动作保持关闭。'
      }
    >
      <AuthorityQueryState
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
        noun="对账规则"
        retry={() => {
          void query.refetch();
        }}
      />
      {query.data === undefined || query.data.items.length === 0 ? null : (
        <FinancePolicyEditor context={context} page={query.data} previewContext={previewContext} limit={queryInput.limit} onLimit={onLimit} onCursor={onCursor} onAuthoritativeRefresh={async () => query.refetch()} />
      )}
    </AuthoritySurface>
  );
}

function AuditTab({ context, queryInput, previewContext, onLimit, onCursor }: AuthorityTabProps) {
  const query = useQuery({
    queryKey: financeAuditKey(context, queryInput),
    queryFn: ({ signal }) => readFinanceAudit(context, queryInput, signal),
  });
  return (
    <AuthoritySurface title="审计记录" description="逐条展示服务端财务与发票审计记录及哈希链字段；浏览器不拼接、不验证或推断整条链。" actionLabel="变更审计记录" preview={previewContext && query.data?.preview?.source === 'local-preview'}>
      <AuthorityQueryState
        pending={query.isPending}
        error={query.error}
        empty={query.data?.items.length === 0}
        noun="审计记录"
        retry={() => {
          void query.refetch();
        }}
      />
      {query.data === undefined || query.data.items.length === 0 ? null : <AuditTable page={query.data} />}
      {query.data === undefined || query.data.items.length === 0 ? null : <AuthorityPagination page={query.data} limit={queryInput.limit} onLimit={onLimit} onCursor={onCursor} />}
    </AuthoritySurface>
  );
}

interface AuthorityTabProps {
  readonly context: ConsoleContext;
  readonly queryInput: FinanceAuthorityQuery;
  readonly previewContext: boolean;
  readonly onLimit: (limit: number) => void;
  readonly onCursor: (cursor?: string) => void;
}

function AuthoritySurface({ title, description, actionLabel, preview, productionMessage, children }: Readonly<{ title: string; description: string; actionLabel: string; preview: boolean; productionMessage?: string; children: ReactNode }>) {
  return (
    <section className="financeauthority" aria-labelledby={`financeauthority-${title}`}>
      <header className="financeauthorityheader">
        <div>
          <p>AUTHORITATIVE READ MODEL</p>
          <h2 id={`financeauthority-${title}`}>{title}</h2>
          <span>{description}</span>
        </div>
        <button type="button" disabled aria-disabled="true">
          {actionLabel}
        </button>
      </header>
      {preview ? (
        <p className="financepreviewboundary" role="status">
          <FinanceIcon name="shield" />
          LOCAL PREVIEW FIXTURE · 仅用于本地视觉回归，与生产权威数据路径隔离
        </p>
      ) : (
        <p className="financeproductionboundary">
          <FinanceIcon name="shield" />
          {productionMessage ?? '当前页面只展示通过 Zod 校验的服务端响应；没有演示 fallback，所有写动作保持关闭。'}
        </p>
      )}
      {children}
    </section>
  );
}

function AuthorityQueryState({ pending, error, empty, noun, retry }: Readonly<{ pending: boolean; error: Error | null; empty: boolean; noun: string; retry: () => void }>) {
  if (pending) {
    return (
      <div className="financequerystate" role="status">
        正在读取{noun}权威快照…
      </div>
    );
  }
  if (error !== null && error !== undefined) {
    return (
      <div className="financequerystate iserror" role="alert">
        <strong>{noun}读取失败</strong>
        <p>{safeQueryError(error)}</p>
        <button type="button" onClick={retry}>
          重试
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="financequerystate" role="status">
        当前范围没有{noun}。
      </div>
    );
  }
  return null;
}

import { queryCondition, hasFailureCode, safeQueryError } from '@shop/presentation';
import { ResourcePanel } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import type { OperationId } from '@shop/contract';
import type { ReactNode } from 'react';

import { useConsoleContext } from '../session/ConsoleContext';
import type { ConsoleContext } from '../session/ConsoleSession';
import { AssurancePrompt } from '../session/AssurancePrompt';
import { useRouteTitle } from '../../shared/ui/RouteTitle';

export function OperationPage({
  operation,
  title,
  description,
  load,
  render,
}: Readonly<{
  operation: OperationId;
  title: string;
  description: string;
  load: (context: ConsoleContext, signal: AbortSignal) => Promise<unknown>;
  render?: (value: unknown) => ReactNode;
}>) {
  const context = useConsoleContext();
  const routeTitle = useRouteTitle(title);
  const query = useQuery({ queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, operation], queryFn: ({ signal }) => load(context, signal) });
  if (hasFailureCode(query.error, 'STEPUP_REQUIRED')) {
    return <AssurancePrompt title={routeTitle} />;
  }
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data === undefined });
  return (
    <ResourcePanel
      eyebrow={operation}
      title={routeTitle}
      description={description}
      condition={condition}
      {...(error === undefined ? {} : { error })}
      retry={() => {
        void query.refetch();
      }}
    >
      {query.data === undefined ? null : (render?.(query.data) ?? <PayloadSummary value={query.data} />)}
    </ResourcePanel>
  );
}

function PayloadSummary({ value }: Readonly<{ value: unknown }>) {
  const count = record(value)?.items;
  return (
    <section className="featurestack">
      <h2>权威服务响应</h2>
      <p>{Array.isArray(count) ? `当前页 ${count.length} 条记录` : '数据已通过Contract v2校验并加载。'}</p>
    </section>
  );
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

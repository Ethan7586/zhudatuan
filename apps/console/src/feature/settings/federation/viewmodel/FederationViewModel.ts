import { OP_IDENTITY_PROVIDERS_CENTER_READ, OP_IDENTITY_PROVIDERS_TEST } from '@shop/contract/ids';
import { queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { FederationDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { FederationHealth } from '../model/Federation';

export function useFederationViewModel(context: ConsoleContext, dependencies: FederationDependencies, requestStepup: () => void) {
  const query = useQuery({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_IDENTITY_PROVIDERS_CENTER_READ] as const),
    queryFn: ({ signal }) => dependencies.read.execute(context, signal),
  });
  const [health, setHealth] = useState<Readonly<Record<string, FederationHealth>>>({});
  const [testing, setTesting] = useState<string>();
  const test = useMutation({
    mutationFn: ({ provider, identity }: Readonly<{ provider: string; identity: string }>) => dependencies.test.execute(context, provider, identity),
    onMutate: ({ provider }) => setTesting(provider),
    onSuccess: (value) => setHealth((current) => Object.freeze({ ...current, [value.provider]: value })),
    onSettled: () => setTesting(undefined),
  });
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => void query.refetch(),
        test: (provider: string) => {
          if (!test.isPending) test.mutate({ provider, identity: dependencies.createIdentity() });
        },
        stepup: requestStepup,
      }),
    [dependencies, query, requestStepup, test]
  );
  const data = query.data;
  return Object.freeze({
    data,
    health,
    testing,
    assurance: context.session.assurance.level,
    canTest: canUseOperation(context, OP_IDENTITY_PROVIDERS_TEST),
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: data?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    testError: safeQueryError(test.error),
    actions,
  });
}
export type FederationViewModel = ReturnType<typeof useFederationViewModel>;

import { OP_CHANNEL_DISTRIBUTORS_READ, OP_ORGANIZATION_LAYERS_READ, OP_RUNTIME_HEALTH_DEPENDENCY } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { CONTROL_PAGE_LIMIT, controlKind } from '../model/Control';

const operations = Object.freeze({ platform: OP_ORGANIZATION_LAYERS_READ, distribution: OP_CHANNEL_DISTRIBUTORS_READ, runtime: OP_RUNTIME_HEALTH_DEPENDENCY });

export function controlQueryKey(context: ConsoleContext, cursor?: string) {
  const kind = controlKind(context.scope.kind);
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, operations[kind], kind === 'runtime' ? null : (cursor ?? null), kind === 'runtime' ? null : CONTROL_PAGE_LIMIT] as const);
}

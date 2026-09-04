import type { AccessDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessChange } from '../model/Access';

export interface AccessMutation {
  readonly change: AccessChange;
  readonly proof: string;
  readonly identity: string;
}

export function executeAccess(dependencies: AccessDependencies, context: ConsoleContext, input: AccessMutation) {
  if (input.change.kind === 'role') return dependencies.role.execute(context, input.change, input.proof, input.identity);
  if (input.change.kind === 'override') return dependencies.override.execute(context, input.change, input.proof, input.identity);
  if (input.change.kind === 'scope') return dependencies.scope.execute(context, input.change, input.proof, input.identity);
  return dependencies.owner.execute(context, input.change, input.proof, input.identity);
}

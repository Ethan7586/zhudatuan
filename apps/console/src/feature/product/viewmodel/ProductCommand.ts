import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ProductCommand } from '../public';

export function productCommand(context: ConsoleContext, identity: string): ProductCommand {
  return Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, identity, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) });
}

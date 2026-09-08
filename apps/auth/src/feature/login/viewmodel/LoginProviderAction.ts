import type { Dependencies } from '../../../app/Dependencies';
import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { Provider } from '../../federation';
import type { useLoginCommand } from './LoginCommandViewModel';

export function startLoginProvider(
  provider: Provider,
  validateTerms: () => boolean,
  command: ReturnType<typeof useLoginCommand>,
  dependencies: Dependencies,
  session: SessionRequest
): void {
  if (!validateTerms()) return;
  const operation = command.start();
  if (operation === undefined) return;
  void dependencies.federationView.start(provider.id, session, operation.signal).then(
    ({ redirectUrl }) => dependencies.navigation.assignExternal(redirectUrl),
    (cause: unknown) => command.fail(operation.command, cause)
  );
}

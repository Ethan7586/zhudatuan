import type { AuthEnvironment } from '../../../config/Environment';
import type { IdentitySdk } from '../../../shared/api/Client';
import { commandContext } from '../../../shared/api/Context';
import type { BootstrapPort } from '../../bootstrap/public/BootstrapPort';
import type { Recovery } from '../model/Recovery';
import type { RecoveryPort } from '../public/RecoveryPort';

export class RecoveryGateway implements RecoveryPort {
  constructor(
    private readonly sdk: IdentitySdk,
    private readonly environment: AuthEnvironment,
    private readonly bootstrap: BootstrapPort
  ) {}
  async reset(input: Recovery, signal?: AbortSignal): Promise<void> {
    const state = await this.bootstrap.read('storefront', {}, signal);
    await this.sdk.passwordReset({ body: { challenge: input.challenge, code: input.code.trim(), newPassword: input.password } }, commandContext(this.environment, 'storefront', state.csrf, signal));
  }
}

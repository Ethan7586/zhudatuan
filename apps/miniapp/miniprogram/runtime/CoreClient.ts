import { ApiClient, WechatTransport, type OperationExecutor } from '@shop/sdk';
import {
  bindBootstrapRead as bindIdentityBootstrapRead,
  bindFederationsCallback,
  bindFederationsComplete,
  bindFederationsSelectionRead,
  bindFederationsStart,
  bindProvidersRead,
  bindSessionDelete,
  bindSessionRead,
} from '@shop/sdk/identity';
import { bindBootstrapRead as bindStorefrontBootstrapRead } from '@shop/sdk/storefront';
import type { MiniappRuntimeEnvironment } from '../config/Environment';
import type { CookieJar } from '../platform/CookieJar';
import { createWechatRequester } from '../platform/Request';

export interface MiniappCoreClient {
  readonly identity: Readonly<{
    sessionRead: ReturnType<typeof bindSessionRead>;
    sessionDelete: ReturnType<typeof bindSessionDelete>;
    bootstrapRead: ReturnType<typeof bindIdentityBootstrapRead>;
    providersRead: ReturnType<typeof bindProvidersRead>;
    federationsStart: ReturnType<typeof bindFederationsStart>;
    federationsCallback: ReturnType<typeof bindFederationsCallback>;
    federationsSelectionRead: ReturnType<typeof bindFederationsSelectionRead>;
    federationsComplete: ReturnType<typeof bindFederationsComplete>;
  }>;
  readonly storefront: Readonly<{ bootstrapRead: ReturnType<typeof bindStorefrontBootstrapRead> }>;
}

export function createMiniappCore(environment: MiniappRuntimeEnvironment, cookies: CookieJar): Readonly<{ client: MiniappCoreClient; executor: OperationExecutor }> {
  const executor = new ApiClient(environment.apiOrigin, new WechatTransport(createWechatRequester(environment.ownOrigin, cookies)));
  return Object.freeze({
    executor,
    client: Object.freeze({
      identity: Object.freeze({
        sessionRead: bindSessionRead(executor), sessionDelete: bindSessionDelete(executor), bootstrapRead: bindIdentityBootstrapRead(executor),
        providersRead: bindProvidersRead(executor), federationsStart: bindFederationsStart(executor), federationsCallback: bindFederationsCallback(executor),
        federationsSelectionRead: bindFederationsSelectionRead(executor), federationsComplete: bindFederationsComplete(executor),
      }),
      storefront: Object.freeze({ bootstrapRead: bindStorefrontBootstrapRead(executor) }),
    }),
  });
}

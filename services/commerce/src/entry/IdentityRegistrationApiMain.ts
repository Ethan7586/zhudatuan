import {
  identityRegistrationApiAllowedOrigins,
  identityRegistrationApiEnvironment,
  identityRegistrationApiPort,
} from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { createIdentityRegistrationApiRuntime } from '../bootstrap/IdentityRegistrationApiRuntime';
import { listen } from '../foundation/interface/NodeServer';
import { ACCESS_OPERATOR_READ_OPERATION_IDS } from '../modules/access/AccessReadOperations';
import { IdentityOperatorAccessModule } from '../modules/access/IdentityOperatorAccessModule';
import { IDENTITY_REGISTRATION_OPERATION_IDS } from '../modules/identity/IdentityOperations';
import { IdentityRegistrationModule } from '../modules/identity/IdentityRegistrationModule';
import { IdentityOperatorMemberModule } from '../modules/member/IdentityOperatorMemberModule';
import { MEMBER_OPERATOR_READ_OPERATION_IDS } from '../modules/member/MemberReadOperations';
import { IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS } from '../modules/runtime/IdentityRegistrationRuntimeOperations';
import { IdentityRegistrationRuntimeModule } from '../modules/runtime/IdentityRegistrationRuntimeModule';

const environment = identityRegistrationApiEnvironment();
const runtime = await createIdentityRegistrationApiRuntime(environment);
const operationIds = Object.freeze([
  ...IDENTITY_REGISTRATION_RUNTIME_OPERATION_IDS,
  ...IDENTITY_REGISTRATION_OPERATION_IDS,
  ...MEMBER_OPERATOR_READ_OPERATION_IDS,
  ...ACCESS_OPERATOR_READ_OPERATION_IDS,
]);
const bootstrapped = await bootstrapApi({
  modules: [IdentityRegistrationRuntimeModule, IdentityRegistrationModule, IdentityOperatorMemberModule, IdentityOperatorAccessModule],
  operationIds,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: identityRegistrationApiAllowedOrigins(environment),
  telemetry: runtime.telemetry,
});
const server = listen(bootstrapped.app, identityRegistrationApiPort(environment), '127.0.0.1');

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});

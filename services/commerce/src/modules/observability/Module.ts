import { defineModule } from '../../bootstrap/DefinedModule';
import { TELEMETRY } from '../../foundation/telemetry/Telemetry';
import { ClientErrorsCreateHandler } from './application/handler/ClientErrorsCreateHandler';
import { ClientErrorsReadHandler } from './application/handler/ClientErrorsReadHandler';
import { TelemetryClientErrorRepository } from './infrastructure/persistence/TelemetryClientErrorRepository';
import { Manifest } from './Manifest';

export const ObservabilityModule = defineModule(Manifest, {
  handlers: (context) => {
    const errors = new TelemetryClientErrorRepository(context.service(TELEMETRY));
    return [new ClientErrorsCreateHandler(errors), new ClientErrorsReadHandler(errors)];
  },
});

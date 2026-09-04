import { defineModule } from '../../bootstrap/DefinedModule';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { OBSERVATIONS, TELEMETRY } from '../../foundation/telemetry/Telemetry';
import { ClientErrorsCreateHandler } from './application/handler/ClientErrorsCreateHandler';
import { ClientErrorsReadHandler } from './application/handler/ClientErrorsReadHandler';
import { HealthOverviewHandler } from './application/handler/HealthOverviewHandler';
import { SloReadHandler } from './application/handler/SloReadHandler';
import { LOG_SINK } from './application/port/LogSink';
import { METRIC_SINK } from './application/port/MetricSink';
import { TRACE_SINK } from './application/port/TraceSink';
import { OBSERVATION_REGISTRY } from './infrastructure/registry/TelemetryCatalog';
import { TelemetryClientErrorRepository } from './infrastructure/persistence/TelemetryClientErrorRepository';
import { TelemetryOperationalReader } from './infrastructure/persistence/TelemetryOperationalReader';
import { Manifest } from './Manifest';
import { OBSERVABILITY_CATALOG_PORT, OBSERVABILITY_LOG_PORT, OBSERVABILITY_METRIC_PORT, OBSERVABILITY_TRACE_PORT } from './public';

function observabilityPorts(context: ModuleContext) {
  return [
    { token: OBSERVABILITY_METRIC_PORT, value: context.service(METRIC_SINK) },
    { token: OBSERVABILITY_TRACE_PORT, value: context.service(TRACE_SINK) },
    { token: OBSERVABILITY_LOG_PORT, value: context.service(LOG_SINK) },
    { token: OBSERVABILITY_CATALOG_PORT, value: OBSERVATION_REGISTRY.catalog() },
  ];
}

export const ObservabilityModule = defineModule(Manifest, {
  ports: observabilityPorts,
  jobPorts: observabilityPorts,
  providerPorts: observabilityPorts,
  handlers: (context) => {
    const errors = new TelemetryClientErrorRepository(context.service(TELEMETRY));
    const operations = new TelemetryOperationalReader(context.service(OBSERVATIONS), OBSERVATION_REGISTRY);
    return [new ClientErrorsCreateHandler(errors), new ClientErrorsReadHandler(errors), new HealthOverviewHandler(operations), new SloReadHandler(operations)];
  },
});

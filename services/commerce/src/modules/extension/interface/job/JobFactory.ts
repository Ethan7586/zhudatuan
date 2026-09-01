import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { ProviderMetrics } from '../../../../foundation/telemetry/ProviderMetrics';
import { TELEMETRY } from '../../../../foundation/telemetry/Telemetry';
import { EXTENSION_LOADER } from '../../application/port/ExtensionLoader';
import { extensionHealthRepository } from '../../infrastructure/persistence/ExtensionHealthRepository';
import { EXTENSION_STATE_PORT } from '../../../channel/public';
import { MonitorExtensions } from '../../application/process/MonitorExtensions';
import { ExtensionHealthJob } from './ExtensionHealthJob';

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([
    {
      id: 'extensionhealth',
      processor: new ExtensionHealthJob(
        new MonitorExtensions(
          new PgTransactionManager(context.service(DATABASE_POOL)),
          extensionHealthRepository(),
          context.service(EXTENSION_LOADER),
          context.ports.get(EXTENSION_STATE_PORT),
          new ProviderMetrics(context.service(TELEMETRY))
        )
      ),
    },
  ]);
}
import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';

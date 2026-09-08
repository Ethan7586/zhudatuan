import type { ModuleContext } from '../../../../composition/ModuleRegistry';
import type { ModuleJob } from '../../../../pipeline/ModuleJob';
import { DATABASE_POOL } from '../../../../platform/database/Pool';
import { ProviderMetrics } from '../../../../platform/telemetry/ProviderMetrics';
import { TELEMETRY } from '../../../../platform/telemetry/Telemetry';
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
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';

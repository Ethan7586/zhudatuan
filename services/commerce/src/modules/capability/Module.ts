import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { CapabilityPort } from './infrastructure/persistence/CapabilityPort';
import { CHANNEL_CAPABILITY_PORT } from './public/index';
import { NAVIGATION_CAPABILITY_PORT } from './public/NavigationCapabilityPort';
import { PgNavigationCapability } from './infrastructure/persistence/PgNavigationCapability';
import { CAPABILITY_READINESS_PORT } from './public/ReadinessPort';
import { PgCapabilityReadiness } from './infrastructure/persistence/PgCapabilityReadiness';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { AssignmentsReadHandler } from './application/handler/AssignmentsReadHandler';
import { AssignmentsManageHandler } from './application/handler/AssignmentsManageHandler';
import { PgAssignmentRepository } from './infrastructure/persistence/PgAssignmentRepository';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { ManageEntitlement } from './application/service/ManageEntitlement';
export const CapabilityModule = defineModule(Manifest, {
  handlers: (context) => {
    const assignments = new PgAssignmentRepository(new PgTransactionAccess());
    const organizations = context.ports.get(ORGANIZATION_READ_PORT);
    return [new AssignmentsReadHandler(assignments, organizations), new AssignmentsManageHandler(new ManageEntitlement(organizations, assignments))];
  },
  ports: (context) => [
    {
      token: CHANNEL_CAPABILITY_PORT,
      value: new CapabilityPort(new ManageEntitlement(context.ports.get(ORGANIZATION_READ_PORT), new PgAssignmentRepository(new PgTransactionAccess()))),
    },
    { token: NAVIGATION_CAPABILITY_PORT, value: new PgNavigationCapability() },
    { token: CAPABILITY_READINESS_PORT, value: new PgCapabilityReadiness(new PgTransactionAccess()) },
  ],
});

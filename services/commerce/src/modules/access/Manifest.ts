import { defineModuleManifest } from '../../bootstrap/ModuleManifest';
import { ACTION_PROOF_PORT, AUTHORIZATION_PORT, IDENTITY_ACCESS_PORT, INVITATION_ACCESS_PORT, MEMBER_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT, MEMBERSHIP_READ_PORT, NAVIGATION_ACCESS_PORT, TASK_AUTHORIZATION_PORT } from './public';

export const Manifest = defineModuleManifest({
  id: 'access',
  dependencies: ['organization', 'partner'],
  services: ['database.pool', 'audit.sink'],
  ports: [IDENTITY_ACCESS_PORT, MEMBER_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT, MEMBERSHIP_READ_PORT, NAVIGATION_ACCESS_PORT, INVITATION_ACCESS_PORT, AUTHORIZATION_PORT, TASK_AUTHORIZATION_PORT, ACTION_PROOF_PORT],
  workloads: { jobs: { services: ['database.pool'], ports: [IDENTITY_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT, TASK_AUTHORIZATION_PORT] } },
});

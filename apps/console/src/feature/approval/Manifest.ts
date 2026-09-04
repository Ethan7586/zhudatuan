import { defineComponent } from '../../shared/manifest/ComponentManifest';

export const ApprovalManifest = defineComponent({
  component: 'approval',
  navigationids: ['groupapproval', 'mallapproval', 'groupapprovaltemplate', 'mallapprovaltemplate'],
  routes: [
    { routeid: 'consoleapprovals' },
    { routeid: 'consoleapprovaltemplate', load: () => import('./route/ApprovalRoute') },
  ],
  load: () => import('./route/ApprovalRoute'),
});

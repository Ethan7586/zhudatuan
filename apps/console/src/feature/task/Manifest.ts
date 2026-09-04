import { defineComponent } from '../../shared/manifest/ComponentManifest';
export const TaskManifest = defineComponent({ component: 'task', navigationids: [], routes: [{ routeid: 'consoleimporttask' }], load: () => import('./route/TaskRoute') });

import { defineComponent } from '../../shared/manifest/ComponentManifest';
export const TaskManifest = defineComponent({ component: 'task', navigationids: ['grouptasks', 'malltasks', 'platformimporttask', 'groupimporttask', 'mallimporttask'], routes: [{ routeid: 'consoletasks' }, { routeid: 'consoleimporttask' }], load: () => import('./route/TaskRoute') });

import { OP_RUNTIME_EXPORTS_READ, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_JOBS_READ } from '@shop/contract/ids';
import { taskStates, taskTypes, type TaskFilter, type TaskState } from '../model/Task';

export function taskReadOperation(selection?: Readonly<{ type: 'import' | 'export' }>) {
  return selection?.type === 'import' ? OP_RUNTIME_IMPORTS_READ : selection?.type === 'export' ? OP_RUNTIME_EXPORTS_READ : OP_RUNTIME_JOBS_READ;
}

export function taskFilter(search: URLSearchParams): TaskFilter {
  const typeValue = search.get('type');
  const stateValue = search.get('state');
  const ownerValue = search.get('owner')?.trim();
  const type = taskTypes.find((value) => value === typeValue);
  const state = taskStates.find((value) => value === stateValue);
  const owner = ownerValue && /^[a-z][a-z0-9]{1,31}$/.test(ownerValue) ? ownerValue : undefined;
  return Object.freeze({
    limit: search.get('limit') === '50' ? 50 : 20,
    ...(type === undefined ? {} : { type }),
    ...(state === undefined ? {} : { state }),
    ...(owner === undefined ? {} : { owner }),
    ...(search.get('cursor') === null ? {} : { cursor: search.get('cursor')! }),
  });
}

export function activeTask(state?: TaskState): boolean {
  return state !== undefined && ['queued', 'validating', 'ready', 'running'].includes(state);
}

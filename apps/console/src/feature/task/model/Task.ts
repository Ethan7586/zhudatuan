import { RUNTIME_TASK_STATES, RUNTIME_TASK_TYPES, type OperationOutputFor, type RUNTIME_IMPORT_OWNERS } from '@shop/contract';

type TaskDto = OperationOutputFor<'runtime.jobs.read'>['items'][number];
export type TaskType = TaskDto['type'];
export type TaskState = TaskDto['state'];
export type ImportKind = (typeof RUNTIME_IMPORT_OWNERS)[number];

export interface Task {
  readonly id: string;
  readonly type: TaskType;
  readonly owner: string;
  readonly kind: string;
  readonly title: string;
  readonly state: TaskState;
  readonly processed: number;
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly retryableItems: number;
  readonly cancellable: boolean;
  readonly retryable: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt: string | null;
  readonly fileName: string | null;
  readonly downloadAvailable: boolean;
  readonly confirmationRequired: boolean;
  readonly previewHash: string | null;
  readonly columns: readonly string[];
  readonly validationErrors: number;
}

export interface TaskFilter {
  readonly type?: TaskType;
  readonly state?: TaskState;
  readonly owner?: string;
  readonly cursor?: string;
  readonly limit: 20 | 50;
}

export interface TaskPage {
  readonly items: readonly Task[];
  readonly count: number;
  readonly nextCursor?: string;
}

export type TaskCommand = Readonly<{ kind: 'cancel' | 'retry' | 'confirm'; task: Task; reason: string; identity: string }>;

export const taskTypes: readonly TaskType[] = RUNTIME_TASK_TYPES;
export const taskStates: readonly TaskState[] = RUNTIME_TASK_STATES;

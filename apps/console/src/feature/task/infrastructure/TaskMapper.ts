import { deepFreeze } from '../../../shared/model/Immutable';
import type { Task, TaskPage } from '../model/Task';
import { RuntimeTaskDtoSchema, RuntimeTaskPageDtoSchema } from './TaskSchema';

export class TaskMapper {
  page(value: unknown): TaskPage {
    const dto = RuntimeTaskPageDtoSchema.parse(value);
    return deepFreeze({
      items: dto.items.map(mapTask),
      count: dto.count,
      ...(dto.nextCursor === undefined ? {} : { nextCursor: dto.nextCursor }),
    });
  }

  task(value: unknown): Task {
    return deepFreeze(mapTask(RuntimeTaskDtoSchema.parse(value)));
  }
}

function mapTask(value: ReturnType<typeof RuntimeTaskDtoSchema.parse>): Task {
  return {
    id: value.id,
    type: value.type,
    owner: value.owner,
    kind: value.kind,
    title: value.title,
    state: value.state,
    processed: value.processed,
    total: value.total,
    succeeded: value.succeeded,
    failed: value.failed,
    retryableItems: value.retryableItems,
    cancellable: value.cancellable,
    retryable: value.retryable,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    expiresAt: value.expiresAt,
    fileName: value.fileName,
    downloadAvailable: value.downloadAvailable,
    confirmationRequired: value.confirmationRequired,
    previewHash: value.previewHash,
    columns: Object.freeze([...value.columns]),
    validationErrors: value.validationErrors,
  };
}

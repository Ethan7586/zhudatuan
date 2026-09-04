import { deepFreeze } from '../../../../shared/model/Immutable';
import type { Directory, DirectoryPage } from '../model/Directory';
import type { DirectorySyncRun, SyncReceipt, SyncRunPage } from '../model/SyncRun';
import { DirectoryPageDtoSchema, SyncReceiptDtoSchema, SyncRunPageDtoSchema, type DirectoryDto, type SyncRunDto } from './DirectorySchema';

export class DirectoryMapper {
  directories(value: unknown): DirectoryPage {
    const page = DirectoryPageDtoSchema.parse(value) as Readonly<{ items: readonly DirectoryDto[]; count: number; nextCursor?: string }>;
    return deepFreeze({ items: page.items.map(directory), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }
  runs(value: unknown): SyncRunPage {
    const page = SyncRunPageDtoSchema.parse(value) as Readonly<{ items: readonly SyncRunDto[]; count: number; nextCursor?: string }>;
    return deepFreeze({ items: page.items.map(run), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }
  receipt(value: unknown): SyncReceipt {
    return deepFreeze(SyncReceiptDtoSchema.parse(value) as SyncReceipt);
  }
}

function directory(value: DirectoryDto): Directory {
  return {
    id: value.id,
    organizationId: value.organization_id,
    type: value.type,
    status: value.status,
    successfulVersion: value.successful_version,
    version: value.version,
    updatedAt: value.updated_at,
    lastSuccessAt: value.last_success_at,
  };
}
function run(value: SyncRunDto): DirectorySyncRun {
  return {
    id: value.id,
    mode: value.mode,
    state: value.state,
    preview: value.preview,
    readCount: value.read_count,
    appliedCount: value.applied_count,
    createCount: value.create_count,
    updateCount: value.update_count,
    freezeCount: value.freeze_count,
    restoreCount: value.restore_count,
    conflictCount: value.conflict_count,
    ignoredCount: value.ignored_count,
    watermark: value.watermark,
    startedAt: value.started_at,
    completedAt: value.completed_at,
    createdAt: value.created_at,
  };
}

import { DomainError } from '../../../../platform/error/DomainError';
export class DirectoryPolicy {
  validate(page: DirectoryPolicyPage, previous: number): void {
    if (!Number.isSafeInteger(page.version) || page.version < previous) throw new DomainError('DIRECTORY_SYNC_STALE');
    if (page.subjects.length > 500 || new Set(page.subjects.map((subject) => `${subject.type}:${subject.externalid}`)).size !== page.subjects.length) {
      throw new Error('DIRECTORY_PAGE_INVALID');
    }
    const departments = new Map(page.subjects.filter((item) => item.type === 'department').map((item) => [item.externalid, item.parentid]));
    for (const subject of page.subjects) {
      if (subject.type === 'department' && subject.parentid === subject.externalid) throw new Error('DIRECTORY_HIERARCHY_CYCLE');
      if (subject.type === 'user' && subject.parentid !== null) throw new Error('DIRECTORY_USER_PARENT_INVALID');
    }
    for (const id of departments.keys()) {
      const seen = new Set<string>();
      let cursor: string | null = id;
      while (cursor !== null && departments.has(cursor)) {
        if (seen.has(cursor)) throw new Error('DIRECTORY_HIERARCHY_CYCLE');
        seen.add(cursor);
        cursor = departments.get(cursor) ?? null;
      }
    }
  }
}
interface DirectoryPolicyPage {
  readonly version: number;
  readonly subjects: readonly Readonly<{ type: 'user' | 'department'; externalid: string; parentid: string | null }>[];
}

export type DirectorySubjectType = 'user' | 'department';
export type DirectorySubjectStatus = 'active' | 'inactive' | 'deleted' | 'conflict';

export interface DirectorySubjectValue {
  readonly id: string;
  readonly connectionid: string;
  readonly hash: Buffer;
  readonly type: DirectorySubjectType;
  readonly status: DirectorySubjectStatus;
  readonly attributes: string | null;
  readonly sourceversion: number;
  readonly version: number;
}

export class DirectorySubject implements DirectorySubjectValue {
  readonly id: string;
  readonly connectionid: string;
  readonly hash: Buffer;
  readonly type: DirectorySubjectType;
  readonly status: DirectorySubjectStatus;
  readonly attributes: string | null;
  readonly sourceversion: number;
  readonly version: number;
  constructor(value: DirectorySubjectValue) {
    if (
      value.hash.byteLength !== 32 ||
      !['user', 'department'].includes(value.type) ||
      !['active', 'inactive', 'deleted', 'conflict'].includes(value.status) ||
      !Number.isSafeInteger(value.sourceversion) ||
      value.sourceversion < 0 ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0 ||
      (value.attributes !== null && value.attributes.length > 64_000)
    )
      throw new Error('DIRECTORY_SUBJECT_INVALID');
    this.id = value.id;
    this.connectionid = value.connectionid;
    this.hash = Buffer.from(value.hash);
    this.type = value.type;
    this.status = value.status;
    this.attributes = value.attributes;
    this.sourceversion = value.sourceversion;
    this.version = value.version;
    Object.freeze(this);
  }
}

export type AnnouncementAudience = Readonly<{ kind: 'all' } | { kind: 'members'; members: readonly string[] }>;

export class Announcement {
  readonly audience: AnnouncementAudience;

  constructor(
    readonly id: string,
    readonly scope: string,
    readonly title: string,
    readonly body: string,
    audience: Readonly<Record<string, unknown>>,
    readonly startsAt: string,
    readonly endsAt: string | null,
    readonly state: 'draft' | 'published' | 'retired',
    readonly version: number
  ) {
    if (
      !id ||
      !scope ||
      !title.trim() ||
      title.length > 500 ||
      !body.trim() ||
      body.length > 20_000 ||
      Number.isNaN(Date.parse(startsAt)) ||
      (endsAt !== null && (Number.isNaN(Date.parse(endsAt)) || Date.parse(endsAt) <= Date.parse(startsAt))) ||
      !Number.isSafeInteger(version) ||
      version < 0
    )
      throw new Error('NOTIFICATION_ANNOUNCEMENT_INVALID');
    this.audience = announcementAudience(audience);
    Object.freeze(this);
  }
}

export function announcementAudience(value: Readonly<Record<string, unknown>>): AnnouncementAudience {
  if (value.kind === 'all' && Object.keys(value).length === 1) return Object.freeze({ kind: 'all' });
  if (value.kind === 'members' && Array.isArray(value.members) && value.members.length > 0 && value.members.length <= 1_000 && value.members.every((member) => typeof member === 'string' && member.length > 0)) {
    return Object.freeze({ kind: 'members', members: Object.freeze([...new Set(value.members as string[])]) });
  }
  throw new Error('NOTIFICATION_AUDIENCE_INVALID');
}

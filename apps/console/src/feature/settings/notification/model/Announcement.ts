export type AnnouncementState = 'draft' | 'published' | 'retired';
export type AnnouncementAudience = Readonly<{ kind: 'all' }> | Readonly<{ kind: 'members'; members: readonly string[] }>;

export interface Announcement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly audience: AnnouncementAudience;
  readonly state: AnnouncementState;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AnnouncementPage {
  readonly items: readonly Announcement[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface AnnouncementChange {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly audience: AnnouncementAudience;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly state: AnnouncementState;
  readonly expectedVersion: number;
}

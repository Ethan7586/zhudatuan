export interface Favorite {
  readonly listingId: string;
  readonly createdAt: string;
  readonly version: number;
  readonly available: boolean;
  readonly unavailableReason: string | null;
}

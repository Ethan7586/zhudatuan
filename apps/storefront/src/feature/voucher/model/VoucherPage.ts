export interface VoucherPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface CatalogSourceInput {
  readonly id: string;
  readonly provider: string;
  readonly external: string;
  readonly scope: string;
  readonly version: string;
  readonly payload: string;
  readonly hash: string;
}

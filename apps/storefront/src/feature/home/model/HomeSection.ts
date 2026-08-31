export interface HomeSection {
  readonly id: string;
  readonly path: string;
  readonly blocks: readonly Readonly<Record<string, unknown>>[];
}

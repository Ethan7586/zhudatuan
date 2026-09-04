export type ProductFacetOption = Readonly<{
  readonly value: string;
  readonly label: string;
  readonly count: number;
}>;

export type ProductFilterFacets = Readonly<{
  readonly categories: readonly ProductFacetOption[];
  readonly suppliers: readonly ProductFacetOption[];
  readonly malls: readonly ProductFacetOption[];
  readonly statuses: readonly ProductFacetOption[];
}>;

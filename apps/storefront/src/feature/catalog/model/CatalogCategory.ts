export interface CatalogCategory {
  readonly id: string;
  readonly name: string;
  readonly iconName: string;
  readonly hotKeywords: readonly string[];
  readonly icon: string;
  readonly description: string;
  readonly subCategories: readonly object[];
}

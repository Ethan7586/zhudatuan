export type PriceComponentKind = 'base' | 'markup' | 'discount' | 'tax' | 'freight';

export interface PriceComponent {
  readonly kind: PriceComponentKind;
  readonly label: string;
  readonly amountMinor: number;
}

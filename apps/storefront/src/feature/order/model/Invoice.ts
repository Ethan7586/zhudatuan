export interface Invoice {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: string;
  readonly kind: 'original' | 'red';
  readonly createdAt: string;
  readonly issuedAt: string | null;
  readonly sha256: string | null;
  readonly downloadable: boolean;
  readonly version: number;
}

export interface InvoiceDownload {
  readonly url: string;
  readonly expiresAt: string;
  readonly filename: string;
  readonly sha256: string;
}

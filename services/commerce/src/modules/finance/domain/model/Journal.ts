export interface Journal {
  readonly id: string;
  readonly scope: string;
  readonly referenceType: string;
  readonly reference: string;
  readonly currency: 'CNY';
  readonly description: string;
  readonly state: 'posted';
  readonly postedAt: string;
}

export type FailureAction = 'retry' | 'signin' | 'stepup' | 'refresh' | 'contact' | 'none';

export interface ActionView {
  readonly kind: FailureAction;
  readonly label: string;
}

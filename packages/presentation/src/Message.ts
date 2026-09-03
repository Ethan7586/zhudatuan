export type MessageLocale = 'zh-CN' | 'en';

export interface FailureView {
  readonly title: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'danger';
  readonly action: Readonly<{ kind: 'retry' | 'signin' | 'stepup' | 'refresh' | 'contact' | 'none'; label: string }>;
  readonly retryable: boolean;
  readonly requestId?: string;
  readonly retryAfter?: number;
}

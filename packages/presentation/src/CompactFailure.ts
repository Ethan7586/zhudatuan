export interface CompactFailureView {
  readonly message: string;
  readonly authenticationRequired: boolean;
  readonly retryable: boolean;
}

export function compactFailure(cause: unknown): CompactFailureView {
  const failure = record(cause);
  const code = typeof failure?.code === 'string' ? failure.code : '';
  const retryable = failure?.retryable === true;
  if (code === 'AUTHENTICATION_REQUIRED') return view('登录状态已失效，请重新登录。', true, false);
  if (code === 'OFFLINE') return view('当前网络不可用，请检查网络后重试。', false, true);
  if (code === 'TIMEOUT' || code === 'UNAVAILABLE' || code === 'DEADLINE_EXCEEDED') return view('网络响应较慢，请稍后重试。', false, true);
  if (code === 'RATE_LIMITED') return view('操作太频繁，请稍后再试。', false, true);
  if (code === 'STEPUP_REQUIRED') return view('此操作需要进一步验证身份。', false, false);
  if (code === 'FEDERATION_LINK_REQUIRED') return view('当前微信尚未关联福利身份，请联系企业管理员。', false, false);
  if (code.endsWith('_DENIED') || code === 'CAPABILITY_DISABLED' || code === 'SCOPE_DENIED') return view('当前身份没有执行此操作的权限。', false, false);
  if (typeof failure?.kind === 'string' && failure.kind === 'api') return view('当前操作未完成，请核对信息后重试。', false, retryable);
  return view('系统暂时无法完成操作，请稍后重试。', false, retryable);
}

function view(message: string, authenticationRequired: boolean, retryable: boolean): CompactFailureView {
  return Object.freeze({ message, authenticationRequired, retryable });
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : undefined;
}

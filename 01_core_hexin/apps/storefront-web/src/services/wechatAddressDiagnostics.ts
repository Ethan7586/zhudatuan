export type WechatAddressDiagnosticStage =
  | 'sdk-load'
  | 'signature'
  | 'configuration'
  | 'capability-check'
  | 'launch'
  | 'callback';

export type WechatAddressDiagnosticStatus = 'succeeded' | 'failed' | 'cancelled' | 'unavailable' | 'cached';

export interface WechatAddressDiagnostic {
  readonly stage: WechatAddressDiagnosticStage;
  readonly status: WechatAddressDiagnosticStatus;
  readonly durationMs: number;
  readonly recordedAt: string;
  readonly rawError?: unknown;
}

type DiagnosticWindow = Window & {
  __SW_WECHAT_ADDRESS_DIAGNOSTICS__?: readonly WechatAddressDiagnostic[];
};

const MAX_DIAGNOSTICS = 30;
const diagnostics: WechatAddressDiagnostic[] = [];

export function beginWechatAddressDiagnostic(stage: WechatAddressDiagnosticStage) {
  const startedAt = now();
  let completed = false;
  return (status: WechatAddressDiagnosticStatus, rawError?: unknown): WechatAddressDiagnostic | undefined => {
    if (completed) return undefined;
    completed = true;
    return recordWechatAddressDiagnostic(stage, status, now() - startedAt, rawError);
  };
}

export function recordCachedWechatAddressDiagnostic(stage: WechatAddressDiagnosticStage): WechatAddressDiagnostic {
  return recordWechatAddressDiagnostic(stage, 'cached', 0);
}

export function getWechatAddressDiagnostics(): readonly WechatAddressDiagnostic[] {
  return Object.freeze([...diagnostics]);
}

export function clearWechatAddressDiagnostics(): void {
  diagnostics.splice(0, diagnostics.length);
  publishDiagnostics();
}

function recordWechatAddressDiagnostic(
  stage: WechatAddressDiagnosticStage,
  status: WechatAddressDiagnosticStatus,
  durationMs: number,
  rawError?: unknown,
): WechatAddressDiagnostic {
  const diagnostic = Object.freeze({
    stage,
    status,
    durationMs: Math.max(0, Math.round(durationMs * 10) / 10),
    recordedAt: new Date().toISOString(),
    ...(rawError === undefined ? {} : { rawError }),
  });
  diagnostics.push(diagnostic);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.splice(0, diagnostics.length - MAX_DIAGNOSTICS);
  publishDiagnostics();
  publishPerformanceMeasure(diagnostic);
  return diagnostic;
}

function publishDiagnostics(): void {
  if (typeof window === 'undefined') return;
  const snapshot = Object.freeze([...diagnostics]);
  (window as DiagnosticWindow).__SW_WECHAT_ADDRESS_DIAGNOSTICS__ = snapshot;
  if (typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('sw:wechat-address-diagnostic', { detail: snapshot[snapshot.length - 1] }));
  }
}

function publishPerformanceMeasure(diagnostic: WechatAddressDiagnostic): void {
  if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
  try {
    performance.measure(`sw:wechat-address:${diagnostic.stage}:${diagnostic.status}`, {
      start: Math.max(0, performance.now() - diagnostic.durationMs),
      duration: diagnostic.durationMs,
      detail: diagnostic.rawError,
    });
  } catch {
    // Some embedded WebViews expose the legacy Performance API only.
  }
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

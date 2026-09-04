import { channelFailure, terminalChannelFailure, type ChannelFailure } from '../model/Failure';
import type { SyncKind, SyncPhase, SyncProgress, SyncState } from '../model/SyncRun';

export interface SyncCheckpoint {
  readonly phase: SyncPhase;
  readonly progress: SyncProgress;
}

export interface SyncRetryDecision {
  readonly failure: ChannelFailure;
  readonly retry: boolean;
  readonly delayMs: number;
}

export class SyncPolicy {
  requireRunnable(state: SyncState, kind: SyncKind, expected: SyncKind): void {
    if (!['queued', 'running'].includes(state)) throw new Error('CHANNEL_SYNC_RUN_NOT_RUNNABLE');
    if (kind !== expected) throw new Error('CHANNEL_SYNC_JOB_KIND_MISMATCH');
  }

  requireCancellation(state: SyncState): void {
    if (!['queued', 'running'].includes(state)) throw new Error('CHANNEL_SYNC_NOT_CANCELLABLE');
  }

  requireCheckpoint(previous: SyncProgress, next: SyncCheckpoint): void {
    if (next.progress.pulled < previous.pulled || next.progress.accepted < previous.accepted || next.progress.rejected < previous.rejected || next.progress.accepted + next.progress.rejected > next.progress.pulled)
      throw new Error('CHANNEL_SYNC_PROGRESS_REGRESSION');
    if (next.progress.cursor !== previous.cursor && next.phase !== 'commit') throw new Error('CHANNEL_SYNC_CURSOR_UNCOMMITTED');
    if (previous.watermark !== null && next.progress.watermark !== null && Date.parse(next.progress.watermark) < Date.parse(previous.watermark)) {
      throw new Error('CHANNEL_SYNC_WATERMARK_REGRESSION');
    }
  }

  retry(cause: unknown, attempt: number, maximum: number): SyncRetryDecision {
    if (!Number.isSafeInteger(attempt) || attempt < 1 || !Number.isSafeInteger(maximum) || maximum < attempt) throw new Error('CHANNEL_SYNC_RETRY_INVALID');
    const failure = channelFailure(classify(cause))!;
    const retry = failure.retryable && attempt < maximum;
    return Object.freeze({ failure, retry, delayMs: retry ? Math.min(60_000, 250 * 2 ** (attempt - 1)) : 0 });
  }

  terminal(cause: unknown): ChannelFailure {
    return terminalChannelFailure(cause, 'CHANNEL_SYNC_FAILED');
  }
}

function classify(cause: unknown): ChannelFailure {
  const failure = terminalChannelFailure(cause, 'CHANNEL_SYNC_FAILED');
  return { ...failure, retryable: ['ratelimit', 'timeout', 'unavailable'].includes(failure.classification) };
}

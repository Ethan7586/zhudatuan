import type { ProviderCapability } from '@shop/contract';
import type { Connection, ConnectionLimits, ConnectionState } from '../model/Connection';
import type { ProviderOperation, ProviderOperationState } from '../model/ProviderOperation';
import type { Quota } from '../model/Quota';

const connectionTransitions: Readonly<Record<ConnectionState, readonly ConnectionState[]>> = Object.freeze({
  draft: ['testing', 'disabled'],
  testing: ['enabled', 'degraded', 'disabled'],
  enabled: ['degraded', 'disabled'],
  degraded: ['testing', 'enabled', 'disabled'],
  disabled: ['testing'],
});

const operationTransitions: Readonly<Record<ProviderOperationState, readonly ProviderOperationState[]>> = Object.freeze({
  queued: ['submitted', 'processing', 'succeeded', 'failed', 'unknown'],
  submitted: ['processing', 'succeeded', 'failed', 'unknown'],
  processing: ['processing', 'succeeded', 'failed', 'unknown'],
  succeeded: [],
  failed: ['queued'],
  unknown: ['queued', 'processing', 'succeeded', 'failed'],
});

export interface ChannelUsage {
  readonly concurrent: number;
  readonly requestsInSecond: number;
  readonly quotaUsed: number;
  readonly at: string;
}

export interface ChannelAdmission {
  readonly deadlineMs: number;
  readonly attempts: number;
}

export type WebhookTransition = 'apply' | 'duplicate' | 'stale';

export class ChannelPolicy {
  requireTransition(connection: Connection, target: ConnectionState): void {
    if (!connectionTransitions[connection.state].includes(target)) throw new Error(`CONNECTION_TRANSITION_INVALID:${connection.state}:${target}`);
  }

  requireInvocation(connection: Connection, capability: ProviderCapability, usage: ChannelUsage, quota: Quota | null): ChannelAdmission {
    if (connection.state !== 'enabled') throw new Error('CHANNEL_CONNECTION_NOT_ENABLED');
    if (!connection.capabilities.includes(capability)) throw new Error(`CHANNEL_CAPABILITY_UNAVAILABLE:${capability}`);
    validateUsage(usage);
    if (usage.concurrent >= connection.limits.maxConcurrency) throw new Error('CHANNEL_CONCURRENCY_LIMITED');
    if (usage.requestsInSecond >= connection.limits.requestsPerSecond) throw new Error('CHANNEL_RATE_LIMITED');
    if (quota !== null && !this.quotaAllows(quota, usage.quotaUsed, usage.at)) throw new Error('CHANNEL_QUOTA_EXHAUSTED');
    return Object.freeze({ deadlineMs: connection.limits.totalDeadlineMs, attempts: connection.limits.maxAttempts });
  }

  requireCapability(state: ConnectionState, capabilities: readonly ProviderCapability[], capability: ProviderCapability): void {
    if (state !== 'enabled') throw new Error('CHANNEL_CONNECTION_NOT_ENABLED');
    if (!capabilities.includes(capability)) throw new Error(`CHANNEL_CAPABILITY_UNAVAILABLE:${capability}`);
  }

  requireAnyCapability(state: ConnectionState, capabilities: readonly ProviderCapability[], accepted: readonly ProviderCapability[]): ProviderCapability {
    if (state !== 'enabled') throw new Error('CHANNEL_CONNECTION_NOT_ENABLED');
    const selected = accepted.find((capability) => capabilities.includes(capability));
    if (!selected) throw new Error(`CHANNEL_CAPABILITY_UNAVAILABLE:${accepted.join(',')}`);
    return selected;
  }

  requireQuotaConfiguration(quota: Quota): void {
    if (quota.value.state === 'disabled' && quota.value.limit !== null) throw new Error('CHANNEL_DISABLED_QUOTA_LIMIT_INVALID');
  }

  quotaAllows(quota: Quota, used: number, at: string): boolean {
    const instant = Date.parse(at);
    if (!Number.isSafeInteger(used) || used < 0 || Number.isNaN(instant)) throw new Error('CHANNEL_QUOTA_USAGE_INVALID');
    return quota.value.state === 'enabled' && instant >= Date.parse(quota.value.effectiveAt) && (quota.value.expiresAt === null || instant < Date.parse(quota.value.expiresAt)) && (quota.value.limit === null || used < quota.value.limit);
  }

  requireOperationTransition(operation: ProviderOperation, target: ProviderOperationState): void {
    const state = operation.value.state;
    if (!operationTransitions[state].includes(target)) throw new Error(`CHANNEL_PROVIDER_OPERATION_TRANSITION_INVALID:${state}:${target}`);
  }

  webhookTransition(operation: ProviderOperation, target: ProviderOperationState): WebhookTransition {
    const state = operation.value.state;
    if (state === target) return 'duplicate';
    if (state === 'succeeded' || state === 'failed') return 'stale';
    return operationTransitions[state].includes(target) ? 'apply' : 'stale';
  }

  requireReplay(operation: ProviderOperation): void {
    this.requireOperationTransition(operation, 'queued');
  }
}

export function validateConnectionLimits(limits: ConnectionLimits): void {
  const integers = [limits.connectionTimeoutMs, limits.responseTimeoutMs, limits.totalDeadlineMs, limits.maxConcurrency, limits.maxAttempts, limits.failureThreshold, limits.recoveryMs];
  if (
    integers.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    !Number.isFinite(limits.requestsPerSecond) ||
    limits.requestsPerSecond <= 0 ||
    limits.connectionTimeoutMs > limits.totalDeadlineMs ||
    limits.responseTimeoutMs > limits.totalDeadlineMs
  )
    throw new Error('CHANNEL_CONNECTION_LIMITS_INVALID');
}

function validateUsage(usage: ChannelUsage): void {
  if ([usage.concurrent, usage.requestsInSecond, usage.quotaUsed].some((value) => !Number.isSafeInteger(value) || value < 0) || Number.isNaN(Date.parse(usage.at))) {
    throw new Error('CHANNEL_USAGE_INVALID');
  }
}

import type { Telemetry, TelemetryContext } from '@shop/telemetry';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { EntryResolveObservation, ExperienceObserver, PublicationObservation } from '../../application/port/ExperienceObserver';
import type { EntryState } from '../../domain/policy/EntryPolicy';

export class ExperienceTelemetry implements ExperienceObserver {
  constructor(private readonly telemetry: Telemetry) {}

  resolve(context: ReadTransactionContext, observation: EntryResolveObservation): void {
    const measured = this.context(context, observation.result, observation.errorCode, observation.cache);
    this.telemetry.metrics.duration('experience.entry.resolve.duration', observation.milliseconds, measured);
    if (observation.result === 'failure') this.telemetry.metrics.count('experience.entry.resolve.failure', 1, measured);
  }

  states(context: ReadTransactionContext, counts: Readonly<Record<EntryState, number>>): void {
    for (const state of Object.keys(counts) as EntryState[]) {
      if (counts[state] > 0) this.telemetry.metrics.count('experience.entry.state', counts[state], this.context(context, state));
    }
  }

  publication(observation: PublicationObservation): void {
    this.telemetry.metrics.duration('experience.publication.activate.duration', observation.milliseconds, {
      requestId: observation.trace,
      traceId: observation.trace,
      module: 'experience',
      operation: 'job.experience.activate',
      result: observation.result,
      ...(observation.errorCode === undefined ? {} : { errorCode: observation.errorCode }),
    });
  }

  private context(context: ReadTransactionContext, result: string, errorCode?: string, target?: string): TelemetryContext {
    return {
      requestId: context.trace,
      traceId: context.trace,
      module: 'experience',
      operation: context.operation,
      result,
      ...(target === undefined ? {} : { target }),
      ...(errorCode === undefined ? {} : { errorCode }),
    };
  }
}

import type { SupportEvent } from '../infrastructure/SupportGateway';

export interface SupportEventState {
  readonly cursor?: string;
  readonly seen: readonly string[];
  readonly versions: Readonly<Record<string, number>>;
}

export interface SupportEventDecision {
  readonly accepted: boolean;
  readonly state: SupportEventState;
}

export const initialSupportEventState: SupportEventState = Object.freeze({ seen: Object.freeze([]), versions: Object.freeze({}) });

export function reduceSupportEvent(current: SupportEventState, event: SupportEvent): SupportEventDecision {
  if (current.seen.includes(event.id)) return Object.freeze({ accepted: false, state: current });
  const identity = event.messageId ?? event.evidenceId ?? event.ticketId;
  const version = event.version ?? event.sequence ?? 0;
  const known = current.versions[identity] ?? -1;
  if (version > 0 && version < known) {
    return Object.freeze({ accepted: false, state: remember(current, event.id) });
  }
  return Object.freeze({
    accepted: true,
    state: Object.freeze({
      cursor: event.id,
      seen: Object.freeze([...current.seen.slice(-255), event.id]),
      versions: Object.freeze({ ...current.versions, [identity]: Math.max(known, version) }),
    }),
  });
}

function remember(current: SupportEventState, id: string): SupportEventState {
  return Object.freeze({ ...current, seen: Object.freeze([...current.seen.slice(-255), id]) });
}

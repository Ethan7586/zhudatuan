import type { TicketPriority, TicketChannel } from './Ticket';

export interface AgentChange {
  readonly membership: string;
  readonly skills: readonly string[];
  readonly capacity: number;
  readonly state: 'offline' | 'available' | 'busy' | 'disabled';
}
export interface AccountChange {
  readonly provider: TicketChannel;
  readonly displayName: string;
  readonly secretRef?: string | null;
  readonly state: 'active' | 'disabled';
}
export interface RuleChange {
  readonly name: string;
  readonly skill: string;
  readonly priorities: readonly TicketPriority[];
  readonly weight: number;
  readonly state: 'active' | 'disabled';
}
export interface SlaChange {
  readonly priority: TicketPriority;
  readonly responseSeconds: number;
  readonly resolutionSeconds: number;
}

export interface Account {
  readonly id: string;
  readonly provider: TicketChannel;
  readonly displayName: string;
  readonly state: 'active' | 'disabled';
  readonly validationState: 'verified' | 'notrequired' | 'unverified';
  readonly validationCode: string;
  readonly validatedAt: string | null;
  readonly version: number;
}
export interface Rule {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly priorities: readonly TicketPriority[];
  readonly weight: number;
  readonly state: 'active' | 'disabled';
  readonly version: number;
  readonly updatedAt: string;
}
export interface Sla {
  readonly id: string;
  readonly priority: TicketPriority;
  readonly responseSeconds: number;
  readonly resolutionSeconds: number;
  readonly version: number;
}
export interface ConfigPage<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly nextCursor?: string;
}

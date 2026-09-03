export interface Agent {
  readonly id: string;
  readonly membershipId: string;
  readonly skills: readonly string[];
  readonly capacity: number;
  readonly state: 'offline' | 'available' | 'busy' | 'disabled';
  readonly version: number;
}

export interface AgentPage {
  readonly items: readonly Agent[];
  readonly count: number;
  readonly nextCursor?: string;
}

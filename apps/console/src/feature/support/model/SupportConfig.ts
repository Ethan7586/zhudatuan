import type { ContractJsonValue } from '@shop/contract';

type ConfigRecord = Readonly<Record<string, ContractJsonValue>>;

export type AgentChange = ConfigRecord & {
  readonly membership: string;
  readonly skills: readonly string[];
  readonly capacity: number;
  readonly state: 'offline' | 'available' | 'busy' | 'disabled';
};

export type AccountChange = ConfigRecord & {
  readonly provider: 'inapp' | 'wechat' | 'email' | 'sms';
  readonly displayName: string;
  readonly secretRef?: string | null;
  readonly state: 'active' | 'disabled';
};

export type RuleChange = ConfigRecord & {
  readonly name: string;
  readonly skill: string;
  readonly priorities: readonly ('low' | 'normal' | 'high' | 'urgent')[];
  readonly weight: number;
  readonly state: 'active' | 'disabled';
};

export type SlaChange = ConfigRecord & {
  readonly priority: 'low' | 'normal' | 'high' | 'urgent';
  readonly responseSeconds: number;
  readonly resolutionSeconds: number;
};

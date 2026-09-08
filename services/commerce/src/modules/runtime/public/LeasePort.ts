import { publicPort } from '../../../composition/ModuleRegistry';

export interface RuntimeLease {
  readonly resource: string;
  readonly scope: string;
  readonly owner: string;
  readonly token: string;
  readonly deadline: string;
  readonly version: number;
  readonly fencingToken: number;
}

export interface LeaseRequest {
  readonly resource: string;
  readonly scope: string;
  readonly owner: string;
  readonly seconds: number;
}

export interface LeasePort {
  acquire(request: LeaseRequest): Promise<RuntimeLease | null>;
  renew(lease: RuntimeLease, seconds: number): Promise<RuntimeLease>;
  assert(lease: RuntimeLease): Promise<void>;
  release(lease: RuntimeLease): Promise<void>;
}

export const LEASE_PORT = publicPort<LeasePort>('runtime', 'lease');

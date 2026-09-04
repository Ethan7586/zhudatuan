export interface StorefrontBootstrap {
  readonly entry: Readonly<{ handle: string; url: string }>;
  readonly binding: Readonly<{ application: string; mall: string; pool: string; release: string; version: string; tenant: string }>;
  readonly identity: Readonly<{
    state: 'complete' | 'unavailable' | 'failed';
    version: string;
    asOf: string;
    data: Readonly<{ state: 'anonymous' | 'member'; membership: string | null; csrf?: string }> | null;
  }>;
  readonly navigation: Readonly<{
    state: 'complete' | 'unavailable' | 'failed';
    version: string;
    asOf: string;
    data: readonly Readonly<{ id: string; title: string; icon: string; route: string; order: number }>[] | null;
  }>;
  readonly benefit: Readonly<{
    state: 'complete' | 'unavailable' | 'failed';
    version: string;
    asOf: string;
    data: Readonly<{ version: number }> | null;
  }>;
  readonly orders: Readonly<{
    state: 'complete' | 'unavailable' | 'failed';
    version: string;
    asOf: string;
    data: Readonly<{ version: number }> | null;
  }>;
  readonly experience: Readonly<{
    state: 'complete' | 'unavailable' | 'failed';
    version: string;
    asOf: string;
    data: unknown;
  }>;
}

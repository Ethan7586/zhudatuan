import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface IdentityEventPort {
  publish(
    database: OperationDatabase,
    type: string,
    aggregateType: 'invitation' | 'session' | 'challenge' | 'membership' | 'linkcase' | 'principal',
    aggregate: string,
    scope: string,
    trace: string,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void>;
}

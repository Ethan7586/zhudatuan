import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface ExperienceOrganizationPort {
  createMall(context: WriteTransactionContext, input: Readonly<{ parent: string; name: string }>): Promise<string>;
  copyMall(context: WriteTransactionContext, input: Readonly<{ source: string; name: string }>): Promise<string>;
}

export const EXPERIENCE_ORGANIZATION_PORT = publicPort<ExperienceOrganizationPort>('organization', 'experience');

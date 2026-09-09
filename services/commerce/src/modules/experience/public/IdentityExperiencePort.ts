import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface IdentityExperiencePort {
  storefront(context: ReadTransactionContext, organization: string): Promise<Readonly<{ handle: string }> | null>;
}

export const IDENTITY_EXPERIENCE_PORT = publicPort<IdentityExperiencePort>('experience', 'identity');

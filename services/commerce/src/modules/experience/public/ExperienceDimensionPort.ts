import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface ExperienceApplicationLabel {
  readonly id: string;
  readonly name: string;
  readonly mall: string;
  readonly mallName: string;
}

export interface ExperienceDimensionPort {
  applications(context: ReadTransactionContext, scope: string, ids?: readonly string[]): Promise<readonly ExperienceApplicationLabel[]>;
}

export const EXPERIENCE_DIMENSION_PORT = publicPort<ExperienceDimensionPort>('experience', 'dimension');

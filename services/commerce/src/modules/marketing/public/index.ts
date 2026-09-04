import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { MarketingReadPort } from './MarketingReadPort';
import type { MarketingReservePort } from './MarketingReservePort';

export const MARKETING_READ_PORT = publicPort<MarketingReadPort>('marketing', 'read');
export const MARKETING_RESERVE_PORT = publicPort<MarketingReservePort>('marketing', 'reserve');
export type { MarketingEvaluation, MarketingEvaluationInput, MarketingEvidence, MarketingReadPort } from './MarketingReadPort';
export type { MarketingRefund, MarketingReservation, MarketingReservePort } from './MarketingReservePort';

import { deepFreeze } from '../../../../shared/model/Immutable';
import type { FederationCenter, FederationHealth } from '../model/Federation';
import { FederationCenterSchema, FederationHealthSchema } from './FederationSchema';

export class FederationMapper {
  center(value: unknown): FederationCenter {
    const parsed = FederationCenterSchema.parse(value);
    if (parsed.count !== parsed.items.length) throw new Error('FEDERATION_CENTER_COUNT_MISMATCH');
    return deepFreeze({ items: parsed.items.map((item) => ({ id: item.id, type: item.type, status: item.status })), count: parsed.count });
  }
  health(provider: string, value: unknown): FederationHealth {
    const parsed = FederationHealthSchema.parse(value);
    return deepFreeze({ provider, status: parsed.status, checkedAt: parsed.checkedat });
  }
}

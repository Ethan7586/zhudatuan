import { describe, expect, it } from 'vitest';
import { ProductionApiError } from '../services/productionApi';
import { shouldRetainProductionSnapshot } from './useProductionSync';

describe('production synchronization recovery', () => {
  it('retains the visible snapshot during a temporary network interruption', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('网络连接已中断', 0, 'NETWORK_OR_CLIENT_ERROR'))).toBe(true);
  });

  it('still closes member data when authentication is no longer valid', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED'))).toBe(false);
  });
});

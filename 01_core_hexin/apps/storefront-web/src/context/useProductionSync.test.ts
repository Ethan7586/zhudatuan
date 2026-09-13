import { describe, expect, it } from 'vitest';
import { ProductionApiError } from '../services/productionApi';
import { authenticatedMall, shouldCloseMemberSession, shouldRetainProductionSnapshot } from './useProductionSync';

describe('production synchronization recovery', () => {
  it('retains the visible snapshot during a temporary network interruption', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('网络连接已中断', 0, 'NETWORK_OR_CLIENT_ERROR'))).toBe(true);
  });

  it('still closes member data when authentication is no longer valid', () => {
    expect(shouldRetainProductionSnapshot(new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED'))).toBe(false);
    expect(shouldCloseMemberSession(new ProductionApiError('登录会话已失效', 401, 'AUTHENTICATION_REQUIRED'))).toBe(true);
    expect(shouldCloseMemberSession(new ProductionApiError('上游暂时不可用', 503, 'UPSTREAM_UNAVAILABLE'))).toBe(false);
  });

  it('builds the stable member shell before account data arrives', () => {
    expect(authenticatedMall({
      actor: {} as never,
      scope: {
        tenantId: 'tenant:one', enterpriseId: 'enterprise:one', mallId: 'mall:one', mallCode: 'HONGTAI',
        mallName: '宏泰甄选', brandName: '宏泰甄选', enterpriseName: '已授权企业',
      },
    })).toMatchObject({ mallName: '宏泰甄选', logoText: '宏泰甄选', id: 'mall:one' });
  });
});

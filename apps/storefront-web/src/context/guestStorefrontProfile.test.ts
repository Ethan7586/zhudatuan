import { describe, expect, it } from 'vitest';
import { MOCK_USER } from '../mock/base';
import { guestStorefrontProfile } from './guestStorefrontProfile';

describe('guest storefront profile', () => {
  it('does not expose the demo employee while session discovery is pending', () => {
    expect(guestStorefrontProfile(MOCK_USER)).toMatchObject({
      id: 'guest',
      name: '访客',
      employeeId: '未登录',
      department: '未登录',
      avatar: '',
      welfareBalance: 0,
      mealBalance: 0,
      couponCount: 0,
    });
  });
});

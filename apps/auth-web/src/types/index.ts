/**
 * 智慧翼企业福利商城 - 类型定义
 * 技术服务方：雍彻科技
 */

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'offboarded' | 'expired';

export type MembershipTarget = 'storefront' | 'admin';

export type LoginMethod = 'otp' | 'password' | 'work_weixin' | 'sso';

export interface Membership {
  id: string;
  target: MembershipTarget;
  status: MembershipStatus;
  enterpriseName: string;
  storeName: string;
  roleName: string;
  dataScope: string;
  accountTypeLabel?: '福利账户' | '餐卡' | string;
  subjectScope?: '租户' | '企业' | '供应商' | '商城';
  keyPermissions?: string[];
  authorizedBy?: string;
  expireAt?: string;
  requiresStepUp?: boolean;
}

export interface PreAuthContext {
  preAuthToken: string;
  phone?: string;
  identifier?: string;
  loginMethod: LoginMethod;
  requiresPasswordReset?: boolean;
  memberships: Membership[];
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
export type DomainType = 'zhudatuan.com' | 'console.zhudatuan.com';
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export interface StepUpChallenge {
  challengeId: string;
  preAuthToken: string;
  membershipId: string;
  method: 'totp';
  targetDomain: string;
  requiresStepUp: boolean;
  message: string;
}

export interface StepUpVerifyResult {
  ticket: string;
  redirectUrl: string;
  targetDomain: string;
  expiresInSeconds: number;
}

export interface LockoutState {
  isLocked: boolean;
  remainingSeconds: number;
  failedAttempts: number;
}

export type DomainType = 'zhudatuan.com' | 'console.zhudatuan.com' | 'hbbtzn.com' | 'smart.hbbtzn.com';

export type ScreenType = 'login' | 'storefront_home' | 'admin_dashboard' | 'auth_callback' | 'force_password_reset';
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export type DomainType = 'zhudatuan.com' | 'console.zhudatuan.com';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

export interface MallContextType {
  currentDomain: DomainType;
  setDomain: (domain: DomainType) => void;
  currentScreen: ScreenType;
  screenParams: Record<string, any>;
  navigateTo: (screen: ScreenType, params?: Record<string, any>) => void;
  acceptedTerms: boolean;
  setAcceptedTerms: (accepted: boolean) => void;
  activeSession: {
    membership?: Membership;
    domain?: DomainType;
    ticket?: string;
  } | null;
  setActiveSession: (session: any) => void;
}

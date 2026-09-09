export interface Profile {
  readonly id: string;
  readonly employeeNumber: string | null;
  readonly name: string;
  readonly avatar: string;
  readonly phone: string;
  readonly jobTitle: string;
  readonly department: string;
  readonly enterpriseId: string;
  readonly enterpriseName: string;
  readonly currentMallId: string;
  readonly welfareBalanceMinor: number;
  readonly mealBalanceMinor: number;
  readonly couponCount: number;
  readonly assuranceLevel: 'account' | 'phone';
  readonly phoneVerified: boolean;
  readonly paymentEligible: boolean;
  readonly accessVersion: number;
  readonly locale: string;
  readonly timezone: string;
  readonly marketingAllowed: boolean;
  readonly preferenceVersion: number;
}

export interface EnterpriseMall {
  readonly id: string;
  readonly membershipId?: string;
  readonly enterpriseId: string;
  readonly enterpriseName: string;
  readonly mallName: string;
  readonly logoText: string;
  readonly badge: string;
  readonly roleLabel: string;
  readonly welcomeBanner: string;
}

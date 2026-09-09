import { token } from '../../../../composition/Container';

export type ChallengePurpose = 'login' | 'password_reset' | 'phone_change' | 'enrollment' | 'enrollment_campaign' | 'invitation_acceptance' | 'stepup';

export interface ChallengeCode {
  issue(purpose: ChallengePurpose): string;
}

export const IDENTITY_CHALLENGE_CODE = token<ChallengeCode>('identity.challengecode');

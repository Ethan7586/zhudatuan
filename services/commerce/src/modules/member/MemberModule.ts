import { defineModule } from '../../bootstrap/DefinedModule';
import { memberOperations } from './MemberOperations';
import { Manifest } from './Manifest';
import { MemberPort } from './MemberPort';
import { IDENTITY_MEMBER_PORT } from './public/IdentityMemberPort';
import { INVITATION_MEMBER_PORT } from './public/InvitationMemberPort';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { PgReferralMemberPort, REFERRAL_MEMBER_PORT } from './public/ReferralMemberPort';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { BENEFIT_MEMBER_PORT, PgBenefitMemberPort } from './public/BenefitMemberPort';
import { MEMBER_READ_PORT, PgMemberReadPort } from './public/MemberReadPort';
import { readDatabaseWorkload } from '../../foundation/persistence/Workload';
export const MemberModule = defineModule(Manifest, memberOperations, (context) => {
  const member = new MemberPort();
  return [
    { token: IDENTITY_MEMBER_PORT, value: member },
    { token: INVITATION_MEMBER_PORT, value: member },
    { token: REFERRAL_MEMBER_PORT, value: new PgReferralMemberPort(context.ports.get(MEMBER_ACCESS_PORT)) },
    { token: BENEFIT_MEMBER_PORT, value: new PgBenefitMemberPort() },
    { token: MEMBER_READ_PORT, value: new PgMemberReadPort(context.service(DATABASE_POOL), readDatabaseWorkload(context.workload)) },
  ];
});

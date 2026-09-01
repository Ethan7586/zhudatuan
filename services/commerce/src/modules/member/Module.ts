import { PgReferralMemberPort } from './infrastructure/persistence/PgReferralMemberPort';
import { PgMemberReadPort } from './infrastructure/persistence/PgMemberReadPort';
import { PgBenefitMemberPort } from './infrastructure/persistence/PgBenefitMemberPort';

import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { KMS_CLIENT } from '../../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../../foundation/infrastructure/ObjectStore';
import { ImportObjectService } from '../../foundation/application/ImportObjectService';
import { MEMBER_ACCESS_PORT } from '../access/public';
import { MEMBER_CATALOG_PORT } from '../catalog/public';
import { AddressesManageHandler } from './application/handler/AddressesManageHandler';
import { AddressesReadHandler } from './application/handler/AddressesReadHandler';
import { FavoritesPutHandler } from './application/handler/FavoritesPutHandler';
import { FavoritesReadHandler } from './application/handler/FavoritesReadHandler';
import { ImportsCreateHandler } from './application/handler/ImportsCreateHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { MembersReadHandler } from './application/handler/MembersReadHandler';
import { ProfileReadHandler } from './application/handler/ProfileReadHandler';
import { MemberPort } from './infrastructure/persistence/MemberPort';
import { PgAddressRepository } from './infrastructure/persistence/PgAddressRepository';
import { PgMemberRepository } from './infrastructure/persistence/PgMemberRepository';
import { Manifest } from './Manifest';
import { BENEFIT_MEMBER_PORT } from './public/BenefitMemberPort';
import { IDENTITY_MEMBER_PORT } from './public/IdentityMemberPort';
import { INVITATION_MEMBER_PORT } from './public/InvitationMemberPort';
import { MEMBER_READ_PORT } from './public/MemberReadPort';
import { MEMBER_ADDRESS_PORT } from './public/MemberAddressPort';
import { REFERRAL_MEMBER_PORT } from './public/ReferralMemberPort';
import { createJobs } from './interface/job/JobFactory';

export const MemberModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const members = new PgMemberRepository(transactions, context.ports.get(MEMBER_ACCESS_PORT), context.ports.get(MEMBER_CATALOG_PORT));
    const addresses = new PgAddressRepository(transactions);
    return [
      new MembersReadHandler(members),
      new ProfileReadHandler(members),
      new AddressesReadHandler(members, addresses),
      new AddressesManageHandler(members, addresses, context.service(KMS_CLIENT)),
      new FavoritesReadHandler(members),
      new FavoritesPutHandler(members),
      new ImportsCreateHandler(members, new PgJobScheduler(transactions), new ImportObjectService(context.service(OBJECT_STORE))),
      new ImportsReadHandler(members, context.service(OBJECT_STORE)),
    ];
  },
  ports: (context) => {
    const member = new MemberPort();
    return [
      { token: IDENTITY_MEMBER_PORT, value: member },
      { token: INVITATION_MEMBER_PORT, value: member },
      { token: REFERRAL_MEMBER_PORT, value: new PgReferralMemberPort(context.ports.get(MEMBER_ACCESS_PORT)) },
      { token: BENEFIT_MEMBER_PORT, value: new PgBenefitMemberPort() },
      { token: MEMBER_READ_PORT, value: new PgMemberReadPort() },
      { token: MEMBER_ADDRESS_PORT, value: new PgAddressRepository(new PgTransactionAccess()) },
    ];
  },
  jobPorts: [{ token: BENEFIT_MEMBER_PORT, value: new PgBenefitMemberPort() }],
});

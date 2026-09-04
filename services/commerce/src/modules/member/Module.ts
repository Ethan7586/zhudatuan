import { PgReferralMemberPort } from './infrastructure/persistence/PgReferralMemberPort';
import { PgMemberReadPort } from './infrastructure/persistence/PgMemberReadPort';
import { PgBenefitMemberPort } from './infrastructure/persistence/PgBenefitMemberPort';

import { PgJobScheduler } from '../../adapter/database/PgJobScheduler';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { defineModule } from '../../bootstrap/DefinedModule';
import { KMS_CLIENT } from '../../foundation/application/KmsPort';
import { OBJECT_STORE } from '../runtime/public/ObjectPort';
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
import { PgFavoriteRepository } from './infrastructure/persistence/PgFavoriteRepository';
import { Manifest } from './Manifest';
import { BENEFIT_MEMBER_PORT } from './public/BenefitMemberPort';
import { IDENTITY_MEMBER_PORT } from './public/IdentityMemberPort';
import { IDENTITY_REGISTRATION_PORT } from './public/IdentityRegistrationPort';
import { MEMBER_READ_PORT } from './public/MemberReadPort';
import { MEMBER_ADDRESS_PORT } from './public/MemberAddressPort';
import { REFERRAL_MEMBER_PORT } from './public/ReferralMemberPort';
import { createJobs } from './interface/job/JobFactory';
import { IMPORT_OBJECT_PORT, RUNTIME_IMPORT_PORT } from '../runtime/public';

export const MemberModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const access = context.ports.get(MEMBER_ACCESS_PORT);
    const catalog = context.ports.get(MEMBER_CATALOG_PORT);
    const members = new PgMemberRepository(transactions, access);
    const imports = context.ports.get(RUNTIME_IMPORT_PORT);
    const addresses = new PgAddressRepository(transactions);
    const favorites = new PgFavoriteRepository(transactions);
    return [
      new MembersReadHandler(members),
      new ProfileReadHandler(members),
      new AddressesReadHandler(members, addresses),
      new AddressesManageHandler(members, addresses, context.service(KMS_CLIENT)),
      new FavoritesReadHandler(members, favorites, catalog),
      new FavoritesPutHandler(members, favorites, catalog),
      new ImportsCreateHandler(imports, new PgJobScheduler(transactions), context.ports.get(IMPORT_OBJECT_PORT)),
      new ImportsReadHandler(imports, context.service(OBJECT_STORE)),
    ];
  },
  ports: (context) => {
    const access = context.ports.get(MEMBER_ACCESS_PORT);
    const member = new MemberPort(access);
    return [
      { token: IDENTITY_MEMBER_PORT, value: member },
      { token: IDENTITY_REGISTRATION_PORT, value: member },
      { token: REFERRAL_MEMBER_PORT, value: new PgReferralMemberPort(access) },
      { token: BENEFIT_MEMBER_PORT, value: new PgBenefitMemberPort() },
      { token: MEMBER_READ_PORT, value: new PgMemberReadPort() },
      { token: MEMBER_ADDRESS_PORT, value: new PgAddressRepository(new PgTransactionAccess()) },
    ];
  },
  jobPorts: [{ token: BENEFIT_MEMBER_PORT, value: new PgBenefitMemberPort() }],
});

import { defineModule } from '../../../bootstrap/DefinedModule';
import { memberOperations } from '../03_application_yingyong/MemberOperations';
export const MemberModule = defineModule('member', ['identity'], memberOperations);
export { MemberPort, memberPort, type MemberInvite } from '../01_public_gongkai/MemberPort';

import { defineModule } from '../../bootstrap/DefinedModule';
import { memberOperations } from './MemberOperations';
export const MemberModule = defineModule('member', ['identity'], memberOperations);
export { MemberPort, memberPort, type MemberInvite } from './MemberPort';

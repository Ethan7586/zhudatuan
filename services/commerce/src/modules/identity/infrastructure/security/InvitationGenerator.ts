import { randomBytes } from 'node:crypto';
import { InvitationCode } from '../../domain/model/InvitationCode';
import type { InvitationCodePort } from '../../application/port/InvitationSecurity';

export class InvitationGenerator implements InvitationCodePort {
  issue(): InvitationCode {
    return InvitationCode.issue(randomBytes(24));
  }
}

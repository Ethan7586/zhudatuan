import type { InvitationCode } from '../../domain/model/InvitationCode';

export interface InvitationDigest {
  readonly version: string;
  readonly hash: Buffer;
}

export interface InvitationHashPort {
  current(code: InvitationCode): InvitationDigest;
  candidates(code: InvitationCode): readonly InvitationDigest[];
  recipient(value: string): Buffer;
  matchesRecipient(value: string, expected: Buffer): boolean;
}

export interface InvitationCodePort {
  issue(): InvitationCode;
}

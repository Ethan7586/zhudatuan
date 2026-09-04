export type ConversationChannel = 'inapp' | 'wechat' | 'email' | 'sms';

export class Conversation {
  constructor(
    readonly id: string,
    readonly scope: string,
    readonly member: string | null,
    readonly channel: ConversationChannel,
    readonly subject: string,
    readonly order: string | null,
    readonly latestSequence: number,
    readonly version: number
  ) {
    if (!id || !scope || !subject.trim() || !Number.isSafeInteger(latestSequence) || latestSequence < 0 || !Number.isSafeInteger(version) || version < 1) throw new Error('SUPPORT_CONVERSATION_INVALID');
    Object.freeze(this);
  }

  assertMember(member: string): void {
    if (!member || this.member !== member) throw new Error('SUPPORT_CONVERSATION_PARTICIPANT_DENIED');
  }

  append(): Conversation {
    return new Conversation(this.id, this.scope, this.member, this.channel, this.subject, this.order, this.latestSequence + 1, this.version + 1);
  }
}

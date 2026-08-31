export type ConversationChannel = 'inapp' | 'wechat' | 'email' | 'sms';

export class Conversation {
  constructor(
    readonly id: string,
    readonly scope: string,
    readonly member: string | null,
    readonly channel: ConversationChannel,
    readonly subject: string,
    readonly order: string | null,
    readonly version: number
  ) {
    if (!id || !scope || !subject.trim() || !Number.isSafeInteger(version) || version < 0) throw new Error('SUPPORT_CONVERSATION_INVALID');
  }
}

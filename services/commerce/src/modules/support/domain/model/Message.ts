export type MessageAuthor = 'member' | 'agent' | 'system';

/** Messages have no transition methods: persistence enforces append-only history. */
export class Message {
  constructor(
    readonly id: string,
    readonly clientMessageId: string,
    readonly conversation: string,
    readonly author: MessageAuthor,
    readonly actor: string | null,
    readonly bodyHash: string,
    readonly sequence: number,
    readonly version: number,
    readonly createdAt: string
  ) {
    if (!id || !clientMessageId || !conversation || !/^[a-f0-9]{64}$/.test(bodyHash) || !Number.isSafeInteger(sequence) || sequence < 1 || !Number.isSafeInteger(version) || version < 1 || Number.isNaN(Date.parse(createdAt))) {
      throw new Error('SUPPORT_MESSAGE_INVALID');
    }
    Object.freeze(this);
  }
}

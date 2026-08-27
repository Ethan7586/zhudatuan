export type MessageAuthor = 'member' | 'agent' | 'system';

/** Messages have no transition methods: persistence enforces append-only history. */
export class Message {
  constructor(readonly id: string, readonly conversation: string, readonly author: MessageAuthor, readonly actor: string | null,
    readonly bodyHash: string, readonly createdAt: string) {
    if (!id || !conversation || !/^[a-f0-9]{64}$/.test(bodyHash) || Number.isNaN(Date.parse(createdAt))) {
      throw new Error('SUPPORT_MESSAGE_INVALID');
    }
  }
}

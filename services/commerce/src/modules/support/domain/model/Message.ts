export type MessageAuthor = 'member' | 'agent' | 'system';
export type MessageKind = 'text' | 'attachment' | 'system';
export type MessageVisibility = 'external' | 'internal';

/** Messages have no transition methods: persistence enforces append-only history. */
export class Message {
  constructor(
    readonly id: string,
    readonly clientMessageId: string,
    readonly conversation: string,
    readonly author: MessageAuthor,
    readonly actor: string,
    readonly kind: MessageKind,
    readonly visibility: MessageVisibility,
    readonly bodyHash: string,
    readonly sequence: number,
    readonly version: number,
    readonly createdAt: string
  ) {
    if (!id || !clientMessageId || !conversation || !actor || !/^[a-f0-9]{64}$/.test(bodyHash) || !Number.isSafeInteger(sequence) || sequence < 1 || !Number.isSafeInteger(version) || version < 1 || Number.isNaN(Date.parse(createdAt))) {
      throw new Error('SUPPORT_MESSAGE_INVALID');
    }
    if ((author === 'member' && visibility !== 'external') || (author === 'system' && (actor !== 'system' || kind !== 'system' || visibility !== 'internal')) || (author !== 'system' && kind === 'system'))
      throw new Error('SUPPORT_MESSAGE_AUDIENCE_INVALID');
    Object.freeze(this);
  }
}

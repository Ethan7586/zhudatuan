export class ReadState {
  constructor(
    readonly conversation: string,
    readonly membership: string,
    readonly lastSequence: number,
    readonly version: number
  ) {
    if (!conversation || !membership || !Number.isSafeInteger(lastSequence) || lastSequence < 0 || !Number.isSafeInteger(version) || version < 1) {
      throw new Error('SUPPORT_READ_STATE_INVALID');
    }
    Object.freeze(this);
  }

  advance(sequence: number): ReadState {
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('SUPPORT_READ_SEQUENCE_INVALID');
    return sequence <= this.lastSequence ? this : new ReadState(this.conversation, this.membership, sequence, this.version + 1);
  }
}

import { describe, expect, it } from 'vitest';
import { hashFile } from '@shop/sdk';

describe('Sha256', () => {
  it('matches the standard vector', async () => {
    expect(await hashFile(streamFile('abc', 'vector.csv'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes empty input', async () => {
    expect(await hashFile(streamFile('', 'empty.csv'))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

function streamFile(value: string, name: string): File {
  const file = new File([value], name, { type: 'text/csv' });
  Object.defineProperty(file, 'stream', { value: () => new ReadableStream({ start(controller) { if (value) controller.enqueue(new TextEncoder().encode(value)); controller.close(); } }) });
  return file;
}

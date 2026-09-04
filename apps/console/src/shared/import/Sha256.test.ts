import { describe, expect, it } from 'vitest';
import { Sha256 } from './Sha256';

describe('Sha256', () => {
  it('matches standard vectors across arbitrary stream boundaries', () => {
    const hash = new Sha256();
    hash.update(new TextEncoder().encode('a'));
    hash.update(new TextEncoder().encode('bc'));
    expect(hash.hex()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes empty input', () => {
    expect(new Sha256().hex()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

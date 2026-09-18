import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifySignedLevel, signedLevelNumber } from './SignedLevel';

const sql = readFileSync(new URL('../../database/levels/20260918010000_signed_level_codes.sql', import.meta.url), 'utf8');
const codes = [...sql.matchAll(/\('(L-?\d+)',(-?\d+),'([^']+)'\)/g)]
  .map(([, code = '', number = '', segment = '']) => ({ code, number: Number(number), segment }));

describe('copyable signed-level catalog', () => {
  it('publishes the agreed initial range without instance rows', () => {
    expect(codes.map(({ number }) => number)).toEqual(Array.from({ length: 17 }, (_, index) => index - 5));
    expect(sql).not.toMatch(/insert into\s+(?:identity|member|access|organization)\./i);
  });

  it('agrees with the existing L-kernel parser and segment classifier', () => {
    for (const { code, number, segment } of codes) {
      expect(code).toBe(`L${number}`);
      expect(signedLevelNumber(code)).toBe(number);
      expect(classifySignedLevel(code)).toBe(segment);
    }
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('payment webhook database boundary', () => {
  it('validates provider facts without requesting write locks on protected payment tables', () => {
    const source = readFileSync(join(import.meta.dirname, '../05_interface_jieru/http/PaymentWebhook.ts'), 'utf8');
    expect(source).not.toMatch(/for update of (?:intent|refund)/i);
  });
});

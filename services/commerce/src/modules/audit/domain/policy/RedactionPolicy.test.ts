import { describe, expect, it } from 'vitest';
import { RedactionPolicy } from './RedactionPolicy';

describe('RedactionPolicy', () => {
  it('removes secrets and minimizes contact data without mutating safe codes', () => {
    const source = { password:'secret', authorization:'Bearer private', verificationCode:'123456', phone:'13800138000',
      email:'person@example.com', address:'full street', errorCode:'PAYMENT_FAILED', nested:{ token:'private', value:'safe' } };
    expect(new RedactionPolicy().redact(source)).toEqual({ password:'[REDACTED]', authorization:'[REDACTED]',
      verificationCode:'[REDACTED]', phone:'13***00', email:'***@example.com', address:'[MINIMIZED]', errorCode:'PAYMENT_FAILED',
      nested:{ token:'[REDACTED]', value:'safe' } });
    expect(source.password).toBe('secret');
  });

  it('bounds depth, collection size and text size', () => {
    const result = new RedactionPolicy().redact({ values:Array.from({length:120},(_,index)=>index), text:'x'.repeat(700),
      deep:{ one:{ two:{ three:{ four:{ five:{ six:'hidden' } } } } } } }) as Record<string, unknown>;
    expect(result.values).toHaveLength(100);
    expect(String(result.text)).toHaveLength(500);
    expect(JSON.stringify(result)).toContain('[DEPTH_LIMIT]');
  });
});

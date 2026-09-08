import { describe, expect, it } from 'vitest';
import { actionField, requiredInteger, requiredMoneyMinor, validateActionInput } from '@shop/presentation/actions';

describe('miniapp action input', () => {
  it('normalizes declared fields and rejects undeclared or missing values', () => {
    const action = { id: 'save', label: '保存', description: '保存内容', tone: 'primary' as const, fields: [actionField('name', '名称')] };
    expect(validateActionInput(action, { name: '  福利  ' })).toEqual({ name: '福利' });
    expect(() => validateActionInput(action, { name: '', hidden: 'value' })).toThrow('MINIAPP_ACTION_FIELD_UNKNOWN');
    expect(() => validateActionInput(action, { name: '' })).toThrow('MINIAPP_ACTION_FIELD_REQUIRED:name');
  });

  it('parses quantities and yuan amounts without floating point rounding', () => {
    expect(requiredInteger({ quantity: '9' }, 'quantity', 1, 10)).toBe(9);
    expect(requiredMoneyMinor({ amount: '12.30' }, 'amount')).toBe(1230);
    expect(() => requiredMoneyMinor({ amount: '1.001' }, 'amount')).toThrow('MINIAPP_ACTION_FIELD_INVALID:amount');
  });
});

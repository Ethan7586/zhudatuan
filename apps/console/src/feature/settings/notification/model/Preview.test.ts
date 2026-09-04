import { describe, expect, it } from 'vitest';
import { createTemplatePreview, readVariableSchema } from './Preview';

describe('notification template preview', () => {
  it('validates typed variables and renders the exact reviewed content', () => {
    const schema = readVariableSchema('{"name":"string","amount":"money","paid":"boolean"}');
    const preview = createTemplatePreview('订单提醒', '{{name}} 的订单金额 {{amount}}，支付={{paid}}', schema, '{"name":"小王","amount":"100.00","paid":true}');
    expect(preview).toMatchObject({ subject: '订单提醒', body: '小王 的订单金额 100.00，支付=true', segments: 1 });
  });

  it('rejects undeclared placeholders and sample values with a mismatched type', () => {
    expect(() => createTemplatePreview(null, '{{unknown}}', {}, '{}')).toThrow('未在变量定义中声明');
    expect(() => createTemplatePreview(null, '{{count}}', { count: 'number' }, '{"count":"1"}')).toThrow('类型不匹配');
  });
});

import { describe, expect, it } from 'vitest';
import { productAttributes } from './ProductAttributes';

describe('productAttributes', () => {
  it('keeps ordinary attributes while protecting the verified cover reference', () => {
    expect(productAttributes({ subtitle: '原副标题', coverObject: 'object:old' }, { subtitle: '新副标题', coverObject: 'object:forged' }, 'object:verified')).toEqual({
      subtitle: '新副标题',
      coverObject: 'object:verified',
    });
  });

  it('removes both uploaded and external covers only after an explicit removal', () => {
    expect(productAttributes({ coverObject: 'object:old', coverUrl: 'https://assets.test/old.png', subtitle: '保留' }, null, null)).toEqual({ subtitle: '保留' });
  });

  it('preserves the current cover when image input is omitted', () => {
    expect(productAttributes({ coverObject: 'object:old' }, { coverObject: 'object:forged', description: '说明' }, undefined)).toEqual({ coverObject: 'object:old', description: '说明' });
  });
});

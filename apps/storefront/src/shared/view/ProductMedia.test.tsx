import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductMedia } from './ProductMedia';

describe('ProductMedia', () => {
  it('renders a normal image without changing its source', () => {
    const markup = renderToStaticMarkup(<ProductMedia source="/media/product.jpg" alt="商品" className="image" emptyClassName="empty" />);
    expect(markup).toContain('src="/media/product.jpg"');
    expect(markup).not.toContain('暂无商品图片');
  });

  it.each([undefined, null, '', '   '])('renders the empty state instead of an empty image source for %s', (source) => {
    const markup = renderToStaticMarkup(<ProductMedia source={source} alt="商品" className="image" emptyClassName="empty" />);
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('src=""');
    expect(markup).toContain('暂无商品图片');
  });
});

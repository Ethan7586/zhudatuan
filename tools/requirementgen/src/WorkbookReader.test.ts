import { describe, expect, it } from 'vitest';
import { sharedStrings, worksheet } from './WorkbookReader';

describe('WorkbookReader', () => {
  it('keeps self-closing sparse cells from consuming the next cell', () => {
    const xml = '<row><c r="A3" t="s"><v>0</v></c><c r="B3" t="s"/><c r="C3" t="s"><v>1</v></c></row>';
    expect(Object.fromEntries(worksheet(xml, ['平台层', '分销层']))).toEqual({ A3: '平台层', B3: '', C3: '分销层' });
  });

  it('joins rich shared strings and decodes XML entities', () => {
    const xml = '<sst><si><r><t>卡券</t></r><r><t xml:space="preserve">\n&amp;福利</t></r></si><si><t>商城&#10;首页</t></si></sst>';
    expect(sharedStrings(xml)).toEqual(['卡券\n&福利', '商城\n首页']);
  });
});

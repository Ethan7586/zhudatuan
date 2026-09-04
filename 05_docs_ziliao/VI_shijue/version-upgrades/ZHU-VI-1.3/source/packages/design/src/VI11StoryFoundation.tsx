import { Divider } from './Divider';
import { Icon, type IconSize } from './Icon';
import { Surface } from './Surface';

const colors = [
  ['智慧藍', 'var(--sw-brand)', '#1F5EFF'],
  ['深海藍', 'var(--sw-brand-dark)', '#143A8F'],
  ['夜空墨', 'var(--sw-brand-ink)', '#07182F'],
  ['主文字', 'var(--sw-text)', '#172033'],
  ['畫布', 'var(--sw-background)', '#F5F7FA'],
  ['表面', 'var(--sw-surface)', '#FFFFFF'],
  ['成功', 'var(--sw-success)', '#0F9F6E'],
  ['警告', 'var(--sw-warning)', '#F59E0B'],
  ['危險', 'var(--sw-danger)', '#DC2626'],
] as const;

const iconSizes: readonly [IconSize, string][] = [
  ['extraSmall', '12'],
  ['small', '16'],
  ['medium', '20'],
  ['standard', '24'],
  ['large', '28'],
  ['extraLarge', '32'],
  ['hero', '40'],
];

type GlyphKind = 'layers' | 'shield' | 'plus' | 'search' | 'refresh';

export function Glyph({ kind = 'layers' }: { readonly kind?: GlyphKind }) {
  if (kind === 'plus')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  if (kind === 'search')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="6" />
        <path d="m16 16 4 4" />
      </svg>
    );
  if (kind === 'refresh')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 7v5h-5M4 17v-5h5M18.2 9A7 7 0 0 0 6 7M5.8 15A7 7 0 0 0 18 17" />
      </svg>
    );
  if (kind === 'shield')
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="m12 3 7 3v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="m12 3 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4M4 17l8 4 8-4" />
    </svg>
  );
}

export function Heading({ eyebrow, title, note }: { readonly eyebrow: string; readonly title: string; readonly note: string }) {
  return (
    <header className="v11sectionhead">
      <div>
        <p className="swoverline">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p>{note}</p>
    </header>
  );
}

export function FoundationSections() {
  return (
    <>
      <section className="v11section">
        <Heading eyebrow="01 · Foundation" title="色彩與語義" note="品牌色只負責識別；狀態色只負責語義，不互相借用。" />
        <div className="v11swatches">
          {colors.map(([name, value, hex]) => (
            <div className="v11swatch" key={name}>
              <i style={{ background: value }} />
              <strong>{name}</strong>
              <code>{hex}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="v11section v11twocol">
        <div>
          <Heading eyebrow="02 · Typography" title="字體階梯" note="最小正式字級 12px；金額與版本號使用等寬數字。" />
          <div className="v11type">
            <p className="swdisplay">Display 32/40</p>
            <p className="swheading">Heading 28/36</p>
            <p className="swtitle">Title 20/28</p>
            <p className="swbody">Body 16/24 · 清楚而從容的正文節奏</p>
            <p className="swcaption">Caption 12/18 · 輔助信息的最低層級</p>
            <p className="swamount">¥ 18,425,000.00</p>
          </div>
        </div>
        <div>
          <Heading eyebrow="03 · Shape" title="圓角與間距" note="4/8pt 網格；8/12/16/24 四檔圓角。" />
          <div className="v11shapegrid">
            <div data-radius="8">8</div>
            <div data-radius="12">12</div>
            <div data-radius="16">16</div>
            <div data-radius="24">24</div>
          </div>
          <div className="v11spacing">
            <i data-space="4" />
            <i data-space="8" />
            <i data-space="12" />
            <i data-space="16" />
            <i data-space="24" />
            <i data-space="32" />
          </div>
        </div>
      </section>

      <section className="v11section">
        <Heading eyebrow="04 · Depth & Layer" title="陰影與圖層" note="普通內容以描邊為主；只有真正浮起的互動面才增加深度。" />
        <div className="v11depth">
          <Surface depth="flat">
            <strong>Flat</strong>
            <span>0 · 內容平面</span>
          </Surface>
          <Surface depth="low">
            <strong>Low</strong>
            <span>10 · 普通卡片</span>
          </Surface>
          <Surface depth="raised">
            <strong>Raised</strong>
            <span>40–50 · 選單/Popover</span>
          </Surface>
          <Surface depth="floating">
            <strong>Floating</strong>
            <span>60–100 · Drawer/Modal/Command</span>
          </Surface>
        </div>
        <div className="v11layers" aria-label="圖層順序">
          <span>Base 0</span>
          <span>Sticky 20</span>
          <span>Header 30</span>
          <span>Dropdown 40</span>
          <span>Popover 50</span>
          <span>Drawer 60</span>
          <span>Overlay 70</span>
          <span>Modal 80</span>
          <span>Toast 90</span>
          <span>Command 100</span>
        </div>
      </section>

      <section className="v11section v11twocol">
        <div>
          <Heading eyebrow="05 · Icon" title="Icon 光學規則" note="24px viewBox、2px round stroke；只有 Hero 允許 40px。" />
          <div className="v11icons">
            {iconSizes.map(([size, px]) => (
              <div key={size}>
                <Icon size={size} tone={size === 'hero' ? 'brand' : 'current'}>
                  <Glyph />
                </Icon>
                <code>{px}</code>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Heading eyebrow="06 · Divider" title="分割線" note="先用留白分組；只有關係仍不清楚時才加線。" />
          <div className="v11dividers">
            <span>Subtle</span>
            <Divider tone="subtle" />
            <span>Default</span>
            <Divider />
            <span>Strong</span>
            <Divider tone="strong" />
            <div className="v11inverse">
              <span>Inverse</span>
              <Divider tone="inverse" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

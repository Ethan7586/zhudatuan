import type { ExperienceBlock, ExperienceDocument } from '../model/Experience';
import { componentDefinition } from '../model/ComponentCatalog';
import { themePreset } from '../model/ThemePreset';

export function Canvas({ document, page, block, device, onSelect }: Readonly<{ document: ExperienceDocument; page: number; block: number | null; device: 'desktop' | 'tablet' | 'mobile'; onSelect: (index: number) => void }>) {
  const selected = document.pages[page] ?? document.pages[0];
  if (!selected) return <p className="designercanvasempty">尚未建立可编辑页面。</p>;
  const visual = themePreset(document.theme.preset).visual;
  return (
    <div
      className="designercanvasframe"
      data-device={device}
      style={
        {
          '--designer-primary': document.theme.primaryColor,
          '--designer-accent': document.theme.accentColor,
          '--designer-surface': visual.surface,
          '--designer-radius': visual.radius,
          '--designer-heading': visual.headingFont,
          '--designer-gap': visual.sectionGap,
        } as React.CSSProperties
      }
    >
      <article className="designercanvas" data-theme={document.theme.preset} aria-label={`${selected.path} 页面画布`}>
        <header>
          <strong>{navigationLabel(document, selected.id)}</strong>
          <nav>
            {document.navigation.map((item) => (
              <span key={item.id}>{item.label}</span>
            ))}
          </nav>
        </header>
        {selected.blocks.length === 0 ? <p className="designercanvasempty">这个页面还是空的，请从左侧添加组件。</p> : null}
        {selected.blocks.map((item, index) => (
          <button key={item.id} type="button" className="designercanvasblock" data-selected={block === index} onClick={() => onSelect(index)} aria-label={`编辑${componentDefinition(item.component).name}`}>
            <Block block={item} />
          </button>
        ))}
      </article>
    </div>
  );
}

function Block({ block }: Readonly<{ block: ExperienceBlock }>) {
  const content = block.content;
  if (block.component === 'hero')
    return (
      <section className="designhero">
        <small>{text(content.eyebrow)}</small>
        <strong>{text(content.title, '欢迎来到福利商城')}</strong>
        <p>{text(content.subtitle)}</p>
      </section>
    );
  if (block.component === 'notice')
    return (
      <section className="designnotice">
        <i aria-hidden="true">告</i>
        <span>{text(content.announcement ?? content.text, '请填写公告')}</span>
      </section>
    );
  if (block.component === 'shortcut')
    return (
      <section className="designshortcuts">
        <strong>{text(content.title, '快捷服务')}</strong>
        <div>
          {items(content.items).map((item) => (
            <span key={item.id}>
              <i aria-hidden="true">{item.icon.slice(0, 1)}</i>
              {item.label}
            </span>
          ))}
        </div>
      </section>
    );
  if (block.component === 'productcollection')
    return (
      <section className="designproducts">
        <header>
          <strong>{text(content.title, '精选商品')}</strong>
          <small>{text(content.subtitle)}</small>
        </header>
        <div>
          {Array.from({ length: number(content.displayLimit, 4) }, (_, index) => (
            <span key={index}>
              <i />
              <b>商品 {index + 1}</b>
              <small>以线上权威商品为准</small>
            </span>
          ))}
        </div>
      </section>
    );
  return (
    <section className="designrichtext">
      <strong>{text(content.title, '图文内容')}</strong>
      <p>{text(content.content ?? content.text, '请填写内容')}</p>
    </section>
  );
}

function navigationLabel(document: ExperienceDocument, page: string) {
  return document.navigation.find((item) => item.page === page)?.label ?? '商城页面';
}
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : fallback;
}
function items(value: unknown): readonly Readonly<{ id: string; label: string; icon: string }>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Readonly<Record<string, unknown>>;
    return [{ id: text(source.id, String(index)), label: text(source.label, '快捷入口'), icon: text(source.icon, 'link') }];
  });
}

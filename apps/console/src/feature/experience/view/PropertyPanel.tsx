import { EXPERIENCE_ACTIONS, type ExperienceAction } from '@shop/contract';
import { componentDefinition } from '../model/ComponentCatalog';
import type { ExperienceBlock } from '../model/Experience';
import { themePresets } from '../model/ThemePreset';
import type { VersionViewModel } from '../viewmodel/VersionViewModel';

export function PropertyPanel({ model }: Readonly<{ model: VersionViewModel }>) {
  const document = model.document;
  const page = document?.pages[model.page];
  const block = model.block === null ? undefined : page?.blocks[model.block];
  if (!document || !page)
    return (
      <aside className="designerproperties">
        <p>正在准备属性面板…</p>
      </aside>
    );
  return (
    <aside className="designerproperties" aria-label="属性面板">
      <header>
        <strong>{block ? componentDefinition(block.component).name : '页面与主题'}</strong>
        <small>{block ? '组件属性' : '全局属性'}</small>
      </header>
      <fieldset className="designerpropertylock" disabled={model.locked}>
        {block ? <BlockFields block={block} model={model} /> : <PageFields model={model} />}
      </fieldset>
    </aside>
  );
}

function PageFields({ model }: Readonly<{ model: VersionViewModel }>) {
  const document = model.document!;
  const page = document.pages[model.page]!;
  const label = document.navigation.find((item) => item.page === page.id)?.label ?? '';
  return (
    <div className="designerfields">
      <Field label="页面名称">
        <input value={label} maxLength={40} onChange={(event) => model.actions.pageField('label', event.target.value)} />
      </Field>
      <Field label="页面路径" hint={page.path === 'home' ? '首页路径固定为 home。' : '只使用小写字母、数字、斜线和短横线。'}>
        <input value={page.path} disabled={page.path === 'home'} maxLength={128} onChange={(event) => model.actions.pageField('path', event.target.value.toLowerCase().replace(/[^a-z0-9/-]/g, ''))} />
      </Field>
      <fieldset>
        <legend>品牌气质</legend>
        {themePresets.map((preset) => (
          <div key={preset.id} className="designerthemechoice">
            <input id={`designertheme-${preset.id}`} type="radio" name="designer-theme" checked={document.theme.preset === preset.id} onChange={() => model.actions.theme(preset.id)} />
            <i style={{ background: preset.theme.primaryColor }} />
            <label htmlFor={`designertheme-${preset.id}`}>
              <strong>{preset.name}</strong>
              <small>{preset.temperament}</small>
            </label>
          </div>
        ))}
      </fieldset>
      <Field label="主品牌色">
        <input type="color" value={document.theme.primaryColor} onChange={(event) => model.actions.themeField('primaryColor', event.target.value.toUpperCase())} />
      </Field>
      <Field label="强调色">
        <input type="color" value={document.theme.accentColor} onChange={(event) => model.actions.themeField('accentColor', event.target.value.toUpperCase())} />
      </Field>
    </div>
  );
}

function BlockFields({ block, model }: Readonly<{ block: ExperienceBlock; model: VersionViewModel }>) {
  const content = block.content;
  const update = (patch: Readonly<Record<string, unknown>>) => model.actions.content(Object.freeze({ ...content, ...patch }) as ExperienceBlock['content']);
  return (
    <div className="designerfields">
      {block.component === 'hero' ? (
        <>
          <Text label="眉题" value={text(content.eyebrow)} max={40} onChange={(value) => update({ eyebrow: value })} />
          <Text label="主标题" value={text(content.title)} max={80} onChange={(value) => update({ title: value })} />
          <Text label="副标题" value={text(content.subtitle)} max={160} onChange={(value) => update({ subtitle: value })} />
          <Area label="补充说明" value={text(content.description)} max={300} onChange={(value) => update({ description: value })} />
        </>
      ) : null}
      {block.component === 'notice' ? <Area label="公告内容" value={text(content.announcement ?? content.text)} max={300} onChange={(value) => model.actions.content(Object.freeze({ announcement: value }))} /> : null}
      {block.component === 'richtext' ? (
        <>
          <Text label="标题" value={text(content.title)} max={80} onChange={(value) => update({ title: value })} />
          <Area label="正文" value={text(content.content ?? content.text)} max={2000} onChange={(value) => model.actions.content(Object.freeze({ title: text(content.title), content: value }))} />
        </>
      ) : null}
      {block.component === 'productcollection' ? (
        <>
          <Text label="模块标题" value={text(content.title)} max={80} onChange={(value) => update({ title: value })} />
          <Text label="补充说明" value={text(content.subtitle)} max={160} onChange={(value) => update({ subtitle: value })} />
          <Text
            label="商品集合代码"
            value={text(content.collectionId ?? content.pool)}
            max={255}
            hint="从商品管理中的集合详情复制；发布校验会确认可用性。"
            onChange={(value) => model.actions.content(Object.freeze({ title: text(content.title), subtitle: text(content.subtitle), collectionId: value, displayLimit: number(content.displayLimit, 4) }))}
          />
          <Field label="展示数量">
            <select value={number(content.displayLimit, 4)} onChange={(event) => update({ displayLimit: Number(event.target.value) })}>
              {[2, 4, 6, 8].map((value) => (
                <option key={value} value={value}>
                  {value} 件
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}
      {block.component === 'shortcut' ? <ShortcutFields block={block} model={model} /> : null}
      {block.component === 'shortcut' ? null : <ActionFields action={block.action} onChange={model.actions.blockAction} />}
    </div>
  );
}

function ShortcutFields({ block, model }: Readonly<{ block: ExperienceBlock; model: VersionViewModel }>) {
  const content = block.content;
  const values = shortcutItems(content.items);
  const commit = (items: readonly ShortcutItem[]) => model.actions.content(Object.freeze({ title: text(content.title), items: Object.freeze(items) }));
  return (
    <>
      <Text label="模块标题" value={text(content.title)} max={40} onChange={(value) => model.actions.content(Object.freeze({ ...content, title: value }))} />
      {values.map((item, index) => (
        <fieldset key={item.id}>
          <legend>入口 {index + 1}</legend>
          <Text label="名称" value={item.label} max={20} onChange={(value) => commit(values.map((candidate, current) => (current === index ? Object.freeze({ ...candidate, label: value }) : candidate)))} />
          <Field label="图标">
            <select value={item.icon} onChange={(event) => commit(values.map((candidate, current) => (current === index ? Object.freeze({ ...candidate, icon: event.target.value }) : candidate)))}>
              {['grid', 'gift', 'ticket', 'star', 'store', 'building', 'map-pin', 'link'].map((icon) => (
                <option key={icon} value={icon}>
                  {iconLabel(icon)}
                </option>
              ))}
            </select>
          </Field>
          <Text
            label="目标"
            value={item.action.target}
            max={255}
            onChange={(value) => commit(values.map((candidate, current) => (current === index ? Object.freeze({ ...candidate, action: Object.freeze({ ...candidate.action, target: value }) }) : candidate)))}
          />
          <button type="button" disabled={values.length === 1} onClick={() => commit(values.filter((_, current) => current !== index))}>
            删除此入口
          </button>
        </fieldset>
      ))}
      <button type="button" disabled={values.length >= 8} onClick={() => commit([...values, newShortcut(block.id, values)])}>
        添加快捷入口
      </button>
    </>
  );
}

function ActionFields({ action, onChange }: Readonly<{ action: ExperienceAction | undefined; onChange: (value: ExperienceAction | undefined) => void }>) {
  return (
    <fieldset>
      <legend>点击行为</legend>
      <Field label="动作">
        <select value={action?.type ?? ''} onChange={(event) => onChange(event.target.value === '' ? undefined : { type: event.target.value as ExperienceAction['type'], target: action?.target ?? '' })}>
          <option value="">无点击动作</option>
          {EXPERIENCE_ACTIONS.map((type) => (
            <option key={type} value={type}>
              {actionLabel(type)}
            </option>
          ))}
        </select>
      </Field>
      {action ? <Text label="目标" value={action.target} max={255} hint={action.type === 'link' ? '站内路径，例如 /pages/offers。' : '填写对应业务对象代码。'} onChange={(target) => onChange({ ...action, target })} /> : null}
    </fieldset>
  );
}

function Field({ label, hint, children }: Readonly<{ label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <label>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
function Text({ label, value, max, hint, onChange }: Readonly<{ label: string; value: string; max: number; hint?: string; onChange: (value: string) => void }>) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
function Area({ label, value, max, onChange }: Readonly<{ label: string; value: string; max: number; onChange: (value: string) => void }>) {
  return (
    <Field label={label}>
      <textarea value={value} maxLength={max} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
type ShortcutItem = Readonly<{ id: string; label: string; icon: string; action: Readonly<{ type: 'category'; target: string }> }>;
function shortcutItems(value: unknown): readonly ShortcutItem[] {
  return Array.isArray(value) ? value.flatMap((item) => (item && typeof item === 'object' ? [item as ShortcutItem] : [])) : [];
}
function newShortcut(block: string, items: readonly ShortcutItem[]): ShortcutItem {
  let ordinal = items.length + 1;
  while (items.some((item) => item.id === `${block}:item:${ordinal}`)) ordinal += 1;
  return Object.freeze({ id: `${block}:item:${ordinal}`, label: `入口 ${ordinal}`, icon: 'link', action: Object.freeze({ type: 'category', target: 'all' }) });
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function number(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}
function iconLabel(value: string): string {
  return ({ grid: '分类', gift: '礼物', ticket: '卡券', star: '收藏', store: '商城', building: '企业', 'map-pin': '位置', link: '链接' } as Record<string, string>)[value] ?? value;
}
function actionLabel(value: string): string {
  return ({ link: '站内页面', product: '商品', category: '分类', collection: '商品集合', exchangeableproduct: '可兑换商品', micropage: '微页面', marketingactivity: '营销活动' } as Record<string, string>)[value] ?? value;
}

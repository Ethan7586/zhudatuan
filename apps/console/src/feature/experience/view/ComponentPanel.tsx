import { componentCatalog, componentDefinition } from '../model/ComponentCatalog';
import type { VersionViewModel } from '../viewmodel/VersionViewModel';

export function ComponentPanel({ model }: Readonly<{ model: VersionViewModel }>) {
  const blocks = model.document?.pages[model.page]?.blocks ?? [];
  return (
    <aside className="designercomponents" aria-label="组件库与页面组件">
      <section>
        <header>
          <strong>组件库</strong>
          <small>受控组件</small>
        </header>
        <div className="designercomponentgrid">
          {componentCatalog.map((item) => (
            <button key={item.type} type="button" onClick={() => model.actions.addBlock(item.type)} disabled={!model.document || model.locked}>
              <i aria-hidden="true">{item.symbol}</i>
              <span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <header>
          <strong>当前页面</strong>
          <small>{blocks.length} 个组件</small>
        </header>
        {blocks.length === 0 ? <p className="designerempty">从上方选择一个组件，建立页面内容。</p> : null}
        <ol className="designerblocklist">
          {blocks.map((block, index) => (
            <li key={block.id} data-selected={model.block === index}>
              <button type="button" onClick={() => model.actions.selectBlock(index)}>
                <i aria-hidden="true">{componentDefinition(block.component).symbol}</i>
                <span>
                  <strong>{componentDefinition(block.component).name}</strong>
                  <small>第 {index + 1} 个</small>
                </span>
              </button>
              <nav aria-label={`${componentDefinition(block.component).name}排序与删除`}>
                <button type="button" aria-label="上移组件" disabled={index === 0 || model.locked} onClick={() => model.actions.moveBlock(index, -1)}>
                  ↑
                </button>
                <button type="button" aria-label="下移组件" disabled={index === blocks.length - 1 || model.locked} onClick={() => model.actions.moveBlock(index, 1)}>
                  ↓
                </button>
                <button type="button" aria-label="删除组件" disabled={model.locked} onClick={() => model.actions.removeBlock(index)}>
                  ×
                </button>
              </nav>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

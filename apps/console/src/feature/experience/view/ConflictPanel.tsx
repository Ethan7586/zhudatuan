import type { DesignerConflict } from '../viewmodel/DesignerAutosave';

export function ConflictPanel({ conflict, onMerge, onReload }: Readonly<{ conflict: DesignerConflict; onMerge: () => void; onReload: () => void }>) {
  const overlaps = conflict.plan.differences.filter((item) => item.overlaps).length;
  return (
    <section className="designerconflict" aria-labelledby="designerconflicttitle">
      <header>
        <div>
          <strong id="designerconflicttitle">检测到其他人的新版本</strong>
          <small>当前修改已停止保存，没有覆盖服务端内容</small>
        </div>
        <span>{overlaps > 0 ? `${overlaps} 项同字段冲突` : '可以安全合并'}</span>
      </header>
      <p>{overlaps > 0 ? '双方修改了相同字段或页面结构。为避免覆盖，请载入最新版后重新编辑这些内容。' : '双方修改互不重叠。可将你的修改合并到最新版，再自动保存为一个新版本。'}</p>
      <div className="designerconflictlist" role="list" aria-label="版本字段差异">
        {conflict.plan.differences.map((item) => (
          <article key={item.path} role="listitem" data-overlap={item.overlaps}>
            <header>
              <strong>{item.label}</strong>
              <span>{item.overlaps ? '同字段冲突' : '互不重叠'}</span>
            </header>
            <dl>
              <div>
                <dt>我的修改</dt>
                <dd>{item.local}</dd>
              </div>
              <div>
                <dt>最新版本</dt>
                <dd>{item.current}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <footer>
        <button type="button" onClick={onReload}>
          载入最新版本
        </button>
        <button className="isprimary" type="button" onClick={onMerge} disabled={!conflict.plan.safe}>
          安全合并并保存
        </button>
      </footer>
    </section>
  );
}

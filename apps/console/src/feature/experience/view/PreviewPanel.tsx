import type { VersionViewModel } from '../viewmodel/VersionViewModel';

export function PreviewPanel({ model }: Readonly<{ model: VersionViewModel }>) {
  return (
    <aside className="designercomponents designerpreviewinfo">
      <strong>不可变版本</strong>
      <p>画布正在读取第 {model.preview?.sequence} 版的服务端快照。编辑控件已锁定，发布时使用同一个版本编号和内容哈希。</p>
      <dl>
        <div>
          <dt>版本</dt>
          <dd>第 {model.preview?.sequence} 版</dd>
        </div>
        <div>
          <dt>校验</dt>
          <dd>{model.validated ? '已通过' : '待校验'}</dd>
        </div>
        <div>
          <dt>内容摘要</dt>
          <dd>{model.preview?.configuration_hash.slice(0, 12)}…</dd>
        </div>
      </dl>
    </aside>
  );
}

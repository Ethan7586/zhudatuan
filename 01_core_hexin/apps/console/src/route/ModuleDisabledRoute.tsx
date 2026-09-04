import { ResourcePanel } from '@shop/design';

export function ModuleDisabledRoute() {
  return (
    <ResourcePanel title="模块已停用" description="该模块当前已停用，暂时无法使用。"
      condition="failure" error="MODULE_DISABLED">
      <span />
    </ResourcePanel>
  );
}

import { Button } from '@shop/design';

export function SupportHeader({ scope, settings, connected, onSettings, onRefresh }: Readonly<{ scope: string; settings: boolean; connected: boolean; onSettings: () => void; onRefresh: () => void }>) {
  return (
    <header className="supportheader">
      <div>
        <p>智慧翼 · 客户服务</p>
        <h1>客服中心</h1>
        <span>当前范围：{scope}</span>
      </div>
      <div className="supportheaderactions">
        <span className="supportconnection" data-connected={connected}>
          {connected ? '实时连接正常' : '正在恢复实时连接'}
        </span>
        <Button onPress={onRefresh}>刷新</Button>
        <Button tone={settings ? 'primary' : 'default'} onPress={onSettings}>
          {settings ? '返回工作台' : '客服设置'}
        </Button>
      </div>
    </header>
  );
}

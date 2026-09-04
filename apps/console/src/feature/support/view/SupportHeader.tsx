import { Button } from '@shop/design';

export function SupportHeader({ scope, settings, settingsAvailable, connected, realtime, onSettings, onRefresh }: Readonly<{ scope: string; settings: boolean; settingsAvailable: boolean; connected: boolean; realtime: boolean; onSettings: () => void; onRefresh: () => void }>) {
  return (
    <header className="supportheader">
      <div>
        <p>智慧翼 · 客户服务</p>
        <h1>客服中心</h1>
        <span>当前范围：{scope}</span>
      </div>
      <div className="supportheaderactions">
        <span className="supportconnection" data-connected={connected}>
          {!realtime ? '手动刷新模式' : connected ? '实时连接正常' : '正在恢复实时连接'}
        </span>
        <Button onPress={onRefresh}>刷新</Button>
        {settings || settingsAvailable ? <Button tone={settings ? 'primary' : 'default'} onPress={onSettings}>{settings ? '返回工作台' : '客服设置'}</Button> : null}
      </div>
    </header>
  );
}

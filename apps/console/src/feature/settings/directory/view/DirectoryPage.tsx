import { Button, ResourcePanel } from '@shop/design';
import { chineseReference, chineseSectionLabel } from '@shop/presentation';
import type { DirectoryViewModel } from '../viewmodel/DirectoryViewModel';
import { DirectoryTable } from './DirectoryTable';
import { SyncDialog } from './SyncDialog';
import { SyncRunTable } from './SyncRunTable';
import '../Directory.css';

export function DirectoryPage({ title, model }: Readonly<{ title: string; model: DirectoryViewModel }>) {
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('通讯录同步')}
        description="目录连接、同步历史、任务水位和处理计数均来自组织服务；浏览器刷新后仍可继续查看、取消或恢复任务。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
            {model.fetching ? '正在刷新…' : '刷新全部'}
          </Button>
        }
        notice={
          <section className="capabilitynote">
            <h2>后台同步不阻塞页面</h2>
            <p>每个供应商使用独立任务和租约；页面仅发出命令并轮询权威状态，事件收件箱负责去重，游标只在数据持久化成功后推进。</p>
          </section>
        }
      >
        {model.directories ? (
          <div className="featurestack">
            <DirectoryTable rows={model.directories.items} model={model} />
            <div className="pagination">
              <span>本页 {model.directories.count} 条</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {model.directories.nextCursor ? <Button onPress={() => model.actions.next(model.directories?.nextCursor ?? '')}>下一页</Button> : null}
              </div>
            </div>
          </div>
        ) : null}
      </ResourcePanel>
      {model.selectedId ? (
        <section className="directoryhistory" aria-labelledby="directoryhistorytitle">
          <header>
            <div>
              <p className="eyebrow">可恢复任务历史</p>
              <h2 id="directoryhistorytitle">{model.selected ? (model.selected.type === 'wecomcorp' ? '企业微信自建应用' : '企业微信第三方应用') : chineseReference('目录', model.selectedId)}</h2>
            </div>
            <span>{model.selected ? `成功源版本 ${model.selected.successfulVersion}` : '独立权威读取'}</span>
          </header>
          {model.historyError ? (
            <p className="directoryerror" role="alert">
              {model.historyError}
            </p>
          ) : null}
          {model.runs ? (
            <>
              <SyncRunTable rows={model.runs.items} model={model} />
              <div className="pagination">
                <span>本页 {model.runs.count} 条</span>
                <div>
                  {model.runCursor ? <Button onPress={model.actions.firstRun}>最新运行</Button> : null}
                  {model.runs.nextCursor ? <Button onPress={() => model.actions.nextRun(model.runs?.nextCursor ?? '')}>更早运行</Button> : null}
                </div>
              </div>
            </>
          ) : (
            <p>正在读取同步历史…</p>
          )}
        </section>
      ) : null}
      {model.receipt ? (
        <section className="directoryreceipt" role="status">
          <strong>任务状态已更新</strong>
          <span>
            {chineseReference(model.receipt.preview ? '差异预览任务' : '同步任务', model.receipt.id)} · {model.receipt.mode === 'full' ? '全量' : '增量'} · {model.receipt.state}
          </span>
          <Button onPress={model.actions.dismissReceipt}>知道了</Button>
        </section>
      ) : null}
      <SyncDialog model={model} />
    </>
  );
}

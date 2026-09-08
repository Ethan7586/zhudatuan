import { Button, Status } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { FinanceImportViewModel } from '../viewmodel/FinanceImportViewModel';
import './FinanceImport.css';

export function FinanceImportTemplateStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  return (
    <section className="financeimportcontent">
      <header>
        <h3>{model.template.title}</h3>
        <p>{model.template.description}</p>
      </header>
      {model.providers.pending ? (
        <section className="financeimportnotice" role="status">
          <strong>正在读取渠道目录</strong>
          <p>只显示当前范围已启用、健康且声明 Statement 能力的 Provider。</p>
        </section>
      ) : model.providers.error ? (
        <section className="financeimportnotice" role="alert">
          <strong>渠道目录暂时不可用</strong>
          <p>{model.providers.error}</p>
        </section>
      ) : model.providers.items.length === 0 ? (
        <section className="financeimportnotice">
          <strong>暂无可用账单渠道</strong>
          <p>{model.providers.reason}</p>
        </section>
      ) : (
        <label>
          账单来源渠道
          <select aria-label="账单来源渠道" value={model.draft.provider} onChange={(event) => model.actions.provider(event.target.value)}>
            <option value="">请选择渠道</option>
            {model.providers.items.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label} · {provider.business}
              </option>
            ))}
          </select>
        </label>
      )}
      {model.provider ? (
        <section className="financeprovidercard" aria-label="所选渠道映射">
          <div>
            <strong>{model.provider.label}</strong>
            <Status tone="success">连接健康</Status>
          </div>
          <p>{model.provider.help}</p>
          <dl>
            <div>
              <dt>连接</dt>
              <dd>{chineseReference('渠道连接', model.provider.connection)}</dd>
            </div>
            <div>
              <dt>协议版本</dt>
              <dd>{model.provider.contractVersion}</dd>
            </div>
            <div>
              <dt>区域</dt>
              <dd>{model.provider.region}</dd>
            </div>
          </dl>
        </section>
      ) : null}
      <section className="financeimporttemplate">
        <strong>统一账单列</strong>
        <p>{model.template.columns.join('、')}</p>
        <small>Provider 适配器在服务端完成字段规范化；浏览器不读取业务行，也不会猜测未知列。</small>
        <Button onPress={model.actions.download}>下载 CSV 模板</Button>
      </section>
      {model.providers.items.length > 0 && model.validation ? <p className="financeimporthint">{model.validation}</p> : null}
      <footer>
        <Button onPress={model.actions.close}>取消</Button>
        <Button tone="primary" onPress={model.actions.next} isDisabled={model.validation !== undefined}>
          下一步：上传文件
        </Button>
      </footer>
    </section>
  );
}

export function FinanceImportUploadStep({ model }: Readonly<{ model: FinanceImportViewModel }>) {
  return (
    <section className="financeimportcontent">
      <header>
        <h3>上传待预检账单</h3>
        <p>支持 CSV 与 XLSX。系统流式计算完整文件哈希并直传隔离区，不在浏览器解析账单行。</p>
      </header>
      <label>
        选择账单文件
        <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => model.actions.file(event.target.files?.[0] ?? null)} />
      </label>
      {model.draft.file ? (
        <section className="financefilecard">
          <strong>{model.draft.file.name}</strong>
          <span>{formatBytes(model.draft.file.size)}</span>
          <small>提交后先执行恶意内容扫描、格式校验与完整性校验。</small>
        </section>
      ) : null}
      {model.validation ? <p className="financeimporthint">{model.validation}</p> : null}
      <footer>
        <Button onPress={model.actions.back}>返回模板</Button>
        <Button tone="primary" onPress={model.actions.next} isDisabled={model.validation !== undefined}>
          下一步：核对映射
        </Button>
      </footer>
    </section>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

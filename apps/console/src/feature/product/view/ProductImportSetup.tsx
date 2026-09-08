import type { ProductImportViewModel } from '../viewmodel/ProductImportViewModel';

export function ProductImportSetup({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  if (viewmodel.step === 1) return <TemplateStep viewmodel={viewmodel} />;
  if (viewmodel.step === 2) return <UploadStep viewmodel={viewmodel} />;
  if (viewmodel.step === 3) return <MappingStep viewmodel={viewmodel} />;
  return null;
}

function TemplateStep({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  return (
    <>
      <section className="productimportcard">
        <strong>{viewmodel.template.title}标准模板</strong>
        <p>{viewmodel.template.description}</p>
        <small>标准列：{viewmodel.template.columns.join('、')}。请保留列名；公式只按计算结果读取，不执行宏或脚本。</small>
        <button type="button" onClick={viewmodel.actions.download}>
          下载 CSV 模板
        </button>
      </section>
      <p className="productflownote">支持 CSV 与 XLSX。文件由服务端扫描、流式解析和逐行校验，浏览器不会把本地预览当作导入成功。</p>
      <StepFooter viewmodel={viewmodel} next="下一步：选择文件" />
    </>
  );
}

function UploadStep({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  return (
    <>
      <label>
        商品文件
        <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => viewmodel.actions.file(event.target.files?.[0] ?? null)} />
      </label>
      <section className="productimportcard">
        <strong>{viewmodel.file ? viewmodel.file.name : '尚未选择文件'}</strong>
        <p>{viewmodel.file ? `${formatBytes(viewmodel.file.size)} · 文件将在提交校验时安全上传` : 'CSV 最大 1 GiB；XLSX 最大 32 MiB。'}</p>
        <small>系统会分块计算 SHA-256，上传会话与文件类型均由服务端再次验证。</small>
      </section>
      {viewmodel.file !== null && viewmodel.fileError !== undefined ? (
        <p role="alert" className="productflowerror">
          {viewmodel.fileError}
        </p>
      ) : null}
      <StepFooter viewmodel={viewmodel} next="下一步：核对映射" disabled={viewmodel.fileError !== undefined} />
    </>
  );
}

function MappingStep({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  return (
    <>
      <section className="productimportcard">
        <strong>字段映射</strong>
        <p>使用标准列名自动映射；服务端会依据商品合同再次验证类型、类目、SKU 和必填属性。</p>
        <dl>
          {viewmodel.template.columns.map((column) => (
            <div key={column}>
              <dt>{column}</dt>
              <dd>文件列 → 商品字段</dd>
            </div>
          ))}
        </dl>
      </section>
      <label className="productimportconfirm">
        <input type="checkbox" checked={viewmodel.confirmed} disabled={viewmodel.busy} onChange={(event) => viewmodel.actions.confirmed(event.target.checked)} />
        我确认文件来源可信，且本次仅创建或更新商品与 SKU 草稿；不会绕过资格、价格、库存和发布检查。
      </label>
      {viewmodel.assurance < 2 ? (
        <section className="productimportcard">
          <strong>需要二次验证</strong>
          <p>商品导入属于高风险批量操作，请先完成二次验证。</p>
          <button type="button" onClick={viewmodel.actions.stepup}>
            立即验证
          </button>
        </section>
      ) : null}
      {viewmodel.error ? (
        <p role="alert" className="productflowerror">
          {viewmodel.error}
        </p>
      ) : null}
      <footer className="productimportfooter">
        <button type="button" onClick={viewmodel.actions.back} disabled={viewmodel.busy}>
          返回
        </button>
        <button className="productactionprimary" type="button" onClick={viewmodel.actions.validate} disabled={!viewmodel.confirmed || viewmodel.fileError !== undefined || viewmodel.busy}>
          {viewmodel.busy ? '正在安全上传…' : '上传并开始服务端校验'}
        </button>
      </footer>
    </>
  );
}

function StepFooter({ viewmodel, next, disabled = false }: Readonly<{ viewmodel: ProductImportViewModel; next: string; disabled?: boolean }>) {
  return (
    <footer className="productimportfooter">
      <button type="button" onClick={viewmodel.step === 1 ? viewmodel.actions.close : viewmodel.actions.back}>
        {viewmodel.step === 1 ? '取消' : '返回'}
      </button>
      <button className="productactionprimary" type="button" onClick={viewmodel.actions.next} disabled={disabled}>
        {next}
      </button>
    </footer>
  );
}

function formatBytes(value: number): string {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

# 商品导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

商品导入预检/执行停滞、分类或属性 Schema 漂移、SKU/来源键冲突、错误率或 Deadletter 越界时触发。影响仅限草稿 Product/Sku/Listing；未经合法资格、价格和库存校验的商品绝不能发布。跨 Supplier Scope 或错误上架为 P0。

## Owner 与前置权限

Catalog Owner 主责，Supplier、Qualification、Pricing、Inventory 与 Security 协同。先遵循 `import.md` 的统一 Runtime 权限、对象和命令；本手册只增加商品领域规则。

## 只读诊断（Diagnosis）

除统一证据外，核对 `title`、`sku`、`category`、可选 `type/attributes`，来源 Product/SKU 唯一键、属性 Schema 版本、Supplier 所有权、资格、Pool/Listing 引用和发布状态。检查失败是否停留在草稿，不能把错误详情替换成原始行内容。

## 止血（Stop loss）

暂停该 Scope 导入及候选 Listing 发布，保留当前线上版本；隔离 Schema/内容异常对象。不得删除已发布 Listing、跨 Supplier 迁移所有权或手工改 Catalog 表。

## 恢复（Recovery）

通用 Checkpoint/重试由 `import.md` 执行。映射或源数据错误用新文件/Mapping 版本重建任务；成功行复用稳定来源键，失败行不影响其他 Savepoint。导入完成后仍须单独执行可售链校验和发布审批。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 核对行数守恒、来源键/SKU 唯一、Owner/Scope 正确、属性可解析、Product/Sku/Listing 关联完整、无无效项发布。Data repair 走 Catalog Command 与 Review；Escalation 对跨 Scope、恶意内容或线上污染升级 P0；Audit 追加 Mapping、资格与发布证据。

## 回滚边界

未发布草稿可经 Catalog Command 归档；已发布事实通过新版本下架/归档，不能删除历史。Import 技术回滚边界遵循 `import.md`。

## 沟通模板

“商品导入 `{importId}`，Scope `{scope}`，Mapping `{mappingVersion}`，草稿/失败 `{accepted}/{failed}`，发布影响 `{publicationImpact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

统一 Import 条件通过；所有成功项归属正确且保持草稿或经独立审批发布；失败项错误文件可用；可售链与跨 Scope 核对为 0。

## 复盘链接（Postmortem）

Schema 漂移、跨 Supplier、错误发布或重复来源持续发生时填写 `{postmortemUrl}`。

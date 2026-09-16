# RV-0035｜渠道外部对象 scope 映射切换独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0013
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅迁移、渠道同步 Worker 与当前表访问路径；未访问数据库、渠道或部署环境。

## 迁移责任

迁移以 `catalog.sourcelisting` 的 `(provider, object_type, external_id)` 关联回填 `channel.externalobject.scope_id`；任一历史外部映射无法归属即抛出 `EXTERNAL_MAPPING_SCOPE_BACKFILL_REQUIRED`，整笔事务不会提交。成功后它将 scope 设为非空，把 `externalobject`、`sourcerecord` 与 `sourcelisting` 的唯一键改为包含 scope，并以 `access.scope_allowed(scope_id)` 重建外部映射的行级策略。

这既是历史数据归属转换，也是跨租户相同渠道 external id 的幂等键与授权边界；不能从“当前源码未直接写 `externalobject`”推断其无运行或恢复责任。

## 当前运行关系

`ChannelJobProcessor` 从 scope 化的连接取得运行上下文。目录同步写入 `channel.sourcerecord(provider,scope_id,objecttype,externalid,sourceversion)`，随后调用 Catalog source port/projection；价格和库存同步以 `(provider,scope_id,externalId)` 查找 SKU，并以 scope 生成价格簿、库存观察与后续 outbox/job 的标识。即使 `ExternalMapping` 当前只在 Worker 中作领域校验构造，数据库仍保留历史映射、RLS 和冲突键的持久化契约。

## 裁决与未知项

维持 GX。已静态确认迁移对回填缺口 fail-closed，运行写入与作业事件均显式携带 scope；未验证生产数据是否存在同键多匹配、迁移 ledger/备份、RLS 实效、渠道重放或失败恢复。后续任何变更须从届时最新主线建立独立渠道/数据库专项；本审计分支未执行数据库、渠道或部署操作。

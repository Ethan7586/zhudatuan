# AU-454｜渠道外部对象的 scope 映射与租户隔离

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821045000_channel_scope_mapping.sql`（31 行）。
- 人工审阅回填、约束、RLS 和 ledger 断言；反查 Channel 同步和 Catalog source projection 的真实写入/读取路径。
- 本轮为静态审阅；未执行迁移、渠道同步、Webhook 重放或线上查询。

## 真实运行关系

渠道同步任务把供应商原始商品记录写入 `channel.sourcerecord`，键包含 provider 与 scope；Catalog source port 将相同范围带入 `catalog.sourcelisting`，并由投影建立 SKU 关联。外部对象映射用于把渠道标识连接到内部业务对象。迁移为该映射补齐 scope、把三组唯一键改为 provider+scope+外部标识，并按 scope 重建应用身份的 RLS。

## 隔离与正确性边界

- 回填只从同 provider、对象类型、外部标识相同的 source listing 取得 scope；若有任何历史映射无法确定归属，迁移立刻失败，随后才允许 `NOT NULL`。
- 复合唯一键允许不同 scope 使用相同外部标识，同时阻止同一 scope 内重复；`channel_externalobject_internal` 索引支撑从内部对象反查其渠道映射。
- Channel sync 和 Catalog API 的现行 SQL 皆带 scope 参数或 scope 复合冲突键，因此迁移改变的是实际运行隔离边界，而不是孤立的历史定义。

## 评审结论

- **G0**：渠道同步、目录投影和范围授权依赖该 schema。
- **GX-0013**：这是跨租户外部对象的历史回填及唯一键/授权切换；禁止删除、改写、单独重放或与功能修复混合。
- 未发现本迁移新增且可直接证实的 P0–P3。未验证项为实际历史回填缺口、跨范围重复外部 ID、RLS 运行结果和渠道重放行为。

## 后续验证与回滚边界

- 后续独立分支应验证 scope 回填完整性、同 external id 跨 scope 的映射、拒绝越权读取、同步重放和唯一冲突。
- 恢复需在备份及逐 scope 映射对账基础上进行；不得在审计分支执行。

# AU-341｜Supabase 双语目录 API

`20260725010000_bilingual_catalog_api.sql` 以换签重建将早期 `api_catalog` 扩展为双语展示输出：优先中文展示名/摘要、保留来源英文与原中文字段，并返回 taxonomy、分类状态、价格、库存、供应商和测试标志。目录按商城 slug、分类、有效状态和稳定分页读取；权限只给 `service_role`。

当前 Commerce API 在带分类查询时仍以相同 RPC 名称调用目录，但后续严格 taxonomy 与 canonical inventory 切换已重定义其最终实现和可见性条件。故本文件记录的是有效的历史输出契约迁移，而不是当前函数实现本身，归 G0；删除或改写会破坏从空库重放的迁移序列。

未发现新增 P0–P3 或删除候选。未运行 RPC 或数据库迁移。

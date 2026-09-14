# AU-344｜Supabase 严格目录 taxonomy

`20260725013000_enforce_strict_catalog_taxonomy.sql` 将 taxonomy 树转为可执行边界：校验函数要求有效的 active 三级父子路径；商品触发器拒绝非 pending 的 active 商品使用非法路径，并把一级 taxonomy 固定为对外 `category_code`。目录 RPC 仅返回有效路径、置信度至少 0.8 且商品/SKU/商城有效的商品；审计 RPC 只向 `service_role` 输出测试商品的路径和审阅统计。

该路径校验持续被后续移动目录、资格目录和 canonical inventory 读模型调用，是跨多条运行链的底层数据契约，归 G0。触发器和读模型均不是“多余校验”或垃圾代码。

未发现新增 P0–P3 或删除候选。未执行数据库迁移或读写验证。

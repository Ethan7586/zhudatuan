# AU-306｜Compatibility 移动目录分类回填

该迁移的规则分类器和写入 trigger 仅对 `supplier-test-abo` 且 `is_test=true` 的商品生效；它将分类结果写回三级 taxonomy、一级 `category_code`、置信度与版本。存量回填同样限定该测试供应商；落入 `welfare_review_unclassified` 的项目会进入 `catalog_review_queue`，不会伪装为已人工确认的类别。迁移自身以六个跨分类示例作安装期自检。

公开目录窗口 RPC 只读取指定公开商城的 active 商品、SKU、商城及库存行，要求有效的三级 taxonomy 和置信度不低于 0.8。库存表的约束保证 `reserved_qty <= available_qty`，故公开响应的可用库存计算不会为负。`commerce-api` 将目录 taxonomy 作为只读响应契约返回；网页公开目录客户端以一级 `categoryCode` 完成分类展示。

未发现新增 P0–P3 问题。因审计工作树缺少 Vitest 依赖，未执行目录测试；结论基于迁移、目录路由、客户端映射和数据库约束的静态调用链取证。

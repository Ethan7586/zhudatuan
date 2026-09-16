# AU-325｜Compatibility 平台 Owner 范围数据库契约

该事务测试断言活动 Owner membership 全库唯一，测试 Owner 已实际绑定平台组织节点且可委派 platform 范围；普通测试管理员尝试插入同一范围时必须收到 `PLATFORM_SCOPE_REQUIRES_OWNER`。全程 rollback。

它直接覆盖 AU-321 的唯一 Owner 与平台范围核心约束；未覆盖 Owner 撤销后旧平台范围的投影行为、过期角色或 HTTP 层错误映射。未找到正式执行入口，按审计纪律未运行。

未发现新增 P0–P3 问题或删除候选；结论为 G0（真实数据库契约测试）。

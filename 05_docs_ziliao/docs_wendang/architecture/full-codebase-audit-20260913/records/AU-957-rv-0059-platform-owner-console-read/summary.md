# RV0059｜GX-0037 Platform Owner Console 只读 operation 授权

- 复核对象：`20260821074000_grant_platform_owner_operations.sql`、Console navigation access 和服务端 AccessPipeline。
- 直接证据：迁移固定 12 个 `*.read` permission，并以同数 read operation 的 `capability.membership_operations('membership-platform-owner-ethan-v1')` 断言可执行性；唯一删除动作只删除这些 permission 的旧 deny，随后仅插入同项 allow。
- 运行链：Console 导航对可见入口同时要求 capability 与 permission；每个 API 请求还经 AccessPipeline 的 audience、permission/access-version、scope、capability、资源就绪、step-up 与风险校验。写 operation 并不在本迁移的清单内，仍需其独立 permission/capability。
- 结论：这是 Platform Owner 恢复指定 Console 只读板块的精确发布授权，而非无边界提权；GX-0037 维持，禁止删除或合并为泛化角色规则。未执行迁移、测试或线上操作；未发现 P0/P1。

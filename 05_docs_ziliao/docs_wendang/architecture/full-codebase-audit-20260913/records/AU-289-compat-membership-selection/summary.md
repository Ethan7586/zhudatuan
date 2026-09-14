# AU-289｜Compatibility 多 Membership 登录选择边界

该 migration 将 `api_local_login_candidate` 扩展为返回全部 active entrance，并保留按目标优先级选择的候选 membership。Compatibility `authenticateLocalMember` 在 membership 模式下要求 entrances 恰为一项；多项或旧 RPC 缺少 entrances 时都返回 `MEMBERSHIP_SELECTION_REQUIRED`（409）且不建立会话。生产 API 路由和测试均直接覆盖该失败关闭链。

迁移只授权 service_role 执行函数；active/expiry 条件同时作用于候选和 entrances。该机制暂不实现服务端身份选择，而是将多身份账号显式阻断，符合 SOURCE-MANIFEST 已记录的待闭合身份 Adapter 边界。无 P0–P3 新问题；未运行依赖缺失的测试。

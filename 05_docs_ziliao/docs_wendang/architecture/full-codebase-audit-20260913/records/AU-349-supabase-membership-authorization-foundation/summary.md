# AU-349｜Supabase 成员授权基础

`20260809093000_membership_authorization_foundation.sql` 建立成员、成员身份、范围绑定和角色授予的授权骨架。范围触发器确保租户归属；范围/角色/状态和过期变更自动递增 `authz_version`，为会话失效提供版本事实；审计日志保存 membership 与授权证据。迁移还将既有 employee/mall_admin 数据回填为 storefront/admin identity，并生成相应 self/mall 范围。

`api_resolve_membership_context` 只解析 active、未过期成员身份，派生有效角色、权限、上下文、范围与版本，并且仅授予 service role。后续 runtime cutover、权限命令中心、账户安全和 canonical distributor 范围迁移多次重定义并复用它；因此本文件是现行身份授权链的根迁移，归 G0。

未发现新增 P0–P3 或删除候选。未运行迁移、回填或数据库授权验证。

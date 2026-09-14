# AU-399｜canonical 分销范围绑定

`20260820121000_canonical_distributor_scope_bindings.sql` 把分销范围资源统一为 `distributors.id`，将历史 org-unit 绑定逐条审计、可重入修复，并在过期或歧义状态下 fail-closed：无效单绑定保留为 tombstone，多个分销绑定会隔离非平台 membership 并移除范围。该迁移还为角色、范围、覆盖、分销关系和分销商状态变更增加 authz version 失效传播。

它重定义 membership actor/scope 判定、授权范围、分销权限、分销中心和会话 runtime，使下游售后、券、商城应用等能力在分销锚点失效时一起拒绝。`canonical_distributor_scope_contract.sql` 直接覆盖 ID 规范化、过期、停用、歧义、范围转移、命令中心和会话投影的反事实路径。

该迁移是当前分销授权的 G0 核心边界，不是删除候选。未发现新增 P0–P3；未执行测试、数据库写入、构建或线上检查。

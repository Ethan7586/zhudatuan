# AU-351｜Supabase 旧冒号权限词汇退役

`20260810090000_retire_legacy_colon_permissions.sql` 清除 `finance:refund`、`finance:reconcile` 和 `order:read:own` 三项旧 role grant，并仅对实际受影响成员身份递增 `authz_version`，让既有会话在下次请求重发并重新派生 dot-separated 权限。重复运行不会因没有已删 grant 而扩大更新范围。

早期数据基座和财务迁移确有这些冒号权限；当前成员授权基础同时引入 dot 词汇，运行 API 契约使用 dot 码。该文件是兼容退出和会话失效的历史安全/一致性步骤，归 G0，不能因当前不再匹配旧码而删除。

未发现新增 P0–P3 或删除候选。未执行权限删除或会话版本更新。

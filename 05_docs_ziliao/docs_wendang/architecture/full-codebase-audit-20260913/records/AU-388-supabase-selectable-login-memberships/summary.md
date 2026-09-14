# AU-388｜Supabase 可选登录成员身份

`20260817194000_list_selectable_login_memberships.sql` 最初提供已验证成员的可选 Storefront/admin 身份列表；后续授权闭环版本增加有效 distributor anchor 条件，避免过期分销关系出现在会话选择前。它仅开放给 service role，不签发会话。

当前 Commerce API 在多入口账号时返回 `MEMBERSHIP_SELECTION_REQUIRED` 并拒绝建会话；Auth Web 也明确要求服务端绑定的选择 token 才能选择身份。固定基线没有应用、路由、Worker 或测试调用该列表 RPC，说明产品选择流程尚未接线，而不是证明数据库函数可以删除。

该可选身份 RPC 归 G1、禁止删除：外部认证服务、已发布客户端和后续选择 token 契约尚未核验。未发现新增 P0–P3 或删除候选以外的问题；未执行登录、测试、数据库写入或线上检查。

# AU-296｜Compatibility Membership Runtime 切换

该 migration 建立 Compatibility runtime 的唯一授权来源：membership role → permission、membership scope 和数据库 `api_resolve_membership_context` 投影。会话解析每请求以 host-only signed cookie 定位成员和 membership，再通过 `api_resolve_session_membership_context` 重新读取 server-derived permission/scope；cookie 的 authzVersion 与数据库不一致即拒绝。资源地址型操作则先由 order/after-sale scope RPC 反查真实 tenancy，避免客户端伪造 mall 或 owner。

本 migration 中命名 test 身份只服务 development/test fixture，密码不存于此；其登录 alias 与 runtime provider 映射为 Compatibility 历史/测试职责，不是 G3。未发现 P0–P3 新问题；实际 session DB 函数及 migration 回放未执行。

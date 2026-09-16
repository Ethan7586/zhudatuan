# AU-322｜Compatibility Storefront 会员资料

Storefront bootstrap 从当前认证上下文提供的用户、租户、企业和商城范围读取数据库资料，返回仅适合本人页头的姓名、工号、部门名和掩码手机号；RPC 不向浏览器角色开放。资料缺失时 `handleBootstrap` 明确失败关闭，不回落到浏览器 demo 身份。

`accountRoutes.ts` 同时用当前 membership 读取保障状态和商城显示信息，响应中的用户 ID、角色与权限都来自已解析的服务器授权上下文。现有测试固定数据库资料覆盖 demo 身份，并验证资料不可解析时返回 `MEMBER_PROFILE_UNAVAILABLE`。审计工作树缺少 Vitest 依赖，未执行测试。

未发现新增 P0–P3 问题或删除候选；RPC 与 bootstrap 入口均有真实运行职责，结论为 G0。

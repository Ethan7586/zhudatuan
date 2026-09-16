# AU-728｜治理与身份合同测试补充

- 审阅范围：admin order export authorization、authorization evidence divergence、custom role center、member operations、platform owner scope、registration terms policy、session membership bootstrap 与 Zhudatuan operator invitation registration 的 8 份 SQL 文件。
- 审阅方式：深入审阅会话/credential/authz 证据绑定、越权拒绝、角色/范围不可变性、邀请与条款边界；对既有 AU-705 已深审会话消费合同的辅助 bootstrap 仅结构性审阅。未运行 SQL。

## 审计结论

- **G0：全部保留。** 这些合同各自保留了订单导出 step-up、撤销会话失效、角色与成员运营约束、Owner 范围、注册条款、会话输入和 operator 邀请的独立业务规格，不能以结构相似合并或删除。
- 代表性测试使用动态 ID、预期异常和 rollback；重点确认了 session 被撤销、credential/authz 版本过期、跨 scope/client/organization 请求和非法角色授权均必须被拒绝。
- 未发现新增问题。运行器与当前 migration head 的实际兼容性未验证。

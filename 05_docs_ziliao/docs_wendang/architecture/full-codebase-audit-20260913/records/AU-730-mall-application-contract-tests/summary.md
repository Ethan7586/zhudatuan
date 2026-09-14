# AU-730｜商城应用数据库合同测试

- 审阅范围：mall application builder 与 schema v2 的 2 份 SQL 合同。
- 审阅方式：深入审阅 draft/save/publish/restore 版本状态、公开可见性、权限证据、幂等/row version、历史不可变性，以及 schema v1→v2/组件 registry 的兼容边界；未运行 SQL。

## 审计结论

- **G0：全部保留。** builder 是商城应用写入状态机规格；schema v2 是数据结构、组件注册和旧配置兼容规格，职责不同。
- builder 明确确保创建不复制交易数据、草稿不公开、发布不被 restore 草稿改写、历史版本不可篡改并留下审计记录；schema v2 防止双 storefront 系统并验证 schema registry/compatibility。
- 未发现新增问题。当前数据库实际执行和页面侧渲染兼容性未验证。

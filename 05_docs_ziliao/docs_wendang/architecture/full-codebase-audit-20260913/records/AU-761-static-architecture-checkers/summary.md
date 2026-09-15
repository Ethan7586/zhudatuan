# AU-761｜静态架构检查器

- 审阅范围：boundary、bundles、classify、dependencies、environment、extensions、graphcontext、naming、navigation。
- 审阅方式：深入审阅 boundary/dependencies/environment/naming/navigation 的规则、输入与退出边界；bundles/extensions/graphcontext/classify 为同类纯静态辅助工具，做结构性复核。`mvp-kernel.mjs` 的数据库/支付/队列夹具拆至后续 AU。
- 验证：未运行。正式 scripts 的输入是整个 production source tree；本阶段只验证其实现与调用关系，不以全仓扫描结果替代人工审阅。

## 审计结论

- **G0：九个检查器均有明确维护/quality gate 职责。** root package 注册 naming、boundaries、bundles、extensions、navigation、dependencies 和 environment；boundary 约束后端层向及前端 feature/import/fetch 规则，dependencies 将 TS 引用与 workspace manifest 对照，environment/navigation 检查声明、入口与路由/catalog 的静态一致性。
- **证据边界：** 这些工具依赖路径 convention、正则、相对 import resolve 或 TypeScript static references；不能发现动态 import、反射、仓外配置、运行时注册、实际 HTTP/DB/queue 行为或生产权限，因此只构成持续性静态 gate，不构成业务安全/发布成功证明。
- `classify.mjs` 默认指向旧 base/branch，仅见手动 CLI 用途；保留为诊断脚本，当前正式 quality scripts 未注册它。无删除结论。

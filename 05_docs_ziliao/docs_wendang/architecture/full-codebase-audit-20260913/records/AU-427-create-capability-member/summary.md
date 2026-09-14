# AU-427｜能力与成员初始模型

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821015000_create_capability_member.sql`。
- 交叉核对：后续 capability operation、成员生命周期、范围规范化与 membership 所有权迁移。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放或线上操作。

## 运行结论

能力域把 operation、feature、UI block 和 quota 统一成可版本化 capability，支持依赖关系、范围 entitlement，并把 runtime operation 映射到权限与受众。成员域建立个人档案、跨组织/客户端 membership、邀请和批量导入记录；身份会话通过外键绑定 membership。

后续模块持续添加 capability operation 与权限映射。`member.membership` 随后迁移到 `access` schema，是所有权和命名收敛而非可删除的兼容冗余；后续范围解析继续以成员档案为主体。所有表启用 RLS。

## 审计结论

- G0：能力契约和成员身份投影的基础关系模型，不是删除候选。
- 本批未新增 P0–P3；未重放迁移，实际数据与 RLS 未验证。

# AU-446｜邀请条款读取契约

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821036000_add_invitation_terms_read.sql`（27 行）。
- 交叉核对：Identity invitation resolve 操作、Auth Web 注册映射测试、部署检查，以及后续 member invitation records read 操作。
- 本批为静态契约与调用关系审阅；未执行匿名 API、数据库或线上验证。

## 运行结论

迁移把 `identity.invitations.read` 注册为 public POST resolve 接口及对应 capability，供未登录受邀者获取邀请所需的权威条款/隐私和上下文。Identity 模块、SDK、OpenAPI、Web deployment check 与 Auth Web 注册映射测试均保留这一链路。

后续 `member.invitations.read` 是经过授权的成员/运营邀请记录列表接口，路径、受众和数据目的均不同；它不是 anonymous resolve 的替代或删除依据。

## 审计结论

- G0：匿名邀请解析与条款展示的正式 operation/capability 登记，不是删除候选。
- 本批未执行 invite token 枚举、过期/撤销、条款一致性或响应脱敏验证；保持未验证。
- 本批未新增 P0–P3。

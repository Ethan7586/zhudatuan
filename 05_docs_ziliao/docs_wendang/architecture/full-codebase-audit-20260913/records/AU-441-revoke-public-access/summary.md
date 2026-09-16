# AU-441｜默认 public 访问收口

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821030000_revoke_public_access.sql`（81 行）。
- 交叉核对：后续 grant/RLS 迁移、数据库对象契约生成器及应用角色使用。
- 本批为静态权限与调用边界审阅；未连接数据库、运行角色权限探测或线上操作。

## 运行结论

迁移从 `public`、Supabase 默认角色和 31 个业务 schema 撤销表、序列、函数和 schema 权限，并收紧默认 privileges。随后为 `shopapp`、`shopjob`、`shopread` 授予显式最小能力：所有业务表受 RLS，`shopapp` 依 scope/workload 限定，`shopjob` 是受控后台执行角色，`shopread` 只读报告指标/事实。

它只显式开放 session、scope、capability、extension/channel、runtime job/inbox/outbox 等 security-definer 函数和必要表；角色断言拒绝任何应用角色 `BYPASSRLS`。后续迁移为新增表、函数和专用 web/console/identity 角色追加授权与更细策略，数据库对象契约生成器以本文件作为初始安全边界。

## 审计结论

- G0：全域默认拒绝、最小授权和 RLS 初始化安全边界，不是删除候选。
- 初始通用 RLS 策略之后被各领域更精细的策略取代/补充；实际最终权限必须通过特定角色的数据库验证和第二轮安全复核确认。
- 本批未新增 P0–P3；没有执行权限绕过或业务访问验证。

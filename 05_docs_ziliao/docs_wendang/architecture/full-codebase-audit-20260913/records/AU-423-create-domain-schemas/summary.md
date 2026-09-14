# AU-423｜领域 schema 创建

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821011000_create_domain_schemas.sql`。
- 交叉核对：后续 domain lifecycle、安全边界和跨域 `search_path` 定义。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放或线上操作。

## 运行结论

迁移在一个事务内确保四个受控数据库角色存在，并创建 identity、organization、access、capability、catalog、inventory、payment、finance、runtime 等 29 个领域 schema。随后撤销 public schema 的默认访问与创建权，避免后续安全定义函数经由不受控 `public` 名称解析对象。

后续各领域 lifecycle 与安全函数明确以这些 schema 作为 `search_path` 依赖；该迁移是从公共表模型转向领域边界的基础控制面。

## 审计结论

- G0：领域隔离和数据库权限模型的基础迁移，不是删除候选。
- 本批未新增 P0–P3；未重放迁移，实际角色/schema ACL 未验证。

# 第二片：L 等级编码标准

`20260918010000_signed_level_codes.sql` 安装一张可复制的静态目录 `lkernel.signed_level_code`：首版发布供应侧 `L-5～L-1`、经营／会员侧 `L0～L11`，共 17 条。表中只有编码、数值和沿用现有 `SignedLevel.ts` 的分段；不含任何 Realm、Node、Membership 或当前等级实例，也不授予权限。

2026-09-18 已在 Supabase `zdt-next / L-kernel` 项目 `kbzejcfvmsqqqdjvqumu` 的 SQL 编辑器执行本文件。只读复核：编码 17 条，范围 -5～11，三个分段分别 5／6／6；`identity`、`access`、`member`、`organization` 四个实例 schema 的表数为 0。本地 PostgreSQL 17 及 L-kernel 测试也验证了相同编码。第一片基础结构尚未安装；本片不依赖它。

这次 SQL 编辑器执行不会自动把文件登记到 Supabase 的迁移历史；可复制版本仍以桌面仓库中的本 SQL 文件为准，后续各 L 的数据库按版本单独安装。现有 TypeScript 解析器及旧 SQL 仍允许未限定下界的负等级；本片只发布首版静态目录，**不收窄原运行规则**，也不让业务写操作改用此目录作目标或权限判定。

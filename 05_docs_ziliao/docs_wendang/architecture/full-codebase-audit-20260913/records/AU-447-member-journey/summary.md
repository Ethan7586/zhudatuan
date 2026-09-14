# AU-447｜成员旅程数据模型与读取接口

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821037000_add_member_journey.sql`（43 行）。
- 交叉核对：订单 reminder 操作、notification job 创建、member self role 权限和后续地址模型。
- 本批为静态迁移与调用关系审阅；未执行数据库、提醒投递或线上验证。

## 运行结论

迁移为结算地址增加默认脱敏展示字段和地区代码，并建立订单履约 reminder 记录、索引和 RLS。member self role 获得资料/地址/履约读取与提醒创建能力。

订单模块实际创建 `ordering.reminder`：仅订单所有成员可操作、30 分钟内禁止重复，并在同一业务路径写入 notification job。提醒表 RLS 同时允许成员自身或组织祖先范围的受权访问，后台角色执行投递。

## 审计结论

- G0：成员地址展示与履约提醒的基础数据/权限模型，不是删除候选。
- 默认 `***` 掩码必须由后续数据迁移或应用写入覆盖；本批未验证任何历史地址是否已生成正确脱敏值。
- 本批未新增 P0–P3。

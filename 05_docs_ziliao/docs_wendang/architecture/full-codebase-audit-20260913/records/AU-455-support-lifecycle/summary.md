# AU-455｜客服会话、工单、SLA 与附件生命周期

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821046000_support_lifecycle.sql`（192 行）。
- 人工审阅历史工单迁移、RLS、不可变触发器、资源 scope 解析、接口/事件契约；反查 Support API、SLA 和附件扫描任务。
- 本轮为静态审阅；未执行迁移、附件扫描、SLA 任务、测试或线上查询。

## 真实运行关系与结论

迁移把旧 case 演进为 conversation 与 ticket：客户/订单/渠道/主题/引用信息归 conversation，工单保存状态和流程；消息、历史、分配、证据、升级均回填 scope 与新关联。Support API 的建单、读写消息、附件、分配、关闭/重开和 SLA 配置使用该模型。建单排入 `supportsla`，附件排入 `supportscan`；任务分别升级逾期工单并扫描附件。消息和历史通过触发器保持追加式，应用权限按 scope 过滤，资源 scope 函数接入统一授权解析。

该迁移删除旧 case 外键和已迁出的 ticket 字段，因此登记为 **GX-0014**：不可删除、改写或单独重放。未发现新增且可直接证实的 P0–P3；未验证项为历史数据一一映射、附件引用、SLA 重新调度和真实 RLS 行为。后续需从最新主线的独立分支进行数据/授权专项验证，不得在审计分支操作。

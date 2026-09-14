# AU-450｜支付异常恢复与授权范围

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821040000_payment_recovery.sql`（106 行）。
- 交叉核对：Payment HTTP/job/deadletter 实现、事件/权限目录、Storefront recovery 展示和后续 payment 迁移。
- 本批为静态迁移、权限与调用关系审阅；未执行真实恢复、支付通道、数据库或线上操作。

## 运行结论

迁移登记 payment recovery 读/解决操作、检测/失败/provider observation/自动退款/案件开启事件，并将解决权限标为 critical。它为支付 attempt 付款人哈希与 recovery case/request 查询补足索引，并把 recovery case 纳入资源 scope 解析。

Commerce payment job 与 deadletter adapter 真实创建/累积 recovery case，HTTP 操作在订单/商城范围和幂等请求下记录 resolution request、调度后续 payment/refund 恢复并关闭案件。Storefront 仅显示无内部标识的 recovery 体验，Purchase API 不暴露恢复管理面。

## 审计结论

- G0：受权支付异常恢复和告警审计的基础契约，不是删除候选。
- critical 操作的身份、范围、双人/人工流程和实际资金结果需要独立资金与权限复核；本批未运行恢复路径。
- 本批未新增 P0–P3。

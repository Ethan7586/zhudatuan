# RV-0045｜支付 Webhook scope resolver 历史演进独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0023
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅双参数迁移、三参数替换迁移、Webhook 入口与运行身份授权；未接收或处理外部支付回调。

## 迁移责任

初始迁移按支付/退款 provider reference 解析订单 scope，并撤销 public/anon/authenticated/service_role 对双参数函数的执行权。后续支付 mall identity 迁移显式删除双参数函数，改建 `(kind, reference, application_hash)` 三参数版本；支付场景隔离把 AppID 哈希纳入尝试记录，形成顺序不可拆的历史 schema 演进。

## 当前运行关系

`PaymentWebhook` 调用三参数 resolver；三参数 payment 路径要求 provider reference 与 application hash 同时唯一定位 mall，refund 路径按退款 reference 定位。Webhook 专用身份只被授予该三参数函数及受限表权限，当前入口随后再比较最近 attempt 的 scene/application hash。

## 裁决与未知项

维持 GX。已静态确认双参数函数由后续迁移有序替换而非可任意删除，当前回调依赖三参数版本和专用权限；未验证历史升级顺序、真实 webhook 拒绝、函数权限实效、渠道重试或恢复。后续变更须从届时最新主线建立独立支付/数据库专项；本审计分支未调用渠道。

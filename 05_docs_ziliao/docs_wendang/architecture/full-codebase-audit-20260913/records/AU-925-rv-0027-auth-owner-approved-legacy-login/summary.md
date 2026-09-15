# RV-0027｜Auth owner-approved 旧登录链独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0002；关联问题 F-0005
- 结论：**维持 GX，禁止删除；F-0005 维持 P2；未发现 P0。**
- 定向验证：`node 04_tools/scripts/check/owner-approved-ui.mjs`，退出码1，报告accounts的`App.tsx`锁定哈希不匹配。

## 入口与批准冲突

当前`auth-web/src/App.tsx`只装配`ConsumerIdentityPage`、`OperatorIdentityPage`和无效入口页；它不导入`LoginPage`。但owner-approved机器清单把`LoginPage.tsx`标为accounts的approvedComponent，并把`App.tsx`、`LoginPage.tsx`和`services/auth.ts`列为锁定发布输入；正式release target仍构建`auth-web`并从其dist生成静态制品。

只读批准校验实际在`App.tsx`的hash处失败，证明冲突是可观察的质量门禁状态，而不仅是文档陈述。

## 裁决

`LoginPage`和`auth.ts`虽不被当前App静态导入，却承载所有者批准的三段式登录、旧凭据BFF路径、注册/多身份选择及未接通step-up的可见契约。没有所有者当前产品裁定、实际bundle/线上页面或BFF兼容确认，不能安全认定旧链应删除，也不能自行恢复它替换现有入口。

因此维持GX和禁止删除。后续只能在所有者明确指定权威登录页面后，从最新主线用单一治理批次校准入口、approved清单、锁定hash、制品与真实登录验收；审计分支不改代码或清单。

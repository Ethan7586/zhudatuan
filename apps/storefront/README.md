# 智慧翼企业福利商城

雍彻科技（YONGCHE TECH）建设的企业福利商城生产型 MVP。

当前版本具备受控登录、企业/商城/员工数据隔离、生产商品目录、福利卡与餐卡、主子订单、内部账户组合支付、账户流水、售后工单、审计日志和验收控制台。数据库部署在 Supabase 东京区域，浏览器不接触数据库管理密钥。

## 本地运行

```bash
npm install
npm run dev
```

服务端环境变量参考 `.env.example`。生产密钥只配置在托管平台，不提交到 Git。

## 消费者 Web 组件标准

消费者 Web 只有一套生产组件树：`src/app/App.tsx` 负责组合运行时，`src/shell/StorefrontShell.tsx` 负责统一外壳，`src/feature` 下 15 个领域 Feature 负责业务。`src/shared/view/ResponsivePattern.ts` 集中表达跨断点布局模式；浏览器原生分享与复制能力由 `src/shared/platform/BrowserShareAdapter.ts` 适配。手机、平板、笔记本和宽屏共享 Header、导航、商品卡、账户卡、交互反馈与 Footer，不按设备复制业务组件。

正式 `/s/{handle}` 入口由 Storefront 路由承载，使用服务端 Published Experience 与真实 Read Model。客户端只通过生成 SDK 访问网络目录中的唯一 Commerce API；本地开发只允许明确的 3001 API 与 3002 Auth 端口。生产源码禁止 Mock、Showcase、设备展示路由、待接接口弹窗、失败后降级数据和按设备分叉的业务实现；能力不存在时明确失败并给出可恢复反馈，不显示高保真预览。

## 质量检查

```bash
npm run lint
npm test
npm run build
```

完整边界、接口与验收说明见 `docs/生产型MVP开发说明.md`。

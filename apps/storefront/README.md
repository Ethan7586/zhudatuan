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

消费者 Web 统一使用 `shop-storefront-standard-v2` 组件族，规范入口为 `src/components/laptop/LaptopFrame.tsx` 导出的 `StorefrontWebFrame`。标准和宽屏布局共享 Header、导航、六个业务页面、商品卡、账户卡、交互反馈与 Footer，仅通过响应式密度调整布局。

正式 `/s/{handle}` 入口由 Storefront 路由承载，使用生产数据 Provider。客户端只通过 Contract v2 生成 SDK 访问网络目录中的唯一 Commerce API；本地开发只允许明确的 3001 API 与 3002 Auth 端口。不存在静态业务状态、演示认证、设备展示路由或失败后降级数据。

## 质量检查

```bash
npm run lint
npm test
npm run build
```

完整边界、接口与验收说明见 `docs/生产型MVP开发说明.md`。

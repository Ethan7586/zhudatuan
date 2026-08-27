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

消费者 Web 统一使用 `smart-wing-storefront-web-v1` 组件族，规范入口为 `src/components/laptop/LaptopFrame.tsx` 导出的 `StorefrontWebFrame`。1366×768、1440×900 与 1920×1080 三种规格共享同一套 Header、导航、六页面、商品卡、账户卡、交互反馈与 Footer，只通过 `StorefrontWebStandard.ts` 的 preset 和响应式密度调整布局。

- `/laptop-web`：Laptop 标准预览。
- `/desktop-1920`：27 英寸完整视觉预览。
- `/desktop-1920/inspect`：1920×1080 原生与 Windows 175% 等效画布验收。

正式 `/` 入口继续使用生产服务；上述多端预览只使用隔离的演示服务，不能把演示数据依赖导入正式入口。

## 质量检查

```bash
npm run lint
npm test
npm run build
```

完整边界、接口与验收说明见 `docs/生产型MVP开发说明.md`。

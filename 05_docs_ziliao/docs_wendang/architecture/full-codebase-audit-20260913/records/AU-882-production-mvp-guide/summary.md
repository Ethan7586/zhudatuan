# AU-882｜生产型 MVP 开发说明审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`生产型MVP开发说明.md`，1 个文件、123 行。
- 方法：主样本审阅阶段结论、能力/未开放边界、数据切换、验收和下一迭代；核对章程/Storefront README 引用、当前 API、身份入口、Storefront 展示边界和既有文档控制面 finding。

## 结论

文件仍被主章程与 `apps/storefront-web/README.md` 引用，故归 G0；其“未取得资质不得宣称开通”“浏览器不持有管理密钥”“资金使用服务端权威事实”等原则仍有保留价值。

但该文件为 2026-07-24 快照，仍将阶段访问码、旧 `/api/v1/products`/`/api/v1/auth/login` 路径、Supabase Data API、Vinext/Cloudflare 构建、六迁移/27表/16测试和旧多端入口写作当前事实。当前 Storefront README 已明确旧 `src/App.tsx`/`src/screens/*` 退出标准工程、展示路由仅属于 labs，实际身份 API 与运行/发布单元也已重组。该被直接引用的说明会误导实施和验收，记录 F-0340（P3）。

未执行测试、构建、部署、数据库、浏览器或外部控制面操作，未修改业务代码、配置、测试、工作流、迁移或运行资源。

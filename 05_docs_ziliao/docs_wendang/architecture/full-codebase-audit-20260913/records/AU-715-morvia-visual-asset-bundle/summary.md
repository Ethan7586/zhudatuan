# AU-715｜MORVIA 当前视觉资产包

- 审阅范围：`05_docs_ziliao/VI_shijue/current/ZHU-VI-1.5/` 的 61 个文件，及其 Auth Web 运行时导入。
- 审阅方式：深入审阅三份生成脚本和运行时 import；同源 SVG/PNG 尺寸与色彩变体只作结构性审阅并逐文件登记。

## 运行与生成关系

- `build-assets.mjs` 以三个 `components/*.svg` 母版生成 12 份 `assets/svg/` 输出；ID 重写和颜色变体在脚本内完成。
- `build-product-assets.mjs` 以生成 SVG 为输入，生成 8 份 `assets/app-icons/` 图标/社交图；`render-guide.mjs` 以本地 HTML 生成 PDF 与预览 PNG。
- 当前仓内运行时直接导入仅见 Auth Web：白色完整署名、彩色 M 标记及 `MorviaTitle-700.woff2` 字体。无 Storefront/Console 对此包的直接 import 或发布复制配置证据。

## 审计结论

- **G0：当前规范资产包仍有运行与品牌职责，不能按零引用或重复导出删除。** Auth Web 的登录壳和受众切换页直接使用其中 SVG；字体由全局 CSS 引入。
- 生成 SVG、应用图标、PDF 与预览按生成关系归类；未逐像素审阅同源尺寸变体。`assets/png/` 没有发现仓内生成器，因此保留为人工导出的静态分发资产。
- 新增 **F-0291（P3）**：产品资产映射声称 Auth、Console、Storefront 共用母版，但固定基线只证实 Auth 直接消费，缺少仓内可追踪的 Console/Storefront 接入或发布复制关系；该风险是品牌显示漂移，不是删除依据。

## 未验证项

- 未启动产品页面或执行资产构建；未核对发布服务器/设计交付物是否在仓外复制这套资产。
- 未验证 `assets/png/` 的外部人工导出过程、视觉像素一致性或字体子集覆盖范围。

## 结论等级

- 新增问题：P3 1 项；无 P0/P1/P2。
- 垃圾代码：无新增候选；无删除。
- 二次复核：F-0291 不强制；若产品端或发布系统拟改用/移除资产，先核对真实生产页面与制品清单。

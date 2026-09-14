# AU-545｜前端制品体积预算

- 审阅范围：`02_platform_pingtai/config/bundles.yml`（10 行）；定向阅读 `check:bundles` wrapper/implementation、根 quality hard-cut 与 app 路径。
- 审阅方式：配置、静态消费链和 artifact 选择逻辑人工阅读；未构建或执行 bundle gate。

## 真实运行关系

`quality:canonical-hard-cut` → `check:bundles` → audit wrapper → bundle checker → console/auth/storefront Vite dist gzip initial/lazy graph、commerce forbidden-byte scan、miniapp tree size → YAML budgets；gate 缺 artifact、超预算或发现 retired/mock/API 字符串时退出失败。

## 审计结论

- **G0**：console/auth/storefront initial budget、共享 lazy budget 及 miniapp total budget均由实际 checker 读取；checker 还解析 Vite manifest 图、排除 source map，兼容没有 manifest 时的整体 gzip 计算。
- **F-0257（P3，高置信）**：`storeInitialGzipKb` 与 `supplierInitialGzipKb` 仅存在于 YAML，固定基线没有其它命中；checker artifact list 不含这两个应用，当前 `apps` 下也无相应 store/supplier tree。因此质量 gate 永远不会以这两个配置值拒绝构建，配置名称造成虚假的受保护印象。

## 未验证项

- 未构建 dist 或运行 gate；未验证 Vite dynamic graph 算法、实际 gzip 数值、production release 是否一定执行 quality hard-cut，或 store/supplier 是否由仓外产品/未来制品使用。

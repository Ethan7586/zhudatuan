# AU-499｜核心代码布局 README 深审

- 审阅对象：`01_core_hexin/README.md`（6 行）。
- 方法：人工审阅全文；以实际一级目录反查声明。未运行构建或应用。

## 结论

- **G0**：简短但准确的导航文档。`apps`、`services`、`packages`、`extensions` 四个声明目录均存在；apps 实际含 Auth/Console/Miniapp/Storefront，services 含 Commerce/compatibility API，extensions 分 payment/providers/vendors。
- 文件不声明命令、运行时、API、部署或权限细节，因此未发现可直接证实的文档漂移或 P0–P3。
- 当前文档不替代全仓 architecture/runtime map；其保留价值是稳定一级边界导航，不是运行权威。

# AU-493｜Git 属性与跨平台文本规则深审

- 审阅对象：仓库根 `.gitattributes`（16 行）。
- 方法：人工审阅全部属性与注释；静态检索仓内显式引用。未进行 checkout、格式化或 Git 属性重写。

## 结论

- **G0**：Git 在 checkout/index 自动消费的跨平台文本和二进制边界，非零代码引用即可删除的普通文件。
- 全局文本强制 LF；显式覆盖 JS/JSON/MJS/CSS/SVG/小程序模板样式；PNG/JPEG/WebP 保持二进制。注释说明该规则防止 Windows CRLF 让 format gate 产生全量假漂移，并保护 SQL fixture/小程序打包语义。
- 仓内显式引用只有命名审计；Git 客户端、跨平台 checkout、miniapp packer 与格式化 gate 的实际执行未验证。未发现 P0–P3。

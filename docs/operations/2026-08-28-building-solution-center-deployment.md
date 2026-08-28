# 建店方案中心三套原版发布记录

日期：2026-08-28（Asia/Shanghai）

## 结论

建店方案中心的三套 Owner 已批准原版已完成 GitHub 与阿里云发布，并在正式 Console 内逐套验收通过：

1. 築店 · 静序
2. 築店 · 东方策展
3. 築店 · 暖筑工坊

线上入口：

- Console：`https://console.zhudatuan.com/scopes/platform/platform%3Apreview/applications`
- 方案静态域：`https://labs.zhudatuan.com`

## 原因与修复

故障不是方案卡缺失，而是完整方案预览承载链未发布：

- `labs.zhudatuan.com` 当时没有 DNS 记录，也没有生效的 Caddy 站点。
- `apps/console/.gitignore` 的 `dist/` 规则误忽略第二套方案的嵌套构建目录。
- 原 Labs CSP 只允许同源嵌入，无法在 Console 中通过 iframe 展示。

修复后：

- 第二套方案的 3 个原始构建文件按已核对 SHA-256 原样纳入 `main`。
- Labs 仅开放 `/design-references/*` 与 `/demo/*`，根路径、API、健康检查与未知路径均返回 404。
- CSP 只允许 `https://console.zhudatuan.com` 嵌入；未开放交易、写入或正式 API。
- Cloudflare 新增仅 DNS 的 A 记录：`labs.zhudatuan.com → 123.57.232.253`。

## 版本与制品

- Git commit：`35c5cb6222dba49afe2d8edac9362f65330ac635`
- GitHub Actions：`33134164164`，结果 `success`
- 阿里云 release：`/srv/zhudatuan-display/releases/35c5cb6222dba49afe2d8edac9362f65330ac635`
- Console/Labs artifact：`/srv/zhudatuan-display/console-previews/35c5cb6222dba49afe2d8edac9362f65330ac635`
- Artifact：91 files；SHA manifest 校验通过
- Artifact manifest SHA-256：`c9269743744c502fe0ed6056e16cddbc939557d7dc8b32343b0058f972714c33`
- 生效 Caddy SHA-256：`756826f1ceba26a0c21f8ef47d422050ae87426a1dde80772a6f00730a1e60cf`
- 生效 Console preview unit SHA-256：`4df5152f6501b7e706e821e88a37c0aa2146065bdb5879e8577a65f2ac37e148`

## 验收

- 三套 HTML 均返回 200。
- 东方策展的 HTML、CSS、JS 均返回 200。
- Labs 根路径、API 和未知路径均返回 404。
- Console 同源的预览资产路径继续返回 404，避免绕过 Labs 隔离。
- Labs 返回 `Cache-Control: no-store`、`X-Robots-Tag: noindex, nofollow, noarchive`。
- 三套方案在正式 Console 中均显示“原版方案已载入，可体验完整交互”。
- Caddy 与只读 Console Preview 服务均为 active。
- hbbtzn 九站基线保持不变：8×200，`ts.hbbtzn.com`×404。

## 回滚

切换前配置已保存到：

`/srv/zhudatuan-display/backups/pre-solution-center-35c5cb6-20260828T1009CST`

本次提交与部署未纳入、覆盖或重建工作树中尚未提交的 Finance、Payment、Invoice 与数据库修改。

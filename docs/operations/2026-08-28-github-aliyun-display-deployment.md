# 2026-08-28 GitHub 与阿里云展示版部署日志

## 结论

本轮已把业主确认的三套正版 VI 以 **display-only（可查看、不可写入）** 方式部署到阿里云。部署源固定为 `main` 提交：

`e29ce3d6912d206df0558305bcaa1d063de272d2`

这不是正式业务后端上线。商城与登录的 API 继续 fail-closed；Console 只连接仓库内置的本地验收 Fixture，并在页面标明 `LOCAL-PREVIEW`。

## GitHub 证据

- Repository：`Ethan7586/zhudatuan`
- `origin/main`：`e29ce3d6912d206df0558305bcaa1d063de272d2`
- GitHub Actions：`Main Baseline` run `33129399019`
- 结果：`success`
- 地址：<https://github.com/Ethan7586/zhudatuan/actions/runs/33129399019>
- 阿里云 release checkout：同一 SHA，tracked worktree drift 为 `0`

## 已部署入口

| 域名                                                                       | 当前内容                           | 验收结果                                     |
| -------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------- |
| <https://zhudatuan.com/>                                                   | 业主确认的消费者 Web／27 吋标准 VI | 200；首页目视通过；旧阶段验收登录不存在      |
| <https://accounts.zhudatuan.com/>                                          | 业主确认的完整统一登录             | 200；密码、企微扫码、企业 SSO 与注册入口可见 |
| <https://console.zhudatuan.com/scopes/platform/platform%3Apreview/cockpit> | 业主确认的 4173 后台 VI            | 200；经营驾驶舱完整渲染；数据为只读 Fixture  |

收口结果：

- `zhudatuan.com/laptop-web`：404，正版消费者 Web 已成为正式根入口。
- `console.zhudatuan.com/design-references/*` 与 `/demo/*`：404，设计参考不对外发布。
- Storefront/Auth API：503 `DISPLAY_ONLY`。
- Console 仅白名单 GET 预览接口可读；未知 GET、所有写方法与未知 health 均为 503。
- Console Preview 上游仅监听 `127.0.0.1:4312`；反射式 CORS 头已在 Caddy 移除。

## 运行与完整性

- Storefront service：`zhudatuan-storefront.service`，监听 `127.0.0.1:4310`。
- Console Preview service：`zhudatuan-console-preview.service`，监听 `127.0.0.1:4312`。
- Storefront WorkingDirectory：`/srv/zhudatuan-display/releases/e29ce3d6912d206df0558305bcaa1d063de272d2/apps/storefront`
- Console Preview source：同一只读 release checkout。
- Console 展示制品：88 个文件。
- Console 制品清单 SHA-256：`5ffc3b4e73e14d1cdeebb96d580159149e8997d1a40a0235eb474f05bf263c3b`
- 生效 Caddyfile SHA-256：`cb561e9669ff3f2d207e2e54060a563a359e340fa59c32b3351d9d538363127a`

首次静态 Console 构建使用了不符合契约的 Git SHA 作为 `VITE_CLIENT_VERSION`，会触发 `CLIENT_VERSION_INVALID`。终版仍使用同一源码提交，但构建版本修正为合法 SemVer `0.0.0-e29ce3d`，并完成真实浏览器目视验收。

## 回滚点

- 三站首次切换前：`/srv/zhudatuan-display/backups/pre-e29ce3d6912d206df0558305bcaa1d063de272d2-20260828T004316Z`
- Console 只读展示接入前：`/srv/zhudatuan-display/backups/pre-console-preview-e29ce3d6912d206df0558305bcaa1d063de272d2-20260828T010125Z`

`hbbtzn` 不属于本轮部署对象。切换前后九个旧 Host 状态一致：8 个返回 200，`ts.hbbtzn.com` 根路径维持既有 404。

## 尚未上线／必须继续处理

1. `api.zhudatuan.com`、`media.zhudatuan.com`、`labs.zhudatuan.com`、`chat.zhudatuan.com` 尚未完成公网 DNS 与正式服务闭环。
2. 正式 API、Session、RBAC、数据库、Redis、KMS／Secret Store、Object Store、Jobs 与迁移账本尚未通过生产门禁。
3. 三域仍需补 HSTS 与 Permissions-Policy。
4. 本地历史资料曾出现明文服务器及 OSS 凭据；不得复用或写入日志，正式上线前必须轮换并审计。
5. 真正后端可用后，应移除 Console Preview service 与 Fixture 路由，改由 `api.zhudatuan.com` 的权威 API 提供数据。

## 业主边界

本轮只部署已批准的 UI 基线和临时只读展示运行方式，没有提交或部署工作树中的财务升级代码，也没有修改 `hbbtzn` 旧站。

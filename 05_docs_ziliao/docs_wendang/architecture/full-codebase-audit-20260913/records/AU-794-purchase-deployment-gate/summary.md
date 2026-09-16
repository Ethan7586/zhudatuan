# AU-794｜Purchase 部署声明门禁

- 审阅范围：`check/purchase-deployment.mjs` 与 Caddy/delivery/systemd/environment/runtime/migration/receipt schema/build/operation 输入。
- 审阅方式：深读公共 purchase path、503 blocked cutover、OPTIONS preflight、route ownership、receipt schema、source closure和旧 deploy exclusion；运行只读静态入口。

## 审计结论

- **G0：保留。** 此工具是 public checkout/order/payment API 在未产出 E2E receipt 时必须 fail-closed 的关键发布门禁。
- **既有 F-0296 复证：** checker仍用 `api.zhudatuan.com {` 作为 Caddy block起点，当前 Caddy 使用 `api.fufu.wang {`；固定基线立即报 `CADDY_HOST_BOUNDARY_MISSING`，后续精确503、systemd、receipt、role和迁移检查均未执行。
- **限制：** 没有执行 Caddy、purchase API、E2E receipt或线上 DNS；静态失败不证明公开路径已经开放或购买数据已受影响。

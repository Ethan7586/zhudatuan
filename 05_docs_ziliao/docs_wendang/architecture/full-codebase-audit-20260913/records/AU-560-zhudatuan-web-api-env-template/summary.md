# AU-560｜zhudatuan L0 Web Business API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/zhudatuan-l0/web-api.env.example`（21 行）；定向阅读 WebBusinessApi runtime/environment validator、generic systemd 与 L0 remote target。
- 审阅方式：环境字段、manifest/mall origin binding、启动/发布链人工追踪；未启动 API 或访问实际数据库。

## 真实运行关系

L0 web env + systemd profile `web-business-only` → WebBusiness API environment validation → manifest feature/surface/origin validation → L0 DB/KMS/Secret Store runtime → public mall host mapping；remote policy delivers WebBusinessApi artifacts and restarts `sfl-web-api@zhudatuan-l0.service`.

## 审计结论

- **G0**：API port、profile、DB/KMS/secret/manifest/pointer均符合 L0 generic service/remote target；allowed origins均是 L0 manifest-bound console/storefront origins，public L1 hbbtzn hosts 显式映射到 `zdt-l1-verify`。
- environment validator 限制允许键、强制 membership、secure endpoints、不同 workload bearer、sha256 manifest digest、port和host-map语法；runtime另验证 catalog/storefront/api feature/surface及 bound origins。
- **F-0249 关联**：本环境会进入已记录的 WebBusiness runtime compatibility startup path，该 path catch 后仅 warning 再监听；本单元未发现模板加剧或缓解该既有 P1 候选的证据。

## 未验证项

- 未启动服务、验证真实 manifest digest/secret/DB role/RLS/CORS/public catalog mapping，亦未重跑 compatibility failure case；F-0249独立复核仍待完成。

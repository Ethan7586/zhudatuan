# AU-552｜hbbtzn L1 identity API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/identity-api.env.example`（25 行）；定向核对 hbbtzn manifest、remote delivery target、generic identity unit 与 domain-boundary gate。
- 审阅方式：环境契约与运行入口人工追踪；执行正式只读 `node 04_tools/scripts/check/domain-boundary.mjs`。

## 真实运行关系

hbbtzn identity env → `sfl-identity-api@hbbtzn-l1.service` → identity registration API + L1 Secret/KMS/Object Store refs；remote policy 将同一 API artifact 投递到 `/opt/sfl/nodes/hbbtzn-l1/targets/identity-api` 并重启同名 L1 unit。domain-boundary gate 从 manifest 生成 expected origins/namespace/pointer constraints 并检查本模板。

## 审计结论

- **G0**：模板的 API origins 精确覆盖 hbbtzn manifest 的 identity、console 与全部 storefront hosts；database/session/identity/WeChat refs 都在 `hbbtzn/nodes/l1/` namespace，node manifest/path/runtime/pointer 与 L1 deployment target 相符。
- 所有 KMS/object/secret bearer 为 placeholder，未含明文凭据。与 AU-550/AU-551 不同，identity API 是 hbbtzn L1 的正式独立物理 runtime 与 remote release target，不存在 L0-only ownership 漂移。
- **定向验证通过**：`domain-boundary.mjs` 输出“one registry, two sovereign API domains, zero default fallback”，验证 registry、manifest-domain、env origin/ref/pointer 间的静态一致性。

## 未验证项

- 未读取真实 runtime env、KMS/Secret Store 或线上 systemd；未验证实际 DNS/TLS/tunnel 和 identity session/authorization 行为。

# AU-554｜hbbtzn L1 payment webhook API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/payment-webhook-api.env.example`（17 行）；定向核对 hbbtzn deployment 与 remote release policy。
- 审阅方式：环境键和实际发布/启动单元人工追踪；未启动 webhook、读取回调或访问 Secret Store。

## 真实运行关系

webhook env 预期供 node-bound payment webhook API 使用，绑定 hbbtzn L1 DB role、payment secret config、manifest/runtime/pointer；当前 hbbtzn deployment 将该 responsibility 交给 `sfl-payment-webhook-api@zhudatuan-l0.service`，remote policy 的 webhook candidate、pointer 与 health check也只位于 L0。

## 审计结论

- **F-0260 补强（P2）**：模板描述 L1-local webhook 运行，但当前 release/control-plane 实际只交付/重启 L0 webhook。若未来按模板激活 L1，没有对应 L1 artifact target；若沿用 L0，则模板 DB/payment refs不会成为实际 service 配置。
- 模板未声明 API origin（webhook 是 provider callback surface），所有 secret bearer 为 placeholder；L1 manifest 包含 `surface:api`，但 webhook callback URL/WeChat configuration 与实际 node resolution尚未动态验证。

## 未验证项

- 未核对 provider callback DNS、签名验证、WeChat config 内 notify URL、L0 delegation 和真实 production traffic；不从环境示例推断当前线上故障。

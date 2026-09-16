# AU-754｜Provider contract suite

- 审阅范围：provider contract shared helper 与十一家 priority-one provider 的统一 spec。
- 审阅方式：深入审阅 manifest/factory/port/version/lifecycle assertions 和 provider registry/release-stage consumers。未访问任何 provider 或运行 tests。

## 审计结论

- **G0：两文件均保留。** spec 将运行 provider set 与 `REQUIRED_PROVIDER_IDS` 精确比对；helper 验证 signed manifest、capability-derived ports、contract version mismatch、start/stop 与 local health 生命周期。
- remote fixture 固定使用 `https://sandbox.invalid`、合成 token/短期测试私钥，只验证 in-process contract 构造，不验证真实渠道 endpoint、TLS、鉴权、重试、超时、幂等或任何外部副作用。

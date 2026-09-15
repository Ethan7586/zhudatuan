# AU-742｜Full staging 内部访问与密钥目录模板

- 审阅范围：full staging 的 bootstrap/runtime workload access policy 与 secrets catalog 四份 JSON 模板。
- 审阅方式：深入核对模板的 phase、工作负载、资源授权面与 secret key 集；反向检查候选制品清单、环境校验、主机就绪及运行时 ACL probe 的实际消费关系。未读取真实主机文件、token 或密钥，也未执行服务。

## 审计结论

- **G0：四份模板均保留。** bootstrap 仅授予 migration、owner-bootstrap；runtime 仅授予 identity registration API、identity notification jobs、full jobs。Secret Store 与 KMS token 分离，object-store token 也须与所有 grant token 不同。
- `readiness-host.mjs` 会以模板为契约，比对上线配置的 phase、经脱敏后的授权边界和 secret key 集，并拒绝任何占位值；`readiness-runtime.mjs` 还对每个 workload 发起允许与拒绝 ACL probe。因此这不是静态示例或无引用配置。
- 四个文件均只含 `REPLACE_*` 占位符，没有真实凭据。实际 Secret Store/KMS 的鉴权、主机文件权限及线上 ACL 尚未运行验证，结论明确限于仓库契约与调用关系。

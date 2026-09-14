# AU-502｜Canonical Commerce API 环境模板深审

- 审阅对象：`01_core_hexin/services/commerce/.env.example`（41 行）。
- 方法：人工审阅全部变量；静态追溯 `ApiMain` → `apiEnvironment` → `CommerceRuntime` 的 API workload 启动链及 Catalog Jobs 的媒体变量。未读取真实环境或凭据，未启动服务。

## 结论

- **G0**：模板保存 API origin、Secret Manager reference、对象存储、KMS、Redis、商品媒体和公共商城的本地配置契约；其中 access key 值为空，secret refs 不是 secret 本身。
- **F-0245 / P3**：模板设置 `SECRET_STORE_ENDPOINT`，但 `ApiMain` 建立 `CommerceRuntime` 时无条件要求 `SECRET_STORE_BEARER_TOKEN`；该字段不在模板中。因此从此模板直接创建本地 API 环境会在读取数据库 reference 前 fail-fast。它是开发/文档完整性问题，未证明生产注入受影响。
- 专用 API/Jobs runtime 另需 node manifest、job connection、KMS bearer 等变量；本模板只标注 API workload，不能替代全部运行单元环境定义。真实 secret manager、CORS、对象存储和媒体 provider 未验证。

# AU-547｜容量、超时与连接池权威目录

- 审阅范围：`02_platform_pingtai/config/capacity.yml`（59 行）；定向阅读 runtime config generator 和所有主要 `RUNTIME_LIMITS` runtime consumers。
- 审阅方式：配置、生成链、consumer 调用方向人工阅读；未执行生成、编译或服务启动。

## 真实运行关系

capacity catalog → generator → RuntimeCatalog generated projection → API client deadline、HTTP server request/header/keepalive limits、external executor bulkhead/circuit/rate/retry、Aliyun SMS timeout、PostgreSQL pool profile；其中 HTTP limits 还单独投影给 Miniapp。

## 审计结论

- **G0**：当前 catalog 区分规模模型、provider capacity、external/HTTP runtime limit 与四类 DB pool，已知生产 consumer 明确使用 HTTP/external/pool 的值；`--check` 能检查 YAML 与生成投影是否漂移。
- **F-0258（P3，高置信）**：generator 的 schema 只验证 external 已出现字段为正整数和 pool 已出现字段的部分属性；它未校验 model/provider/http 的必需字段或数字范围，也不确保 external 必需键齐全。未来错误/遗漏值可被生成器接受并写入 TypeScript/Miniapp 投影，随后是否被 typecheck/具体 consumer 截获取决于该字段是否恰好被静态使用。

## 未验证项

- 未运行 generator、typecheck 或服务；未验证所列容量是否满足真实并发/数据库连接上限，也未核对所有 provider/model 字段的实际 consumer 或部署环境覆写。

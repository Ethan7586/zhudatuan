# AU-796｜Web Business API 部署声明门禁

- 审阅范围：`check/web-business-deployment.mjs` 与 Caddy/delivery/systemd/environment/runtime/operations/migration/sandbox plan 输入。
- 审阅方式：深读 public path list、Caddy matcher/route closure、selected runtime role/port、delivery route/operation ownership与禁止依赖规则；运行只读静态入口。

## 审计结论

- **G0：保留。** 该工具意图验证公开 member/catalog/cart/benefit/order读取路径只能由 Web Business 专用 API 提供。
- **F-0309 / P2：** checker首先要求 Caddy存在单行 `@webBusinessApi path …` matcher；当前受控 Caddy无该 matcher，且 API site已从历史拓扑迁为 `api.fufu.wang`→`localhost:3001`。命令在第57行停止，后续 selected role/systemd/delivery/operation closure/assertions全未运行。
- **限制：** 静态 Caddyfile不能证明在线服务器、DNS或端口3001实际服务；本批没有探测或修改线上路由。

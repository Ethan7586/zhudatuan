# RV-0075｜Auth runtime 凭据目的地独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；仅静态审阅，未读取线上 runtime、未提交凭据、未访问线上身份接口。
- 对象：F-0083，Auth Web `identity-runtime.json` → registry → 登录/注册请求目的地。

## 重查调用链

- Auth Web 从同源 `/identity-runtime.json` 读取 runtime；`installIdentityNodeRuntime` 只校验 schema、SHA/digest 字段形状、`build_count` 与当前浏览器 hostname 能在 runtime registry 中找到 accounts host。
- SDK `parseIdentityNodeRegistry` 对 API、consumer API、storefront 和后台地址施加 HTTPS/原点形状、去重和 node profile 约束，却不把 API origin 绑定到 accounts host 的受信 Manifest、已验证摘要或同一域关系。
- `canonicalIdentity.ts` 与 `canonicalRegistration.ts` 都经 `currentIdentityNode().apiOrigin` 构造 POST 请求；请求正文可含账号、密码、OTP、邀请或注册资料。现有单测只证明生成节点整体可被安装和 host mismatch 会失败，没有拒绝“当前 accounts host + 外域 API”的反事实。
- AutoNode 会写入 runtime 文件并产生 digest；Commerce 服务启动时亦会把自身 runtime node 与 NodeManifest 对比。但浏览器 installer 不验证 runtime digest，也不复用服务端 Manifest 比对，因此两条服务器侧控制不能约束浏览器的请求目的地。

## 结论

- **确认 P1。** 在可修改同源 runtime 文件或其供应链的前提下，形状合法但 API 指向外域的 runtime 会被浏览器接受，并成为凭据请求目的地。该链已有直接代码证据，不依赖猜测。
- 未确认线上 runtime 是否可被篡改、当前值是否漂移、外域是否允许 CORS、是否已有凭据泄露或受影响用户；所以没有 P0 证据。
- 后续修复必须从当时最新主线另建单一安全批次，统一 runtime producer、浏览器验证和 Manifest/摘要绑定，并用“正确 accounts host + 外域 API”反事实拒绝测试验证；回滚须保留前一受控 runtime 制品。

# AU-811｜Console 制品浏览器验证

- 审阅范围：`release/verify-console.mjs`（290 行）及 build-console 调用点。
- 结论：CLI强制二选一 local dist或public URL；local经已审artifact reader并以Playwright路由本地文件/受控API，验证未认证identity跳转、节点API origin及Owner workspace在受控403 profile下的降级；public模式读取远程manifest并浏览真实URL。两种模式均未运行。
- 证据边界：local测试是synthetic API/identity，不证明真实session、服务端授权或RLS；public模式才可能提供线上可用性观察但本审计未访问线上。脚本由build-console调用，**G0**，无新 finding。

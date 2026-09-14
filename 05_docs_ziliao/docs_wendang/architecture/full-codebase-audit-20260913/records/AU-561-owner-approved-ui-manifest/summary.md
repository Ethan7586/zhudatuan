# AU-561｜Owner-approved UI 发布锁定清单

- 审阅范围：`02_platform_pingtai/config/owner-approved-ui.json`（145 行）及 `check:approved-ui` 实现；复核已记录的 F-0005。
- 审阅方式：批准/发布入口、machine lock逻辑人工阅读；执行正式只读 `npm run check:approved-ui`。

## 真实运行关系

Owner approval manifest → `check:approved-ui` → schema/policy/path containment → surfaces entrypoint/output/locked file SHA → deployment Caddy/delivery/process SHA、required hosts/forbidden runtime tokens/migration existence → `quality:canonical-hard-cut` 和 delivery `sourceOfTruth`。它声明 storefront/accounts/console 三个批准 surface 与 38 个 locked files。

## 审计结论

- **F-0005 复核（高置信）**：正式 check 当前在第一处 accounts `auth-web/src/App.tsx` 停止，实际 SHA `877f7e…81ccc5` 不等于 manifest locked hash。该门因此无法完成，且本次只证明首个 mismatch；其余锁定文件/部署锁未运行至核验。
- manifest 是发布治理输入，而非代码运行入口；它正确拒绝 archive/outside-main paths、禁止 archive deploy、检查 delivery source-of-truth、required hosts/forbidden runtime tokens，并强制 locked files非空。
- checker 验证 path/hash/existence，但不追踪 entrypoint import graph、router mounting或视觉可达性；manifest 自己也声明 visual reachability 不能代表 backend acceptance。F-0005 中“批准 LoginPage 与实际 App render 分歧”仍须 Owner 决定，审计不改 manifest/hash。

## 未验证项

- 未确认 Ethan 当前希望冻结的真实 Auth 页面、其余锁文件/host/migration是否全部一致、实际 Caddy/运行制品、页面视觉或后端会话契约；失败后未重试/绕过检查。

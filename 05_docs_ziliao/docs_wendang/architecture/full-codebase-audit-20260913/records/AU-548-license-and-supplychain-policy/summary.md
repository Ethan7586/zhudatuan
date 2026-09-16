# AU-548｜许可证与源码凭据质量策略

- 审阅范围：`02_platform_pingtai/config/licenses.yml`（27 行）；定向阅读 `check:supplychain` 与 root quality hard-cut，并执行正式只读 `npm run check:supplychain`。
- 审阅方式：配置、消费者逻辑及定向质量命令；命令未修改仓库。

## 真实运行关系

`quality:canonical-hard-cut` → `check:supplychain` → package-lock license expression allow/deny evaluation + tracked/untracked repository secret/signature scan → nonzero findings 阻止总闸。

## 审计结论

- **F-0259（P2，高置信）**：正式命令当前退出 1，报告 7 个 package-lock license finding：`big-integer` Unlicense、`buffers`/`pause-stream` missing、`chainsaw`/`traverse` MIT/X11、`jszip` MIT OR GPL-3.0-or-later、`pako` MIT AND Zlib。因 quality hard-cut 把它作为早期 gate，完整 canonical quality run 当前无法经过此步骤。
- 策略同时执行以 Git index 为基础的秘密模式扫描，覆盖 tracked 和未忽略 untracked text/secret-file，属于真实质量/凭据防线；本次失败输出未报告 secret finding。
- 许可表达式 parser 仅接受 allow-list 中的精确单项，且 AND/OR 拆分后要求全部 allowed，并再套 denied regexp；这使含允许分支但也出现 GPL 的 `MIT OR GPL…` 被拒绝，是否符合项目法务意图需专项确认，不能在审计分支自行放宽。

## 未验证项

- 未核对 7 个依赖的来源、实际使用、打包/动态链接方式或法务许可义务；未验证 production release 是否强制运行 canonical hard-cut；未对 secret scanner 作反事实样本测试。

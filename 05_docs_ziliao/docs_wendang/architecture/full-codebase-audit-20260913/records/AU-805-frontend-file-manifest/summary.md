# AU-805｜前端文件清单证据生成器

- 审阅范围：`evidence/frontendmanifest.mjs`（75 行）与已存在的 `evidence/frontend/files.json`。
- 审阅方式：审阅11个 source root、排除规则、path/hash/size/mode canonicalization、`--check` byte equality和默认写入模式；只运行 `--check`。

## 审计结论

- **F-0005（复现，未重复登记）：** `--check` 退出1并报 `FRONTEND_FILE_MANIFEST_DRIFT`；现存 evidence file 为786条，不能作为当前固定基线的可信内容清单。
- 默认命令会直接覆盖版本控制的 `files.json`，审计没有运行它；清单更新必须在独立、明确审查的证据刷新批次进行，并核对每个新增/删除/变更项。
- 根 package 同时注册 generate 与 check 路径，故为 **G0**；无删除依据。

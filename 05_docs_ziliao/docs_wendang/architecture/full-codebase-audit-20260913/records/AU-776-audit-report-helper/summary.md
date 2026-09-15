# AU-776｜Audit report 共享输出器

- 审阅范围：`04_tools/scripts/audit/report.mjs`。
- 审阅方式：深入审阅唯一性 key、输出及 exit status，反向核对 events/runtimegraph/navigation/extensions/operations/jobs/dependencies/requirements/providers/environment callers。

## 审计结论

- **G0：保留。** helper 对 `(code, location, detail)` 去重，输出 accepted/violations，并在任意 violation 时设置非零 exit；是多个正式 architecture/quality gate 的共同 fail-closed 终点。
- 它不判断规则本身正确性；每个 caller 的 source coverage/dynamic behavior 限制仍须单独评估。

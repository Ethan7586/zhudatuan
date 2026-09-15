# RV0058｜GX-0036 Console contract runtime ledger 封板

- 复核对象：`20260821073000_publish_console_contract.sql`、其目标 `20260821032000` checksum，以及当前 RuntimeCompatibility 和后续 readiness repair。
- 直接证据：该迁移将目标 head 的 checksum 封入 `runtime.schemaversion`，以 `RUNTIME_CONTRACT_CHECKSUM_MISMATCH` 中止不一致状态并登记自身版本；后续 `20260828183000` 明确接受该 checksum 后再演进为新值，拒绝未知前序值。
- 运行结论：当前 API/Jobs 的 RuntimeCompatibility 查询 schema ledger、scope resolver 和运行注册表；测试确认 legacy contract match 会被报告，但该旧标记不再单独决定 API health。这是历史兼容性限定，不构成 P0/P1。
- 结论：该文件仍是可恢复迁移序列中 Console API/授权契约的封板历史，不能删改、跳过或单独重放；GX-0036 维持。未执行迁移、构建、服务或线上检查。

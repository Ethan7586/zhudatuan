# AU-787｜Owner-approved UI 清单门禁

- 审阅范围：`check/owner-approved-ui.mjs`、`owner-approved-ui.json` 的 surface/lock/deployment contract。
- 审阅方式：深读 schema、仓库路径/归档限制、锁定文件 hash、rejected entrypoint、proxy/delivery/process/migration 和 host/forbidden token 校验；运行正式只读入口。

## 审计结论

- **G0：保留。** 清单是 owner 核准页面与部署输入之间的反漂移证明；它不会实际部署或改变文件。
- **既有 F-0005 复证：** 首个 accounts locked file `auth-web/src/App.tsx` 期望 hash 为 `11d977…f86e`，当前为 `877f7e…1ccc`，命令因此停止。清单无法证明当前 Auth 入口是经 owner 批准版本。
- **限制：** 该检查只证明文件身份、路径与部署声明，不验证真实渲染、可访问性或用户操作；需要受控真实页面对照的结论仍保留未验证。

# AU-057｜cart 当前购物车与批量变更深审

- CartModule 在 Commerce/WebBusiness 注册 current read、single put 和 item batch 三个 member operation；CartPort 只由下单链路将 active cart 转为 converted。
- 单项 put 验证 member/mall、active Experience application 和可购买 listing，原子取得 active cart，再按 quantity 新建/更新/删除 item。数据库唯一索引保证每个 member/mall/application 一个 active cart，RLS 绑定 web scope。
- F-0146（P2）：公开 `cart.items.batch` 与 SDK 承诺批量写入，但实现既不创建 cart、不校验 listing，也不能插入不存在 item；空购物车或新 listing 的非零 quantity 请求零更新且返回空结果。该操作已在 WebBusiness API 注册。
- 已有测试仅断言 manifest；未覆盖 put/batch、成员隔离、版本或 converted cart。未运行 Vitest（固定审计 worktree 缺命令）。未发现 P0/P1。

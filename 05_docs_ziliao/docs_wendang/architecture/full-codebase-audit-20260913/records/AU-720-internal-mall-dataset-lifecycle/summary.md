# AU-720｜Internal Mall 测试数据集生命周期

- 审阅范围：Internal Mall 数据集的生成、导入、核验、清理、数据库 guard、fixture 和 core/commerce/reporting 写入器，共 11 个文件。
- 审阅方式：深入审阅写入入口、目标数据库 guard、transaction/advisory lock、导入幂等与 cleanup；大批确定性 fixture/同形 insert 映射按代表路径结构性审阅。未运行任何 seed/import/cleanup/verify 命令。

## 运行关系

- 本地 `InternalMallDataset` 要求本机地址、`zhudatuan_internal_` 前缀数据库、空的非 ITHT 订单空间后，在一个 transaction 内 cleanup 后依次写 core、commerce、reporting。
- 导入入口 `ImportInternalMallDataset` 使用相同 seed pipeline 和 transaction/advisory lock，但通过独立 `parseImportOptions`/`assertImportDatabase` 进入；其 purpose 是对指定目标导入后以 import-mode verifier核验。
- cleanup 覆盖主数据集与多类 dependent rows；导入再执行时检查完整 dataset counts 后 no-op。现有 F-0265 已记录当前 schema 的 fulfillment/inventory Mall 字段与 seed writer 兼容性风险，本批未重复编号。

## 审计结论

- **G0：完整生命周期都保留。** Dataset、导入、验证、清理和确定性 plan 共同保存 test-data 契约；不能把固定 ID、synthetic 标记或重复 insert 当垃圾。
- 新增 **F-0293（P2）**：导入模式要求 `--database`，但未限制数据库命名前缀、host 或空的非-ITHT 业务数据；它可借拥有写入凭据的错误目标执行整个 synthetic 数据写入链。
- 未运行定向验证：所有正式入口均连接并写入数据库，违反本轮只读审计边界。

## 未验证项

- 未验证任何导入目标、运行凭据或生产数据库是否可被该 command 连接；未证明实际发生过误导入。
- 未在 current migration head 执行 dataset；F-0265 的最新 schema failure/success 仍按原记录未验证。

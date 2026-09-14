# AU-208｜Commerce TransactionRunner 深审

TransactionRunner保存ModuleOperations的query/command事务选择语义，实际转发到UnitOfWork；不是冗余删除候选，未发现P0–P3问题。

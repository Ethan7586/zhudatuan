# AU-135｜Catalog 发布 Worker 与行为测试深审

发布 Worker 以逐项事务把 listing 变更和 guarded durable progress 对齐；测试覆盖完成、恢复和冲突回滚。未发现 P0–P3。

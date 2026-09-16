# AU-247｜Commerce IdentityNodeManifestRuntime 深审

此运行时把节点manifest、identity registry与registration数据库的realm/entry/target投影绑定：可选文件必须具备固定schema，节点必须唯一且与manifest一致；数据库检查同时读取三张表并以完整排序投影拒绝drift。Fixture覆盖全局投影drift、scoped realm query及L0多admin target，但未直接执行runtime文件加载、未知/重复节点或manifest/registry mismatch，记录F-0226/P2；无P0/P1问题。

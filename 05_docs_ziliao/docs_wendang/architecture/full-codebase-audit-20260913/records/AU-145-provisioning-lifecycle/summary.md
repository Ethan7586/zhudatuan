# AU-145｜Mall Provisioning、模板克隆与域名购买状态机深审

Provisioning is a dedicated API composition with only mall create/read operations. `CreateMall` plans stable IDs, preflights organization/public-slug conflicts, then creates organization → catalog pool → experience application/draft → owner in the caller transaction. Hosted-node and company-template provisioning delegate canonical validated JSON to database functions. Domain purchase policy validates canonical domains, quote expiry/amount, hold reference, approval fingerprint/scope/assurance; lifecycle stops at registrar registration rather than DNS/TLS/publication.

新增 F-0178/P2：existing tests cover CreateMall engine, hosted node/clone adapters and policy/lifecycle, but no test invokes `provisioningOperations` for the two HTTP actions; API entrypoint only asserts routes. HTTP validation, access context, reject status and read-not-found contract lack behavior evidence. 未发现 P0/P1；Vitest execution 未验证（审计 worktree 缺少依赖）。

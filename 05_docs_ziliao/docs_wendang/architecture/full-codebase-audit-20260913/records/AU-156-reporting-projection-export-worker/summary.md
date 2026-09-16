# AU-156｜Reporting projection 与 export Worker 深审

Projection worker 在 transaction 内 claim inbox、投影并完成事件，再按 projection version 删除旧 cache。Export worker 分页生成 CSV/XLSX，要求 object scan/hash/size/content-type 完整匹配后完成；失败 abort object 并记录 retry/terminal state。

新增 F-0183/P2：Worker process/retry/integrity 没有直接测试。未发现 P0。

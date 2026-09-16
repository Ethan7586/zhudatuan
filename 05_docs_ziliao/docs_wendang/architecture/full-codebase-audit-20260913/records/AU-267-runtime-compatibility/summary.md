# AU-267｜RuntimeCompatibility 深审

通用运行健康将runtime contract作为可观测状态，不作为`healthy`阻断条件；direct fixture明确覆盖contract false仍healthy。API/Jobs另外检查schema、scope resolver、extensions、jobs cache及jobs数据库边界。无P0–P3新问题。

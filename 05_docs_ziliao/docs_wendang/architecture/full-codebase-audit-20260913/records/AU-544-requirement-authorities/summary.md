# AU-544｜需求权威工作簿锁定配置

- 审阅范围：`02_platform_pingtai/config/authorities.yml`（17 行）；定向阅读 requirement authority loader/audit consumer，并对两份受管工作簿重算 SHA-256。
- 审阅方式：配置、调用链和实际摘要人工核对；未执行生成/审计命令。

## 真实运行关系

requirements generator/audit → `authorities.yml` → repository-relative path + realpath repository containment → read workbook bytes → SHA-256 equality → sheet count/source metadata → requirement mapping/full requirements consistency gate。

## 审计结论

- **G0**：配置锁定福利商城需求清单和订单需求两份 repository authority。实际重算 hash 分别为 `78cfc3…322942` 与 `2d2681…9e79e`，与配置完全一致。
- loader 拒绝绝对/`..` 路径、realpath escape、无效 hash、空 sheet map 和缺失 mandatory `requirements` authority；该配置是需求生成与漂移审计的输入契约，而非说明性 YAML。
- `orderRequirements` 附带 OMS/profile 和两张需求表计数，当前 loader 将其作为通用 authority 条目解析；专门如何消费由 order requirements 专项决定。

## 未验证项

- 未运行 requirementgen/audit，未解读 Excel 内容或独立核实 sheet 行数是否与业务规格相符；未验证外部流程是否绕过 authority loader。

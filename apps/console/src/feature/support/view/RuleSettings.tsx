import { Button } from '@shop/design';
import { useEffect, useState } from 'react';
import type { Rule, RuleChange } from '../model/SupportConfig';

type Body = RuleChange;
export function RuleSettings({ rows, busy, disabled, onSave }: Readonly<{ rows: readonly Rule[]; busy: boolean; disabled: boolean; onSave: (id: string, version: number, body: Body) => void }>) {
  const [id, setId] = useState(rows[0]?.id ?? `rule:${crypto.randomUUID()}`);
  const row = rows.find((item) => item.id === id);
  const [name, setName] = useState(row?.name ?? '默认分配');
  const [skill, setSkill] = useState(row?.skill ?? 'general');
  const [priorities, setPriorities] = useState<Body['priorities']>(row?.priorities ?? ['normal']);
  const [weight, setWeight] = useState(row?.weight ?? 100);
  const [state, setState] = useState<Body['state']>(row?.state ?? 'active');
  const edit = (value: string) => {
    const found = rows.find((item) => item.id === value);
    setId(value);
    if (found) {
      setName(found.name);
      setSkill(found.skill);
      setPriorities(found.priorities);
      setWeight(found.weight);
      setState(found.state);
    }
  };
  const create = () => {
    setId(`rule:${crypto.randomUUID()}`);
    setName('');
    setSkill('general');
    setPriorities(['normal']);
    setWeight(100);
    setState('active');
  };
  useEffect(() => {
    if (!row && rows[0] && name === '默认分配') edit(rows[0].id);
  }, [rows]);
  return (
    <section className="supportsettingsection">
      <header>
        <div>
          <h2>分配规则</h2>
          <p>按数据范围、技能、容量、权重和稳定顺序分配。</p>
        </div>
        <Button onPress={create}>新增规则</Button>
      </header>
      <label>
        选择规则
        <select value={id} onChange={(event) => edit(event.target.value)}>
          {row ? null : <option value={id}>新规则</option>}
          {rows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · 第 {item.version} 版
            </option>
          ))}
        </select>
      </label>
      <div className="supportsettingsgrid">
        <label>
          规则名称
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          技能
          <select value={skill} onChange={(event) => setSkill(event.target.value)}>
            <option value="general">通用服务</option>
            {rows
              .filter((item) => item.skill !== 'general')
              .map((item) => (
                <option key={item.skill} value={item.skill}>
                  {item.name}专属服务
                </option>
              ))}
          </select>
        </label>
        <label>
          优先级
          <select multiple value={[...priorities]} onChange={(event) => setPriorities([...event.currentTarget.selectedOptions].map((item) => item.value as Body['priorities'][number]))}>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          权重
          <input type="number" min={0} value={weight} onChange={(event) => setWeight(Number(event.target.value))} />
        </label>
        <label>
          状态
          <select value={state} onChange={(event) => setState(event.target.value as Body['state'])}>
            <option value="active">启用</option>
            <option value="disabled">禁用</option>
          </select>
        </label>
      </div>
      <Button tone="primary" isDisabled={busy || disabled || !name || priorities.length === 0} onPress={() => onSave(id, row?.version ?? 0, { name, skill, priorities, weight, state })}>
        {busy ? '保存中…' : '保存规则'}
      </Button>
    </section>
  );
}

import { Button } from '@shop/design';
import { chineseDomainLabel } from '@shop/presentation';
import { useCallback, useEffect, useState } from 'react';
import type { Agent } from '../model/Agent';
import type { AgentChange } from '../model/SupportConfig';

type Body = AgentChange;
export function AgentSettings({ rows, busy, disabled, onSave }: Readonly<{ rows: readonly Agent[]; busy: boolean; disabled: boolean; onSave: (id: string, version: number, body: Body) => void }>) {
  const [selected, setSelected] = useState('');
  const row = rows.find((item) => item.id === selected) ?? rows[0];
  const [membership, setMembership] = useState('');
  const [skills, setSkills] = useState('general');
  const [capacity, setCapacity] = useState(10);
  const [state, setState] = useState<Body['state']>('available');
  const skillOptions = [...new Set(['general', ...rows.flatMap((item) => item.skills)])];
  const edit = useCallback((id: string) => {
    const value = rows.find((item) => item.id === id);
    setSelected(id);
    if (value) {
      setMembership(value.membershipId);
      setSkills(value.skills.join(', '));
      setCapacity(value.capacity);
      setState(value.state);
    }
  }, [rows]);
  useEffect(() => {
    if (!selected && rows[0]) edit(rows[0].id);
  }, [edit, rows, selected]);
  return (
    <section className="supportsettingsection">
      <header>
        <div>
          <h2>客服人员</h2>
          <p>维护客服状态、技能与并发容量；禁用后由后台任务分批重分配。</p>
        </div>
        <Button
          isDisabled={disabled}
          onPress={() => {
            setSelected(`agent:${crypto.randomUUID()}`);
            setMembership('');
            setSkills('general');
            setCapacity(10);
            setState('available');
          }}
        >
          新增客服
        </Button>
      </header>
      <label>
        选择客服
        <select value={row?.id ?? selected} onChange={(event) => edit(event.target.value)} disabled={disabled}>
          <option value={selected && !row ? selected : ''}>{selected && !row ? '新客服' : '请选择'}</option>
          {rows.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName} · 第 {item.version} 版
            </option>
          ))}
        </select>
      </label>
      <div className="supportsettingsgrid">
        <label>
          {row ? '客服姓名' : '成员唯一标识'}
          <input value={row ? row.displayName : membership} onChange={(event) => setMembership(event.target.value)} readOnly={row !== undefined} disabled={disabled} placeholder="新增客服时从成员管理复制唯一标识" />
        </label>
        <label>
          服务技能
          <select
            multiple
            disabled={disabled}
            value={skills
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)}
            onChange={(event) => setSkills([...event.currentTarget.selectedOptions].map((item) => item.value).join(', '))}
          >
            {skillOptions.map((skill) => (
              <option key={skill} value={skill}>
                {chineseDomainLabel(skill, '专属服务')}
              </option>
            ))}
          </select>
        </label>
        <label>
          并发容量
          <input type="number" min={1} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} disabled={disabled} />
        </label>
        <label>
          状态
          <select value={state} onChange={(event) => setState(event.target.value as Body['state'])} disabled={disabled}>
            <option value="available">可接单</option>
            <option value="busy">忙碌</option>
            <option value="offline">离线</option>
            <option value="disabled">禁用</option>
          </select>
        </label>
      </div>
      <Button
        tone="primary"
        isDisabled={busy || disabled || !selected}
        onPress={() =>
          onSave(selected, row?.version ?? 0, {
            membership: membership || row?.membershipId || '',
            skills: skills
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
            capacity,
            state,
          })
        }
      >
        {busy ? '保存中…' : '保存客服'}
      </Button>
    </section>
  );
}

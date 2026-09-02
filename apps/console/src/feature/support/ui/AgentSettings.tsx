import { Button } from '@shop/design';
import type { OperationOutputFor } from '@shop/contract';
import { useEffect, useState } from 'react';
import type { AgentChange } from '../model/SupportConfig';

type Agent = OperationOutputFor<'support.agents.read'>['items'][number];
type Body = AgentChange;
export function AgentSettings({ rows, busy, disabled, onSave }: Readonly<{ rows: readonly Agent[]; busy: boolean; disabled: boolean; onSave: (id: string, version: number, body: Body) => void }>) {
  const [selected, setSelected] = useState('');
  const row = rows.find((item) => item.id === selected) ?? rows[0];
  const [membership, setMembership] = useState('');
  const [skills, setSkills] = useState('general');
  const [capacity, setCapacity] = useState(10);
  const [state, setState] = useState<Body['state']>('available');
  const edit = (id: string) => { const value = rows.find((item) => item.id === id); setSelected(id); if (value) { setMembership(value.membership_id); setSkills(value.skills.join(', ')); setCapacity(value.capacity); setState(value.state); } };
  useEffect(() => { if (!selected && rows[0]) edit(rows[0].id); }, [rows, selected]);
  return <section className="supportsettingsection"><header><div><h2>客服人员</h2><p>维护客服状态、技能与并发容量；禁用后由后台任务分批重分配。</p></div><Button onPress={() => { setSelected(`agent:${crypto.randomUUID()}`); setMembership(''); setSkills('general'); setCapacity(10); setState('available'); }}>新增客服</Button></header><label>选择客服<select value={row?.id ?? selected} onChange={(event) => edit(event.target.value)}><option value={selected && !row ? selected : ''}>{selected && !row ? '新客服' : '请选择'}</option>{rows.map((item) => <option key={item.id} value={item.id}>{item.membership_id} · v{item.version}</option>)}</select></label><div className="supportsettingsgrid"><label>成员关系<input value={membership || row?.membership_id || ''} onChange={(event) => setMembership(event.target.value)} /></label><label>技能（逗号分隔）<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label><label>并发容量<input type="number" min={1} value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><label>状态<select value={state} onChange={(event) => setState(event.target.value as Body['state'])}><option value="available">可接单</option><option value="busy">忙碌</option><option value="offline">离线</option><option value="disabled">禁用</option></select></label></div><Button tone="primary" isDisabled={busy || disabled || !selected} onPress={() => onSave(selected, row?.version ?? 0, { membership: membership || row?.membership_id || '', skills: skills.split(',').map((value) => value.trim()).filter(Boolean), capacity, state })}>{busy ? '保存中…' : '保存客服'}</Button></section>;
}

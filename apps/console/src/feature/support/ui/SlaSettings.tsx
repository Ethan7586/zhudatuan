import { Button } from '@shop/design';
import type { OperationOutputFor } from '@shop/contract';
import { useEffect, useState } from 'react';
import type { SlaChange } from '../model/SupportConfig';

type Sla = OperationOutputFor<'support.slas.read'>['items'][number];
type Body = SlaChange;
export function SlaSettings({ rows, busy, disabled, onSave }: Readonly<{ rows: readonly Sla[]; busy: boolean; disabled: boolean; onSave: (id: string, version: number, body: Body) => void }>) {
  const [priority, setPriority] = useState<Body['priority']>('normal');
  const row = rows.find((item) => item.priority === priority);
  const [responseSeconds, setResponse] = useState(row?.response_seconds ?? 1800);
  const [resolutionSeconds, setResolution] = useState(row?.resolution_seconds ?? 86400);
  const edit = (value: Body['priority']) => {
    const found = rows.find((item) => item.priority === value);
    setPriority(value);
    setResponse(found?.response_seconds ?? 1800);
    setResolution(found?.resolution_seconds ?? 86400);
  };
  useEffect(() => {
    const found = rows.find((item) => item.priority === priority);
    if (found) {
      setResponse(found.response_seconds);
      setResolution(found.resolution_seconds);
    }
  }, [rows, priority]);
  return (
    <section className="supportsettingsection">
      <header>
        <div>
          <h2>服务时限</h2>
          <p>首次创建使用第 0 版；更新后由服务端自动递增版本。</p>
        </div>
      </header>
      <div className="supportsettingsgrid">
        <label>
          优先级
          <select value={priority} onChange={(event) => edit(event.target.value as Body['priority'])}>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          首次响应（秒）
          <input type="number" min={60} value={responseSeconds} onChange={(event) => setResponse(Number(event.target.value))} />
        </label>
        <label>
          解决期限（秒）
          <input type="number" min={60} value={resolutionSeconds} onChange={(event) => setResolution(Number(event.target.value))} />
        </label>
      </div>
      <Button tone="primary" isDisabled={busy || disabled} onPress={() => onSave(row?.id ?? `sla:${priority}`, row?.version ?? 0, { priority, responseSeconds, resolutionSeconds })}>
        {busy ? '保存中…' : '保存服务时限'}
      </Button>
    </section>
  );
}

import { Button } from '@shop/design';
import { useEffect, useState } from 'react';
import type { Sla, SlaChange } from '../model/SupportConfig';

type Body = SlaChange;
export function SlaSettings({ rows, busy, disabled, onSave }: Readonly<{ rows: readonly Sla[]; busy: boolean; disabled: boolean; onSave: (id: string, version: number, body: Body) => void }>) {
  const [priority, setPriority] = useState<Body['priority']>('normal');
  const row = rows.find((item) => item.priority === priority);
  const [responseSeconds, setResponse] = useState(row?.responseSeconds ?? 1800);
  const [resolutionSeconds, setResolution] = useState(row?.resolutionSeconds ?? 86400);
  const [reopenSeconds, setReopen] = useState(row?.reopenSeconds ?? 604800);
  const edit = (value: Body['priority']) => {
    const found = rows.find((item) => item.priority === value);
    setPriority(value);
    setResponse(found?.responseSeconds ?? 1800);
    setResolution(found?.resolutionSeconds ?? 86400);
    setReopen(found?.reopenSeconds ?? 604800);
  };
  useEffect(() => {
    const found = rows.find((item) => item.priority === priority);
    if (found) {
      setResponse(found.responseSeconds);
      setResolution(found.resolutionSeconds);
      setReopen(found.reopenSeconds);
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
          <select value={priority} onChange={(event) => edit(event.target.value as Body['priority'])} disabled={disabled}>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          首次响应（秒）
          <input type="number" min={60} value={responseSeconds} onChange={(event) => setResponse(Number(event.target.value))} disabled={disabled} />
        </label>
        <label>
          解决期限（秒）
          <input type="number" min={60} value={resolutionSeconds} onChange={(event) => setResolution(Number(event.target.value))} disabled={disabled} />
        </label>
        <label>
          关闭后可重开（秒）
          <input type="number" min={60} value={reopenSeconds} onChange={(event) => setReopen(Number(event.target.value))} disabled={disabled} />
        </label>
      </div>
      <Button tone="primary" isDisabled={busy || disabled} onPress={() => onSave(row?.id ?? `sla:${priority}`, row?.version ?? 0, { priority, responseSeconds, resolutionSeconds, reopenSeconds })}>
        {busy ? '保存中…' : '保存服务时限'}
      </Button>
    </section>
  );
}

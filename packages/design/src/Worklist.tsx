import type { DisplayCollection } from '@shop/presentation';

export function Worklist({ value }: Readonly<{ value: DisplayCollection }>) {
  return (
    <section className="worklist" aria-label="业务记录">
      <header>
        <h2>当前范围</h2>
        <span>{value.count} 条</span>
      </header>
      {value.rows.length === 0 ? (
        <div className="worklistempty">
          <strong>当前没有待处理记录</strong>
          <p>数据已与服务端同步，切换左侧任务可查看其他业务。</p>
        </div>
      ) : (
        <ul>
          {value.rows.map((row) => (
            <li key={row.key}>
              <div>
                <strong>{row.title}</strong>
                <p>{row.detail}</p>
              </div>
              <div className="worklistmeta">
                <span>{row.status}</span>
                {row.timestamp ? <time dateTime={row.timestamp}>{formatTime(row.timestamp)}</time> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间待同步' : date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

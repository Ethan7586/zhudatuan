import type { ReactNode } from 'react';
import './Templates.css';

export function DashboardWorkspace({ title, context, actions, metrics, primary, secondary }: Readonly<{ title: string; context?: ReactNode; actions?: ReactNode; metrics: ReactNode; primary: ReactNode; secondary?: ReactNode }>) {
  return <main className="shopworkspace" data-template="dashboard"><header><div><h1>{title}</h1>{context}</div>{actions}</header><section aria-label="关键指标">{metrics}</section><div className="shopdashboard"><section aria-label="主要分析">{primary}</section>{secondary === undefined ? null : <aside aria-label="待处理事项">{secondary}</aside>}</div></main>;
}

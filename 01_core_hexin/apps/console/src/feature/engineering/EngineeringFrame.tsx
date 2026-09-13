import type { ReactNode } from 'react';
import { NavLink, useParams } from 'react-router';
import { scopePath } from '../../shared/url/ScopePath';
import './engineering.css';

const tabs = [
  { suffix: 'system/engineering', label: '工程与架构' },
  { suffix: 'system/status', label: '运行状态' },
  { suffix: 'system/releases', label: '发布与版本' },
  { suffix: 'system/incidents', label: '故障与技术' },
] as const;

interface EngineeringFrameProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

export function EngineeringFrame({ eyebrow, title, description, children }: EngineeringFrameProps) {
  const { scopeKind = 'platform', scopeId = 'organization-platform-root' } = useParams();
  const scope = { kind: scopeKind, id: scopeId };

  return <section className="engineeringpage">
    <header className="engineeringhero">
      <div className="engineeringherocopy">
        <span className="engineeringeyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <img className="engineeringbrand" src="/brand/morvia-compact-lockup.svg"
        alt="MORVIA · zhudatuan 主打团" />
    </header>
    <nav className="engineeringtabs" aria-label="工程与架构中心页面">
      {tabs.map((tab) => <NavLink key={tab.suffix} to={scopePath(scope, tab.suffix)}
        className={({ isActive }) => isActive ? 'isactive' : undefined}>{tab.label}</NavLink>)}
    </nav>
    {children}
  </section>;
}

interface Metric {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: 'brand' | 'ready' | 'waiting';
}

export function MetricGrid({ metrics }: Readonly<{ metrics: readonly Metric[] }>) {
  return <div className="engineeringmetrics">
    {metrics.map((metric) => <article key={metric.label} className="engineeringmetric" data-tone={metric.tone ?? 'brand'}>
      <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small>
    </article>)}
  </div>;
}

export function HonestNotice({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <aside className="engineeringnotice" role="note"><strong>{title}</strong><span>{children}</span></aside>;
}

export function StatusPill({ children, tone = 'waiting' }: Readonly<{
  children: ReactNode;
  tone?: 'ready' | 'waiting' | 'information';
}>) {
  return <span className="engineeringstatus" data-tone={tone}>{children}</span>;
}

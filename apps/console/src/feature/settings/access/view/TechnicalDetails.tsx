import type { ReactNode } from 'react';

interface TechnicalFact {
  readonly label: string;
  readonly value: ReactNode;
}

export function TechnicalDetails({ facts, summary = '技术详情' }: Readonly<{ facts: readonly TechnicalFact[]; summary?: string }>) {
  if (facts.length === 0) return null;
  return (
    <details className="accesstechnical">
      <summary>{summary}</summary>
      <dl>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

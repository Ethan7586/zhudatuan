import { useId, type ReactNode } from 'react';
import './Molecule.css';

export interface JourneyStep {
  readonly title: string;
  readonly detail: string;
}

export interface JourneyGuideProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly steps: readonly JourneyStep[];
  readonly footer?: ReactNode;
}

export function JourneyGuide({ eyebrow, title, steps, footer }: Readonly<JourneyGuideProps>) {
  const titleId = useId();
  return (
    <section className="shopjourneyguide" aria-labelledby={titleId}>
      <header>
        <p>{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
      </header>
      <ol>
        {steps.map((step, index) => (
          <li key={`${step.title}:${index}`}>
            <span aria-hidden="true">{index + 1}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      {footer ? <div className="shopjourneyfooter">{footer}</div> : null}
    </section>
  );
}

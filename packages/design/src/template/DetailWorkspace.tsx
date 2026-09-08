import type { ReactNode } from 'react';
import './Templates.css';

export function DetailWorkspace({ title, reference, summary, actions, sections, aside }: Readonly<{ title: string; reference?: ReactNode; summary?: ReactNode; actions?: ReactNode; sections: ReactNode; aside?: ReactNode }>) {
  return <main className="shopworkspace" data-template="detail"><header><div>{reference}<h1>{title}</h1>{summary}</div>{actions}</header><div className="shopworkspacecontent"><div>{sections}</div>{aside}</div></main>;
}

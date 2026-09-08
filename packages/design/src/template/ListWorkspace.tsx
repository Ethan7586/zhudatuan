import type { ReactNode } from 'react';
import { ResourceState, type ResourceCondition } from '../organism/ResourceState';
import './Templates.css';

export function ListWorkspace({ title, description, actions, filters, condition, children, aside }: Readonly<{ title: string; description?: string; actions?: ReactNode; filters?: ReactNode; condition: ResourceCondition; children: ReactNode; aside?: ReactNode }>) {
  return <main className="shopworkspace" data-template="list"><header><div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions}</header>{filters}<div className="shopworkspacecontent"><ResourceState condition={condition}>{children}</ResourceState>{aside}</div></main>;
}

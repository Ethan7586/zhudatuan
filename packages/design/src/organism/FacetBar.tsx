import { Button } from '../atom/Button';
import './Composite.css';

export interface Facet {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
}

export function FacetBar({ label, facets, selected, onChange }: Readonly<{ label: string; facets: readonly Facet[]; selected: string; onChange: (id: string) => void }>) {
  return <nav className="shopfacetbar" aria-label={label}>{facets.map((facet) => <Button key={facet.id} tone={facet.id === selected ? 'primary' : 'quiet'} aria-pressed={facet.id === selected} onPress={() => onChange(facet.id)}>{facet.label}{facet.count === undefined ? null : ` ${facet.count}`}</Button>)}</nav>;
}

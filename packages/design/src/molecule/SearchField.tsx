import { Input, type InputProps } from '../atom/Input';
import './Molecule.css';

export function SearchField(props: Omit<InputProps, 'type'>) {
  return <Input {...props} type="search" enterKeyHint="search" autoComplete="off" />;
}

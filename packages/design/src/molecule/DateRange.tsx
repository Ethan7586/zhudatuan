import { Input } from '../atom/Input';
import './Molecule.css';

export interface DateRangeProps {
  readonly start: string;
  readonly end: string;
  readonly onStartChange: (value: string) => void;
  readonly onEndChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly error?: string;
}

export function DateRange({ start, end, onStartChange, onEndChange, disabled, error }: Readonly<DateRangeProps>) {
  return (
    <fieldset className="shopdaterange">
      <legend>日期范围</legend>
      <Input label="开始日期" type="date" value={start} {...(end ? { max: end } : {})} {...(disabled === undefined ? {} : { disabled })} onChange={(event) => onStartChange(event.currentTarget.value)} />
      <Input label="结束日期" type="date" value={end} {...(start ? { min: start } : {})} {...(disabled === undefined ? {} : { disabled })} {...(error === undefined ? {} : { error })} onChange={(event) => onEndChange(event.currentTarget.value)} />
    </fieldset>
  );
}

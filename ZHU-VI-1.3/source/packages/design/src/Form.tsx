import { Form as AriaForm, type FormProps as AriaFormProps } from 'react-aria-components';

export interface FormProps extends Omit<AriaFormProps, 'aria-label'> {
  readonly label: string;
}

export function Form({ label, ...props }: FormProps) {
  return <AriaForm {...props} aria-label={label} />;
}

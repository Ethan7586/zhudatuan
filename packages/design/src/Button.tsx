import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export type ButtonTone = 'default' | 'primary' | 'danger';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly className?: string;
  readonly tone?: ButtonTone;
}

export function Button({ className, tone = 'default', ...props }: ButtonProps) {
  const classes = ['shopbutton', `shopbutton${tone}`, className].filter(Boolean).join(' ');
  return <AriaButton {...props} className={classes} />;
}

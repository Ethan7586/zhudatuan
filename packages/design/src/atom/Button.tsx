import { forwardRef } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import './Button.css';

export type ButtonTone = 'default' | 'primary' | 'strong' | 'danger' | 'quiet';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly className?: string;
  readonly tone?: ButtonTone;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, tone = 'default', ...props }, ref) {
  const classes = ['shopbutton', `shopbutton${tone}`, className].filter(Boolean).join(' ');
  return <AriaButton {...props} ref={ref} className={classes} />;
});

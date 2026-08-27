<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import type { ReactNode } from 'react';
import { Button as AriaButton, Tooltip, TooltipTrigger, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export type ButtonTone = 'default' | 'primary' | 'danger' | 'quiet';
export type ButtonSize = 'compact' | 'default' | 'large';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly className?: string;
  readonly iconOnly?: boolean;
  readonly size?: ButtonSize;
  readonly tone?: ButtonTone;
}

export function Button({ className, iconOnly = false, size = 'default', tone = 'default', ...props }: ButtonProps) {
  const sizeClass = size === 'default' ? null : `shopbutton${size}`;
  const classes = ['shopbutton', `shopbutton${tone}`, sizeClass, iconOnly ? 'shopbuttonicononly' : null, className].filter(Boolean).join(' ');
  return <AriaButton {...props} aria-busy={props.isPending || undefined} className={classes} />;
}

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label' | 'children' | 'iconOnly'> {
  readonly children: ReactNode;
  readonly label: string;
}

export function IconButton({ children, label, ...props }: IconButtonProps) {
  return (
    <TooltipTrigger delay={600} closeDelay={0}>
      <Button {...props} aria-label={label} iconOnly>
        {children}
      </Button>
      <Tooltip className="swtooltip">{label}</Tooltip>
    </TooltipTrigger>
  );
=======
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
=======
import type { ReactNode } from 'react';
import { Button as AriaButton, Tooltip, TooltipTrigger, type ButtonProps as AriaButtonProps } from 'react-aria-components';
>>>>>>> 018b2a71 (chore(release): capture current production source)

export type ButtonTone = 'default' | 'primary' | 'danger' | 'quiet';
export type ButtonSize = 'compact' | 'default' | 'large';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly className?: string;
  readonly iconOnly?: boolean;
  readonly size?: ButtonSize;
  readonly tone?: ButtonTone;
}

<<<<<<< HEAD
export function Button({ className, tone = 'default', ...props }: ButtonProps) {
  const classes = ['shopbutton', `shopbutton${tone}`, className].filter(Boolean).join(' ');
  return <AriaButton {...props} className={classes} />;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
export function Button({ className, iconOnly = false, size = 'default', tone = 'default', ...props }: ButtonProps) {
  const sizeClass = size === 'default' ? null : `shopbutton${size}`;
  const classes = ['shopbutton', `shopbutton${tone}`, sizeClass, iconOnly ? 'shopbuttonicononly' : null, className].filter(Boolean).join(' ');
  return <AriaButton {...props} aria-busy={props.isPending || undefined} className={classes} />;
}

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label' | 'children' | 'iconOnly'> {
  readonly children: ReactNode;
  readonly label: string;
}

export function IconButton({ children, label, ...props }: IconButtonProps) {
  return (
    <TooltipTrigger delay={600} closeDelay={0}>
      <Button {...props} aria-label={label} iconOnly>
        {children}
      </Button>
      <Tooltip className="swtooltip">{label}</Tooltip>
    </TooltipTrigger>
  );
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export type ButtonTone = 'default' | 'primary' | 'danger';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  readonly className?: string;
  readonly tone?: ButtonTone;
}

export function Button({ className, tone = 'default', ...props }: ButtonProps) {
  const classes = ['shopbutton', `shopbutton${tone}`, className].filter(Boolean).join(' ');
  return <AriaButton {...props} className={classes} />;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}

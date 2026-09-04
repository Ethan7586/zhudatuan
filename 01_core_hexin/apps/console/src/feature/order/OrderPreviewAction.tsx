import type { ReactNode } from 'react';
import { Button, Dialog, DialogTrigger, Heading, Popover } from 'react-aria-components';

export interface OrderPreviewActionProps {
  readonly ariaLabel: string;
  readonly title: string;
  readonly trigger: ReactNode;
  readonly disabled: boolean;
  readonly description?: string;
  readonly describedBy?: string;
  readonly placement?: 'bottom end' | 'top end';
  readonly triggerClassName?: string;
  readonly triggerTitle?: string;
  readonly children?: (close: () => void) => ReactNode;
}

export function OrderPreviewAction({ ariaLabel, title, trigger, disabled, description = '这是本地交互预览，不会发起写操作。', describedBy, placement = 'bottom end', triggerClassName, triggerTitle, children }: OrderPreviewActionProps) {
  return (
    <span className="orderpreviewtrigger" title={triggerTitle}>
      <DialogTrigger>
        <Button type="button" isDisabled={disabled} aria-label={ariaLabel} {...(triggerClassName === undefined ? {} : { className: triggerClassName })} {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}>
          {trigger}
        </Button>
        <Popover className="orderpreviewpopover" placement={placement} offset={8}>
          <Dialog className="orderpreviewdialog" aria-label={title}>
            {({ close }) => (
              <>
                <Heading slot="title">{title}</Heading>
                <p>{description}</p>
                {children?.(close)}
                <div className="orderpreviewdialogactions">
                  <Button type="button" onPress={close}>
                    关闭
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </span>
  );
}

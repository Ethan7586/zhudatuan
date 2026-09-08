import { OperatorWorkspace, type OperatorWorkspaceProps } from '@shop/design';

type SupplierShellProps = Omit<OperatorWorkspaceProps, 'product'>;

export function SupplierShell(props: Readonly<SupplierShellProps>) {
  return <OperatorWorkspace product="供应链后台" {...props} />;
}

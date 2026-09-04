export function ControlState({ value, healthy }: Readonly<{ value: string; healthy: boolean }>) {
  return (
    <span className="controlstate" data-healthy={healthy}>
      {value}
    </span>
  );
}

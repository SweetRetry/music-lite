export function Range(props: {
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  label: string;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="range"
      className="range"
      min={0}
      max={props.max}
      step={props.step ?? 0.1}
      value={props.value}
      disabled={props.disabled}
      aria-label={props.label}
      style={{ "--fill": `${(props.value / props.max) * 100}%` } as React.CSSProperties}
      onChange={(e) => props.onChange(Number(e.target.value))}
    />
  );
}

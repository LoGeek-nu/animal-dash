export function ProgressBar({ value, max = 100, className = "", label }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span
      className={className}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <i style={{ width: `${percent}%` }} />
    </span>
  );
}

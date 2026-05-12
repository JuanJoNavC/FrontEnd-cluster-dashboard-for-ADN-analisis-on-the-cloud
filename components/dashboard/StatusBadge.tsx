interface StatusBadgeProps {
  label: string;
  className: string;
}

export function StatusBadge({ label, className }: StatusBadgeProps) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold tracking-wide ${className}`}>
      {label}
    </span>
  );
}

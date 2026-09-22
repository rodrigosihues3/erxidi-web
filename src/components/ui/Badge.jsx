const BADGE_VARIANTS = {
  success:
    "bg-status-success-bg text-status-success-text border-status-success-border",
  warning:
    "bg-status-warning-bg text-status-warning-text border-status-warning-border",
  danger:
    "bg-status-danger-bg text-status-danger-text border-status-danger-border",
  neutral: "bg-surface-subtle text-brand-secondary border-border",
};

export default function Badge({
  children,
  variant = "neutral",
  icon: Icon,
  className = "",
}) {
  const variantClasses = BADGE_VARIANTS[variant] || BADGE_VARIANTS.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge text-xs font-semibold tracking-wide border ${variantClasses} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      {children}
    </span>
  );
}

import { Loader2 } from "lucide-react";

const VARIANTS = {
  primary: "bg-accent text-white hover:bg-accent-hover focus:ring-accent",
  secondary:
    "bg-brand-primary text-white hover:bg-slate-800 focus:ring-brand-primary",
  outline:
    "bg-surface-card border border-border text-brand-primary hover:bg-surface-subtle focus:ring-brand-primary",
  danger:
    "bg-status-danger-bg text-status-danger-text border border-status-danger-border hover:bg-rose-100 focus:ring-status-danger-text",
  ghost:
    "bg-transparent text-brand-secondary hover:bg-surface-subtle hover:text-brand-primary focus:ring-brand-primary",
};

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  className = "",
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center font-semibold rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variantClasses = VARIANTS[variant] || VARIANTS.primary;
  const sizeClasses = SIZES[size] || SIZES.md;

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      {...props}
    >
      {isLoading && (
        <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />
      )}
      {children}
    </button>
  );
}

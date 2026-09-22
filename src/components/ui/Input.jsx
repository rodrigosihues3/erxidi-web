import { forwardRef } from "react";

const Input = forwardRef(function Input(
  { label, error, helperText, id, className = "", disabled, ...props },
  ref,
) {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold uppercase tracking-wider text-brand-secondary mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        disabled={disabled}
        className={`w-full h-10 px-3 bg-surface-card border rounded-button text-sm text-brand-primary placeholder:text-brand-muted transition-colors focus:outline-none focus:ring-1 disabled:bg-surface-subtle disabled:text-brand-muted disabled:cursor-not-allowed ${
          error
            ? "border-status-danger-border focus:border-status-danger-text focus:ring-status-danger-text"
            : "border-border focus:border-brand-primary focus:ring-brand-primary"
        } ${className}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-status-danger-text font-medium">
          {error}
        </p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-brand-muted">{helperText}</p>
      ) : null}
    </div>
  );
});

export default Input;

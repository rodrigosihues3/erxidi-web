export function Card({ children, className = "", ...props }) {
  return (
    <div
      className={`bg-surface-card border border-border rounded-card p-5 shadow-subtle ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }) {
  return (
    <div className={`mb-4 border-b border-border pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }) {
  return (
    <h3
      className={`text-base font-bold text-brand-primary ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = "", ...props }) {
  return (
    <p className={`text-xs text-brand-secondary mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "", ...props }) {
  return (
    <div className={`space-y-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = "", ...props }) {
  return (
    <div
      className={`mt-4 pt-3 border-t border-border flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

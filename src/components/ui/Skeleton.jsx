export default function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`bg-zinc-200 animate-pulse rounded ${className}`}
      {...props}
    />
  );
}

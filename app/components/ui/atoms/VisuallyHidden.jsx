export function VisuallyHidden({ children, ...props }) {
  return <div className="sr-only" {...props}>{children}</div>;
}

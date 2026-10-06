export function IconButton({ label, children, danger, ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${danger ? "danger-icon" : ""}`}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

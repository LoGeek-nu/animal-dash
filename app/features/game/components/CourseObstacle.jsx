export function CourseObstacle({ obstacle, left, warning = false, className = "" }) {
  const positionStyle = Number.isFinite(left) ? { left: `${left}%` } : {};
  return (
    <div
      aria-hidden="true"
      className={`course-obstacle obstacle-${obstacle.type} variant-${obstacle.variant} ${className}`}
      data-obstacle={obstacle.id}
      style={{ ...positionStyle, "--obstacle-width": `${obstacle.width}px` }}
    >
      <span className="obstacle-hitbox" />
      <span className="obstacle-artwork">
        <i className="obstacle-detail detail-a" /><i className="obstacle-detail detail-b" /><i className="obstacle-detail detail-c" />
      </span>
      {warning && <span className="hazard-warning">!</span>}
    </div>
  );
}

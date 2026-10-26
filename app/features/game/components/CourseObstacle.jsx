/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

export function CourseObstacle({ obstacle, left, warning = false, className = "" }) {
  const positionStyle = Number.isFinite(left) ? { left: `${left}%` } : {};
  return (
    <div
      aria-hidden="true"
      className={`course-obstacle obstacle-${obstacle.type} ${className}`}
      data-obstacle={obstacle.id}
      style={{ ...positionStyle, "--obstacle-width": `${obstacle.width}px` }}
    >
      <span className="obstacle-hitbox" />
      <img className="obstacle-artwork" src={`/course/${obstacle.type}.png`} alt="" draggable={false} />
      {warning && <span className="hazard-warning">!</span>}
    </div>
  );
}

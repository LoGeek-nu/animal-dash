import { courseLeft, courseSegments, getCourseSegment } from "../../../domain/course.js";

export function CourseScenery({ progress, laneIndex }) {
  const current = getCourseSegment(progress);
  return (
    <div className="course-scenery" aria-hidden="true" style={{ "--far-scroll": `${-progress * 2.2}px`, "--mid-scroll": `${-progress * 5.5}px`, "--segment-accent": current.accent }}>
      <div className="course-layer course-far"><i className="course-cloud cloud-a" /><i className="course-cloud cloud-b" /><i className="school-silhouette" /></div>
      <div className="course-layer course-mid">
        {courseSegments.map((segment) => {
          const left = courseLeft(segment.start + 5, progress);
          if (left < 10 || left > 112) return null;
          return <div className={`course-landmark landmark-${segment.id}`} style={{ left: `${left}%` }} key={segment.id}><i /><b>{segment.label}</b></div>;
        })}
      </div>
      <div className="course-layer course-foreground"><i className="grass-tuft grass-one" /><i className="grass-tuft grass-two" /><i className="course-flower flower-one" /><i className="course-flower flower-two" /></div>
      {laneIndex === 0 && <div className="course-zone-tag" key={current.id}><span>{current.label}</span><b>{current.caption}</b></div>}
    </div>
  );
}

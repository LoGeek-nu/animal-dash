/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { UNIT_PERCENT, courseGates, courseLeft, courseSegments, getCourseSegment } from "../../../domain/course.js";

const landmarks = courseSegments.filter((segment) => !courseGates.some((gate) => gate.id === segment.id));

export function CourseScenery({ progress }) {
  const current = getCourseSegment(progress);
  return (
    <div className="course-scenery" aria-hidden="true" style={{ "--far-scroll": `${-progress * UNIT_PERCENT * .085}cqw`, "--mid-scroll": `${-progress * UNIT_PERCENT * .21}cqw`, "--segment-accent": current.accent }}>
      <div className="course-layer course-far"><i className="course-cloud cloud-a" /><i className="course-cloud cloud-b" /><i className="school-silhouette" /></div>
      <div className="course-layer course-mid">
        {landmarks.map((segment) => {
          const left = courseLeft(segment.start + 5, progress);
          if (left < 10 || left > 112) return null;
          return <img className={`course-landmark landmark-${segment.id}`} src={`/course/${segment.id}.png`} alt="" draggable={false} style={{ left: `${left}%` }} key={segment.id} />;
        })}
      </div>
      <div className="course-layer course-foreground"><i className="grass-tuft grass-one" /><i className="grass-tuft grass-two" /><i className="course-flower flower-one" /><i className="course-flower flower-two" /></div>
    </div>
  );
}

import { StaminaMeter } from "../../../components/ui/molecules/StaminaMeter.jsx";
import { getCharacter, laneColors } from "../../../domain/characters.js";
import { courseLeft, getCourseSegment, getNearestUpcomingObstacle, getVisibleCourseObstacles } from "../../../domain/course.js";
import { CourseObstacle } from "./CourseObstacle.jsx";
import { CourseScenery } from "./CourseScenery.jsx";
import { Runner } from "./Runner.jsx";

const KEY_HELP = ["SPACE / SHIFT", "↑ / ENTER", "W / E", "I / O"];

export function RaceLane({ lane, laneIndex, runner, rank }) {
  const character = getCharacter(lane.characterId);
  const segment = getCourseSegment(runner.progress);
  const visibleObstacles = getVisibleCourseObstacles(runner.progress);
  const nearestObstacle = getNearestUpcomingObstacle(runner.progress, visibleObstacles);

  return (
    <article
      className={`race-lane segment-${segment.id} ${runner.collision ? "is-hit" : ""} ${runner.finishedAt ? "is-finished" : ""}`}
      style={{ "--lane": laneColors[laneIndex], "--scroll": `${-runner.progress * 9}px`, "--course-progress": runner.progress, "--segment-accent": segment.accent }}
    >
      <CourseScenery progress={runner.progress} laneIndex={laneIndex} />
      <div className="race-lane-info"><span>LANE {laneIndex + 1}</span><strong>{character.name}</strong><small>{lane.isBot ? "BOT" : KEY_HELP[laneIndex]}</small></div>
      <div className="rank-bubble"><strong>{rank}</strong><span>位</span></div>
      <div className="track-meter"><i style={{ width: `${runner.progress}%` }} /></div>
      <StaminaMeter value={runner.stamina} />
      {visibleObstacles.map((obstacle) => {
        const left = courseLeft(obstacle.position, runner.progress);
        const distance = obstacle.position - runner.progress;
        return <CourseObstacle obstacle={obstacle} left={left} warning={nearestObstacle?.id === obstacle.id && distance > 0 && distance < obstacle.warningDistance} key={obstacle.id} />;
      })}
      {runner.progress > 80 && <div className="finish-line" style={{ left: `${courseLeft(100, runner.progress)}%` }}><span>FINISH</span></div>}
      <Runner characterId={lane.characterId} runner={runner} />
    </article>
  );
}

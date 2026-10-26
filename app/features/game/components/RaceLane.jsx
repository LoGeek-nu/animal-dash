/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { StaminaMeter } from "../../../components/ui/molecules/StaminaMeter.jsx";
import { getCharacter, laneColors } from "../../../domain/characters.js";
import { COURSE_LENGTH, UNIT_PERCENT, courseGates, courseLeft, getCourseSegment, getNearestUpcomingObstacle, getVisibleCourseObstacles } from "../../../domain/course.js";
import { CourseObstacle } from "./CourseObstacle.jsx";
import { CourseScenery } from "./CourseScenery.jsx";
import { Runner } from "./Runner.jsx";

const KEY_HELP = ["SPACE / SHIFT", "↑ / ENTER", "W / E", "I / O"];

export function RaceLane({ lane, laneIndex, runner, rank, obstacles }) {
  const character = getCharacter(lane.characterId);
  const segment = getCourseSegment(runner.progress);
  const visibleObstacles = getVisibleCourseObstacles(obstacles, runner.progress);
  const nearestObstacle = getNearestUpcomingObstacle(visibleObstacles, runner.progress);
  const showStamina = (runner.stamina < 99.9 || runner.boosting) && !runner.finishedAt;

  return (
    <article
      className={`race-lane segment-${segment.id} ${runner.collision ? "is-hit" : ""} ${runner.finishedAt ? "is-finished" : ""} ${runner.finishedAt && runner.y === 0 ? "is-landed" : ""}`}
      style={{ "--lane": laneColors[laneIndex], "--scroll": `${-runner.progress * UNIT_PERCENT}cqw`, "--course-progress": runner.progress, "--segment-accent": segment.accent }}
    >
      <CourseScenery progress={runner.progress} laneIndex={laneIndex} />
      <div className="race-lane-info"><span>LANE {laneIndex + 1}</span><strong>{character.name}</strong><small>{lane.isBot ? "BOT" : KEY_HELP[laneIndex]}</small></div>
      <div className="rank-bubble"><strong>{rank}</strong><span>位</span></div>
      <div className="track-meter"><i style={{ width: `${Math.min(100, runner.progress / COURSE_LENGTH * 100)}%` }} /></div>
      {showStamina && <StaminaMeter value={runner.stamina} />}
      {visibleObstacles.map((obstacle) => {
        const left = courseLeft(obstacle.position, runner.progress);
        const distance = obstacle.position - runner.progress;
        return <CourseObstacle obstacle={obstacle} left={left} warning={nearestObstacle?.id === obstacle.id && distance > 0 && distance < obstacle.warningDistance} key={obstacle.id} />;
      })}
      {courseGates.map((gate) => {
        const left = courseLeft(gate.position, runner.progress);
        if (left < -20 || left > 120) return null;
        return <img className={`course-gate gate-${gate.id}`} src={`/course/${gate.id}.png`} alt="" draggable={false} style={{ left: `${left}%` }} key={gate.id} />;
      })}
      <Runner characterId={lane.characterId} runner={runner} />
    </article>
  );
}

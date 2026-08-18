/**
 * The course is shared by all four lanes so every racer gets the same hazards.
 * Visual and collision settings live together to keep the mock deterministic.
 */
export const courseSegments = [
  { id: "start", start: 0, end: 18, label: "START YARD", caption: "よーい、スタート！", accent: "#ef5c6c" },
  { id: "garden", start: 18, end: 40, label: "FLOWER GARDEN", caption: "花ばたけを駆けぬけろ", accent: "#f3a83b" },
  { id: "bridge", start: 40, end: 62, label: "LOG BRIDGE", caption: "森の橋をジャンプ", accent: "#34a96f" },
  { id: "festival", start: 62, end: 82, label: "MUD FEST", caption: "屋台通りは泥に注意", accent: "#8e63d2" },
  { id: "final", start: 82, end: 101, label: "FINAL STRAIGHT", caption: "ゴールまで一直線！", accent: "#f04e84" },
];

export const courseObstacles = [
  { id: "garden-rock", type: "rock", position: 27, hitHeight: 34, width: 54, penaltyMs: 680, penaltyDistance: 1.1, warningDistance: 7, variant: "moss" },
  { id: "garden-hay", type: "hay", position: 37, hitHeight: 40, width: 66, penaltyMs: 720, penaltyDistance: 1.2, warningDistance: 7, variant: "sunny" },
  { id: "bridge-log", type: "log", position: 50, hitHeight: 50, width: 82, penaltyMs: 760, penaltyDistance: 1.35, warningDistance: 8, variant: "birch" },
  { id: "festival-mud", type: "mud", position: 69, hitHeight: 18, width: 112, penaltyMs: 860, penaltyDistance: .9, warningDistance: 6, variant: "splash" },
  { id: "festival-puddle", type: "puddle", position: 78, hitHeight: 22, width: 94, penaltyMs: 820, penaltyDistance: 1, warningDistance: 6, variant: "blue" },
  { id: "final-hurdle", type: "hurdle", position: 89, hitHeight: 42, width: 64, penaltyMs: 650, penaltyDistance: 1.05, warningDistance: 8, variant: "checkered" },
];

export function getCourseSegment(progress) {
  return courseSegments.find((segment) => progress >= segment.start && progress < segment.end) ?? courseSegments.at(-1);
}

export function getVisibleCourseObstacles(progress) {
  return courseObstacles.filter((obstacle) => {
    const distance = obstacle.position - progress;
    return distance >= -2.5 && distance <= 35;
  });
}

export function getNearestUpcomingObstacle(progress, obstacles = getVisibleCourseObstacles(progress)) {
  return obstacles
    .filter((obstacle) => obstacle.position > progress)
    .sort((a, b) => a.position - b.position)[0] ?? null;
}

export function courseLeft(position, progress) {
  return 27 + (position - progress) * 1.62;
}

// About 30 seconds of running at the tuned speeds.
export const COURSE_LENGTH = 250;

export const courseSegments = [
  { id: "start", start: 0, end: 30, label: "START YARD", caption: "よーい、スタート！", accent: "#ef5c6c" },
  { id: "garden", start: 30, end: 85, label: "FLOWER GARDEN", caption: "花ばたけを駆けぬけろ", accent: "#f3a83b" },
  { id: "bridge", start: 85, end: 140, label: "LOG BRIDGE", caption: "森の橋をジャンプ", accent: "#34a96f" },
  { id: "festival", start: 140, end: 200, label: "MUD FEST", caption: "屋台通りは泥に注意", accent: "#8e63d2" },
  { id: "final", start: 200, end: COURSE_LENGTH + 1, label: "FINAL STRAIGHT", caption: "ゴールまで一直線！", accent: "#f04e84" },
];

// The start and goal arches stand at the ends of the track instead of beside it.
export const courseGates = [{ id: "start", position: 0 }, { id: "final", position: COURSE_LENGTH }];

// One unit of progress spans this share of the lane: it sets how fast the course scrolls on screen.
export const UNIT_PERCENT = 2.84;
// Sprites are drawn at fixed pixel sizes for a 1600px lane.
const PX_PER_UNIT = 1600 * UNIT_PERCENT / 100;
// Only the solid middle of each drawing counts, leaving out white rims, grass tufts, ears and tails.
const OBSTACLE_CORE = .4;
const RUNNER_CORE = .3;
const RUNNER_ART_PX = 164;

const toUnits = (px) => Math.round(px / PX_PER_UNIT * 100) / 100;
// Half the runner's body: added to an obstacle's range so the body, not just its centre, has to clear it.
export const RUNNER_HIT_RANGE = toUnits(RUNNER_ART_PX * RUNNER_CORE / 2);

const withHitRange = (types) => Object.fromEntries(Object.entries(types).map(([type, spec]) =>
  [type, { ...spec, hitRange: toUnits(spec.width * OBSTACLE_CORE / 2) }]));

// hitRange: how far from its centre, in units of progress, the obstacle catches a runner below hitHeight.
export const obstacleTypes = withHitRange({
  rock: { hitHeight: 34, width: 108, penaltyMs: 680, penaltyDistance: 1.1, warningDistance: 7 },
  hay: { hitHeight: 40, width: 112, penaltyMs: 720, penaltyDistance: 1.2, warningDistance: 7 },
  log: { hitHeight: 50, width: 148, penaltyMs: 760, penaltyDistance: 1.35, warningDistance: 8 },
  mud: { hitHeight: 18, width: 162, penaltyMs: 860, penaltyDistance: .9, warningDistance: 6 },
  puddle: { hitHeight: 22, width: 140, penaltyMs: 820, penaltyDistance: 1, warningDistance: 6 },
  hurdle: { hitHeight: 42, width: 130, penaltyMs: 650, penaltyDistance: 1.05, warningDistance: 8 },
});

const FIRST_OBSTACLE = 32;
const LAST_OBSTACLE = COURSE_LENGTH - 10;
const MIN_GAP = 10;
const MAX_GAP = 20;

// FNV-1a + mulberry32: every device and the room derive the same course from the race ID.
function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// One set of hazards per race: every lane meets the same positions and the same mix of types,
// but each lane gets its own order of types, so no lane is luckier than another.
export function createCourseObstacles(raceId, laneCount) {
  const random = seededRandom(raceId);
  const positions = [];
  const types = [];
  let bag = [];
  for (let position = FIRST_OBSTACLE + random() * 6; position <= LAST_OBSTACLE; position += MIN_GAP + random() * (MAX_GAP - MIN_GAP)) {
    positions.push(Math.round(position * 10) / 10);
    // Draw from a bag holding each type once, so every race shows every type about equally often.
    if (!bag.length) bag = shuffle(Object.keys(obstacleTypes), random);
    types.push(bag.pop());
  }
  return Array.from({ length: laneCount }, (_, lane) => {
    const order = shuffle(types, seededRandom(`${raceId}#${lane}`));
    return positions.map((position, index) => {
      const type = order[index];
      return { id: `${type}-${index}`, type, position, ...obstacleTypes[type] };
    });
  });
}

export function getCourseSegment(progress) {
  return courseSegments.find((segment) => progress >= segment.start && progress < segment.end) ?? courseSegments.at(-1);
}

// Keep obstacles mounted from just off the right edge until they leave on the left, so none pops in mid-lane.
export function getVisibleCourseObstacles(obstacles, progress) {
  return obstacles.filter((obstacle) => {
    const left = courseLeft(obstacle.position, progress);
    return left >= -15 && left <= 115;
  });
}

export function getNearestUpcomingObstacle(obstacles, progress) {
  return obstacles
    .filter((obstacle) => obstacle.position > progress)
    .sort((a, b) => a.position - b.position)[0] ?? null;
}

export function courseLeft(position, progress) {
  return 27 + (position - progress) * UNIT_PERCENT;
}

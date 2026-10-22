const JUMP_POWER = 7;
const SPEED_MULTIPLIER = 3;

// Stats run 1–20. Speed sets the cruising speed, acceleration how quickly the runner gets there
// (from the start, after a hit, when boost toggles), stamina how long boost lasts and how fast it refills.
// Tuned by simulation so speed-, acceleration-, stamina- and even builds (total 40) finish within ~0.25s
// of each other with clean play, while acceleration pays off when a runner hits obstacles.
const BASE_SPEED = 2.2;
const SPEED_PER_STAT = .03;
const BOOST_SPEED = .86;
const ACCEL_BASE = .45;
const ACCEL_PER_STAT = .07;
const DECEL = 6;
const HIT_SPEED_KEEP = .4;
const DRAIN_BASE = 26;
const DRAIN_PER_STAT = 1.1;
const REGEN_BASE = 8;
const REGEN_PER_STAT = .4;

const cruiseSpeed = (character, boosting) => (BASE_SPEED + character.stats.speed * SPEED_PER_STAT + (boosting ? BOOST_SPEED : 0)) * SPEED_MULTIPLIER;

export function createRuntimeRunner() {
  return {
    progress: 0,
    velocity: 0,
    stamina: 100,
    y: 0,
    vy: 0,
    exhausted: false,
    collisionUntil: 0,
    collision: false,
    boosting: false,
    finishedAt: null,
    hit: new Set(),
  };
}

export function stepRaceRunner({ runner, character, input, obstacles, now, dt, elapsed }) {
  if (runner.finishedAt !== null) {
    if (runner.y > 0 || runner.vy > 0) {
      const next = { ...runner, hit: new Set(runner.hit) };
      next.y += next.vy * dt;
      next.vy -= 1780 * dt;
      next.progress += next.velocity * dt;
      if (next.y <= 0) {
        next.y = 0;
        next.vy = 0;
      }
      return { runner: next, jumped: false };
    }
    return { runner, jumped: false };
  }

  const next = { ...runner, hit: new Set(runner.hit) };
  let jumped = false;

  if (input.jump && next.y === 0) {
    next.vy = 500 + JUMP_POWER * 34;
    jumped = true;
  }

  if (next.y > 0 || next.vy > 0) {
    next.y += next.vy * dt;
    next.vy -= 1780 * dt;
    if (next.y <= 0) {
      next.y = 0;
      next.vy = 0;
    }
  }

  if (next.exhausted && next.stamina > 32) next.exhausted = false;
  next.boosting = input.boost && !next.exhausted && next.stamina > 0;

  if (next.boosting) {
    next.stamina = Math.max(0, next.stamina - (DRAIN_BASE - character.stats.stamina * DRAIN_PER_STAT) * dt);
    if (next.stamina === 0) next.exhausted = true;
  } else {
    next.stamina = Math.min(100, next.stamina + (REGEN_BASE + character.stats.stamina * REGEN_PER_STAT) * dt);
  }

  let target = cruiseSpeed(character, next.boosting);
  if (next.collisionUntil > now) target *= .35;
  const rate = (next.velocity < target ? ACCEL_BASE + character.stats.acceleration * ACCEL_PER_STAT : DECEL) * SPEED_MULTIPLIER;
  next.velocity = next.velocity < target ? Math.min(target, next.velocity + rate * dt) : Math.max(target, next.velocity - rate * dt);
  next.progress += next.velocity * dt;

  for (const obstacle of obstacles) {
    if (!next.hit.has(obstacle.id) && Math.abs(next.progress - obstacle.position) < .42 && next.y < obstacle.hitHeight) {
      next.hit.add(obstacle.id);
      next.collisionUntil = now + obstacle.penaltyMs;
      next.progress = Math.max(0, next.progress - obstacle.penaltyDistance);
      next.velocity *= HIT_SPEED_KEEP;
    }
  }

  next.collision = next.collisionUntil > now;
  if (next.progress >= 100) {
    if (next.finishedAt === null) next.finishedAt = Math.max(0, Math.round(elapsed));
    next.boosting = false;
    next.collision = false;
    next.collisionUntil = 0;
    if (next.y <= 0) {
      next.y = 0;
      next.vy = 0;
    }
  }
  return { runner: next, jumped };
}

export function toRenderableRunner(runner, now) {
  const isFinished = runner.finishedAt !== null;
  return {
    progress: runner.progress,
    stamina: runner.stamina,
    y: Math.max(0, runner.y),
    collision: !isFinished && runner.collisionUntil > now,
    boosting: !isFinished && runner.boosting,
    finishedAt: runner.finishedAt,
  };
}

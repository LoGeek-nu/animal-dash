const JUMP_POWER = 7;
const SPEED_MULTIPLIER = 3;

export function createRuntimeRunner() {
  return {
    progress: 0,
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
      const speed = (2.18 + character.stats.speed * .055) * SPEED_MULTIPLIER;
      next.progress += speed * dt;
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
    next.stamina = Math.max(0, next.stamina - (27 - character.stats.stamina * .7) * dt);
    if (next.stamina === 0) next.exhausted = true;
  } else {
    next.stamina = Math.min(100, next.stamina + (12 + character.stats.stamina * .7) * dt);
  }

  let speed = (2.18 + character.stats.speed * .055 + (next.boosting ? .86 : 0)) * SPEED_MULTIPLIER;
  if (next.collisionUntil > now) speed *= .35;
  next.progress += speed * dt;

  for (const obstacle of obstacles) {
    if (!next.hit.has(obstacle.id) && Math.abs(next.progress - obstacle.position) < .42 && next.y < obstacle.hitHeight) {
      next.hit.add(obstacle.id);
      next.collisionUntil = now + obstacle.penaltyMs;
      next.progress = Math.max(0, next.progress - obstacle.penaltyDistance);
    }
  }

  next.collision = next.collisionUntil > now;
  if (next.progress >= 100) {
    if (next.finishedAt === null) next.finishedAt = elapsed;
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

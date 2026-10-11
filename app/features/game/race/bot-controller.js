export function getBotInput({ laneIndex, runner, now, obstacles }) {
  const nextObstacle = obstacles.find(({ position }) => {
    const distance = position - runner.progress;
    return distance > 1 && distance < 4.2;
  });

  return {
    boost: Math.sin(now / 650 + laneIndex * 1.7) > -.05,
    jump: Boolean(nextObstacle),
  };
}

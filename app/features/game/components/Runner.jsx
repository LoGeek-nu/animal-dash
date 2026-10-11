import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";

export function Runner({ characterId, runner }) {
  return (
    <>
      <div className="runner-ground-shadow" style={{ opacity: Math.max(.18, 1 - runner.y / 260), transform: `scaleX(${Math.max(.46, 1 - runner.y / 430)})` }} />
      <div className={`racing-character ${runner.boosting ? "is-boosting" : ""} ${runner.collision ? "has-impact" : ""}`} style={{ transform: `translateY(${-runner.y}px)` }}>
        <span className="speed-streak">≋</span><span className="runner-dust" /><span className="impact-stars">★</span>
        <CharacterAvatar id={characterId} compact />
        {runner.finishedAt && <b>GOAL!</b>}
      </div>
    </>
  );
}

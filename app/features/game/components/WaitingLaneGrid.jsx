import { WaitingCharacterCard } from "./WaitingCharacterCard.jsx";

export function WaitingLaneGrid({ lanes }) {
  return (
    <section className="waiting-lanes" aria-label="参加キャラクター">
      {lanes.map((lane, index) => (
        <WaitingCharacterCard lane={lane} index={index} key={lane ? `${index}-${lane.characterId}` : `empty-${index}`} />
      ))}
    </section>
  );
}

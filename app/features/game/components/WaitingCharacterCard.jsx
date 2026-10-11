import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { StatBars } from "../../../components/ui/molecules/StatBars.jsx";
import { getCharacter, laneColors } from "../../../domain/characters.js";

export function WaitingCharacterCard({ lane, index }) {
  if (!lane) {
    return (
      <article className="waiting-card empty-waiting-card" style={{ "--lane": laneColors[index] }}>
        <div className="waiting-card-header"><span>LANE {index + 1}</span></div>
        <div className="empty-card-art"><strong>?</strong></div>
        <div className="waiting-card-meta empty-card-meta"><h2>参加者を待っています</h2><p>スタッフが管理画面から登録します</p></div>
      </article>
    );
  }

  const character = getCharacter(lane.characterId);
  return (
    <article className="waiting-card" style={{ "--lane": laneColors[index] }}>
      <div className="waiting-card-header"><span>LANE {index + 1}</span>{lane.isBot && <b>BOT</b>}</div>
      <div className="waiting-card-art"><CharacterAvatar id={lane.characterId} /></div>
      <div className="waiting-card-meta">
        <div className="waiting-card-copy"><span>{character.preset.toUpperCase()}</span><h2>{character.name}</h2></div>
        <StatBars id={lane.characterId} small />
      </div>
    </article>
  );
}

import { Button } from "../../../components/ui/atoms/Button.jsx";
import { getCharacter } from "../../../domain/characters.js";
import { BotFillControl } from "./BotFillControl.jsx";
import { LaneDropTarget } from "./LaneDropTarget.jsx";

export function LaneManagement({ lanes, selectedId, activeCharacterId, overLaneId, mutable, participantCount, onClearSelection, onAssign, onRemove, onFillBots }) {
  const activeCharacter = activeCharacterId ? getCharacter(activeCharacterId) : null;
  return (
    <div className="lane-management panel-card" aria-label="キャラクターのドロップ先">
      <div className="panel-heading">
        <div><span>02</span><div><h1>{activeCharacter ? `${activeCharacter.name}をどこへ運ぶ？` : "レーンにセット"}</h1><p>{activeCharacter ? "明るくなったレーンへドロップ" : selectedId ? `${getCharacter(selectedId).name} を選択中` : "キャラクターをドラッグしてレーンへ"}</p></div></div>
        {selectedId && !activeCharacter && <Button variant="clear" onClick={onClearSelection}>選択解除 ×</Button>}
      </div>
      <div className="admin-lanes">
        {lanes.map((lane, index) => (
          <LaneDropTarget
            lane={lane}
            index={index}
            key={index}
            selectedId={selectedId}
            mutable={mutable}
            dragging={Boolean(overLaneId)}
            onAssign={onAssign}
            onRemove={onRemove}
          />
        ))}
      </div>
      <BotFillControl disabled={!mutable || participantCount === 4} onFill={onFillBots} />
    </div>
  );
}

"use client";

import { useDroppable } from "@dnd-kit/core";
import { getCharacter, laneColors } from "../../race-data.js";
import { CharacterAvatar } from "../character/CharacterAvatar.jsx";
import { StatBars } from "../character/StatBars.jsx";

export function LaneDropTarget({ lane, index, selectedId, mutable, dragging, onAssign, onRemove }) {
  const { isOver, setNodeRef } = useDroppable({
    id: `lane-${index}`,
    data: { laneIndex: index },
    disabled: !mutable,
  });

  return (
    <div ref={setNodeRef} className={`admin-lane ${lane ? "has-racer" : ""} ${dragging ? "is-drop-ready" : ""} ${isOver ? "is-drag-over" : ""}`} style={{ "--lane": laneColors[index] }}>
      <div className="admin-lane-number"><span>LANE</span><strong>0{index + 1}</strong></div>
      {lane ? <>
        <CharacterAvatar id={lane.characterId} compact />
        <div className="lane-character-copy"><div><strong>{getCharacter(lane.characterId).name}</strong>{lane.isBot && <b>BOT</b>}</div><span>{getCharacter(lane.characterId).preset}タイプ</span><StatBars id={lane.characterId} small /></div>
        {isOver && <div className="drop-replace-label">ここに交代</div>}
        <button className="remove-racer" disabled={!mutable} onClick={() => onRemove(index)} aria-label={`レーン${index + 1}から解除`}>×</button>
      </> : <>
        <div className="empty-lane-mark">{dragging ? "↓" : "?"}</div>
        <div className="empty-lane-copy"><strong>{dragging ? "ここにドロップ" : "空きレーン"}</strong><span>{dragging ? `LANE ${index + 1} にセット` : selectedId ? "セットできます" : "キャラクターを選択してください"}</span></div>
        <button className="assign-button" disabled={!selectedId || !mutable} onClick={() => onAssign(index)}>このレーンにセット</button>
      </>}
    </div>
  );
}

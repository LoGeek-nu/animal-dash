"use client";

import { useCallback, useRef, useState } from "react";
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { getCharacter } from "../../../domain/characters.js";

export function useCharacterDragAndDrop({ mutable, assignCharacter, clearSelection }) {
  const [activeCharacterId, setActiveCharacterId] = useState(null);
  const [overLaneId, setOverLaneId] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const dragEndedAtRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const finishDrag = useCallback(() => {
    dragEndedAtRef.current = performance.now();
    setActiveCharacterId(null);
    setOverLaneId(null);
  }, []);

  const handleDragStart = useCallback(({ active }) => {
    const characterId = active.data.current?.characterId;
    if (!mutable || !characterId) return;
    setActiveCharacterId(characterId);
    setAnnouncement(`${getCharacter(characterId).name}を移動中。配置するレーンを選んでください。`);
  }, [mutable]);

  const handleDragOver = useCallback(({ over }) => {
    const laneIndex = over?.data.current?.laneIndex;
    setOverLaneId(Number.isInteger(laneIndex) ? `lane-${laneIndex}` : null);
  }, []);

  const handleDragEnd = useCallback(({ active, over }) => {
    const characterId = active.data.current?.characterId;
    const laneIndex = over?.data.current?.laneIndex;
    if (mutable && characterId && Number.isInteger(laneIndex)) {
      assignCharacter(laneIndex, characterId);
      clearSelection();
      setAnnouncement(`${getCharacter(characterId).name}をレーン${laneIndex + 1}にセットしました。`);
    } else if (characterId) {
      setAnnouncement(`${getCharacter(characterId).name}の移動をキャンセルしました。`);
    }
    finishDrag();
  }, [assignCharacter, clearSelection, finishDrag, mutable]);

  const wasDragRecently = useCallback(() => performance.now() - dragEndedAtRef.current < 250, []);

  return {
    sensors,
    activeCharacterId,
    overLaneId,
    announcement,
    wasDragRecently,
    dndHandlers: {
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
      onDragCancel: finishDrag,
    },
  };
}

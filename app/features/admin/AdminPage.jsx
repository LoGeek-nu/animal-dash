"use client";

import { useCallback, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { VisuallyHidden } from "../../components/ui/atoms/VisuallyHidden.jsx";
import { ConfirmDialog } from "../../components/ui/organisms/ConfirmDialog.jsx";
import { getCharacter } from "../../domain/characters.js";
import { useRaceSession } from "../race-session/useRaceSession.js";
import { AdminControlBar } from "./components/AdminControlBar.jsx";
import { AdminFooter } from "./components/AdminFooter.jsx";
import { AdminHeader } from "./components/AdminHeader.jsx";
import { AdminStatusBar } from "./components/AdminStatusBar.jsx";
import { CharacterDragOverlay } from "./components/CharacterDragOverlay.jsx";
import { CharacterLibrary } from "./components/CharacterLibrary.jsx";
import { LaneManagement } from "./components/LaneManagement.jsx";
import { useCharacterDragAndDrop } from "./hooks/useCharacterDragAndDrop.js";
import { useCharacterSelection } from "./hooks/useCharacterSelection.js";
import { laneOnlyCollisionDetection } from "./model/lane-collision.js";

export function AdminPage() {
  const { session, ready, actions } = useRaceSession();
  const [confirm, setConfirm] = useState(null);
  const selection = useCharacterSelection({ lanes: session.lanes });
  const clearSelection = useCallback(() => selection.setSelectedId(null), [selection.setSelectedId]);
  const drag = useCharacterDragAndDrop({
    mutable: session.phase === "WAITING" || session.phase === "ATTRACT",
    assignCharacter: actions.assignCharacter,
    clearSelection,
  });

  const mutable = session.phase === "WAITING" || session.phase === "ATTRACT";
  const participantCount = session.lanes.filter(Boolean).length;
  const activeCharacter = drag.activeCharacterId ? getCharacter(drag.activeCharacterId) : null;

  const assignSelected = useCallback((laneIndex) => {
    if (!selection.selectedId) return;
    actions.assignCharacter(laneIndex, selection.selectedId);
    clearSelection();
  }, [actions, clearSelection, selection.selectedId]);

  const handleSelect = useCallback((characterId) => {
    if (!drag.wasDragRecently()) selection.toggleSelected(characterId);
  }, [drag, selection]);

  const confirmFinish = () => {
    if (session.phase === "RESULTS") actions.resetSession();
    else actions.forceFinish();
    setConfirm(null);
  };

  return (
    <DndContext
      id="animal-dash-admin-dnd"
      sensors={drag.sensors}
      collisionDetection={laneOnlyCollisionDetection}
      {...drag.dndHandlers}
    >
      <main className={`admin-shell ${drag.activeCharacterId ? "is-dragging-character" : ""} ${drag.overLaneId ? "is-over-lane-zone" : ""}`}>
        <AdminHeader ready={ready} />
        <AdminStatusBar session={session} participantCount={participantCount} />
        <section className="admin-workspace">
          <CharacterLibrary
            query={selection.query}
            onQueryChange={selection.setQuery}
            filteredCharacters={selection.filteredCharacters}
            usedIds={selection.usedIds}
            mutable={mutable}
            selectedId={selection.selectedId}
            onSelect={handleSelect}
          />
          <LaneManagement
            lanes={session.lanes}
            selectedId={selection.selectedId}
            activeCharacterId={drag.activeCharacterId}
            overLaneId={drag.overLaneId}
            mutable={mutable}
            participantCount={participantCount}
            onClearSelection={clearSelection}
            onAssign={assignSelected}
            onRemove={actions.removeCharacter}
            onFillBots={() => actions.fillBots(false)}
          />
        </section>
        <AdminControlBar
          session={session}
          participantCount={participantCount}
          actions={actions}
          onRequestFinish={() => setConfirm("finish")}
          onRequestReset={() => setConfirm("reset")}
        />
        <AdminFooter session={session} />
        {confirm === "reset" && (
          <ConfirmDialog
            danger
            title="待機状態へリセットしますか？"
            copy="現在のレース進行と参加枠がすべてクリアされます。"
            actionLabel="リセットする"
            onCancel={() => setConfirm(null)}
            onConfirm={() => { actions.resetSession(); setConfirm(null); }}
          />
        )}
        {confirm === "finish" && (
          <ConfirmDialog
            title={session.phase === "RESULTS" ? "リザルトを終了しますか？" : "レースを強制終了しますか？"}
            copy={session.phase === "RESULTS" ? "次の上映のためアトラクト画面へ戻ります。" : "現在の順位を仮タイムで確定してリザルトへ進みます。"}
            actionLabel={session.phase === "RESULTS" ? "アトラクトへ戻す" : "リザルトへ進む"}
            onCancel={() => setConfirm(null)}
            onConfirm={confirmFinish}
          />
        )}
        <VisuallyHidden aria-live="polite">{drag.announcement}</VisuallyHidden>
      </main>
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
        <CharacterDragOverlay character={activeCharacter} />
      </DragOverlay>
    </DndContext>
  );
}

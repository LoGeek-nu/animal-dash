"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/atoms/Button.jsx";
import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { SearchField } from "../../../components/ui/molecules/SearchField.jsx";
import { getCharacter, laneColors } from "../../../domain/characters.js";
import { PHASE_LABELS } from "../../../domain/race-session.js";
import { logout } from "../../auth/useStaffAuth.js";
import { createLongPressGesture } from "../model/long-press.js";
import { AdminModal } from "./AdminModal.jsx";

function MobileStats({ character, compact = false }) {
  const stats = compact ? [["SPD", character.stats.speed], ["STM", character.stats.stamina]]
    : [["スピード", character.stats.speed], ["加速", character.stats.acceleration], ["スタミナ", character.stats.stamina]];
  return <div className={`mobile-stats ${compact ? "is-compact" : ""}`}>{stats.map(([label, value]) => (
    <div key={label}><span>{label}</span><meter min="0" max="10" value={value} aria-label={label}>{value} / 10</meter>{!compact && <strong>{value} / 10</strong>}</div>
  ))}</div>;
}

function CharacterCard({ character, selected, used, assigning, mutable, onSelect, onInfo }) {
  const inspect = useCallback(() => onInfo(character.id), [character.id, onInfo]);
  const tap = useCallback(() => {
    if (!assigning) inspect();
    else if (!used && mutable) onSelect(character.id);
  }, [assigning, character.id, inspect, mutable, onSelect, used]);
  const gesture = useMemo(() => createLongPressGesture({ onLongPress: inspect, onClick: tap }), [inspect, tap]);
  useEffect(() => () => gesture.cancel(), [gesture]);
  return <div className={`mobile-character-card ${selected ? "is-selected" : ""} ${used && assigning ? "is-used" : ""}`}>
    <button type="button" className="mobile-character-main" onPointerDown={gesture.onPointerDown} onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp} onPointerCancel={gesture.onPointerCancel} onClick={gesture.onClick} onContextMenu={gesture.onContextMenu} aria-disabled={assigning && (used || !mutable) ? true : undefined}
      aria-label={`${character.name}${assigning ? "を選択" : "の詳細を見る"}`} aria-pressed={assigning ? selected : undefined}>
      <CharacterAvatar id={character.id} compact />
      <span className="mobile-character-copy"><strong>{selected && <span aria-hidden="true">✓ </span>}{character.name}</strong><small>{character.preset}タイプ</small>{used && <b>使用中</b>}</span>
    </button>
    <button type="button" className="mobile-character-info" aria-label={`${character.name}のステータス`} onClick={inspect}><span aria-hidden="true">ⓘ</span></button>
  </div>;
}

export function MobileAdminWorkspace({ session, selection, actions, canLogout, onRequestGenerate, onRequestFinish, onRequestReset }) {
  const [tab, setTab] = useState("lanes");
  const [targetLane, setTargetLane] = useState(null);
  const [infoId, setInfoId] = useState(null);
  const [operationsOpen, setOperationsOpen] = useState(false);
  const workspaceRef = useRef(null);
  const mutable = session.phase === "WAITING" || session.phase === "ATTRACT";
  const participantCount = session.lanes.filter(Boolean).length;
  const readiness = session.phase === "WAITING"
    ? participantCount ? "レースを開始できます" : "参加者を登録してください"
    : `${PHASE_LABELS[session.phase]}です`;
  const assigning = targetLane !== null;
  const selectedId = selection.selectedId;
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const closeMobileOverlays = () => {
      if (!media.matches) { setInfoId(null); setOperationsOpen(false); }
    };
    media.addEventListener("change", closeMobileOverlays);
    return () => media.removeEventListener("change", closeMobileOverlays);
  }, []);
  useEffect(() => {
    const workspace = workspaceRef.current;
    const dock = workspace.querySelector(".mobile-action-dock");
    const reserveSpace = () => workspace.style.setProperty("--mobile-dock-height", `${dock.getBoundingClientRect().height}px`);
    reserveSpace();
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [tab]);
  // If another staff member fills the target, never silently replace their racer.
  const canAssign = assigning && mutable && selectedId && !selection.usedIds.has(selectedId) && !session.lanes[targetLane];
  const changeTab = (next) => { selection.setSelectedId(null); setTargetLane(null); setTab(next); window.scrollTo(0, 0); };
  const chooseLane = (index) => { selection.setSelectedId(null); setTargetLane(index); setTab("characters"); window.scrollTo(0, 0); };
  const assign = () => {
    if (!canAssign) return;
    actions.assignCharacter(targetLane, selectedId);
    changeTab("lanes");
  };
  const requestConfirmation = (callback) => { setOperationsOpen(false); callback(); };
  const info = infoId ? getCharacter(infoId) : null;

  return <div ref={workspaceRef} className={`mobile-admin-workspace ${tab === "characters" ? "is-character-view" : ""}`}>
    <nav className="mobile-admin-tabs" aria-label="管理画面の表示">
      <button type="button" aria-current={tab === "lanes" ? "page" : undefined} onClick={() => changeTab("lanes")}>参加枠</button>
      <button type="button" aria-current={tab === "characters" ? "page" : undefined} onClick={() => changeTab("characters")}>キャラクター</button>
    </nav>
    {tab === "lanes" ? <>
      <Button variant="ghost" className="mobile-capture-entry" disabled={!mutable} onClick={onRequestGenerate}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h5l2-3h4l2 3h5v13H3Z" /><circle cx="12" cy="13" r="4" /></svg>読み取り・撮影して追加</Button>
      <section className="mobile-panel" aria-labelledby="mobile-lanes-title">
        <div className="mobile-panel-heading"><span>02</span><div><h1 id="mobile-lanes-title">レーンにセット</h1><p>空きレーンの「選ぶ」からキャラクターを指定</p></div></div>
        <div className="mobile-lanes">{session.lanes.map((lane, index) => {
          const character = lane ? getCharacter(lane.characterId) : null;
          return <div key={index} className={`mobile-lane ${lane ? "has-racer" : ""}`} style={{ "--lane": laneColors[index] }}>
            <div className="mobile-lane-number"><small>LANE</small><strong>0{index + 1}</strong></div>
            {character ? <><CharacterAvatar id={character.id} compact /><div className="mobile-lane-copy"><strong>{character.name} {lane.isBot && <b>BOT</b>}</strong><small>{character.preset}タイプ</small><MobileStats character={character} compact /></div><button type="button" className="mobile-remove" disabled={!mutable} aria-label={`レーン${index + 1}から解除`} onClick={() => actions.removeCharacter(index)}>×</button></>
              : <><span className="mobile-empty-mark" aria-hidden="true">?</span><strong className="mobile-empty-copy">空きレーン</strong><Button variant="ghost" disabled={!mutable} onClick={() => chooseLane(index)} aria-label={`レーン${index + 1}のキャラクターを選ぶ`}>＋ 選ぶ</Button></>}
          </div>;
        })}</div>
        <button type="button" className="mobile-fill-bots" disabled={!mutable || participantCount === 4} onClick={() => actions.fillBots(false)}><span>BOT</span><span><strong>空きレーンをBOTで補充</strong><small>自動操作のキャラクターを追加します</small></span><span aria-hidden="true">→</span></button>
      </section>
      <div className="mobile-action-dock"><p className="mobile-readiness"><i className={session.phase === "WAITING" && participantCount ? "is-ready" : ""} />{readiness}</p><div><Button variant="ghost" onClick={() => setOperationsOpen(true)}>その他の操作</Button><Button variant="raceStart" disabled={session.phase !== "WAITING" || !participantCount} onClick={actions.startRace}><span>▶</span> レース開始</Button></div></div>
    </> : <>
      <section className="mobile-panel mobile-library" aria-labelledby="mobile-library-title">
        <div className="mobile-panel-heading"><span>01</span><div><h1 id="mobile-library-title">{assigning ? "キャラクターを選ぶ" : "キャラクターを見る"}</h1><p>登録済みのキャラクター {selection.totalCount}体</p></div></div>
        <p className="mobile-info-hint">ⓘ または長押しでステータスを表示</p>
        <SearchField value={selection.query} onChange={(event) => selection.setQuery(event.target.value)} placeholder="名前・タイプで検索" />
        <div className="mobile-character-grid">{selection.filteredCharacters.map((character) => <CharacterCard key={character.id} character={character} used={selection.usedIds.has(character.id)} selected={assigning && selectedId === character.id} assigning={assigning} mutable={mutable} onSelect={selection.toggleSelected} onInfo={setInfoId} />)}</div>
        {!selection.filteredCharacters.length && <p className="mobile-empty-search">該当するキャラクターがいません。</p>}
      </section>
      <div className="mobile-action-dock mobile-character-dock"><div><Button variant="primary" disabled={!canAssign} onClick={assign}>{!assigning && <svg className="mobile-set-lock" aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg>}{assigning ? `レーン${targetLane + 1}にセット` : "レーンにセット"}</Button>{assigning && <Button variant="secondary" disabled={!selectedId} onClick={() => selection.setSelectedId(null)}>選択解除</Button>}</div>{!assigning && <small>参加枠の「選ぶ」から開くとセットできます</small>}{assigning && session.lanes[targetLane] && <small role="status">このレーンは他の操作で埋まりました。参加枠から選び直してください。</small>}</div>
    </>}
    {info && <AdminModal title="ステータス詳細" onClose={() => setInfoId(null)} className="mobile-stats-dialog"><CharacterAvatar id={info.id} /><h3>{info.name}</h3><p>{info.preset}タイプ</p><p>{info.caption}</p><MobileStats character={info} /><Button variant="secondary" onClick={() => setInfoId(null)}>閉じる</Button></AdminModal>}
    {operationsOpen && <AdminModal title="その他の操作" onClose={() => setOperationsOpen(false)} className="mobile-operations-dialog">
      <span className={`mobile-phase status-${session.phase.toLowerCase()}`}>{PHASE_LABELS[session.phase]}</span><p>レース全体の操作はここから行います</p>
      <div className="mobile-operation-buttons">
        <Button variant="ghost" onClick={session.phase === "ATTRACT" ? actions.restartAttract : actions.showAttract}>{session.phase === "ATTRACT" ? "上映を最初から" : "アトラクトへ"}</Button>
        <Button variant="ghost" disabled={session.phase !== "ATTRACT"} onClick={actions.nextAttract}>アトラクト画面を移行する</Button>
        <Button variant="ghost" onClick={actions.showWaiting}>参加待機画面</Button>
        <Button variant="ghost" disabled={session.phase === "WAITING" || session.phase === "ATTRACT"} onClick={() => requestConfirmation(onRequestFinish)}>{session.phase === "RESULTS" ? "リザルトをスキップ" : "強制終了"}</Button>
        <Button variant="ghost" className="mobile-reset" onClick={() => requestConfirmation(onRequestReset)}>リセット <small>確認画面へ進みます</small></Button>
      </div>
      <div className="mobile-operation-links"><a href="/game" target="_blank" rel="noreferrer">ゲーム画面を開く ↗</a>{canLogout && <button type="button" onClick={() => logout("/admin")}>ログアウト</button>}</div>
      <p className="mobile-operation-note">操作は他のスタッフの画面にも反映されます</p><Button variant="secondary" onClick={() => setOperationsOpen(false)}>閉じる</Button>
    </AdminModal>}
  </div>;
}

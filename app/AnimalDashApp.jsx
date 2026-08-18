"use client";
/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { DraggableCharacter } from "./components/admin/DraggableCharacter.jsx";
import { LaneDropTarget } from "./components/admin/LaneDropTarget.jsx";
import { CharacterAvatar } from "./components/character/CharacterAvatar.jsx";
import { StatBars } from "./components/character/StatBars.jsx";
import { CourseObstacle } from "./components/game/CourseObstacle.jsx";
import { characters, formatTime, getCharacter, laneColors, staticRanking } from "./race-data.js";
import { courseLeft, courseObstacles, courseSegments, getCourseSegment, getNearestUpcomingObstacle, getVisibleCourseObstacles } from "./course-data.js";
import { useRaceSession } from "./use-race-session.js";
import { ATTRACT_SCENES } from "./attract-data.js";
import { AttractTutorial } from "./components/game/AttractTutorial.jsx";

const PHASE_LABELS = { ATTRACT: "アトラクト", WAITING: "参加受付中", COUNTDOWN: "カウントダウン", RACING: "レース中", RESULTS: "リザルト", RECOVERY: "復旧待ち" };
const keyHelp = ["SPACE / SHIFT", "↑ / ENTER", "W / E", "I / O"];

function laneOnlyCollisionDetection(args) {
  const hits = args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
  return hits.filter(({ id }) => String(id).startsWith("lane-"));
}

function ConnectionBadge({ label = "LIVE SYNC" }) {
  return <div className="connection-badge"><span />{label}</div>;
}

function GameHeader({ phase }) {
  return (
    <header className="game-header">
      <div className="game-logo"><span>OUREISAI 2026</span><strong>ANIMAL DASH!</strong></div>
      <div className="game-header-status"><span className={`phase-chip phase-${phase.toLowerCase()}`}>{PHASE_LABELS[phase]}</span><ConnectionBadge /></div>
    </header>
  );
}

function AttractRanking() {
  return (
    <section className="attract-ranking-scene">
      <header><p className="section-kicker">2026.08.19 · LIVE RECORD</p><h2>今日のランキング</h2><span>TOP 10</span></header>
      <div className="attract-ranking-list">
        {staticRanking.map((item, index) => <article className={`attract-rank-row rank-${index + 1}`} style={{ "--rank-delay": `${index * 120}ms` }} key={item.characterId}><strong>{index + 1}</strong><CharacterAvatar id={item.characterId} compact /><div><b>{getCharacter(item.characterId).name}</b><small>{getCharacter(item.characterId).preset} TYPE</small></div><time>{formatTime(item.finishMs)}</time>{index < 3 && <i>{index === 0 ? "CROWN" : "TOP 3"}</i>}</article>)}
      </div>
      <p className="ranking-callout">キミの名前をランキングにのせよう！ <b>→</b></p>
    </section>
  );
}

function AttractScreen({ revision }) {
  const [scene, setScene] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setScene((current) => (current + 1) % ATTRACT_SCENES.length), ATTRACT_SCENES[scene].duration);
    return () => window.clearTimeout(timer);
  }, [scene, revision]);

  return (
    <main className={`game-stage attract-stage attract-scene-${ATTRACT_SCENES[scene].id}`} key={revision}>
      <GameHeader phase="ATTRACT" />
      <div className="attract-confetti" aria-hidden="true" />
      {scene === 0 && <section className="attract-hero">
        <p className="section-kicker">OUREISAI 2026 · PLAYABLE EXHIBITION</p>
        <h1><span>アニマル</span><strong>ダッシュ！</strong></h1>
        <p>かわいい動物たちと、いっしょに走ろう！</p>
        <div className="attract-runners" aria-label="登場キャラクター">
          {["momo", "koro", "dorami", "azuki"].map((id, index) => <div key={id} style={{ "--runner-delay": `${index * -.35}s` }}><CharacterAvatar id={id} /></div>)}
        </div>
      </section>}
      {scene === 1 && <section className="attract-demo-scene"><header><span>GAME DEMO</span><strong>遊び方をおぼえよう！</strong></header><AttractTutorial /></section>}
      {scene === 2 && <AttractRanking />}
      <section className="attract-program" aria-label="上映プログラム">
        {ATTRACT_SCENES.map((item, index) => <div className={scene === index ? "is-active" : ""} key={item.id}><span>0{index + 1}</span><strong>{item.label}</strong><small>{index === 0 ? "動物たちが大集合！" : index === 1 ? "ゲームの遊びかた" : "今日のトップレーサー"}</small>{scene === index && <i key={`${scene}-${revision}`} style={{ "--scene-duration": `${item.duration}ms` }} />}</div>)}
      </section>
      <footer className="attract-footer"><strong>次のレースはまもなく！</strong><span>参加したい人はスタッフに声をかけてね</span></footer>
    </main>
  );
}

function WaitingScreen({ lanes }) {
  const count = lanes.filter(Boolean).length;
  return (
    <main className="game-stage waiting-stage">
      <GameHeader phase="WAITING" />
      <section className="waiting-title-row">
        <div><p className="section-kicker">NEXT RACE</p><h1>キャラクター選択中<span>…</span></h1><p className="waiting-subtitle">4人集まったらエントリー完了！</p></div>
        <div className="entry-counter"><span>ENTRY</span><strong>{count}<small>/4</small></strong><p>{count === 4 ? "エントリー完了！ スタートを待ってね" : `あと${4 - count}人でエントリー完了`}</p></div>
      </section>
      <section className="waiting-lanes" aria-label="参加キャラクター">
        {lanes.map((lane, index) => lane ? (
          <article className="waiting-card" key={`${index}-${lane.characterId}`} style={{ "--lane": laneColors[index] }}>
            <div className="waiting-card-header"><span>LANE {index + 1}</span>{lane.isBot && <b>BOT</b>}</div>
            <div className="waiting-card-art"><CharacterAvatar id={lane.characterId} /></div>
            <div className="waiting-card-meta"><div className="waiting-card-copy"><span>{getCharacter(lane.characterId).preset.toUpperCase()}</span><h2>{getCharacter(lane.characterId).name}</h2></div><StatBars id={lane.characterId} small /></div>
          </article>
        ) : (
          <article className="waiting-card empty-waiting-card" key={`empty-${index}`} style={{ "--lane": laneColors[index] }}>
            <div className="waiting-card-header"><span>LANE {index + 1}</span></div>
            <div className="empty-card-art"><strong>?</strong></div>
            <div className="waiting-card-meta empty-card-meta"><h2>参加者を待っています</h2><p>スタッフが管理画面から登録します</p></div>
          </article>
        ))}
      </section>
      <footer className="game-footer-tips">
        <div className="tip-key"><kbd>JUMP</kbd><p><strong>ジャンプ</strong><span>障害物をとびこえよう</span></p></div>
        <div className="tip-key"><kbd>BOOST</kbd><p><strong>加速</strong><span>長押しでスピードアップ</span></p></div>
        <div className="waiting-message">スタッフの「スタート！」を待ってね <i>→</i></div>
      </footer>
    </main>
  );
}

function CountdownScreen({ lanes, countdownEndsAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(timer);
  }, []);
  const left = countdownEndsAt ? Math.max(0, countdownEndsAt - now) : 0;
  const value = left > 2700 ? "3" : left > 1800 ? "2" : left > 900 ? "1" : "GO!";
  return (
    <main className="game-stage countdown-stage">
      <GameHeader phase="COUNTDOWN" />
      <div className="starting-grid">{lanes.map((lane, index) => lane && <div className="starting-runner" key={lane.characterId} style={{ "--lane": laneColors[index] }}><span>LANE {index + 1}</span><CharacterAvatar id={lane.characterId} /><strong>{getCharacter(lane.characterId).name}</strong></div>)}</div>
      <div className="countdown-overlay"><p>READY?</p><strong key={value}>{value}</strong><span>コントローラーを持ってね！</span></div>
    </main>
  );
}

function CourseScenery({ progress, laneIndex }) {
  const current = getCourseSegment(progress);
  return (
    <div className="course-scenery" aria-hidden="true" style={{ "--far-scroll": `${-progress * 2.2}px`, "--mid-scroll": `${-progress * 5.5}px`, "--segment-accent": current.accent }}>
      <div className="course-layer course-far"><i className="course-cloud cloud-a" /><i className="course-cloud cloud-b" /><i className="school-silhouette" /></div>
      <div className="course-layer course-mid">
        {courseSegments.map((segment) => {
          const left = courseLeft(segment.start + 5, progress);
          if (left < 10 || left > 112) return null;
          return <div className={`course-landmark landmark-${segment.id}`} style={{ left: `${left}%` }} key={segment.id}><i /><b>{segment.label}</b></div>;
        })}
      </div>
      <div className="course-layer course-foreground"><i className="grass-tuft grass-one" /><i className="grass-tuft grass-two" /><i className="course-flower flower-one" /><i className="course-flower flower-two" /></div>
      {laneIndex === 0 && <div className="course-zone-tag" key={current.id}><span>{current.label}</span><b>{current.caption}</b></div>}
    </div>
  );
}

function RaceArena({ lanes, raceStartedAt, onFinished }) {
  const [runners, setRunners] = useState(() => lanes.map(() => ({ progress: 0, stamina: 100, y: 0, collision: false, boosting: false, finishedAt: null })));
  const runtimeRef = useRef(runners.map((runner) => ({ ...runner, vy: 0, exhausted: false, collisionUntil: 0, hit: new Set() })));
  const controlRef = useRef(lanes.map(() => ({ boost: false, jump: false })));
  const sentRef = useRef(false);

  useEffect(() => {
    const jumpMap = { " ": 0, ArrowUp: 1, w: 2, W: 2, i: 3, I: 3 };
    const boostMap = { Shift: 0, Enter: 1, e: 2, E: 2, o: 3, O: 3 };
    const onKeyDown = (event) => {
      const jumpLane = jumpMap[event.key];
      const boostLane = boostMap[event.key];
      if (jumpLane !== undefined) { controlRef.current[jumpLane].jump = true; event.preventDefault(); }
      if (boostLane !== undefined) { controlRef.current[boostLane].boost = true; event.preventDefault(); }
    };
    const onKeyUp = (event) => {
      const boostLane = boostMap[event.key];
      if (boostLane !== undefined) controlRef.current[boostLane].boost = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastPaint = 0;
    const started = raceStartedAt ?? Date.now();

    const tick = (now) => {
      const dt = Math.min(.04, (now - last) / 1000);
      last = now;
      const elapsed = Date.now() - started;
      const gamepads = navigator.getGamepads?.() ?? [];

      runtimeRef.current.forEach((runner, index) => {
        const lane = lanes[index];
        if (!lane || runner.finishedAt !== null) return;
        const character = getCharacter(lane.characterId);
        const pad = gamepads[index];
        const botBoost = lane.isBot && Math.sin(now / 650 + index * 1.7) > -.05;
        const wantsBoost = botBoost || controlRef.current[index].boost || Boolean(pad?.buttons[1]?.pressed);
        const wantsJump = controlRef.current[index].jump || Boolean(pad?.buttons[0]?.pressed) || (lane.isBot && courseObstacles.some((obstacle) => obstacle.position - runner.progress > 1 && obstacle.position - runner.progress < 4.2));

        if (wantsJump && runner.y === 0) {
          runner.vy = 500 + character.stats.jump * 34;
          controlRef.current[index].jump = false;
        }
        if (runner.y > 0 || runner.vy > 0) {
          runner.y += runner.vy * dt;
          runner.vy -= 1780 * dt;
          if (runner.y <= 0) { runner.y = 0; runner.vy = 0; }
        }

        if (runner.exhausted && runner.stamina > 32) runner.exhausted = false;
        const boosting = wantsBoost && !runner.exhausted && runner.stamina > 0;
        runner.boosting = boosting;
        if (boosting) {
          runner.stamina = Math.max(0, runner.stamina - (27 - character.stats.stamina * .7) * dt);
          if (runner.stamina === 0) runner.exhausted = true;
        } else runner.stamina = Math.min(100, runner.stamina + (12 + character.stats.stamina * .7) * dt);

        let speed = 2.18 + character.stats.speed * .055 + (boosting ? .86 : 0);
        if (runner.collisionUntil > now) speed *= .35;
        runner.progress = Math.min(100, runner.progress + speed * dt);

        courseObstacles.forEach((obstacle) => {
          if (!runner.hit.has(obstacle.id) && Math.abs(runner.progress - obstacle.position) < .42 && runner.y < obstacle.hitHeight) {
            runner.hit.add(obstacle.id);
            runner.collisionUntil = now + obstacle.penaltyMs;
            runner.progress = Math.max(0, runner.progress - obstacle.penaltyDistance);
          }
        });

        if (runner.progress >= 100) runner.finishedAt = elapsed;
      });

      if (now - lastPaint > 32) {
        setRunners(runtimeRef.current.map((runner) => ({ progress: runner.progress, stamina: runner.stamina, y: runner.y, collision: runner.collisionUntil > now, boosting: runner.boosting, finishedAt: runner.finishedAt })));
        lastPaint = now;
      }

      const active = runtimeRef.current.flatMap((runner, laneIndex) => lanes[laneIndex] ? [{ runner, laneIndex }] : []);
      if (!sentRef.current && (active.every(({ runner }) => runner.finishedAt !== null) || elapsed >= 60_000)) {
        sentRef.current = true;
        const sorted = active.map(({ runner, laneIndex }) => {
          const lane = lanes[laneIndex];
          return { characterId: lane.characterId, lane: laneIndex + 1, finishMs: runner.finishedAt, isBot: lane.isBot };
        }).sort((a, b) => (a.finishMs ?? Infinity) - (b.finishMs ?? Infinity));
        onFinished(sorted.map((result, index) => ({ ...result, rank: index + 1 })));
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lanes, onFinished, raceStartedAt]);

  const ranks = useMemo(() => runners.map((runner, index) => ({ index, progress: runner.progress })).filter(({ index }) => lanes[index]).sort((a, b) => b.progress - a.progress).reduce((map, item, index) => ({ ...map, [item.index]: index + 1 }), {}), [runners, lanes]);

  return (
    <main className="game-stage racing-stage">
      <GameHeader phase="RACING" />
      <section className="race-lanes">
        {lanes.map((lane, index) => lane && (() => {
          const runner = runners[index];
          const character = getCharacter(lane.characterId);
          const segment = getCourseSegment(runner.progress);
          const visibleObstacles = getVisibleCourseObstacles(runner.progress);
          const nearestObstacle = getNearestUpcomingObstacle(runner.progress, visibleObstacles);
          return (
            <article className={`race-lane segment-${segment.id} ${runner.collision ? "is-hit" : ""} ${runner.finishedAt ? "is-finished" : ""}`} key={lane.characterId} style={{ "--lane": laneColors[index], "--scroll": `${-runner.progress * 9}px`, "--course-progress": runner.progress, "--segment-accent": segment.accent }}>
              <CourseScenery progress={runner.progress} laneIndex={index} />
              <div className="race-lane-info"><span>LANE {index + 1}</span><strong>{character.name}</strong><small>{lane.isBot ? "BOT" : keyHelp[index]}</small></div>
              <div className="rank-bubble"><strong>{ranks[index]}</strong><span>位</span></div>
              <div className="track-meter"><i style={{ width: `${runner.progress}%` }} /></div>
              <div className="stamina-meter"><span>BOOST</span><i><b style={{ width: `${runner.stamina}%` }} /></i></div>
              {visibleObstacles.map((obstacle) => {
                const left = courseLeft(obstacle.position, runner.progress);
                const distance = obstacle.position - runner.progress;
                return <CourseObstacle obstacle={obstacle} left={left} warning={nearestObstacle?.id === obstacle.id && distance > 0 && distance < obstacle.warningDistance} key={obstacle.id} />;
              })}
              {runner.progress > 80 && <div className="finish-line" style={{ left: `${courseLeft(100, runner.progress)}%` }}><span>FINISH</span></div>}
              <div className="runner-ground-shadow" style={{ opacity: Math.max(.18, 1 - runner.y / 260), transform: `scaleX(${Math.max(.46, 1 - runner.y / 430)})` }} />
              <div className={`racing-character ${runner.boosting ? "is-boosting" : ""} ${runner.collision ? "has-impact" : ""}`} style={{ transform: `translateY(${-runner.y}px)` }}><span className="speed-streak">≋</span><span className="runner-dust" /><span className="impact-stars">★</span><CharacterAvatar id={lane.characterId} compact />{runner.finishedAt && <b>GOAL!</b>}</div>
            </article>
          );
        })())}
      </section>
      <footer className="race-footer"><span>障害物の手前で <kbd>JUMP</kbd></span><strong>BOOSTは使いすぎに注意！</strong><span>GAMEPAD READY ●</span></footer>
    </main>
  );
}

function ResultsScreen({ results, resultsEndsAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, Math.ceil(((resultsEndsAt ?? now) - now) / 1000));
  const ranking = [...results.filter((result) => result.finishMs !== null).map((result) => ({ characterId: result.characterId, finishMs: result.finishMs })), ...staticRanking].sort((a, b) => a.finishMs - b.finishMs).filter((item, index, all) => all.findIndex((other) => other.characterId === item.characterId) === index).slice(0, 3);
  return (
    <main className="game-stage results-stage">
      <GameHeader phase="RESULTS" />
      <section className="results-heading"><div><p className="section-kicker">RACE COMPLETE</p><h1>ゴール！<span>おつかれさま！</span></h1></div><div className="reset-clock"><span>NEXT RACE</span><strong>00:{String(left).padStart(2, "0")}</strong></div></section>
      <section className="results-board">
        <div className="today-ranking"><div className="board-title"><span>TODAY&apos;S</span><strong>TOP 3</strong><small>2026.08.19</small></div>{ranking.map((item, index) => <div className={`ranking-row rank-${index + 1}`} key={item.characterId}><strong>{index + 1}</strong><CharacterAvatar id={item.characterId} compact /><div><b>{getCharacter(item.characterId).name}</b><span>BEST {formatTime(item.finishMs)}</span></div>{index === 0 && <i>CROWN</i>}</div>)}</div>
        <div className="current-results"><div className="board-title"><span>THIS RACE</span><strong>RESULT</strong></div>{results.map((result) => <div className={`result-row place-${result.rank}`} key={result.characterId}><strong>{result.rank}<small>位</small></strong><CharacterAvatar id={result.characterId} compact /><div><b>{getCharacter(result.characterId).name}</b><span>LANE {result.lane}{result.isBot ? " · BOT" : ""}</span></div><time>{formatTime(result.finishMs)}</time></div>)}</div>
      </section>
      <footer className="results-footer"><div><strong>また遊んでね！</strong><span>作品展示もぜひ見ていってください</span></div><p>SAKURABITO CREATIVE CIRCLE <i>→</i></p></footer>
    </main>
  );
}

export function GameExperience() {
  const { session, finishRace } = useRaceSession();
  if (session.phase === "ATTRACT") return <AttractScreen key={session.sequence} revision={session.sequence} />;
  if (session.phase === "COUNTDOWN") return <CountdownScreen lanes={session.lanes} countdownEndsAt={session.countdownEndsAt} />;
  if (session.phase === "RACING") return <RaceArena lanes={session.lanes} raceStartedAt={session.raceStartedAt} onFinished={finishRace} />;
  if (session.phase === "RESULTS") return <ResultsScreen results={session.results} resultsEndsAt={session.resultsEndsAt} />;
  return <WaitingScreen lanes={session.lanes} />;
}

function ConfirmDialog({ title, copy, actionLabel, danger = false, onCancel, onConfirm }) {
  return <div className="dialog-backdrop" role="presentation"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><span className="dialog-icon">{danger ? "!" : "→"}</span><h2 id="dialog-title">{title}</h2><p>{copy}</p><div><button className="secondary-button" onClick={onCancel}>キャンセル</button><button className={danger ? "danger-button" : "primary-button"} onClick={onConfirm}>{actionLabel}</button></div></div></div>;
}

export function AdminExperience() {
  const { session, ready, assignCharacter, removeCharacter, fillBots, startRace, forceFinish, resetSession, showAttract, showWaiting, restartAttract } = useRaceSession();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [activeCharacterId, setActiveCharacterId] = useState(null);
  const [overLaneId, setOverLaneId] = useState(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const dragEndedAtRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const used = new Set(session.lanes.flatMap((lane) => lane ? [lane.characterId] : []));
  const filtered = characters.filter((character) => character.name.includes(query) || character.preset.includes(query));
  const mutable = session.phase === "WAITING" || session.phase === "ATTRACT";
  const participantCount = session.lanes.filter(Boolean).length;
  const lastSync = new Date(session.lastSync).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo" });
  const activeCharacter = activeCharacterId ? getCharacter(activeCharacterId) : null;

  const assignSelected = (laneIndex) => {
    if (!selectedId) return;
    assignCharacter(laneIndex, selectedId);
    setSelectedId(null);
  };

  const finishDrag = () => {
    dragEndedAtRef.current = performance.now();
    setActiveCharacterId(null);
    setOverLaneId(null);
  };
  const handleDragStart = ({ active }) => {
    const characterId = active.data.current?.characterId;
    if (!mutable || !characterId) return;
    setActiveCharacterId(characterId);
    setDragAnnouncement(`${getCharacter(characterId).name}を移動中。配置するレーンを選んでください。`);
  };
  const handleDragOver = ({ over }) => {
    const laneIndex = over?.data.current?.laneIndex;
    setOverLaneId(Number.isInteger(laneIndex) ? `lane-${laneIndex}` : null);
  };
  const handleDragEnd = ({ active, over }) => {
    const characterId = active.data.current?.characterId;
    const laneIndex = over?.data.current?.laneIndex;
    if (mutable && characterId && Number.isInteger(laneIndex)) {
      assignCharacter(laneIndex, characterId);
      setSelectedId(null);
      setDragAnnouncement(`${getCharacter(characterId).name}をレーン${laneIndex + 1}にセットしました。`);
    } else if (characterId) {
      setDragAnnouncement(`${getCharacter(characterId).name}の移動をキャンセルしました。`);
    }
    finishDrag();
  };

  return (
    <DndContext id="animal-dash-admin-dnd" sensors={sensors} collisionDetection={laneOnlyCollisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={finishDrag}>
    <main className={`admin-shell ${activeCharacterId ? "is-dragging-character" : ""} ${overLaneId ? "is-over-lane-zone" : ""}`}>
      <header className="admin-header"><div className="admin-brand"><strong>ANIMAL DASH!</strong><span>STAFF CONTROL</span></div><nav><a href="/game" target="_blank">ゲーム画面を開く <i>↗</i></a><ConnectionBadge label={ready ? "SYNCED" : "CONNECTING"} /></nav></header>
      <section className="admin-statusbar"><div><span>EVENT</span><strong>桜麗祭 2026</strong><small>oureisai-2026</small></div><div><span>PHASE</span><strong className={`status-phase status-${session.phase.toLowerCase()}`}><i />{PHASE_LABELS[session.phase]}</strong></div><div><span>PARTICIPANTS</span><strong>{participantCount} / 4</strong></div><div><span>LAST SYNC</span><strong>{lastSync}</strong><small>SEQ {String(session.sequence).padStart(4, "0")}</small></div><div><span>SESSION</span><strong>{session.sessionId.replace("session_", "#").toUpperCase()}</strong></div></section>
      <section className="admin-workspace">
        <div className="character-library panel-card">
          <div className="panel-heading"><div><span>01</span><div><h1>キャラクターを選ぶ</h1><p>登録済みのキャラクター {characters.length}体</p></div></div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・タイプで検索" /></label></div>
          <div className="character-list">{filtered.map((character) => {
            const isUsed = used.has(character.id);
            return <DraggableCharacter character={character} key={character.id} disabled={isUsed || !mutable} isUsed={isUsed} selected={selectedId === character.id} onSelect={() => {
              if (performance.now() - dragEndedAtRef.current < 250) return;
              setSelectedId((current) => current === character.id ? null : character.id);
            }} />;
          })}</div>
        </div>
        <div className="lane-management panel-card" aria-label="キャラクターのドロップ先">
          <div className="panel-heading"><div><span>02</span><div><h1>{activeCharacter ? `${activeCharacter.name}をどこへ運ぶ？` : "レーンにセット"}</h1><p>{activeCharacter ? "明るくなったレーンへドロップ" : selectedId ? `${getCharacter(selectedId).name} を選択中` : "キャラクターをドラッグしてレーンへ"}</p></div></div>{selectedId && !activeCharacter && <button className="clear-selection" onClick={() => setSelectedId(null)}>選択解除 ×</button>}</div>
          <div className="admin-lanes">{session.lanes.map((lane, index) => <LaneDropTarget lane={lane} index={index} key={index} selectedId={selectedId} mutable={mutable} dragging={Boolean(overLaneId)} onAssign={assignSelected} onRemove={removeCharacter} />)}</div>
          <button className="fill-bots-button" disabled={!mutable || participantCount === 4} onClick={() => fillBots(false)}><span>BOT</span><div><strong>空きレーンをBOTで補充</strong><small>自動操作のキャラクターを追加します</small></div><i>→</i></button>
        </div>
      </section>
      <section className="admin-controlbar">
        <div className="readiness"><span className={participantCount > 0 ? "ready-light is-ready" : "ready-light"} /> <div><strong>{participantCount > 0 ? "レースを開始できます" : "参加者を登録してください"}</strong><small>ゲーム画面: READY · 画像エラー: 0</small></div></div>
        <div className="admin-actions"><button className="ghost-button" onClick={session.phase === "ATTRACT" ? restartAttract : showAttract}>{session.phase === "ATTRACT" ? "上映を最初から" : "アトラクトへ"}</button><button className="ghost-button" onClick={showWaiting}>参加待機画面</button><button className="ghost-button" disabled={session.phase === "WAITING" || session.phase === "ATTRACT"} onClick={() => setConfirm("finish")}>{session.phase === "RESULTS" ? "リザルトをスキップ" : "強制終了"}</button><button className="ghost-button" onClick={() => setConfirm("reset")}>リセット</button>{session.phase === "WAITING" && participantCount < 4 && <button className="secondary-start" disabled={participantCount === 0} onClick={() => fillBots(true)}>BOTで補充して開始</button>}<button className="race-start-button" disabled={session.phase !== "WAITING" || participantCount === 0} onClick={startRace}><span>▶</span> レース開始</button></div>
      </section>
      <footer className="admin-footer"><span>LOCAL MOCK MODE · BroadcastChannel + localStorage</span><span>Race results: {session.results.length ? "SAVED" : "READY"} · Auto reset: {session.resultsEndsAt ? new Date(session.resultsEndsAt).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" }) : "--:--"}</span></footer>
      {confirm === "reset" && <ConfirmDialog danger title="待機状態へリセットしますか？" copy="現在のレース進行と参加枠がすべてクリアされます。" actionLabel="リセットする" onCancel={() => setConfirm(null)} onConfirm={() => { resetSession(); setConfirm(null); }} />}
      {confirm === "finish" && <ConfirmDialog title={session.phase === "RESULTS" ? "リザルトを終了しますか？" : "レースを強制終了しますか？"} copy={session.phase === "RESULTS" ? "次の上映のためアトラクト画面へ戻ります。" : "現在の順位を仮タイムで確定してリザルトへ進みます。"} actionLabel={session.phase === "RESULTS" ? "アトラクトへ戻す" : "リザルトへ進む"} onCancel={() => setConfirm(null)} onConfirm={() => { if (session.phase === "RESULTS") resetSession(); else forceFinish(); setConfirm(null); }} />}
      <div className="sr-only" aria-live="polite">{dragAnnouncement}</div>
    </main>
    <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
      {activeCharacter && <div className="character-drag-overlay" style={{ "--char": activeCharacter.color, "--char-pale": activeCharacter.pale }}><CharacterAvatar id={activeCharacter.id} /><div><strong>{activeCharacter.name}</strong><span>{activeCharacter.preset}タイプ</span></div></div>}
    </DragOverlay>
    </DndContext>
  );
}

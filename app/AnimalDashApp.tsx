"use client";
/* eslint-disable @next/next/no-img-element -- local transparent game sprites are already sized and optimized */

import { useEffect, useMemo, useRef, useState } from "react";
import { characters, formatTime, getCharacter, laneColors, staticRanking, type LaneAssignment, type RaceResult } from "./race-data";
import { useRaceSession } from "./use-race-session";

const PHASE_LABELS = { ATTRACT: "アトラクト", WAITING: "参加受付中", COUNTDOWN: "カウントダウン", RACING: "レース中", RESULTS: "リザルト", RECOVERY: "復旧待ち" } as const;
const keyHelp = ["SPACE / SHIFT", "↑ / ENTER", "W / E", "I / O"];
const obstacles = [24, 48, 70, 84];

function CharacterAvatar({ id, compact = false }: { id: string; compact?: boolean }) {
  const character = getCharacter(id);
  return (
    <div className={`character-avatar ${compact ? "is-compact" : ""}`} style={{ "--char": character.color, "--char-pale": character.pale } as React.CSSProperties}>
      <img src={`/characters/${character.id}/runner.png`} alt={`${character.name}の全身イラスト`} draggable={false} />
      <i className="avatar-spark spark-one" />
      <i className="avatar-spark spark-two" />
    </div>
  );
}

function ConnectionBadge({ label = "LIVE SYNC" }: { label?: string }) {
  return <div className="connection-badge"><span />{label}</div>;
}

function StatBars({ id, small = false }: { id: string; small?: boolean }) {
  const character = getCharacter(id);
  const stats = [
    ["SPD", character.stats.speed],
    ["ACC", character.stats.acceleration],
    ["JMP", character.stats.jump],
    ["STM", character.stats.stamina],
  ] as const;
  return (
    <div className={`stat-bars ${small ? "is-small" : ""}`}>
      {stats.map(([label, value]) => (
        <div className="stat-row" key={label}>
          <span>{label}</span><i><b style={{ width: `${value * 10}%` }} /></i>
        </div>
      ))}
    </div>
  );
}

function GameHeader({ phase }: { phase: keyof typeof PHASE_LABELS }) {
  return (
    <header className="game-header">
      <div className="game-logo"><span>OUREISAI 2026</span><strong>ANIMAL DASH!</strong></div>
      <div className="game-header-status"><span className={`phase-chip phase-${phase.toLowerCase()}`}>{PHASE_LABELS[phase]}</span><ConnectionBadge /></div>
    </header>
  );
}

const ATTRACT_SCENES = [
  { id: "hero", label: "ANIMAL PARADE", duration: 12_000 },
  { id: "demo", label: "DEMO RACE", duration: 24_000 },
  { id: "ranking", label: "TODAY'S RANKING", duration: 14_000 },
] as const;

function DemoRaceFilm() {
  return (
    <div className="demo-film">
      <video autoPlay muted loop playsInline preload="auto" poster="/demo-poster.svg">
        <source src="/media/animal-dash-demo.mp4" type="video/mp4" />
      </video>
      <div className="demo-film-live" aria-hidden="true">
        {characters.slice(0, 4).map((character, index) => <div className={`demo-live-runner demo-runner-${index + 1}`} key={character.id}><CharacterAvatar id={character.id} compact /></div>)}
        <i className="demo-log" /><i className="demo-rock" />
      </div>
      <div className="demo-film-label"><span>HOW TO PLAY</span><strong>ジャンプで障害物を<br />とびこえよう！</strong><small>JUMP + BOOST でゴールをめざせ</small></div>
    </div>
  );
}

function AttractRanking() {
  return (
    <section className="attract-ranking-scene">
      <header><p className="section-kicker">2026.08.19 · LIVE RECORD</p><h2>今日のランキング</h2><span>TOP 10</span></header>
      <div className="attract-ranking-list">
        {staticRanking.map((item, index) => <article className={`attract-rank-row rank-${index + 1}`} style={{ "--rank-delay": `${index * 120}ms` } as React.CSSProperties} key={item.characterId}><strong>{index + 1}</strong><CharacterAvatar id={item.characterId} compact /><div><b>{getCharacter(item.characterId).name}</b><small>{getCharacter(item.characterId).preset} TYPE</small></div><time>{formatTime(item.finishMs)}</time>{index < 3 && <i>{index === 0 ? "CROWN" : "TOP 3"}</i>}</article>)}
      </div>
      <p className="ranking-callout">キミの名前をランキングにのせよう！ <b>→</b></p>
    </section>
  );
}

function AttractScreen({ revision }: { revision: number }) {
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
          {["momo", "koro", "dorami", "azuki"].map((id, index) => <div key={id} style={{ "--runner-delay": `${index * -.35}s` } as React.CSSProperties}><CharacterAvatar id={id} /></div>)}
        </div>
      </section>}
      {scene === 1 && <section className="attract-demo-scene"><header><span>GAME DEMO</span><strong>こんなゲームだよ！</strong></header><DemoRaceFilm /></section>}
      {scene === 2 && <AttractRanking />}
      <section className="attract-program" aria-label="上映プログラム">
        {ATTRACT_SCENES.map((item, index) => <div className={scene === index ? "is-active" : ""} key={item.id}><span>0{index + 1}</span><strong>{item.label}</strong><small>{index === 0 ? "動物たちが大集合！" : index === 1 ? "ゲームの遊びかた" : "今日のトップレーサー"}</small>{scene === index && <i key={`${scene}-${revision}`} style={{ "--scene-duration": `${item.duration}ms` } as React.CSSProperties} />}</div>)}
      </section>
      <footer className="attract-footer"><strong>次のレースはまもなく！</strong><span>参加したい人はスタッフに声をかけてね</span></footer>
    </main>
  );
}

function WaitingScreen({ lanes }: { lanes: Array<LaneAssignment | null> }) {
  const count = lanes.filter(Boolean).length;
  return (
    <main className="game-stage waiting-stage">
      <GameHeader phase="WAITING" />
      <section className="waiting-title-row">
        <div><p className="section-kicker">NEXT RACE</p><h1>キミのキャラが<br /><em>走りだす！</em></h1></div>
        <div className="entry-counter"><span>ENTRY</span><strong>{count}<small>/4</small></strong><p>{count === 4 ? "準備OK！まもなくスタート" : `あと${4 - count}人参加できます`}</p></div>
      </section>
      <section className="waiting-lanes" aria-label="参加キャラクター">
        {lanes.map((lane, index) => lane ? (
          <article className="waiting-card" key={`${index}-${lane.characterId}`} style={{ "--lane": laneColors[index] } as React.CSSProperties}>
            <div className="card-topline"><span>LANE {index + 1}</span>{lane.isBot && <b>BOT</b>}</div>
            <CharacterAvatar id={lane.characterId} />
            <div className="waiting-card-copy"><span>{getCharacter(lane.characterId).preset.toUpperCase()}</span><h2>{getCharacter(lane.characterId).name}</h2><StatBars id={lane.characterId} small /></div>
          </article>
        ) : (
          <article className="waiting-card empty-waiting-card" key={`empty-${index}`} style={{ "--lane": laneColors[index] } as React.CSSProperties}>
            <div className="card-topline"><span>LANE {index + 1}</span></div><strong>?</strong><div><h2>参加者を<br />待っています</h2><p>スタッフが登録します</p></div>
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

function CountdownScreen({ lanes, countdownEndsAt }: { lanes: Array<LaneAssignment | null>; countdownEndsAt: number | null }) {
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
      <div className="starting-grid">{lanes.map((lane, index) => lane && <div className="starting-runner" key={lane.characterId} style={{ "--lane": laneColors[index] } as React.CSSProperties}><span>LANE {index + 1}</span><CharacterAvatar id={lane.characterId} /><strong>{getCharacter(lane.characterId).name}</strong></div>)}</div>
      <div className="countdown-overlay"><p>READY?</p><strong key={value}>{value}</strong><span>コントローラーを持ってね！</span></div>
    </main>
  );
}

type RunnerState = { progress: number; stamina: number; y: number; collision: boolean; finishedAt: number | null };

function RaceArena({ lanes, raceStartedAt, onFinished }: { lanes: Array<LaneAssignment | null>; raceStartedAt: number | null; onFinished: (results: RaceResult[]) => void }) {
  const [runners, setRunners] = useState<RunnerState[]>(() => lanes.map(() => ({ progress: 0, stamina: 100, y: 0, collision: false, finishedAt: null })));
  const runtimeRef = useRef(runners.map((runner) => ({ ...runner, vy: 0, exhausted: false, collisionUntil: 0, hit: new Set<number>() })));
  const controlRef = useRef(lanes.map(() => ({ boost: false, jump: false })));
  const sentRef = useRef(false);

  useEffect(() => {
    const jumpMap: Record<string, number> = { " ": 0, ArrowUp: 1, w: 2, W: 2, i: 3, I: 3 };
    const boostMap: Record<string, number> = { Shift: 0, Enter: 1, e: 2, E: 2, o: 3, O: 3 };
    const onKeyDown = (event: KeyboardEvent) => {
      const jumpLane = jumpMap[event.key];
      const boostLane = boostMap[event.key];
      if (jumpLane !== undefined) { controlRef.current[jumpLane].jump = true; event.preventDefault(); }
      if (boostLane !== undefined) { controlRef.current[boostLane].boost = true; event.preventDefault(); }
    };
    const onKeyUp = (event: KeyboardEvent) => {
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

    const tick = (now: number) => {
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
        const wantsJump = controlRef.current[index].jump || Boolean(pad?.buttons[0]?.pressed) || (lane.isBot && obstacles.some((position) => position - runner.progress > 1 && position - runner.progress < 3.6));

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
        if (boosting) {
          runner.stamina = Math.max(0, runner.stamina - (27 - character.stats.stamina * .7) * dt);
          if (runner.stamina === 0) runner.exhausted = true;
        } else runner.stamina = Math.min(100, runner.stamina + (12 + character.stats.stamina * .7) * dt);

        let speed = 2.18 + character.stats.speed * .055 + (boosting ? .86 : 0);
        if (runner.collisionUntil > now) speed *= .35;
        runner.progress = Math.min(100, runner.progress + speed * dt);

        obstacles.forEach((position, obstacleIndex) => {
          if (!runner.hit.has(obstacleIndex) && Math.abs(runner.progress - position) < .42 && runner.y < (obstacleIndex % 2 ? 45 : 28)) {
            runner.hit.add(obstacleIndex);
            runner.collisionUntil = now + 720;
            runner.progress = Math.max(0, runner.progress - 1.2);
          }
        });

        if (runner.progress >= 100) runner.finishedAt = elapsed;
      });

      if (now - lastPaint > 32) {
        setRunners(runtimeRef.current.map((runner) => ({ progress: runner.progress, stamina: runner.stamina, y: runner.y, collision: runner.collisionUntil > now, finishedAt: runner.finishedAt })));
        lastPaint = now;
      }

      const active = runtimeRef.current.flatMap((runner, laneIndex) => lanes[laneIndex] ? [{ runner, laneIndex }] : []);
      if (!sentRef.current && (active.every(({ runner }) => runner.finishedAt !== null) || elapsed >= 60_000)) {
        sentRef.current = true;
        const sorted = active.map(({ runner, laneIndex }) => {
          const lane = lanes[laneIndex] as LaneAssignment;
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

  const ranks = useMemo(() => runners.map((runner, index) => ({ index, progress: runner.progress })).filter(({ index }) => lanes[index]).sort((a, b) => b.progress - a.progress).reduce<Record<number, number>>((map, item, index) => ({ ...map, [item.index]: index + 1 }), {}), [runners, lanes]);

  return (
    <main className="game-stage racing-stage">
      <GameHeader phase="RACING" />
      <section className="race-lanes">
        {lanes.map((lane, index) => lane && (() => {
          const runner = runners[index];
          const character = getCharacter(lane.characterId);
          return (
            <article className={`race-lane ${runner.collision ? "is-hit" : ""} ${runner.finishedAt ? "is-finished" : ""}`} key={lane.characterId} style={{ "--lane": laneColors[index], "--scroll": `${-runner.progress * 9}px` } as React.CSSProperties}>
              <div className="race-lane-info"><span>LANE {index + 1}</span><strong>{character.name}</strong><small>{lane.isBot ? "BOT" : keyHelp[index]}</small></div>
              <div className="rank-bubble"><strong>{ranks[index]}</strong><span>位</span></div>
              <div className="track-meter"><i style={{ width: `${runner.progress}%` }} /></div>
              <div className="stamina-meter"><span>BOOST</span><i><b style={{ width: `${runner.stamina}%` }} /></i></div>
              {obstacles.map((position, obstacleIndex) => {
                const left = 27 + (position - runner.progress) * 1.62;
                if (left < -5 || left > 106) return null;
                return obstacleIndex === 2 ? <div className="mud-patch" key={position} style={{ left: `${left}%` }} /> : <div aria-hidden="true" className={`track-obstacle obstacle-${obstacleIndex % 2}`} key={position} style={{ left: `${left}%` }} />;
              })}
              {runner.progress > 73 && <div className="finish-line" style={{ left: `${27 + (100 - runner.progress) * 1.62}%` }}><span>FINISH</span></div>}
              <div className="racing-character" style={{ transform: `translateY(${-runner.y}px)` }}><span className="speed-streak">≋</span><CharacterAvatar id={lane.characterId} compact />{runner.finishedAt && <b>GOAL!</b>}</div>
            </article>
          );
        })())}
      </section>
      <footer className="race-footer"><span>障害物の手前で <kbd>JUMP</kbd></span><strong>BOOSTは使いすぎに注意！</strong><span>GAMEPAD READY ●</span></footer>
    </main>
  );
}

function ResultsScreen({ results, resultsEndsAt }: { results: RaceResult[]; resultsEndsAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, Math.ceil(((resultsEndsAt ?? now) - now) / 1000));
  const ranking = [...results.filter((result) => result.finishMs !== null).map((result) => ({ characterId: result.characterId, finishMs: result.finishMs as number })), ...staticRanking].sort((a, b) => a.finishMs - b.finishMs).filter((item, index, all) => all.findIndex((other) => other.characterId === item.characterId) === index).slice(0, 3);
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

function ConfirmDialog({ title, copy, actionLabel, danger = false, onCancel, onConfirm }: { title: string; copy: string; actionLabel: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><span className="dialog-icon">{danger ? "!" : "→"}</span><h2 id="dialog-title">{title}</h2><p>{copy}</p><div><button className="secondary-button" onClick={onCancel}>キャンセル</button><button className={danger ? "danger-button" : "primary-button"} onClick={onConfirm}>{actionLabel}</button></div></div></div>;
}

export function AdminExperience() {
  const { session, ready, assignCharacter, removeCharacter, fillBots, startRace, forceFinish, resetSession, showAttract, showWaiting, restartAttract } = useRaceSession();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "finish" | null>(null);
  const used = new Set(session.lanes.flatMap((lane) => lane ? [lane.characterId] : []));
  const filtered = characters.filter((character) => character.name.includes(query) || character.preset.includes(query));
  const mutable = session.phase === "WAITING" || session.phase === "ATTRACT";
  const participantCount = session.lanes.filter(Boolean).length;
  const lastSync = new Date(session.lastSync).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Tokyo" });

  const assignSelected = (laneIndex: number) => {
    if (!selectedId) return;
    assignCharacter(laneIndex, selectedId);
    setSelectedId(null);
  };

  return (
    <main className="admin-shell">
      <header className="admin-header"><div className="admin-brand"><strong>ANIMAL DASH!</strong><span>STAFF CONTROL</span></div><nav><a href="/game" target="_blank">ゲーム画面を開く <i>↗</i></a><ConnectionBadge label={ready ? "SYNCED" : "CONNECTING"} /></nav></header>
      <section className="admin-statusbar"><div><span>EVENT</span><strong>桜麗祭 2026</strong><small>oureisai-2026</small></div><div><span>PHASE</span><strong className={`status-phase status-${session.phase.toLowerCase()}`}><i />{PHASE_LABELS[session.phase]}</strong></div><div><span>PARTICIPANTS</span><strong>{participantCount} / 4</strong></div><div><span>LAST SYNC</span><strong>{lastSync}</strong><small>SEQ {String(session.sequence).padStart(4, "0")}</small></div><div><span>SESSION</span><strong>{session.sessionId.replace("session_", "#").toUpperCase()}</strong></div></section>
      <section className="admin-workspace">
        <div className="character-library panel-card">
          <div className="panel-heading"><div><span>01</span><div><h1>キャラクターを選ぶ</h1><p>登録済みのキャラクター {characters.length}体</p></div></div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・タイプで検索" /></label></div>
          <div className="character-list">{filtered.map((character) => {
            const isUsed = used.has(character.id);
            return <button className={`library-character ${selectedId === character.id ? "is-selected" : ""} ${isUsed ? "is-used" : ""}`} key={character.id} disabled={isUsed || !mutable} onClick={() => setSelectedId((current) => current === character.id ? null : character.id)} style={{ "--char": character.color, "--char-pale": character.pale } as React.CSSProperties}><CharacterAvatar id={character.id} compact /><div><strong>{character.name}</strong><span>{character.preset}タイプ</span><small>{character.caption}</small></div>{isUsed ? <b>使用中</b> : <i>{selectedId === character.id ? "選択中" : "+"}</i>}</button>;
          })}</div>
        </div>
        <div className="lane-management panel-card">
          <div className="panel-heading"><div><span>02</span><div><h1>レーンにセット</h1><p>{selectedId ? `${getCharacter(selectedId).name} を選択中` : "キャラクターを選んでレーンへ"}</p></div></div>{selectedId && <button className="clear-selection" onClick={() => setSelectedId(null)}>選択解除 ×</button>}</div>
          <div className="admin-lanes">{session.lanes.map((lane, index) => <div className={`admin-lane ${lane ? "has-racer" : ""}`} key={index} style={{ "--lane": laneColors[index] } as React.CSSProperties}><div className="admin-lane-number"><span>LANE</span><strong>0{index + 1}</strong></div>{lane ? <><CharacterAvatar id={lane.characterId} compact /><div className="lane-character-copy"><div><strong>{getCharacter(lane.characterId).name}</strong>{lane.isBot && <b>BOT</b>}</div><span>{getCharacter(lane.characterId).preset}タイプ</span><StatBars id={lane.characterId} small /></div><button className="remove-racer" disabled={!mutable} onClick={() => removeCharacter(index)} aria-label={`レーン${index + 1}から解除`}>×</button></> : <><div className="empty-lane-mark">?</div><div className="empty-lane-copy"><strong>空きレーン</strong><span>{selectedId ? "セットできます" : "キャラクターを選択してください"}</span></div><button className="assign-button" disabled={!selectedId || !mutable} onClick={() => assignSelected(index)}>このレーンにセット</button></>}</div>)}</div>
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
    </main>
  );
}

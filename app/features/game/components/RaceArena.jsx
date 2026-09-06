"use client";

import { useRaceEngine } from "../race/useRaceEngine.js";
import { GameHeader } from "./GameHeader.jsx";
import { RaceLane } from "./RaceLane.jsx";

export function RaceArena({ lanes, raceStartedAt, onFinished }) {
  const { runners, ranks } = useRaceEngine({ lanes, raceStartedAt, onFinished });

  return (
    <main className="game-stage racing-stage">
      <GameHeader phase="RACING" />
      <section className="race-lanes">
        {lanes.map((lane, index) => lane && (
          <RaceLane
            lane={lane}
            laneIndex={index}
            runner={runners[index]}
            rank={ranks[index]}
            key={lane.characterId}
          />
        ))}
      </section>
      <footer className="race-footer">
        <div className="race-footer-left">
          <span>障害物の手前で <kbd>JUMP</kbd></span>
          <div className="race-footer-keys">
            <span className="race-footer-key-hint">
              <span>ジャンプ</span>
              <kbd className="race-key-pill is-space">Space</kbd>
            </span>
            <span className="race-footer-key-hint">
              <span>ブースト</span>
              <kbd className="race-key-pill is-shift">Shift</kbd>
            </span>
          </div>
        </div>
        <strong>BOOSTは使いすぎに注意！</strong>
        <span>GAMEPAD READY ●</span>
      </footer>
    </main>
  );
}

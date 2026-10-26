"use client";

import { useMemo } from "react";
import { createCourseObstacles } from "../../../domain/course.js";
import { useRaceEngine } from "../race/useRaceEngine.js";
import { GameHeader } from "./GameHeader.jsx";
import { RaceLane } from "./RaceLane.jsx";

export function RaceArena({ raceId, lanes, raceStartedAt, onFinished, onInput, canControl, raceFeed, connected }) {
  const { runners, ranks } = useRaceEngine({ raceId, lanes, raceStartedAt, onFinished, onInput, canControl, raceFeed, connected });
  // The same race ID gives the same course the runtime simulates.
  const obstacles = useMemo(() => createCourseObstacles(raceId, lanes.length), [raceId, lanes.length]);

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
            obstacles={obstacles[index]}
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
              <span className="race-control-button is-jump" aria-hidden="true" />
            </span>
            <span className="race-footer-key-hint">
              <span>ブースト</span>
              <span className="race-control-button is-dash" aria-hidden="true" />
            </span>
          </div>
        </div>
        <strong>BOOSTは使いすぎに注意！</strong>
        <span>GAMEPAD READY ●</span>
      </footer>
    </main>
  );
}

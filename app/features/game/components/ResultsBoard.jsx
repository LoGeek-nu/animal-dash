"use client";

import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { getCharacter } from "../../../domain/characters.js";
import { formatRankingDate, formatTime } from "../../../domain/rankings.js";
import { RankingStatus } from "../../rankings/RankingStatus.jsx";
import { useDailyRankings } from "../../rankings/useDailyRankings.js";

export function ResultsBoard({ raceId, results }) {
  const board = useDailyRankings({ limit: 3, afterRaceId: raceId });
  return <ResultsBoardView results={results} board={board} />;
}

export function ResultsBoardView({ results, board }) {
  return (
    <section className="results-board">
      <div className="today-ranking">
        <div className="board-title"><span>TODAY&apos;S</span><strong>TOP 3</strong><small>{formatRankingDate(board.date)} · 日本時間</small></div>
        <p className="ranking-metric">クリアタイム（秒）<small>キャラクターごとの最速記録 · BOT除外</small></p>
        <RankingStatus status={board.status} empty={board.rankings.length === 0} onRetry={board.retry} />
        {board.status === "ready" && board.rankings.map((item) => (
          <div className={`ranking-row rank-${item.rank}`} key={item.characterId}>
            <strong>{item.rank}</strong><CharacterAvatar character={item.character} compact />
            <div><b>{item.displayName}</b><span className="ranking-time">{formatTime(item.finishMs)}</span></div>
            {item.rank === 1 && <i>CROWN</i>}
          </div>
        ))}
      </div>
      <div className="current-results">
        <div className="board-title"><span>THIS RACE</span><strong>RESULT</strong></div>
        <p className="ranking-metric">クリアタイム（秒）<small>DNF：未完走</small></p>
        {results.map((result) => (
          <div className={`result-row place-${result.rank}`} key={result.characterId}>
            <strong>{result.rank}<small>位</small></strong><CharacterAvatar id={result.characterId} compact />
            <div><b>{getCharacter(result.characterId).name}</b><span>LANE {result.lane}{result.isBot ? " · BOT" : ""}</span></div>
            <time>{formatTime(result.finishMs)}</time>
          </div>
        ))}
      </div>
    </section>
  );
}

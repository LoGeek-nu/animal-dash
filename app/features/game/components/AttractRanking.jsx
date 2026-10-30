"use client";

import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { formatTime, rankRevealDelay } from "../../../domain/rankings.js";
import { RankingStatus } from "../../rankings/RankingStatus.jsx";
import { useDailyRankings } from "../../rankings/useDailyRankings.js";

export function AttractRanking() {
  const board = useDailyRankings();
  return <AttractRankingView board={board} />;
}

export function AttractRankingView({ board }) {
  return (
    <section className="attract-ranking-scene">
      <header><h2>今日のランキング</h2></header>
      <div className="attract-ranking-list">
        <RankingStatus status={board.status} empty={board.rankings.length === 0} onRetry={board.retry} />
        {board.status === "ready" && board.rankings.map((item, index) => (
          <article className={`attract-rank-row rank-${item.rank}`} style={{ "--rank-delay": `${rankRevealDelay(index, board.rankings.length, item.rank)}ms` }} key={item.characterId}>
            <strong>{item.rank}</strong>
            <CharacterAvatar character={item.character} compact />
            <div><b>{item.displayName}</b><small>{item.character.preset ? `${item.character.preset} TYPE` : "BEST RECORD"}</small></div>
            <time>{formatTime(item.finishMs)}</time>
            {item.rank <= 3 && <i>{item.rank === 1 ? "CROWN" : "TOP 3"}</i>}
          </article>
        ))}
      </div>
      <p className="ranking-callout">キミの名前をランキングにのせよう！ <b>→</b></p>
    </section>
  );
}

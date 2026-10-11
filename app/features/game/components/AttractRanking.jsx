"use client";

import { SectionKicker } from "../../../components/ui/atoms/SectionKicker.jsx";
import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { formatRankingDate, formatTime } from "../../../domain/rankings.js";
import { RankingStatus } from "../../rankings/RankingStatus.jsx";
import { useDailyRankings } from "../../rankings/useDailyRankings.js";

export function AttractRanking() {
  const board = useDailyRankings();
  return <AttractRankingView board={board} />;
}

export function AttractRankingView({ board }) {
  return (
    <section className="attract-ranking-scene">
      <header><SectionKicker>{formatRankingDate(board.date)} · 日本時間</SectionKicker>
        <div><h2>今日のランキング</h2><p className="ranking-metric">クリアタイム（秒） · キャラクターごとの最速記録 · BOT除外</p></div><span>TOP 10</span></header>
      <div className="attract-ranking-list">
        <RankingStatus status={board.status} empty={board.rankings.length === 0} onRetry={board.retry} />
        {board.status === "ready" && board.rankings.map((item, index) => (
          <article className={`attract-rank-row rank-${item.rank}`} style={{ "--rank-delay": `${index * 120}ms` }} key={item.characterId}>
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

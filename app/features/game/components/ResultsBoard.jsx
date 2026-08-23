import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { getCharacter } from "../../../domain/characters.js";
import { buildTopRanking, formatTime } from "../../../domain/rankings.js";

export function ResultsBoard({ results }) {
  const ranking = buildTopRanking(results);

  return (
    <section className="results-board">
      <div className="today-ranking">
        <div className="board-title"><span>TODAY&apos;S</span><strong>TOP 3</strong><small>2026.08.19</small></div>
        {ranking.map((item, index) => (
          <div className={`ranking-row rank-${index + 1}`} key={item.characterId}>
            <strong>{index + 1}</strong><CharacterAvatar id={item.characterId} compact />
            <div><b>{getCharacter(item.characterId).name}</b><span>BEST {formatTime(item.finishMs)}</span></div>
            {index === 0 && <i>CROWN</i>}
          </div>
        ))}
      </div>
      <div className="current-results">
        <div className="board-title"><span>THIS RACE</span><strong>RESULT</strong></div>
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

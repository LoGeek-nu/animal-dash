import { SectionKicker } from "../../../components/ui/atoms/SectionKicker.jsx";
import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { getCharacter } from "../../../domain/characters.js";
import { formatTime, staticRanking } from "../../../domain/rankings.js";

export function AttractRanking() {
  return (
    <section className="attract-ranking-scene">
      <header><SectionKicker>2026.08.19 · LIVE RECORD</SectionKicker><h2>今日のランキング</h2><span>TOP 10</span></header>
      <div className="attract-ranking-list">
        {staticRanking.map((item, index) => {
          const character = getCharacter(item.characterId);
          return (
            <article className={`attract-rank-row rank-${index + 1}`} style={{ "--rank-delay": `${index * 120}ms` }} key={item.characterId}>
              <strong>{index + 1}</strong>
              <CharacterAvatar id={item.characterId} compact />
              <div><b>{character.name}</b><small>{character.preset} TYPE</small></div>
              <time>{formatTime(item.finishMs)}</time>
              {index < 3 && <i>{index === 0 ? "CROWN" : "TOP 3"}</i>}
            </article>
          );
        })}
      </div>
      <p className="ranking-callout">キミの名前をランキングにのせよう！ <b>→</b></p>
    </section>
  );
}

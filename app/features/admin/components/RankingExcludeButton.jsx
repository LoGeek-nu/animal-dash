export function RankingExcludeButton({ lane, index, mutable, onChange }) {
  const excluded = lane.isBot || lane.rankingExcluded === true;
  return <button type="button" className="ranking-exclude-button" aria-pressed={excluded}
    aria-label={`レーン${index + 1}のランキング除外`}
    disabled={!mutable || lane.isBot}
    title={lane.isBot ? "BOTは常に全体ランキング対象外です" : "ONにすると、この参加者の記録を全体ランキングから除外します"}
    onClick={() => onChange(index, !excluded)}>
    <span className="ranking-exclude-check" aria-hidden="true">{excluded ? "✓" : ""}</span>
    <span>ランキング除外</span>
  </button>;
}

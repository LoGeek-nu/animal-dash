"use client";

import { useEffect, useState } from "react";
import { SectionKicker } from "../../../components/ui/atoms/SectionKicker.jsx";
import { GameHeader } from "../components/GameHeader.jsx";
import { ResultsBoard } from "../components/ResultsBoard.jsx";

export function ResultsScreen({ results, resultsEndsAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.ceil(((resultsEndsAt ?? now) - now) / 1000));
  return (
    <main className="game-stage results-stage">
      <GameHeader phase="RESULTS" />
      <section className="results-heading">
        <div><SectionKicker>RACE COMPLETE</SectionKicker><h1>ゴール！<span>おつかれさま！</span></h1></div>
        <div className="reset-clock"><span>NEXT RACE</span><strong>00:{String(left).padStart(2, "0")}</strong></div>
      </section>
      <ResultsBoard results={results} />
      <footer className="results-footer"><div><strong>また遊んでね！</strong><span>作品展示もぜひ見ていってください</span></div><p>SAKURABITO CREATIVE CIRCLE <i>→</i></p></footer>
    </main>
  );
}

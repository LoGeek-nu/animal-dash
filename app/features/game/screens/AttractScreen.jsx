"use client";

import { useEffect, useState } from "react";
import { ATTRACT_SCENES } from "../../../domain/attract.js";
import { AttractHero } from "../components/AttractHero.jsx";
import { AttractProgram } from "../components/AttractProgram.jsx";
import { AttractRanking } from "../components/AttractRanking.jsx";
import { AttractTutorial } from "../components/AttractTutorial.jsx";
import { GameHeader } from "../components/GameHeader.jsx";

export function AttractScreen({ revision }) {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setScene((current) => (current + 1) % ATTRACT_SCENES.length),
      ATTRACT_SCENES[scene].duration,
    );
    return () => window.clearTimeout(timer);
  }, [revision, scene]);

  return (
    <main className={`game-stage attract-stage attract-scene-${ATTRACT_SCENES[scene].id}`} key={revision}>
      <GameHeader phase="ATTRACT" />
      <div className="attract-confetti" aria-hidden="true" />
      {scene === 0 && <AttractHero />}
      {scene === 1 && <section className="attract-demo-scene"><header><span>GAME DEMO</span><strong>遊び方をおぼえよう！</strong></header><AttractTutorial /></section>}
      {scene === 2 && <AttractRanking />}
      <AttractProgram scene={scene} revision={revision} />
      <footer className="attract-footer"><strong>次のレースはまもなく！</strong><span>参加したい人はスタッフに声をかけてね</span></footer>
    </main>
  );
}

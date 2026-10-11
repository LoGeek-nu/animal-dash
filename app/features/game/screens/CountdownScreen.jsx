"use client";

import { useEffect, useState } from "react";
import { CountdownGrid } from "../components/CountdownGrid.jsx";
import { GameHeader } from "../components/GameHeader.jsx";

export function CountdownScreen({ lanes, countdownEndsAt }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 80);
    return () => window.clearInterval(timer);
  }, []);

  const left = countdownEndsAt ? Math.max(0, countdownEndsAt - now) : 0;
  const value = left > 2700 ? "3" : left > 1800 ? "2" : left > 900 ? "1" : "GO!";

  return (
    <main className="game-stage countdown-stage">
      <GameHeader phase="COUNTDOWN" />
      <CountdownGrid lanes={lanes} />
      <div className="countdown-overlay"><p>READY?</p><strong key={value}>{value}</strong><span>コントローラーを持ってね！</span></div>
    </main>
  );
}

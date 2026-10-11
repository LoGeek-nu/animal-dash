import { Button } from "../../../components/ui/atoms/Button.jsx";

export function AdminControlBar({ session, participantCount, actions, onRequestFinish, onRequestReset }) {
  return (
    <section className="admin-controlbar">
      <div className="readiness">
        <span className={participantCount > 0 ? "ready-light is-ready" : "ready-light"} />
        <div><strong>{participantCount > 0 ? "レースを開始できます" : "参加者を登録してください"}</strong><small>ゲーム画面: READY · 画像エラー: 0</small></div>
      </div>
      <div className="admin-actions">
        <Button variant="ghost" onClick={session.phase === "ATTRACT" ? actions.restartAttract : actions.showAttract}>{session.phase === "ATTRACT" ? "上映を最初から" : "アトラクトへ"}</Button>
        <Button variant="ghost" disabled={session.phase !== "ATTRACT"} onClick={actions.nextAttract}>アトラクト画面を移行する</Button>
        <Button variant="ghost" onClick={actions.showWaiting}>参加待機画面</Button>
        <Button variant="ghost" disabled={session.phase === "WAITING" || session.phase === "ATTRACT"} onClick={onRequestFinish}>{session.phase === "RESULTS" ? "リザルトをスキップ" : "強制終了"}</Button>
        <Button variant="ghost" onClick={onRequestReset}>リセット</Button>
        {session.phase === "WAITING" && participantCount < 4 && <Button variant="secondaryStart" disabled={participantCount === 0} onClick={() => actions.fillBots(true)}>BOTで補充して開始</Button>}
        <Button variant="raceStart" disabled={session.phase !== "WAITING" || participantCount === 0} onClick={actions.startRace}><span>▶</span> レース開始</Button>
      </div>
    </section>
  );
}

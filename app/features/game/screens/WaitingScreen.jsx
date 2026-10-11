import { KeyCap } from "../../../components/ui/atoms/KeyCap.jsx";
import { SectionKicker } from "../../../components/ui/atoms/SectionKicker.jsx";
import { GameHeader } from "../components/GameHeader.jsx";
import { WaitingLaneGrid } from "../components/WaitingLaneGrid.jsx";

export function WaitingScreen({ lanes }) {
  const count = lanes.filter(Boolean).length;
  return (
    <main className="game-stage waiting-stage">
      <GameHeader phase="WAITING" />
      <section className="waiting-title-row">
        <div><SectionKicker>NEXT RACE</SectionKicker><h1>キャラクター選択中<span>…</span></h1><p className="waiting-subtitle">4人集まったらエントリー完了！</p></div>
        <div className="entry-counter"><span>ENTRY</span><strong>{count}<small>/4</small></strong><p>{count === 4 ? "エントリー完了！ スタートを待ってね" : `あと${4 - count}人でエントリー完了`}</p></div>
      </section>
      <WaitingLaneGrid lanes={lanes} />
      <footer className="game-footer-tips">
        <div className="tip-key"><KeyCap>JUMP</KeyCap><p><strong>ジャンプ</strong><span>障害物をとびこえよう</span></p></div>
        <div className="tip-key"><KeyCap>BOOST</KeyCap><p><strong>加速</strong><span>長押しでスピードアップ</span></p></div>
        <div className="waiting-message">スタッフの「スタート！」を待ってね <i>→</i></div>
      </footer>
    </main>
  );
}

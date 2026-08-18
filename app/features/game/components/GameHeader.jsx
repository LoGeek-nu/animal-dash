import { Badge } from "../../../components/ui/atoms/Badge.jsx";
import { ConnectionBadge } from "../../../components/ui/molecules/ConnectionBadge.jsx";
import { PHASE_LABELS } from "../../../domain/race-session.js";

export function GameHeader({ phase }) {
  return (
    <header className="game-header">
      <div className="game-logo"><span>OUREISAI 2026</span><strong>ANIMAL DASH!</strong></div>
      <div className="game-header-status">
        <Badge className={`phase-chip phase-${phase.toLowerCase()}`}>{PHASE_LABELS[phase]}</Badge>
        <ConnectionBadge />
      </div>
    </header>
  );
}

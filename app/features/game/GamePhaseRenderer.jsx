import { AttractScreen } from "./screens/AttractScreen.jsx";
import { CountdownScreen } from "./screens/CountdownScreen.jsx";
import { RacingScreen } from "./screens/RacingScreen.jsx";
import { ResultsScreen } from "./screens/ResultsScreen.jsx";
import { WaitingScreen } from "./screens/WaitingScreen.jsx";

export function GamePhaseRenderer({ session, onFinished }) {
  switch (session.phase) {
    case "ATTRACT":
      return <AttractScreen key={session.sequence} revision={session.sequence} />;
    case "COUNTDOWN":
      return <CountdownScreen lanes={session.lanes} countdownEndsAt={session.countdownEndsAt} />;
    case "RACING":
      return <RacingScreen lanes={session.lanes} raceStartedAt={session.raceStartedAt} onFinished={onFinished} />;
    case "RESULTS":
      return <ResultsScreen results={session.results} resultsEndsAt={session.resultsEndsAt} />;
    default:
      return <WaitingScreen lanes={session.lanes} />;
  }
}

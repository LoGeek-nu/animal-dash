export type RacePhase = "ATTRACT" | "WAITING" | "COUNTDOWN" | "RACING" | "RESULTS" | "RECOVERY";

export type CharacterStats = {
  speed: number;
  acceleration: number;
  jump: number;
  stamina: number;
};

export type RaceCharacter = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  pale: string;
  preset: string;
  caption: string;
  stats: CharacterStats;
};

export type LaneAssignment = {
  characterId: string;
  isBot: boolean;
};

export type RaceResult = {
  characterId: string;
  lane: number;
  rank: number;
  finishMs: number | null;
  isBot: boolean;
};

export type RaceSession = {
  version: 2;
  sequence: number;
  sessionId: string;
  phase: RacePhase;
  lanes: Array<LaneAssignment | null>;
  lastSync: number;
  courseSeed: string;
  countdownEndsAt: number | null;
  raceStartedAt: number | null;
  resultsEndsAt: number | null;
  results: RaceResult[];
};

export const laneColors = ["#ff6b8a", "#f5b82e", "#55d6be", "#6b8cff"];

export const characters: RaceCharacter[] = [
  { id: "momo", name: "ももラビ", emoji: "🐰", color: "#ff6b8a", pale: "#ffe1e8", preset: "スピード", caption: "風よりはやい元気うさぎ", stats: { speed: 9, acceleration: 8, jump: 7, stamina: 6 } },
  { id: "toramaru", name: "トラまる", emoji: "🐯", color: "#f5b82e", pale: "#fff0bc", preset: "バランス", caption: "どんな道もへっちゃら", stats: { speed: 7, acceleration: 7, jump: 7, stamina: 8 } },
  { id: "keroppin", name: "けろっぴん", emoji: "🐸", color: "#55d6be", pale: "#d8f8f1", preset: "ジャンプ", caption: "ぴょーんと空までひとっとび", stats: { speed: 6, acceleration: 7, jump: 10, stamina: 7 } },
  { id: "panko", name: "ぱんこぐま", emoji: "🐻", color: "#b8875b", pale: "#f3e2d0", preset: "スタミナ", caption: "さいごまであきらめない", stats: { speed: 6, acceleration: 6, jump: 6, stamina: 10 } },
  { id: "kon", name: "こんこん", emoji: "🦊", color: "#ff8a4c", pale: "#ffe2d1", preset: "ダッシュ", caption: "スタートダッシュの天才", stats: { speed: 8, acceleration: 10, jump: 6, stamina: 6 } },
  { id: "penta", name: "ぺんた", emoji: "🐧", color: "#5a9ad8", pale: "#ddecfa", preset: "バランス", caption: "つるりと華麗に駆けぬける", stats: { speed: 7, acceleration: 7, jump: 8, stamina: 7 } },
  { id: "koro", name: "コロすけ", emoji: "🐶", color: "#a87950", pale: "#f4e5d7", preset: "スタミナ", caption: "走るのだいすき一直線", stats: { speed: 7, acceleration: 6, jump: 6, stamina: 9 } },
  { id: "azuki", name: "あずき", emoji: "🐱", color: "#9b72cf", pale: "#ece2f8", preset: "ジャンプ", caption: "身軽なジャンプで大逆転", stats: { speed: 7, acceleration: 8, jump: 9, stamina: 6 } },
  { id: "dorami", name: "どらみん", emoji: "🐲", color: "#57a75d", pale: "#def1df", preset: "パワー", caption: "障害物なんてこわくない", stats: { speed: 7, acceleration: 6, jump: 7, stamina: 8 } },
  { id: "fuwa", name: "ふわりん", emoji: "🐑", color: "#ec88aa", pale: "#fae1ea", preset: "バランス", caption: "ふわふわマイペース", stats: { speed: 6, acceleration: 8, jump: 8, stamina: 8 } },
];

export const staticRanking = [
  { characterId: "kon", finishMs: 28420 },
  { characterId: "momo", finishMs: 29180 },
  { characterId: "azuki", finishMs: 30460 },
  { characterId: "toramaru", finishMs: 31820 },
  { characterId: "koro", finishMs: 32760 },
  { characterId: "dorami", finishMs: 33910 },
  { characterId: "penta", finishMs: 34680 },
  { characterId: "keroppin", finishMs: 35940 },
  { characterId: "fuwa", finishMs: 37120 },
  { characterId: "panko", finishMs: 38960 },
];

export const getCharacter = (id: string) => characters.find((character) => character.id === id) ?? characters[0];

export function createInitialSession(): RaceSession {
  return {
    version: 2,
    sequence: 1,
    sessionId: "session_demo01",
    phase: "ATTRACT",
    lanes: [
      { characterId: "momo", isBot: false },
      { characterId: "toramaru", isBot: false },
      null,
      null,
    ],
    lastSync: Date.UTC(2026, 7, 19, 10, 0, 0),
    courseSeed: "oureisai-2026-demo",
    countdownEndsAt: null,
    raceStartedAt: null,
    resultsEndsAt: null,
    results: [],
  };
}

export function formatTime(ms: number | null) {
  if (ms === null) return "DNF";
  return `${(ms / 1000).toFixed(2)}s`;
}

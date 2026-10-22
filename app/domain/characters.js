import { getGeneratedCharacters } from "./generated-characters.js";

/** @typedef {{speed:number, acceleration:number, stamina:number}} CharacterStats */
/** @typedef {{id:string, name:string, emoji:string, color:string, pale:string, preset:string, caption:string, stats:CharacterStats}} RaceCharacter */

export const laneColors = ["#ff6b8a", "#f5b82e", "#55d6be", "#6b8cff"];

// Every character, built-in or generated, splits the same total across three stats of 1–20.
export const STAT_MIN = 1;
export const STAT_MAX = 20;
export const STAT_TOTAL = 40;
const BALANCED_SPREAD = 3;

// One rule for every character: even stats are バランス, otherwise the strongest stat names the type
// (ties go speed, then acceleration, then stamina).
export function characterType({ speed, acceleration, stamina }) {
  if (Math.max(speed, acceleration, stamina) - Math.min(speed, acceleration, stamina) <= BALANCED_SPREAD) return "バランス";
  if (speed >= acceleration && speed >= stamina) return "スピード";
  if (acceleration >= stamina) return "ダッシュ";
  return "スタミナ";
}

/** @type {RaceCharacter[]} */
export const characters = [
  { id: "momo", name: "ももラビ", emoji: "🐰", color: "#ff6b8a", pale: "#ffe1e8", caption: "風よりはやい元気うさぎ", stats: { speed: 18, acceleration: 12, stamina: 10 } },
  { id: "toramaru", name: "トラまる", emoji: "🐯", color: "#f5b82e", pale: "#fff0bc", caption: "どんな道もへっちゃら", stats: { speed: 14, acceleration: 13, stamina: 13 } },
  { id: "panko", name: "ぱんこぐま", emoji: "🐻", color: "#b8875b", pale: "#f3e2d0", caption: "さいごまであきらめない", stats: { speed: 11, acceleration: 10, stamina: 19 } },
  { id: "kon", name: "こんこん", emoji: "🦊", color: "#ff8a4c", pale: "#ffe2d1", caption: "スタートダッシュの天才", stats: { speed: 12, acceleration: 18, stamina: 10 } },
  { id: "penta", name: "ぺんた", emoji: "🐧", color: "#5a9ad8", pale: "#ddecfa", caption: "つるりと華麗に駆けぬける", stats: { speed: 13, acceleration: 14, stamina: 13 } },
  { id: "azuki", name: "あずき", emoji: "🐱", color: "#9b72cf", pale: "#ece2f8", caption: "身軽なジャンプで大逆転", stats: { speed: 12, acceleration: 16, stamina: 12 } },
  { id: "dorami", name: "どらみん", emoji: "🐲", color: "#57a75d", pale: "#def1df", caption: "障害物なんてこわくない", stats: { speed: 13, acceleration: 9, stamina: 18 } },
  { id: "fuwa", name: "ふわりん", emoji: "🐑", color: "#ec88aa", pale: "#fae1ea", caption: "ふわふわマイペース", stats: { speed: 12, acceleration: 14, stamina: 14 } },
].map((character) => ({ ...character, preset: characterType(character.stats) }));

// Removed from the roster; a room saved before the removal may still hold them in a lane.
export const retiredCharacterIds = ["keroppin", "koro"];

// Built-in characters are run by the computer; visitors race with the characters they draw.
export function isBuiltInCharacterId(id) {
  return characters.some((character) => character.id === id);
}

export function getCharacter(id) {
  return characters.find((character) => character.id === id)
    ?? getGeneratedCharacters().find((character) => character.id === id)
    ?? characters[0];
}

export function isKnownCharacterId(id) {
  return characters.some((character) => character.id === id)
    || getGeneratedCharacters().some((character) => character.id === id);
}

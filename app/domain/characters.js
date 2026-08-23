/** @typedef {{speed:number, acceleration:number, stamina:number}} CharacterStats */
/** @typedef {{id:string, name:string, emoji:string, color:string, pale:string, preset:string, caption:string, stats:CharacterStats}} RaceCharacter */

export const laneColors = ["#ff6b8a", "#f5b82e", "#55d6be", "#6b8cff"];

/** @type {RaceCharacter[]} */
export const characters = [
  { id: "momo", name: "ももラビ", emoji: "🐰", color: "#ff6b8a", pale: "#ffe1e8", preset: "スピード", caption: "風よりはやい元気うさぎ", stats: { speed: 9, acceleration: 8, stamina: 6 } },
  { id: "toramaru", name: "トラまる", emoji: "🐯", color: "#f5b82e", pale: "#fff0bc", preset: "バランス", caption: "どんな道もへっちゃら", stats: { speed: 7, acceleration: 7, stamina: 8 } },
  { id: "keroppin", name: "けろっぴん", emoji: "🐸", color: "#55d6be", pale: "#d8f8f1", preset: "ジャンプ", caption: "ぴょーんと空までひとっとび", stats: { speed: 6, acceleration: 7, stamina: 7 } },
  { id: "panko", name: "ぱんこぐま", emoji: "🐻", color: "#b8875b", pale: "#f3e2d0", preset: "スタミナ", caption: "さいごまであきらめない", stats: { speed: 6, acceleration: 6, stamina: 10 } },
  { id: "kon", name: "こんこん", emoji: "🦊", color: "#ff8a4c", pale: "#ffe2d1", preset: "ダッシュ", caption: "スタートダッシュの天才", stats: { speed: 8, acceleration: 10, stamina: 6 } },
  { id: "penta", name: "ぺんた", emoji: "🐧", color: "#5a9ad8", pale: "#ddecfa", preset: "バランス", caption: "つるりと華麗に駆けぬける", stats: { speed: 7, acceleration: 7, stamina: 7 } },
  { id: "koro", name: "コロすけ", emoji: "🐶", color: "#a87950", pale: "#f4e5d7", preset: "スタミナ", caption: "走るのだいすき一直線", stats: { speed: 7, acceleration: 6, stamina: 9 } },
  { id: "azuki", name: "あずき", emoji: "🐱", color: "#9b72cf", pale: "#ece2f8", preset: "ジャンプ", caption: "身軽なジャンプで大逆転", stats: { speed: 7, acceleration: 8, stamina: 6 } },
  { id: "dorami", name: "どらみん", emoji: "🐲", color: "#57a75d", pale: "#def1df", preset: "パワー", caption: "障害物なんてこわくない", stats: { speed: 7, acceleration: 6, stamina: 8 } },
  { id: "fuwa", name: "ふわりん", emoji: "🐑", color: "#ec88aa", pale: "#fae1ea", preset: "バランス", caption: "ふわふわマイペース", stats: { speed: 6, acceleration: 8, stamina: 8 } },
];

export function getCharacter(id) {
  return characters.find((character) => character.id === id) ?? characters[0];
}

export const ATTRACT_SCENES = [
  { id: "hero", label: "アニマルダッシュ！", caption: "動物たちが大集合！", duration: 9_000 },
  { id: "demo", label: "遊び方をおぼえよう！", caption: "使うボタンは2つだけ", duration: 21_000 },
  { id: "ranking", label: "今日のランキング", caption: "今日のトップ10", duration: 11_000 },
];

export const TUTORIAL_STEP_DURATION = 7_000;

export const tutorialSteps = [
  { id: "jump", number: "01", label: "赤ボタンでジャンプ", title: "障害物の手前でジャンプ！", copy: "少し手前で押すのがコツ", buttons: ["jump"], prompt: "いま押す！", characterId: "momo", obstacleType: "rock" },
  { id: "boost", number: "02", label: "青ボタンでブースト", title: "長押しでスピードアップ！", copy: "ゲージが空になる前に休もう", buttons: ["boost"], prompt: "長押し！", characterId: "toramaru" },
  { id: "goal", number: "03", label: "2つを使い分けよう", title: "使い分けて1位をめざそう！", copy: "最後まで障害物をかわしてゴール", buttons: ["jump", "boost"], prompt: "使い分け！", characterId: "penta", obstacleType: "hurdle" },
];

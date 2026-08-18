export const ATTRACT_SCENES = [
  { id: "hero", label: "ANIMAL PARADE", duration: 9_000 },
  { id: "demo", label: "DEMO RACE", duration: 21_000 },
  { id: "ranking", label: "TODAY'S RANKING", duration: 11_000 },
];

export const TUTORIAL_STEP_DURATION = 7_000;

export const tutorialSteps = [
  {
    id: "jump",
    number: "01",
    label: "JUMP",
    title: "障害物の手前でジャンプ！",
    copy: "少し手前で押すのがコツ",
    button: "JUMP",
    characterId: "momo",
    obstacleId: "garden-rock",
  },
  {
    id: "boost",
    number: "02",
    label: "BOOST",
    title: "長押しでスピードアップ！",
    copy: "ゲージが空になる前に休もう",
    button: "BOOST",
    characterId: "toramaru",
    obstacleId: "garden-hay",
  },
  {
    id: "goal",
    number: "03",
    label: "GOAL",
    title: "使い分けて1位をめざそう！",
    copy: "最後のハードルを越えてゴール",
    button: "JUMP + BOOST",
    characterId: "keroppin",
    obstacleId: "final-hurdle",
  },
];

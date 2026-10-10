import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadRankingViews } from "./helpers/render-rankings.mjs";

const character = (id, name) => ({ id, name, generated: true, imageUrl: `/api/characters/${id}/image`, color: "#55d6be", pale: "#d8f8f1", preset: "スピード" });
const entry = (id, name, rank, finishMs) => ({ characterId: id, displayName: name, character: character(id, name), rank, finishMs });
const rankings = [entry("gen-first", "生成キャラクターA", 1, 30123), entry("gen-tied", "生成キャラクターB", 1, 30123), entry("gen-third", "生成キャラクターC", 3, 31001)];
const board = (status = "ready", rows = rankings) => ({ status, date: "2026-10-10", rankings: rows, retry() {} });
const results = [{ characterId: "momo", lane: 1, rank: 1, finishMs: 32345, isBot: false },
  { characterId: "toramaru", lane: 2, rank: 2, finishMs: null, isBot: true }];

test("both boards render API ranks, snapshot character images, date and exact seconds", async (t) => {
  const { ResultsBoardView, AttractRankingView } = await loadRankingViews(t);
  for (const html of [renderToStaticMarkup(createElement(ResultsBoardView, { results, board: board() })),
    renderToStaticMarkup(createElement(AttractRankingView, { board: board() }))]) {
    assert.match(html, /2026\.10\.10/);
    assert.match(html, /日本時間/);
    assert.match(html, /クリアタイム（秒）/);
    assert.match(html, /30\.123秒/);
    assert.match(html, /生成キャラクターA/);
    assert.match(html, /\/api\/characters\/gen-first\/image/);
    assert.equal((html.match(/class="[^"]*rank-1"/g) ?? []).length, 2);
    assert.match(html, /rank-3/);
    assert.doesNotMatch(html, /2026\.08\.19|28\.420/);
  }
});

test("this race keeps its own confirmed time and clearly marks uncompleted BOT runners DNF", async (t) => {
  const { ResultsBoardView } = await loadRankingViews(t);
  const html = renderToStaticMarkup(createElement(ResultsBoardView, { results, board: board() }));
  assert.match(html, /32\.345秒/);
  assert.match(html, /DNF：未完走/);
  assert.match(html, /<time>DNF<\/time>/);
  assert.match(html, /BOT/);
  assert.doesNotMatch(html, /0\.000秒/);
});

test("loading, pending, empty and failed boards show state messages without displaying stale rankings", async (t) => {
  const { ResultsBoardView, AttractRankingView } = await loadRankingViews(t);
  const states = [[board("loading"), "読み込んでいます"], [board("pending"), "記録を反映"],
    [board("error"), "取得できません"], [board("ready", []), "完走記録がありません"]];
  for (const [state, message] of states) {
    for (const html of [renderToStaticMarkup(createElement(ResultsBoardView, { results, board: state })),
      renderToStaticMarkup(createElement(AttractRankingView, { board: state }))]) {
      assert.ok(html.includes(message));
      assert.doesNotMatch(html, /生成キャラクターA|30\.123秒|CROWN/);
      if (state.status === "error") { assert.match(html, /role="alert"/); assert.match(html, /再読み込み/); }
    }
  }
});

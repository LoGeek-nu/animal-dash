import { build } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";

export async function loadRankingViews(t) {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const scratch = join(root, ".wrangler");
  await mkdir(scratch, { recursive: true });
  const dir = await mkdtemp(join(scratch, "ranking-render-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = await build({ stdin: { contents: `
    export { ResultsBoardView } from './app/features/game/components/ResultsBoard.jsx';
    export { AttractRankingView } from './app/features/game/components/AttractRanking.jsx';
  `, resolveDir: root, loader: "js" }, bundle: true, write: false, format: "esm", platform: "node",
    packages: "external", jsx: "automatic", logLevel: "silent" });
  const path = join(dir, "boards.mjs");
  await writeFile(path, output.outputFiles[0].text);
  return import(pathToFileURL(path).href);
}

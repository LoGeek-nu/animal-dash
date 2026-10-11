import { unlink } from "node:fs/promises";

try {
  await unlink(new URL("../next-env.d.ts", import.meta.url));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

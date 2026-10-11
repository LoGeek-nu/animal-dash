import { pointerWithin, rectIntersection } from "@dnd-kit/core";

export function laneOnlyCollisionDetection(args) {
  const hits = args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
  return hits.filter(({ id }) => String(id).startsWith("lane-"));
}

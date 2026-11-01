"use client";

import { useEffect, useRef } from "react";

export function CharacterPageEnd({ selection, rootRef }) {
  const endRef = useRef(null);
  const { loading, error, hasMore, loadMore, query, filteredCharacters, retry } = selection;
  useEffect(() => {
    const root = rootRef.current;
    // This is a scroll container, shared by the cards and this sentinel.
    root.scrollTop = 0;
  }, [query, rootRef]);
  useEffect(() => {
    if (loading || error || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadMore();
    }, { root: rootRef.current, rootMargin: "100px" });
    observer.observe(endRef.current);
    return () => observer.disconnect();
  }, [loading, error, hasMore, loadMore, rootRef, filteredCharacters.length]);
  return <div ref={endRef} className="character-page-end" role="status" aria-live="polite">
    {loading ? "読み込み中…" : error ? <>{error} <button type="button" onClick={retry}>再試行</button></>
      : !filteredCharacters.length ? "該当するキャラクターがいません。" : !hasMore ? "すべて表示しました" : ""}
  </div>;
}

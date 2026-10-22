"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../../../components/ui/atoms/Button.jsx";
import { CharacterAvatar } from "../../../components/ui/molecules/CharacterAvatar.jsx";
import { addGeneratedCharacter } from "../../../domain/generated-characters.js";
import { AdminModal } from "./AdminModal.jsx";
import { AdminHeader } from "./AdminHeader.jsx";
import { AdminStatusBar } from "./AdminStatusBar.jsx";
import { MobileStats } from "./MobileAdminWorkspace.jsx";

const MAX_DIMENSION = 1600;
// Gemini usually answers in 10–20s. Past this the staff are told it is busy; past the limit the request is dropped.
const SLOW_NOTICE_SECONDS = 25;
const CLIENT_TIMEOUT_MS = 60_000;

async function resizeImageFile(file, maxDimension) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("canvas toBlob failed")), "image/jpeg", 0.85);
  });
}

export function CharacterGenerateDialog({ onClose, session, ready, syncStatus }) {
  const [stage, setStage] = useState("idle");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (stage !== "loading") return undefined;
    const startedAt = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  const handleFileChange = async (event) => {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;

    try {
      const resized = await resizeImageFile(picked, MAX_DIMENSION);
      setFile(resized);
      setPreviewUrl(URL.createObjectURL(resized));
      setError(null);
      setStage("preview");
    } catch {
      setError({ message: "画像の読み込みに失敗しました。別の画像を試してください。", retryable: false });
      setStage("error");
    }
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    setCreated(null);
    setStage("idle");
  };

  const close = () => {
    requestRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  };

  const submit = async () => {
    if (!file || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, CLIENT_TIMEOUT_MS);
    setStage("loading");
    try {
      const formData = new FormData();
      formData.append("image", file, "capture.jpg");
      const response = await fetch("/api/characters/generate", { method: "POST", body: formData, signal: controller.signal });
      const body = await response.json();
      if (controller.signal.aborted) return;

      if (!response.ok) {
        setError({ message: body.detail ?? body.error ?? "生成に失敗しました。", retryable: body.retryable === true });
        setStage("error");
        return;
      }

      addGeneratedCharacter(body);
      setCreated(body);
      setStage("done");
    } catch {
      if (timedOut) {
        setError({ message: "時間がかかりすぎたため中断しました。もう一度試してください。", retryable: true });
        setStage("error");
        return;
      }
      if (controller.signal.aborted) return;
      setError({ message: "通信に失敗しました。ネットワークを確認してください。", retryable: true });
      setStage("error");
    } finally {
      window.clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  return (
    <AdminModal title={stage === "preview" ? "撮影画像の確認" : stage === "done" ? "キャラクターができました！" : "キャラクターを撮影して追加"} onClose={close} className={`generate-dialog ${stage === "idle" ? "mobile-capture-entry-dialog" : "mobile-generation-dialog"}`}>
        {session && <div className="mobile-capture-header"><AdminHeader ready={ready} syncStatus={syncStatus} /><AdminStatusBar session={session} participantCount={session.lanes.filter(Boolean).length} /></div>}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />

        {stage === "idle" && (
          <>
            <p>動物の絵を撮影するか、画像を選んでください。</p>
            <div className="generate-dialog-actions">
              <Button variant="secondary" onClick={close}>キャンセル</Button>
              <Button variant="primary" onClick={() => inputRef.current?.click()}>撮影 / 選択する</Button>
            </div>
          </>
        )}

        {stage === "preview" && previewUrl && (
          <>
            <p className="mobile-capture-copy">動物の絵が写っているか確認してください。</p>
            <img className="generate-dialog-preview" src={previewUrl} alt="選択した画像のプレビュー" />
            <p className="mobile-capture-copy">この画像からキャラクターを生成します。</p>
            <div className="generate-dialog-actions">
              <Button variant="secondary" onClick={retake}>撮り直す・選び直す</Button>
              <Button variant="primary" onClick={submit}>この画像で生成する</Button>
            </div>
            <small className="mobile-capture-copy">生成には10〜20秒ほどかかります。</small>
          </>
        )}

        {stage === "loading" && (
          <>
            <div className="generate-dialog-spinner" aria-hidden="true" />
            <p role="status">生成中です…（{elapsed}秒）<br />{elapsed < SLOW_NOTICE_SECONDS ? "10〜20秒ほどお待ちください。" : "混み合っているようです。もう少しお待ちください。"}</p>
          </>
        )}

        {stage === "done" && created && (
          <div className="generate-dialog-result">
            <CharacterAvatar character={created} />
            <h3>{created.name}</h3>
            <p>{created.preset}タイプ<br />{created.caption}</p>
            <MobileStats character={created} />
            <p>キャラクター一覧に追加しました。レーンにセットして遊べます。</p>
            <div className="generate-dialog-actions">
              <Button variant="secondary" onClick={retake}>もう1体撮影する</Button>
              <Button variant="primary" onClick={close}>OK</Button>
            </div>
          </div>
        )}

        {stage === "error" && (
          <>
            <p className="generate-dialog-error">{error?.message}</p>
            {error?.retryable && (
              <div className="generate-dialog-actions">
                <Button variant="secondary" onClick={close}>閉じる</Button>
                <Button variant="primary" onClick={submit}>もう一度試す</Button>
              </div>
            )}
          </>
        )}
    </AdminModal>
  );
}

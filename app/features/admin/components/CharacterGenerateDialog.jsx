"use client";

import { useRef, useState } from "react";
import { Button } from "../../../components/ui/atoms/Button.jsx";
import { addGeneratedCharacter } from "../../../domain/generated-characters.js";

const MAX_DIMENSION = 1600;

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

export function CharacterGenerateDialog({ onClose }) {
  const [stage, setStage] = useState("idle");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

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
    setStage("idle");
  };

  const close = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onClose();
  };

  const submit = async () => {
    if (!file) return;
    setStage("loading");
    try {
      const formData = new FormData();
      formData.append("image", file, "capture.jpg");
      const response = await fetch("/api/characters/generate", { method: "POST", body: formData });
      const body = await response.json();

      if (!response.ok) {
        setError({ message: body.detail ?? body.error ?? "生成に失敗しました。", retryable: body.retryable === true });
        setStage("error");
        return;
      }

      addGeneratedCharacter(body);
      close();
    } catch {
      setError({ message: "通信に失敗しました。ネットワークを確認してください。", retryable: true });
      setStage("error");
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="generate-dialog" role="dialog" aria-modal="true" aria-labelledby="generate-dialog-title">
        <h2 id="generate-dialog-title">キャラクターを撮影して追加</h2>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
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
            <img className="generate-dialog-preview" src={previewUrl} alt="選択した画像のプレビュー" />
            <div className="generate-dialog-actions">
              <Button variant="secondary" onClick={retake}>選び直す</Button>
              <Button variant="primary" onClick={submit}>この画像で生成する</Button>
            </div>
          </>
        )}

        {stage === "loading" && (
          <>
            <div className="generate-dialog-spinner" aria-hidden="true" />
            <p>生成中です…10〜20秒ほどお待ちください。</p>
          </>
        )}

        {stage === "error" && (
          <>
            <p className="generate-dialog-error">{error?.message}</p>
            <div className="generate-dialog-actions">
              <Button variant="secondary" onClick={close}>閉じる</Button>
              {error?.retryable && <Button variant="primary" onClick={submit}>もう一度試す</Button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

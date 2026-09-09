"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { uploadDocument } from "@/lib/api";

type Status = "idle" | "uploading" | "done" | "error";

export default function UploadDropzone() {
  const [status, setStatus] = useState<Status>("idle");
  const [chunks, setChunks] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputId = useId();

  async function handleFile(file: File) {
    setStatus("uploading");
    setErrorMessage(null);
    try {
      const result = await uploadDocument(file);
      setChunks(result.chunks);
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "업로드에 실패했어요.");
      setStatus("error");
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (isBusy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  }

  const isBusy = status === "uploading";

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={onDrop}
        className={
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center shadow-sm transition-colors " +
          (isDragActive
            ? "border-primary bg-primary/5"
            : "border-line bg-paper hover:border-primary/60")
        }
      >
        <span aria-hidden className="text-3xl">
          📄
        </span>
        <p className="font-body text-sm text-ink">
          여기에 PDF를 끌어다 놓으세요
          <br />
          <label
            htmlFor={inputId}
            className="cursor-pointer font-medium text-primary underline underline-offset-2"
          >
            또는 클릭해서 파일 고르기
          </label>
        </p>
        <input
          id={inputId}
          type="file"
          accept="application/pdf"
          onChange={onInputChange}
          disabled={isBusy}
          className="sr-only"
        />
      </div>

      <p aria-live="polite" className="font-mono text-xs text-muted">
        {status === "idle" && "아직 올린 파일이 없어요."}
        {status === "uploading" && "올리는 중…"}
        {status === "done" && (
          <>
            문장 {chunks}개를 담았어요! 🎉{" "}
            <Link href="/ask" className="text-primary hover:underline">
              질문하러 가기 →
            </Link>
          </>
        )}
        {status === "error" && (
          <span className="font-medium text-ink">
            앗, 문제가 생겼어요 — {errorMessage}
          </span>
        )}
      </p>
    </div>
  );
}

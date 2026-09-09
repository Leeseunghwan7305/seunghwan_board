"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { uploadDocument } from "@/lib/api";

type Status = "idle" | "uploading" | "done" | "error";

export default function UploadDropzone() {
  const [status, setStatus] = useState<Status>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [chunks, setChunks] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function handleFile(file: File) {
    setFileName(file.name);
    setStatus("uploading");
    setErrorMessage(null);
    try {
      const result = await uploadDocument(file);
      setChunks(result.chunks);
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed.");
      setStatus("error");
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
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
          "flex flex-col items-center gap-3 rounded-md border px-6 py-10 text-center transition-colors " +
          (isDragActive
            ? "border-primary"
            : "border-line hover:border-primary")
        }
      >
        <p className="font-body text-sm text-ink">
          Drop a PDF here, or{" "}
          <label
            htmlFor={inputId}
            className="cursor-pointer font-medium text-primary underline underline-offset-2"
          >
            choose a file
          </label>
          .
        </p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="application/pdf"
          onChange={onInputChange}
          disabled={isBusy}
          className="sr-only"
        />
      </div>

      <p aria-live="polite" className="font-mono text-xs text-muted">
        {status === "idle" && "No file yet — drop a PDF to start."}
        {status === "uploading" && `Uploading ${fileName}…`}
        {status === "done" && (
          <>
            Indexed {chunks} passages.{" "}
            <Link href="/ask" className="text-primary hover:underline">
              Ask a question →
            </Link>
          </>
        )}
        {status === "error" && (
          <span className="font-medium text-ink">Error: {errorMessage}</span>
        )}
      </p>
    </div>
  );
}

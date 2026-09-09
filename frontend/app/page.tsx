"use client";

import { useEffect, useId, useRef, useState } from "react";
import EvidenceCard from "@/components/EvidenceCard";
import MetricDumbbell from "@/components/MetricDumbbell";
import {
  ask,
  getLatestEval,
  runEval,
  uploadDocument,
  type Citation,
  type EvalResult,
} from "@/lib/api";
import { METRIC_LABELS } from "@/lib/format";

// 백엔드가 근거를 못 찾았을 때 그대로 돌려주는 문자열입니다.
// 화면에는 더 다정한 문구를 보여주지만, 판정은 이 값과 정확히 비교해야 해요.
const NO_EVIDENCE = "문서에 근거가 없습니다.";

const EXAMPLE_QUESTIONS = [
  "환불 며칠 안에 돼요?",
  "배송 얼마나 걸려요?",
  "교환 가능해요?",
] as const;

type UploadStatus = "idle" | "uploading" | "error";
type AskStatus = "idle" | "asking" | "error";

type HistoryEntry = {
  id: string;
  question: string;
  answer: string;
  citations: Citation[];
};

// entry.citations 순서대로, 처음 등장하는 각 page에 1부터 번호를 매깁니다.
// 예: citations의 page가 [3, 3, 5, 1] 이면 refIndex는 {3: 1, 5: 2, 1: 3}.
function buildRefIndex(citations: Citation[]): Map<number, number> {
  const refIndex = new Map<number, number>();
  for (const citation of citations) {
    if (!refIndex.has(citation.page)) {
      refIndex.set(citation.page, refIndex.size + 1);
    }
  }
  return refIndex;
}

function renderAnswer(answer: string, refIndex: Map<number, number>) {
  const parts = answer.split(/(\[p\.\d+\])/g);
  return parts.map((part, index) => {
    const match = /^\[p\.(\d+)\]$/.exec(part);
    if (!match) return <span key={index}>{part}</span>;
    const page = Number(match[1]);
    const ref = refIndex.get(page);
    if (ref === undefined) {
      // 안전한 대비책: 매핑에 없는 인용은 원문 그대로 보여줘요.
      return <span key={index}>{part}</span>;
    }
    return (
      <sup
        key={index}
        className="mx-0.5 inline-flex h-[1.3em] min-w-[1.3em] align-super items-center justify-center rounded-full bg-primary/15 px-1 font-mono text-[0.7em] font-medium text-primary"
      >
        {ref}
      </sup>
    );
  });
}

export default function Home() {
  // 업로드 상태
  const [doc, setDoc] = useState<{ chunks: number } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputId = useId();

  // 질문 상태
  const [question, setQuestion] = useState("");
  const [askStatus, setAskStatus] = useState<AskStatus>("idle");
  const [askError, setAskError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const latestEntryRef = useRef<HTMLDivElement | null>(null);
  const historyLengthRef = useRef(0);

  // 평가 상태
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [evalLoadingInitial, setEvalLoadingInitial] = useState(true);
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const isUnlocked = doc !== null;
  const isUploading = uploadStatus === "uploading";

  useEffect(() => {
    let cancelled = false;
    getLatestEval()
      .then((latest) => {
        if (!cancelled) setEvalResult(latest);
      })
      .catch((err) => {
        if (!cancelled) {
          setEvalError(
            err instanceof Error ? err.message : "평가를 불러오지 못했어요."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setEvalLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (history.length > historyLengthRef.current) {
      latestEntryRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    historyLengthRef.current = history.length;
  }, [history]);

  async function handleFile(file: File) {
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      const result = await uploadDocument(file);
      setDoc({ chunks: result.chunks });
      setUploadStatus("idle");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "업로드에 실패했어요."
      );
      setUploadStatus("error");
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
    if (isUploading) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  }

  function resetUpload() {
    setDoc(null);
    setUploadStatus("idle");
    setUploadError(null);
  }

  async function handleAsk(overrideQuestion?: string) {
    const query = (overrideQuestion ?? question).trim();
    if (!query || askStatus === "asking" || !isUnlocked) return;

    setAskStatus("asking");
    setAskError(null);
    try {
      const result = await ask(query);
      setHistory((prev) => [
        {
          id: `${Date.now()}-${prev.length}`,
          question: query,
          answer: result.answer,
          citations: result.citations,
        },
        ...prev,
      ]);
      setQuestion("");
      setAskStatus("idle");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "질문에 실패했어요.");
      setAskStatus("error");
    }
  }

  function handleAskSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleAsk();
  }

  async function handleRunEval() {
    setEvalRunning(true);
    setEvalError(null);
    try {
      const next = await runEval();
      setEvalResult(next);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "평가에 실패했어요.");
    } finally {
      setEvalRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-12 motion-safe:animate-[fade-up_0.4s_ease-out]">
      {/* 히어로 */}
      <div className="flex flex-col items-center gap-4 pt-4 text-center sm:pt-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          <span className="gradient-text">문서에게 직접 물어보세요</span>
        </h1>
        <p className="max-w-md font-body text-sm text-muted sm:text-base">
          PDF를 올리면 AI가 그 문서에서 찾아 답하고, 근거 문장까지
          보여줘요.
        </p>
      </div>

      {/* 1. 업로드 영역 */}
      <section className="relative flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6">
        {!isUnlocked ? (
          <>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={onDrop}
              className={
                "relative flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors " +
                (isDragActive
                  ? "gradient-border border-transparent bg-primary/5"
                  : "border-line bg-paper hover:border-primary/60")
              }
            >
              <span aria-hidden className="text-2xl text-primary">
                ✦
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-body text-base font-medium text-ink">
                  먼저 PDF 한 개만 올려주세요
                </p>
                <p className="font-body text-sm text-muted">
                  여기로 끌어다 놓거나{" "}
                  <label
                    htmlFor={fileInputId}
                    className="cursor-pointer font-medium text-primary underline underline-offset-2"
                  >
                    클릭!
                  </label>
                </p>
              </div>
              <input
                id={fileInputId}
                type="file"
                accept="application/pdf"
                onChange={onInputChange}
                disabled={isUploading}
                className="sr-only"
              />
            </div>
            <p aria-live="polite" className="font-mono text-xs text-muted">
              {uploadStatus === "idle" && "아직 올린 파일이 없어요."}
              {uploadStatus === "uploading" && "올리는 중이에요…"}
              {uploadStatus === "error" && (
                <span className="font-medium text-ink">
                  앗, 안 됐어요 — {uploadError}
                </span>
              )}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 px-4 py-3">
            <p className="font-body text-sm font-medium text-ink">
              ✓ 문장 {doc.chunks}개 학습 완료 · 이제 무엇이든 물어보세요
            </p>
            <button
              type="button"
              onClick={resetUpload}
              className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 font-body text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              다시 올리기
            </button>
          </div>
        )}
      </section>

      {isUnlocked && (
        <>
          {/* 2. 질문 영역 */}
          <section className="flex flex-col gap-3">
            <form
              onSubmit={handleAskSubmit}
              className="focus-glow flex items-center gap-2 rounded-2xl border border-line bg-card p-2 shadow-sm transition-shadow"
            >
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="문서에게 무엇이든 물어보세요 ✦"
                aria-label="질문"
                disabled={askStatus === "asking"}
                className="flex-1 bg-transparent px-3 py-2.5 font-body text-base text-ink placeholder:text-muted focus:outline-none disabled:cursor-not-allowed disabled:text-muted"
              />
              <button
                type="submit"
                disabled={
                  askStatus === "asking" || question.trim().length === 0
                }
                aria-label="물어보기"
                className="gradient-cta shrink-0 rounded-full px-4 py-2.5 font-body text-sm font-medium text-paper transition-opacity disabled:opacity-40"
              >
                {askStatus === "asking" ? "…" : "↑"}
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleAsk(q)}
                  disabled={askStatus === "asking"}
                  className="rounded-full border border-line bg-card px-3 py-1.5 font-body text-xs text-muted transition-colors hover:border-primary/60 hover:text-ink disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>

            {askStatus === "asking" && (
              <p className="font-mono text-xs text-muted motion-safe:animate-shimmer-pulse">
                문서를 살펴보는 중…
              </p>
            )}

            {askStatus === "error" && askError && (
              <p className="font-body text-sm text-ink">
                앗, 문제가 생겼어요 — {askError}
              </p>
            )}
          </section>

          {/* 3. 답변 피드 */}
          {history.length > 0 && (
            <section className="flex flex-col gap-6">
              {history.map((entry, index) => {
                const hasNoEvidence =
                  entry.answer === NO_EVIDENCE || entry.citations.length === 0;
                const refIndex = buildRefIndex(entry.citations);
                return (
                  <div
                    key={entry.id}
                    ref={index === 0 ? latestEntryRef : undefined}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm sm:p-6"
                  >
                    <p className="font-mono text-xs text-muted">
                      Q. {entry.question}
                    </p>
                    {hasNoEvidence ? (
                      <p className="font-body text-base text-ink">
                        문서에서 관련 내용을 찾지 못했어요.
                      </p>
                    ) : (
                      <>
                        <p className="font-body text-base leading-relaxed text-ink">
                          {renderAnswer(entry.answer, refIndex)}
                        </p>
                        <div className="flex flex-col gap-3 pt-1">
                          <h3 className="font-mono text-xs uppercase tracking-wide text-muted">
                            출처
                          </h3>
                          <div className="flex flex-col gap-3">
                            {entry.citations.map((citation, i) => (
                              <EvidenceCard
                                key={`${citation.page}-${i}`}
                                citation={citation}
                                index={i + 1}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {/* 4. 품질 비교 영역 */}
          <section
            id="eval"
            className="flex scroll-mt-20 flex-col gap-4 border-t border-line pt-8"
          >
            <div className="flex flex-col gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                <span className="gradient-text">검색 성능 비교</span>
              </h2>
              <p className="max-w-xl font-body text-sm text-muted">
                벡터만 쓰는 dense와, 키워드·재정렬을 더한 hybrid를 RAGAS로
                측정해 비교해요.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRunEval}
              disabled={evalRunning || evalLoadingInitial}
              className="gradient-cta w-fit shrink-0 rounded-full px-5 py-3 font-body text-sm font-medium text-paper transition-opacity disabled:opacity-40"
            >
              {evalRunning ? "측정하는 중…" : "성능 측정하기"}
            </button>

            <div aria-live="polite" className="flex flex-col gap-4">
              {evalError && (
                <p className="font-body text-sm text-ink">
                  앗, 문제가 생겼어요 — {evalError}
                </p>
              )}

              {evalLoadingInitial && (
                <p className="font-mono text-xs text-muted">불러오는 중…</p>
              )}

              {!evalLoadingInitial && !evalResult && !evalRunning && (
                <p className="font-mono text-xs text-muted">
                  아직 측정 안 했어요. 한 번 볼까요?
                </p>
              )}

              {evalResult && (
                <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card px-5 py-6 shadow-sm">
                  {METRIC_LABELS.map(({ key, label }) => (
                    <MetricDumbbell
                      key={key}
                      label={label}
                      dense={evalResult.dense[key]}
                      hybrid={evalResult.hybrid[key]}
                    />
                  ))}
                  <div className="flex flex-wrap items-center gap-4 border-t border-line pt-4 font-mono text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full bg-muted"
                        aria-hidden
                      />
                      dense
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full bg-primary"
                        aria-hidden
                      />
                      hybrid
                    </span>
                    <span>오른쪽 = 개선폭</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

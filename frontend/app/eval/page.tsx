"use client";

import { useEffect, useState } from "react";
import { getLatestEval, runEval, type EvalResult } from "@/lib/api";
import { METRIC_LABELS } from "@/lib/format";
import MetricDumbbell from "@/components/MetricDumbbell";

export default function EvalPage() {
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLatestEval()
      .then((latest) => {
        if (!cancelled) setResult(latest);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error ? err.message : "평가를 불러오지 못했어요."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRun() {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const next = await runEval();
      setResult(next);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "평가에 실패했어요.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-[fade-up_0.4s_ease-out]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          검색 품질 비교
        </h1>
        <p className="max-w-2xl font-body text-base text-muted">
          벡터만 쓰는 dense와, 키워드·재정렬을 더한 hybrid를 RAGAS로 채점해
          비교해요.
        </p>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning || isLoadingInitial}
        className="w-fit shrink-0 rounded-full bg-primary px-5 py-3 font-body text-sm font-medium text-paper shadow-sm transition-opacity disabled:opacity-50"
      >
        {isRunning ? "dense와 hybrid를 채점하는 중…" : "평가 돌리기"}
      </button>

      <div aria-live="polite" className="flex flex-col gap-5">
        {errorMessage && (
          <p className="font-body text-sm text-ink">
            앗, 문제가 생겼어요 — {errorMessage}
          </p>
        )}

        {isLoadingInitial && (
          <p className="font-mono text-xs text-muted">불러오는 중…</p>
        )}

        {!isLoadingInitial && !result && !isRunning && (
          <p className="font-mono text-xs text-muted">
            아직 평가 결과가 없어요. 한 번 돌려볼까요?
          </p>
        )}

        {result && (
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-paper px-5 py-6 shadow-sm">
            {METRIC_LABELS.map(({ key, label }) => (
              <MetricDumbbell
                key={key}
                label={label}
                dense={result.dense[key]}
                hybrid={result.hybrid[key]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

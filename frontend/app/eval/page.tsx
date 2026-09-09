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
            err instanceof Error ? err.message : "Failed to load evaluation."
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
      setErrorMessage(err instanceof Error ? err.message : "Evaluation failed.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-[fade-up_0.4s_ease-out]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          Evaluation
        </h1>
        <p className="max-w-2xl font-body text-base text-muted">
          Dense retrieval (vector-only) vs hybrid (dense + keyword + rerank),
          scored with RAGAS.
        </p>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning || isLoadingInitial}
        className="w-fit shrink-0 rounded-md bg-primary px-5 py-3 font-body text-sm font-medium text-paper transition-opacity disabled:opacity-50"
      >
        {isRunning ? "Scoring dense vs hybrid…" : "Run evaluation"}
      </button>

      <div aria-live="polite" className="flex flex-col gap-5">
        {errorMessage && (
          <p className="font-body text-sm text-ink">
            <span className="font-medium">Error:</span> {errorMessage}
          </p>
        )}

        {isLoadingInitial && (
          <p className="font-mono text-xs text-muted">Loading…</p>
        )}

        {!isLoadingInitial && !result && !isRunning && (
          <p className="font-mono text-xs text-muted">
            No evaluation yet. Run one to compare retrieval strategies.
          </p>
        )}

        {result && (
          <div className="flex flex-col gap-5 rounded-md border border-line px-5 py-6">
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

"use client";

import { useState } from "react";
import { ask, type Citation } from "@/lib/api";
import EvidenceCard from "@/components/EvidenceCard";

type Status = "idle" | "asking" | "answered" | "error";

const NO_EVIDENCE_ANSWER = "문서에 근거가 없습니다.";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasNoEvidence =
    status === "answered" &&
    (answer === NO_EVIDENCE_ANSWER || citations.length === 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = question.trim();
    if (!query || status === "asking") return;

    setStatus("asking");
    setErrorMessage(null);
    try {
      const result = await ask(query);
      setAnswer(result.answer);
      setCitations(result.citations);
      setStatus("answered");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Ask failed.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-[fade-up_0.4s_ease-out]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          Ask
        </h1>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What do you want to know from this document?"
            aria-label="Question"
            disabled={status === "asking"}
            className="flex-1 rounded-md border border-line bg-paper px-4 py-3 font-body text-base text-ink placeholder:text-muted focus-visible:border-primary"
          />
          <button
            type="submit"
            disabled={status === "asking" || question.trim().length === 0}
            className="shrink-0 rounded-md bg-primary px-5 py-3 font-body text-sm font-medium text-paper transition-opacity disabled:opacity-50"
          >
            {status === "asking" ? "Asking…" : "Ask"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col gap-3" aria-live="polite">
          {status === "idle" && (
            <p className="font-mono text-xs text-muted">
              No question yet — ask something to see a cited answer.
            </p>
          )}
          {status === "asking" && (
            <div className="flex flex-col gap-2 motion-safe:animate-pulse">
              <div className="h-4 w-4/5 rounded bg-line" />
              <div className="h-4 w-3/5 rounded bg-line" />
              <div className="h-4 w-2/5 rounded bg-line" />
            </div>
          )}
          {status === "error" && (
            <p className="font-body text-sm text-ink">
              <span className="font-medium">Error:</span> {errorMessage}
            </p>
          )}
          {status === "answered" && answer !== null && (
            <p className="font-body text-lg leading-relaxed text-ink">
              {answer}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted">
            Evidence
          </h2>
          {status !== "answered" && (
            <p className="font-mono text-xs text-muted">
              Cited passages will appear here.
            </p>
          )}
          {hasNoEvidence && (
            <p className="font-mono text-xs text-muted">
              No supporting passage found.
            </p>
          )}
          {status === "answered" && !hasNoEvidence && (
            <div className="flex flex-col gap-3">
              {citations.map((citation, index) => (
                <EvidenceCard key={`${citation.page}-${index}`} citation={citation} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ask, type Citation } from "@/lib/api";
import EvidenceCard from "@/components/EvidenceCard";

type Status = "idle" | "asking" | "answered" | "error";

// 백엔드가 근거를 못 찾았을 때 그대로 돌려주는 문자열입니다.
// 화면에는 더 다정한 문구를 보여주지만, 판정은 이 값과 정확히 비교해야 해요.
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
      setErrorMessage(err instanceof Error ? err.message : "질문에 실패했어요.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-8 motion-safe:animate-[fade-up_0.4s_ease-out]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          질문하기
        </h1>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="이 문서에서 뭐가 궁금하세요?"
            aria-label="질문"
            disabled={status === "asking"}
            className="flex-1 rounded-full border border-line bg-paper px-5 py-3 font-body text-base text-ink placeholder:text-muted focus-visible:border-primary"
          />
          <button
            type="submit"
            disabled={status === "asking" || question.trim().length === 0}
            className="shrink-0 rounded-full bg-primary px-5 py-3 font-body text-sm font-medium text-paper shadow-sm transition-opacity disabled:opacity-50"
          >
            {status === "asking" ? "찾아보는 중…" : "물어보기"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col gap-3" aria-live="polite">
          {status === "idle" && (
            <p className="font-mono text-xs text-muted">
              아직 질문이 없어요 — 뭐든 물어보면 근거와 함께 답해드려요.
            </p>
          )}
          {status === "asking" && (
            <div className="flex flex-col gap-2 motion-safe:animate-pulse">
              <div className="h-4 w-4/5 rounded-full bg-line" />
              <div className="h-4 w-3/5 rounded-full bg-line" />
              <div className="h-4 w-2/5 rounded-full bg-line" />
            </div>
          )}
          {status === "error" && (
            <p className="font-body text-sm text-ink">
              앗, 문제가 생겼어요 — {errorMessage}
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
            근거
          </h2>
          {status !== "answered" && (
            <p className="font-mono text-xs text-muted">
              인용된 문장이 여기에 나타나요.
            </p>
          )}
          {hasNoEvidence && (
            <p className="font-mono text-xs text-muted">
              관련된 문장을 못 찾았어요.
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

import type { Metrics } from "./api";

export function scoreToPct(score: number): number {
  const clamped = Math.min(1, Math.max(0, score));
  return Math.round(clamped * 100);
}

export function metricDelta(dense: number, hybrid: number): string {
  const delta = hybrid - dense;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${Math.abs(delta).toFixed(2)}`;
}

export const METRIC_LABELS: { key: keyof Metrics; label: string }[] = [
  { key: "faithfulness", label: "충실도" },
  { key: "answer_relevancy", label: "답변 관련성" },
  { key: "context_precision", label: "문맥 정밀도" },
  { key: "context_recall", label: "문맥 재현율" },
];

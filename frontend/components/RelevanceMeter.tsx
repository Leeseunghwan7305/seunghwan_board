import { scoreToPct } from "@/lib/format";

export default function RelevanceMeter({ score }: { score: number }) {
  const pct = scoreToPct(score);

  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`관련도 ${score.toFixed(2)}`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-evidence transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted">
        {score.toFixed(2)}
      </span>
    </div>
  );
}

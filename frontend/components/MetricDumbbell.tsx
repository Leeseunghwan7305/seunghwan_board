import { metricDelta, scoreToPct } from "@/lib/format";

export default function MetricDumbbell({
  label,
  dense,
  hybrid,
}: {
  label: string;
  dense: number;
  hybrid: number;
}) {
  const densePct = scoreToPct(dense);
  const hybridPct = scoreToPct(hybrid);
  const delta = metricDelta(dense, hybrid);
  const improved = hybrid > dense;
  const left = Math.min(densePct, hybridPct);
  const width = Math.abs(hybridPct - densePct);

  return (
    <div className="flex items-center gap-4">
      <span className="w-36 shrink-0 font-body text-sm text-ink">{label}</span>

      <div
        role="img"
        aria-label={`${label}: dense ${dense.toFixed(2)}, hybrid ${hybrid.toFixed(2)}, 차이 ${delta}`}
        className="relative h-6 flex-1"
      >
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-line" />
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted/50 transition-[left,width] duration-300 motion-reduce:transition-none"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted transition-[left] duration-300 motion-reduce:transition-none"
          style={{ left: `${densePct}%` }}
        />
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_25%,transparent)] transition-[left] duration-300 motion-reduce:transition-none"
          style={{ left: `${hybridPct}%` }}
        />
      </div>

      <span
        className={
          "w-16 shrink-0 text-right font-mono text-sm tabular-nums " +
          (improved ? "text-primary" : "text-muted")
        }
      >
        {delta}
      </span>
    </div>
  );
}

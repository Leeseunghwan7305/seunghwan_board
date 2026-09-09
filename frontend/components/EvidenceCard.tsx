import type { Citation } from "@/lib/api";
import RelevanceMeter from "@/components/RelevanceMeter";

export default function EvidenceCard({
  citation,
  index,
}: {
  citation: Citation;
  index?: number;
}) {
  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 hover:border-primary/60">
      {typeof index === "number" && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-medium text-primary">
          {index}
        </span>
      )}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">
            p.{citation.page}
          </span>
        </div>
        <p className="font-body text-sm leading-relaxed text-ink">
          {citation.snippet}
        </p>
        <RelevanceMeter score={citation.score} />
      </div>
    </article>
  );
}

import type { Citation } from "@/lib/api";
import RelevanceMeter from "@/components/RelevanceMeter";

export default function EvidenceCard({ citation }: { citation: Citation }) {
  return (
    <article className="flex overflow-hidden rounded-md border border-line bg-paper transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 hover:border-primary/60">
      <div className="flex w-12 shrink-0 items-start justify-center border-r border-line bg-ink/[0.03] py-3">
        <span className="font-mono text-xs text-muted">p.{citation.page}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        <p className="font-body text-sm leading-relaxed text-ink">
          {citation.snippet}
        </p>
        <RelevanceMeter score={citation.score} />
      </div>
    </article>
  );
}

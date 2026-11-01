import type { Notice } from "@/types/notice";
import { Badge } from "@/components/ui/badge";

export const NoticeEnrichment = ({ notice }: { notice: Notice }) => {
  const strings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [];
  const deadlines = Array.isArray(notice.aiDeadlines)
    ? notice.aiDeadlines.filter(
        (item) =>
          item &&
          typeof item.label === "string" &&
          typeof item.when === "string" &&
          typeof item.sourceQuote === "string",
      )
    : [];
  const actions = strings(notice.aiActionItems);
  const highlights = strings(notice.aiKeyHighlights);
  const tags = strings(notice.aiTags);
  const hasExtracted =
    deadlines.length + actions.length + highlights.length + tags.length > 0;
  if (!notice.aiSummary && !hasExtracted) return null;

  return (
    <section
      aria-label="Notice highlights"
      className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4"
    >
      {notice.aiSummary && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            Summary
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {notice.aiSummary}
          </p>
        </div>
      )}
      {hasExtracted && (
        <p className="text-xs text-muted-foreground">
          AI-extracted details may contain errors. Confirm deadlines and actions
          in the original notice below.
        </p>
      )}
      {deadlines.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold">Deadlines</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {deadlines.map((deadline, index) => (
              <li key={index} title={deadline.sourceQuote}>
                <strong>{deadline.when}</strong> — {deadline.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {actions.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold">Action items</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {actions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </div>
      )}
      {highlights.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold">Key highlights</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {highlights.map((highlight, index) => (
              <li key={index}>{highlight}</li>
            ))}
          </ul>
        </div>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Notice tags">
          {tags.map((tag, index) => (
            <Badge key={index} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
};

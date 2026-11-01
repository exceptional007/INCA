import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function DocxPreview({ blob }: { blob: Blob }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    // Render into an isolated host so a stale render cannot overwrite a newer file.
    const host = document.createElement('div');
    container.replaceChildren(host);
    setLoading(true);
    setError(false);
    const render = async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        const buffer = await blob.arrayBuffer();
        if (!active) return;
        await renderAsync(buffer, host, undefined, {
          className: 'docx-viewer-content',
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          useBase64URL: true,
        });
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void render();
    return () => { active = false; host.remove(); };
  }, [blob]);

  return (
    <div className="relative min-h-64">
      {loading && <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Rendering DOCX preview...</div>}
      {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">This DOCX could not be previewed. Use Download Original to open it in Word.</p>}
      <div ref={containerRef} hidden={loading || error} className="overflow-x-auto text-black [&_.docx-viewer-content-wrapper]:!bg-transparent [&_.docx-viewer-content-wrapper]:!p-0 [&_section.docx-viewer-content]:!max-w-full [&_section.docx-viewer-content]:!mx-auto [&_section.docx-viewer-content]:!mb-4 [&_section.docx-viewer-content]:!bg-white [&_section.docx-viewer-content]:!px-5 sm:[&_section.docx-viewer-content]:!px-12" />
    </div>
  );
}

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function TutorMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-3 text-sm leading-7 [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold [&_h4]:font-semibold [&_h1]:mt-5 [&_h2]:mt-5 [&_h3]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li>p]:my-1 [&_strong]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:rounded-r-lg [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:p-0 [&_pre_code]:bg-transparent [&_hr]:border-border [&_hr]:my-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="max-w-full overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted px-3 py-2 font-semibold whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border px-3 py-2 align-top min-w-28">
              {children}
            </td>
          ),
          img: ({ alt }) => (
            <span className="text-muted-foreground">{alt}</span>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

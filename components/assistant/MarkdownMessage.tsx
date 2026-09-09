"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { tableBlockSchema, chartBlockSchema, reportBlockSchema, safeParseBlock } from "@/lib/ai/blocks.schema";
import { TableBlockView } from "./TableBlockView";
import { ChartRenderer } from "./ChartRenderer";
import { ReportBlockView } from "./ReportBlockView";

/**
 * Renders one assistant/user message as Markdown, with three special fenced
 * languages (`ui-table`, `ui-chart`, `ui-report`) intercepted and rendered as
 * rich components instead of code — see the system prompt
 * (`lib/ai/prompts/system-prompt.ts`) for the exact contract the model
 * follows to emit them. Any other fenced/inline code renders as normal code.
 *
 * `pre` is overridden to a no-op wrapper so the special blocks (which render
 * their own `<div>`-based layout) aren't nested inside a literal `<pre>`
 * element; regular code blocks build their own `<pre>` inside `code` below.
 */
const components: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const lang = /language-(\S+)/.exec(className || "")?.[1];
    const raw = String(children).replace(/\n$/, "");

    if (lang === "ui-table") {
      const parsed = safeParseBlock(tableBlockSchema, raw);
      return parsed ? <TableBlockView block={parsed} /> : <FallbackCode raw={raw} />;
    }
    if (lang === "ui-chart") {
      const parsed = safeParseBlock(chartBlockSchema, raw);
      return parsed ? <ChartRenderer block={parsed} /> : <FallbackCode raw={raw} />;
    }
    if (lang === "ui-report") {
      const parsed = safeParseBlock(reportBlockSchema, raw);
      return parsed ? <ReportBlockView block={parsed} /> : <FallbackCode raw={raw} />;
    }

    if (lang) {
      // Regular fenced code block.
      return (
        <pre className="my-2 rounded-lg bg-black/30 border border-white/10 p-3 overflow-x-auto text-xs font-mono leading-relaxed">
          <code>{children}</code>
        </pre>
      );
    }

    // Inline code.
    return <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[0.85em] font-mono">{children}</code>;
  },
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-500 underline underline-offset-2 hover:text-brand-400">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto surface border rounded-xl">
        <table className="w-full text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="text-left muted text-xs uppercase tracking-wider">{children}</thead>;
  },
  th({ children }) {
    return <th className="px-4 py-2 font-medium whitespace-nowrap border-b">{children}</th>;
  },
  td({ children }) {
    return <td className="px-4 py-2 border-t border-black/5 dark:border-white/10">{children}</td>;
  },
  ul({ children }) {
    return <ul className="list-disc pl-5 space-y-1 my-2">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal pl-5 space-y-1 my-2">{children}</ol>;
  },
  p({ children }) {
    return <p className="leading-relaxed my-1.5 first:mt-0 last:mb-0">{children}</p>;
  },
  h1({ children }) {
    return <h1 className="text-lg font-semibold mt-3 mb-1.5">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-semibold mt-3 mb-1.5">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>;
  },
  blockquote({ children }) {
    return <blockquote className="border-l-2 border-brand-500/50 pl-3 my-2 muted italic">{children}</blockquote>;
  },
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
};

function FallbackCode({ raw }: { raw: string }) {
  return (
    <pre className="my-2 rounded-lg bg-black/30 border border-white/10 p-3 overflow-x-auto text-xs font-mono leading-relaxed text-amber-400">
      {raw}
    </pre>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

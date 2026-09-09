"use client";
import { Lightbulb, ListChecks } from "lucide-react";
import type { ParsedReportBlock } from "@/lib/ai/blocks.schema";
import { TableBlockView } from "./TableBlockView";
import { ChartRenderer } from "./ChartRenderer";

export function ReportBlockView({ block }: { block: ParsedReportBlock }) {
  return (
    <div className="my-3 surface border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold tracking-tight">{block.title}</h3>
        <p className="text-sm muted mt-1 leading-relaxed">{block.summary}</p>
      </div>

      {block.charts?.map((c, i) => (
        <ChartRenderer key={i} block={c} />
      ))}

      {block.tables?.map((t, i) => (
        <TableBlockView key={i} block={t} />
      ))}

      {block.insights && block.insights.length > 0 && (
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-400 mb-2">
            <Lightbulb size={14} /> Insights
          </div>
          <ul className="space-y-1.5 text-sm">
            {block.insights.map((ins, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-blue-400">•</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {block.recommendations && block.recommendations.length > 0 && (
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-2">
            <ListChecks size={14} /> Recommendations
          </div>
          <ul className="space-y-1.5 text-sm">
            {block.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-400">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

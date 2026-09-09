"use client";
import type { ParsedTableBlock } from "@/lib/ai/blocks.schema";
import { TABLE_ROW } from "@/lib/theme";

export function TableBlockView({ block }: { block: ParsedTableBlock }) {
  return (
    <div className="my-3 surface border rounded-xl overflow-hidden">
      {block.title && <div className="text-sm font-semibold px-4 py-2.5 border-b">{block.title}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left muted text-xs uppercase tracking-wider">
              {block.columns.map((c) => (
                <th key={c.key} className="px-4 py-2 font-medium whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.length === 0 ? (
              <tr>
                <td colSpan={block.columns.length} className="px-4 py-6 text-center muted text-xs">
                  No rows to display.
                </td>
              </tr>
            ) : (
              block.rows.map((row, i) => (
                <tr key={i} className={TABLE_ROW}>
                  {block.columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 whitespace-nowrap">
                      {row[c.key] === null || row[c.key] === undefined ? "—" : String(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

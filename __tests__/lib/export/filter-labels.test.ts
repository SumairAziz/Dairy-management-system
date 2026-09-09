import { describe, expect, it } from "vitest";
import { buildFilterMeta } from "@/lib/export/filter-labels";

describe("buildFilterMeta", () => {
  it("skips empty and all values", () => {
    const meta = buildFilterMeta({
      gender: "F",
      status: "all",
      search: "",
      farm_id: "2",
    });
    expect(meta).toEqual([
      { label: "Gender", value: "F" },
      { label: "Farm", value: "2" },
    ]);
  });
});

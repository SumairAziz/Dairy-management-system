// ─── Placeholder semen inventory ────────────────────────────────────────────
// There is no Inventory/Veterinary module yet, so Artificial Insemination
// records can't pull from a real semen_inventory table. This mock list lets
// the Breeding form behave correctly today; breeding_records.semen_batch_id
// just stores whichever `id` below was picked.
//
// To wire up the real module later: replace this file's export with a hook
// that fetches from `/api/semen-inventory` (or wherever that module lands),
// keeping the same SemenBatch shape so the Breeding page needs no changes.

export interface SemenBatch {
  id: string;
  breedName: string;
  sireName: string;
  straws: number;
}

export const MOCK_SEMEN_INVENTORY: SemenBatch[] = [
  {
    id: "SEM-HOL-1042",
    breedName: "Holstein",
    sireName: "Maximus",
    straws: 18,
  },
  { id: "SEM-JER-0871", breedName: "Jersey", sireName: "Duke", straws: 6 },
  { id: "SEM-HOL-1108", breedName: "Holstein", sireName: "Atlas", straws: 24 },
  {
    id: "SEM-BSW-0233",
    breedName: "Brown Swiss",
    sireName: "Hercules",
    straws: 3,
  },
  { id: "SEM-JER-0905", breedName: "Jersey", sireName: "Apollo", straws: 11 },
];

export function semenBatchLabel(batch: SemenBatch): string {
  return `${batch.id} · ${batch.breedName} (${batch.sireName}) — ${batch.straws} straws left`;
}

export type GroupTreatmentType = "vaccination" | "medicine";

export function calculateRequiredQuantity(
  animalCount: number,
  dosagePerAnimal: number,
): number {
  return Number((animalCount * dosagePerAnimal).toFixed(2));
}

export function calculateInventorySummary(
  animalCount: number,
  dosagePerAnimal: number,
  availableStock: number,
) {
  const requiredQuantity = calculateRequiredQuantity(animalCount, dosagePerAnimal);
  const shortfall = Math.max(0, Number((requiredQuantity - availableStock).toFixed(2)));
  const remainingAfter = Number((availableStock - requiredQuantity).toFixed(2));
  return {
    requiredQuantity,
    shortfall,
    remainingAfter,
    sufficient: shortfall <= 0,
  };
}

export function inventoryCategoriesForType(type: GroupTreatmentType): string[] {
  return type === "vaccination" ? ["Vaccines"] : ["Medicines"];
}

export function matchesInventoryCategory(
  category: string,
  type: GroupTreatmentType,
): boolean {
  const allowed = inventoryCategoriesForType(type).map((c) => c.toLowerCase());
  return allowed.includes(category.toLowerCase());
}

export function filterProductsBySearch<T extends { item_name: string }>(
  products: T[],
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return products;
  return products.filter((product) =>
    product.item_name.toLowerCase().includes(query),
  );
}

export function parseTreatmentDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function treatmentDateRange(date: string): { start: Date; end: Date } {
  const start = parseTreatmentDate(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

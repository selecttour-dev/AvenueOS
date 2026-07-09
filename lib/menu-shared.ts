// Menu costing math — shared between server and client, no db imports.

export type MenuIngredient = {
  id: number;
  name: string;
  unit: "kg" | "l" | "pc";
  pricePerUnit: number;
  wastePct: number;
};

export type RecipeLine = {
  id: number;
  ingredientId: number;
  qty: number; // grams for kg, ml for l, pieces for pc
};

export type MenuDish = {
  id: number;
  name: string;
  categoryId: number | null;
  sellPrice: number;
  lines: RecipeLine[];
};

export type MenuCategory = { id: number; name: string };

export const UNIT_LABELS: Record<string, string> = {
  kg: "კგ",
  l: "ლ",
  pc: "ცალი",
};

/** Label for recipe quantities: grams / ml / pieces. */
export const QTY_LABELS: Record<string, string> = {
  kg: "გრ",
  l: "მლ",
  pc: "ც",
};

export function lineCost(ing: MenuIngredient, qty: number): number {
  const base =
    ing.unit === "pc" ? qty * ing.pricePerUnit : (qty / 1000) * ing.pricePerUnit;
  return base * (1 + (ing.wastePct || 0) / 100);
}

export function dishCost(
  lines: RecipeLine[],
  ingredientsById: Map<number, MenuIngredient>,
): number {
  return lines.reduce((sum, l) => {
    const ing = ingredientsById.get(l.ingredientId);
    return ing ? sum + lineCost(ing, l.qty) : sum;
  }, 0);
}

export function foodCostPct(cost: number, sellPrice: number): number | null {
  if (!sellPrice) return null;
  return (cost / sellPrice) * 100;
}

/** Suggested sell price from a target food-cost percentage. */
export function suggestedPrice(cost: number, targetPct: number): number {
  if (!targetPct) return 0;
  return cost / (targetPct / 100);
}

export const DEFAULT_TARGET_FOOD_COST_PCT = 32;

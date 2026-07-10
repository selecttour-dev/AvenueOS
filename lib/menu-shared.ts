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

export type InventoryLine = {
  id: number;
  itemId: number;
  qtyPerPortion: number;
};

export type MenuDish = {
  id: number;
  name: string;
  categoryId: number | null;
  sellPrice: number;
  lines: RecipeLine[];
  invLines: InventoryLine[];
};

export type InventoryItem = {
  id: number;
  name: string;
  category: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  minQty: number | null;
};

export type PackageDishLine = {
  id: number;
  dishId: number;
  qtyPerGuest: number;
};

export type MenuPackage = {
  id: number;
  name: string;
  pricePerGuest: number;
  manualCostPerGuest: number | null;
  description: string | null;
  active: boolean;
  dishes: PackageDishLine[];
};

/** Cost per guest of a package = Σ dishCost × portions/guest (recipe-driven);
 *  falls back to manualCostPerGuest when the package has no linked dishes. */
export function packageCostPerGuest(
  pkg: MenuPackage,
  dishesById: Map<number, MenuDish>,
  ingredientsById: Map<number, MenuIngredient>,
): number {
  if (pkg.dishes.length === 0) return pkg.manualCostPerGuest ?? 0;
  return pkg.dishes.reduce((sum, pd) => {
    const dish = dishesById.get(pd.dishId);
    if (!dish) return sum;
    return sum + dishCost(dish.lines, ingredientsById) * pd.qtyPerGuest;
  }, 0);
}

/** Build a dish-portion order from a package for a given guest count. */
export function packageOrder(
  pkg: MenuPackage,
  dishesById: Map<number, MenuDish>,
  guests: number,
): { dish: MenuDish; portions: number }[] {
  return pkg.dishes
    .map((pd) => {
      const dish = dishesById.get(pd.dishId);
      return dish ? { dish, portions: pd.qtyPerGuest * guests } : null;
    })
    .filter((x): x is { dish: MenuDish; portions: number } => x !== null);
}

/** Inventory shortfall for an order: dish portions → required items vs stock. */
export function inventoryNeeds(
  order: { dish: MenuDish; portions: number }[],
  items: InventoryItem[],
): {
  item: InventoryItem;
  required: number;
  missing: number;
}[] {
  const required = new Map<number, number>();
  for (const { dish, portions } of order) {
    for (const l of dish.invLines) {
      required.set(
        l.itemId,
        (required.get(l.itemId) ?? 0) + l.qtyPerPortion * portions,
      );
    }
  }
  return items
    .filter((i) => required.has(i.id))
    .map((item) => {
      const req = required.get(item.id)!;
      return { item, required: req, missing: Math.max(0, req - item.quantity) };
    })
    .sort((a, b) => b.missing - a.missing);
}

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

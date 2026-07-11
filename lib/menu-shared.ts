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

export type MenuType = { id: number; name: string };

export type MenuDish = {
  id: number;
  name: string;
  categoryId: number | null;
  menuTypeId: number | null;
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
  // qty consumed per guest (serving-ware: plates, glasses). null/0 = not per-guest.
  perGuest: number | null;
};

export type PackageDishLine = {
  id: number;
  dishId: number;
  qtyPerGuest: number;
};

export type MenuPackage = {
  id: number;
  name: string;
  menuTypeId: number | null;
  pricePerGuest: number;
  manualCostPerGuest: number | null;
  description: string | null;
  active: boolean;
  dishes: PackageDishLine[];
};

export type MenuLine = { dishId: number; qtyPerGuest: number };

/** Cost per guest of a per-guest menu = Σ dishCost × qty/guest. */
export function menuCostPerGuest(
  lines: MenuLine[],
  dishesById: Map<number, MenuDish>,
  ingredientsById: Map<number, MenuIngredient>,
): number {
  return lines.reduce((sum, l) => {
    const dish = dishesById.get(l.dishId);
    if (!dish) return sum;
    return sum + dishCost(dish.lines, ingredientsById) * l.qtyPerGuest;
  }, 0);
}

/** Per-guest menu → dish-portion order for a guest count. */
export function menuOrder(
  lines: MenuLine[],
  dishesById: Map<number, MenuDish>,
  guests: number,
): { dish: MenuDish; portions: number }[] {
  return lines
    .map((l) => {
      const dish = dishesById.get(l.dishId);
      return dish ? { dish, portions: l.qtyPerGuest * guests } : null;
    })
    .filter((x): x is { dish: MenuDish; portions: number } => x !== null);
}

// ---- booking custom menu: qty may be per-guest OR total for the event ----

export type BookingMenuLine = {
  dishId: number;
  qty: number;
  perGuest: boolean;
};

/** Total portions of a line for the event: per-guest × guests, or the flat total. */
export function bookingLinePortions(
  l: { qty: number; perGuest: boolean },
  guests: number,
): number {
  return l.perGuest ? l.qty * guests : l.qty;
}

/** Total food cost of a booking's custom menu for the whole event. */
export function bookingMenuTotalCost(
  lines: BookingMenuLine[],
  dishesById: Map<number, MenuDish>,
  ingredientsById: Map<number, MenuIngredient>,
  guests: number,
): number {
  return lines.reduce((sum, l) => {
    const dish = dishesById.get(l.dishId);
    if (!dish) return sum;
    return (
      sum + dishCost(dish.lines, ingredientsById) * bookingLinePortions(l, guests)
    );
  }, 0);
}

export function bookingMenuOrder(
  lines: BookingMenuLine[],
  dishesById: Map<number, MenuDish>,
  guests: number,
): { dish: MenuDish; portions: number }[] {
  return lines
    .map((l) => {
      const dish = dishesById.get(l.dishId);
      return dish ? { dish, portions: bookingLinePortions(l, guests) } : null;
    })
    .filter((x): x is { dish: MenuDish; portions: number } => x !== null);
}

/** Total SELLING value of a booking's menu = Σ dish.sellPrice × portions. */
export function bookingMenuSelling(
  lines: BookingMenuLine[],
  dishesById: Map<number, MenuDish>,
  guests: number,
): number {
  return lines.reduce((sum, l) => {
    const dish = dishesById.get(l.dishId);
    if (!dish) return sum;
    return sum + dish.sellPrice * bookingLinePortions(l, guests);
  }, 0);
}

/**
 * Inventory needs for a whole event: dish-driven ware (per dish/portion, shared)
 * PLUS per-guest serving-ware (items with a perGuest qty × guest count).
 */
export type InventoryNeed = {
  item: InventoryItem;
  required: number;
  missing: number;
  perGuestPart: number; // portion of `required` coming from per-guest serving-ware
};

export function bookingInventoryNeeds(
  order: { dish: MenuDish; portions: number }[],
  items: InventoryItem[],
  guests: number,
): InventoryNeed[] {
  const required = new Map<number, number>();
  for (const { dish, portions } of order) {
    for (const l of dish.invLines) {
      required.set(
        l.itemId,
        (required.get(l.itemId) ?? 0) + l.qtyPerPortion * portions,
      );
    }
  }
  for (const item of items) {
    if (item.perGuest && item.perGuest > 0) {
      required.set(
        item.id,
        (required.get(item.id) ?? 0) + item.perGuest * guests,
      );
    }
  }
  return items
    .filter((i) => required.has(i.id))
    .map((item) => ({
      item,
      required: required.get(item.id)!,
      missing: Math.max(0, required.get(item.id)! - item.quantity),
      perGuestPart: (item.perGuest ?? 0) * guests,
    }))
    .sort((a, b) => b.missing - a.missing);
}

/** Cost per guest of a package (recipe-driven); falls back to
 *  manualCostPerGuest when the package has no linked dishes. */
export function packageCostPerGuest(
  pkg: MenuPackage,
  dishesById: Map<number, MenuDish>,
  ingredientsById: Map<number, MenuIngredient>,
): number {
  if (pkg.dishes.length === 0) return pkg.manualCostPerGuest ?? 0;
  return menuCostPerGuest(pkg.dishes, dishesById, ingredientsById);
}

export function packageOrder(
  pkg: MenuPackage,
  dishesById: Map<number, MenuDish>,
  guests: number,
): { dish: MenuDish; portions: number }[] {
  return menuOrder(pkg.dishes, dishesById, guests);
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

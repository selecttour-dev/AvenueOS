"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { VENUE_COOKIE, getActiveVenueId } from "./venue";
import {
  bookings,
  clients,
  dishCategories,
  dishes,
  dishIngredients,
  dishInventory,
  fixedCosts,
  ingredients,
  inventoryItems,
  packageDishes,
  packages,
  payments,
  services,
  settings,
  staff,
  suppliers,
  venues,
} from "@/db/schema";

// ---------- venues ----------

export async function setActiveVenue(venueId: number) {
  const store = await cookies();
  store.set(VENUE_COOKIE, String(venueId), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function createVenue(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.insert(venues).values({ name: trimmed });
  revalidatePath("/select");
}

export async function renameVenue(venueId: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(venues).set({ name: trimmed }).where(eq(venues.id, venueId));
  revalidatePath("/select");
  revalidatePath("/", "layout");
}

export async function updateVenue(
  venueId: number,
  input: { name?: string; address?: string | null; capacity?: number | null },
) {
  await db
    .update(venues)
    .set({
      ...(input.name !== undefined && input.name.trim()
        ? { name: input.name.trim() }
        : {}),
      ...(input.address !== undefined
        ? { address: input.address?.trim() || null }
        : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
    })
    .where(eq(venues.id, venueId));
  revalidatePath("/", "layout");
  revalidatePath("/settings");
}

// ---------- venue duplication ----------

/**
 * Copies catalog data from the ACTIVE venue into the target venue:
 * categories, ingredients, dishes (+recipes, +inventory links), inventory,
 * suppliers, services, fixed costs, staff, packages, settings.
 * Bookings/clients/payments/ledger are operational and are NOT copied.
 * Idempotent: rows that already exist in the target (same name) are skipped
 * but still used for FK remapping.
 */
export async function duplicateVenueData(targetVenueId: number) {
  const sourceVenueId = await getActiveVenueId();
  if (!sourceVenueId) return { error: "ობიექტი არ არის არჩეული" };
  if (sourceVenueId === targetVenueId)
    return { error: "წყარო და სამიზნე ერთი და იგივე ობიექტია" };
  const [target] = await db
    .select()
    .from(venues)
    .where(eq(venues.id, targetVenueId));
  if (!target) return { error: "სამიზნე ობიექტი ვერ მოიძებნა" };

  const key = (s: string) => s.trim().toLowerCase();
  const counts: Record<string, number> = {};

  // --- dish categories ---
  const [srcCats, tgtCats] = await Promise.all([
    db.select().from(dishCategories).where(eq(dishCategories.venueId, sourceVenueId)),
    db.select().from(dishCategories).where(eq(dishCategories.venueId, targetVenueId)),
  ]);
  const catMap = new Map<number, number>();
  const tgtCatByName = new Map(tgtCats.map((c) => [key(c.name), c.id]));
  counts["კატეგორია"] = 0;
  for (const c of srcCats) {
    let tid = tgtCatByName.get(key(c.name));
    if (!tid) {
      const [ins] = await db
        .insert(dishCategories)
        .values({ venueId: targetVenueId, name: c.name, sort: c.sort })
        .returning({ id: dishCategories.id });
      tid = ins.id;
      counts["კატეგორია"]++;
    }
    catMap.set(c.id, tid);
  }

  // --- ingredients ---
  const [srcIngs, tgtIngs] = await Promise.all([
    db.select().from(ingredients).where(eq(ingredients.venueId, sourceVenueId)),
    db.select().from(ingredients).where(eq(ingredients.venueId, targetVenueId)),
  ]);
  const ingMap = new Map<number, number>();
  const tgtIngByName = new Map(tgtIngs.map((i) => [key(i.name), i.id]));
  counts["ინგრედიენტი"] = 0;
  for (const i of srcIngs) {
    let tid = tgtIngByName.get(key(i.name));
    if (!tid) {
      const [ins] = await db
        .insert(ingredients)
        .values({
          venueId: targetVenueId,
          name: i.name,
          unit: i.unit,
          pricePerUnit: i.pricePerUnit,
          wastePct: i.wastePct,
        })
        .returning({ id: ingredients.id });
      tid = ins.id;
      counts["ინგრედიენტი"]++;
    }
    ingMap.set(i.id, tid);
  }

  // --- inventory items ---
  const [srcItems, tgtItems] = await Promise.all([
    db.select().from(inventoryItems).where(eq(inventoryItems.venueId, sourceVenueId)),
    db.select().from(inventoryItems).where(eq(inventoryItems.venueId, targetVenueId)),
  ]);
  const itemMap = new Map<number, number>();
  const tgtItemByName = new Map(tgtItems.map((i) => [key(i.name), i.id]));
  counts["ინვენტარი"] = 0;
  for (const i of srcItems) {
    let tid = tgtItemByName.get(key(i.name));
    if (!tid) {
      const [ins] = await db
        .insert(inventoryItems)
        .values({
          venueId: targetVenueId,
          name: i.name,
          category: i.category,
          unit: i.unit,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          perGuest: i.perGuest,
          minQty: i.minQty,
        })
        .returning({ id: inventoryItems.id });
      tid = ins.id;
      counts["ინვენტარი"]++;
    }
    itemMap.set(i.id, tid);
  }

  // --- dishes + recipes + inventory links ---
  const [srcDishes, tgtDishes] = await Promise.all([
    db.select().from(dishes).where(eq(dishes.venueId, sourceVenueId)),
    db.select().from(dishes).where(eq(dishes.venueId, targetVenueId)),
  ]);
  const dishMap = new Map<number, number>();
  const tgtDishByName = new Map(tgtDishes.map((d) => [key(d.name), d.id]));
  counts["კერძი"] = 0;
  for (const d of srcDishes) {
    let tid = tgtDishByName.get(key(d.name));
    if (!tid) {
      const [ins] = await db
        .insert(dishes)
        .values({
          venueId: targetVenueId,
          name: d.name,
          categoryId: d.categoryId ? (catMap.get(d.categoryId) ?? null) : null,
          sellPrice: d.sellPrice,
          active: d.active,
        })
        .returning({ id: dishes.id });
      tid = ins.id;
      counts["კერძი"]++;

      const [recipe, invLinks] = await Promise.all([
        db.select().from(dishIngredients).where(eq(dishIngredients.dishId, d.id)),
        db.select().from(dishInventory).where(eq(dishInventory.dishId, d.id)),
      ]);
      for (const line of recipe) {
        const ingId = ingMap.get(line.ingredientId);
        if (ingId)
          await db
            .insert(dishIngredients)
            .values({ dishId: tid, ingredientId: ingId, qty: line.qty });
      }
      for (const link of invLinks) {
        const itemId = itemMap.get(link.itemId);
        if (itemId)
          await db.insert(dishInventory).values({
            dishId: tid,
            itemId,
            qtyPerPortion: link.qtyPerPortion,
          });
      }
    }
    dishMap.set(d.id, tid);
  }

  // --- packages + package dishes ---
  const [srcPkgs, tgtPkgs] = await Promise.all([
    db.select().from(packages).where(eq(packages.venueId, sourceVenueId)),
    db.select().from(packages).where(eq(packages.venueId, targetVenueId)),
  ]);
  const tgtPkgByName = new Map(tgtPkgs.map((p) => [key(p.name), p.id]));
  counts["პაკეტი"] = 0;
  for (const p of srcPkgs) {
    if (tgtPkgByName.has(key(p.name))) continue;
    const [ins] = await db
      .insert(packages)
      .values({
        venueId: targetVenueId,
        name: p.name,
        pricePerGuest: p.pricePerGuest,
        manualCostPerGuest: p.manualCostPerGuest,
        description: p.description,
        active: p.active,
      })
      .returning({ id: packages.id });
    counts["პაკეტი"]++;
    const pkgDishes = await db
      .select()
      .from(packageDishes)
      .where(eq(packageDishes.packageId, p.id));
    for (const pd of pkgDishes) {
      const dishId = dishMap.get(pd.dishId);
      if (dishId)
        await db.insert(packageDishes).values({
          packageId: ins.id,
          dishId,
          qtyPerGuest: pd.qtyPerGuest,
        });
    }
  }

  // --- simple named tables: suppliers, services, staff, fixed costs ---
  const [srcSups, tgtSups] = await Promise.all([
    db.select().from(suppliers).where(eq(suppliers.venueId, sourceVenueId)),
    db.select().from(suppliers).where(eq(suppliers.venueId, targetVenueId)),
  ]);
  const tgtSupNames = new Set(tgtSups.map((s) => key(s.name)));
  counts["მომწოდებელი"] = 0;
  for (const s of srcSups) {
    if (tgtSupNames.has(key(s.name))) continue;
    await db.insert(suppliers).values({
      venueId: targetVenueId,
      name: s.name,
      category: s.category,
      contactPerson: s.contactPerson,
      phone: s.phone,
      notes: s.notes,
      active: s.active,
    });
    counts["მომწოდებელი"]++;
  }

  const [srcSrv, tgtSrv] = await Promise.all([
    db.select().from(services).where(eq(services.venueId, sourceVenueId)),
    db.select().from(services).where(eq(services.venueId, targetVenueId)),
  ]);
  const tgtSrvNames = new Set(tgtSrv.map((s) => key(s.name)));
  counts["სერვისი"] = 0;
  for (const s of srcSrv) {
    if (tgtSrvNames.has(key(s.name))) continue;
    await db.insert(services).values({
      venueId: targetVenueId,
      name: s.name,
      price: s.price,
      cost: s.cost,
      perGuest: s.perGuest,
      active: s.active,
    });
    counts["სერვისი"]++;
  }

  const [srcStaff, tgtStaff] = await Promise.all([
    db.select().from(staff).where(eq(staff.venueId, sourceVenueId)),
    db.select().from(staff).where(eq(staff.venueId, targetVenueId)),
  ]);
  const tgtStaffNames = new Set(tgtStaff.map((s) => key(s.name)));
  counts["თანამშრომელი"] = 0;
  for (const s of srcStaff) {
    if (tgtStaffNames.has(key(s.name))) continue;
    await db.insert(staff).values({
      venueId: targetVenueId,
      name: s.name,
      role: s.role,
      phone: s.phone,
      dailyRate: s.dailyRate,
      active: s.active,
    });
    counts["თანამშრომელი"]++;
  }

  const [srcFixed, tgtFixed] = await Promise.all([
    db.select().from(fixedCosts).where(eq(fixedCosts.venueId, sourceVenueId)),
    db.select().from(fixedCosts).where(eq(fixedCosts.venueId, targetVenueId)),
  ]);
  const tgtFixedNames = new Set(tgtFixed.map((f) => key(f.name)));
  counts["ფიქს. ხარჯი"] = 0;
  for (const f of srcFixed) {
    if (tgtFixedNames.has(key(f.name))) continue;
    await db.insert(fixedCosts).values({
      venueId: targetVenueId,
      name: f.name,
      monthlyAmount: f.monthlyAmount,
      active: f.active,
    });
    counts["ფიქს. ხარჯი"]++;
  }

  // --- settings (skip keys the target already has) ---
  const [srcSet, tgtSet] = await Promise.all([
    db.select().from(settings).where(eq(settings.venueId, sourceVenueId)),
    db.select().from(settings).where(eq(settings.venueId, targetVenueId)),
  ]);
  const tgtKeys = new Set(tgtSet.map((s) => s.key));
  for (const s of srcSet) {
    if (tgtKeys.has(s.key)) continue;
    await db
      .insert(settings)
      .values({ venueId: targetVenueId, key: s.key, value: s.value });
  }

  revalidatePath("/", "layout");
  return { ok: true, counts, targetName: target.name };
}

// ---------- fixed costs ----------

export async function createFixedCost(input: {
  name: string;
  monthlyAmount: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(fixedCosts).values({
    venueId,
    name: input.name.trim(),
    monthlyAmount: input.monthlyAmount || 0,
  });
  revalidatePath("/finance");
}

export async function updateFixedCost(
  id: number,
  input: { name?: string; monthlyAmount?: number; active?: boolean },
) {
  await db
    .update(fixedCosts)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.monthlyAmount !== undefined
        ? { monthlyAmount: input.monthlyAmount }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
    .where(eq(fixedCosts.id, id));
  revalidatePath("/finance");
}

export async function deleteFixedCost(id: number) {
  await db.delete(fixedCosts).where(eq(fixedCosts.id, id));
  revalidatePath("/finance");
}

// ---------- inventory ----------

export async function createInventoryItem(input: {
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  minQty?: number | null;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(inventoryItems).values({
    venueId,
    name: input.name.trim(),
    category: input.category?.trim() || null,
    unit: input.unit.trim() || "ცალი",
    quantity: input.quantity || 0,
    unitPrice: input.unitPrice || 0,
    minQty: input.minQty ?? null,
  });
  revalidatePath("/inventory");
  revalidatePath("/calc");
}

export async function updateInventoryItem(
  id: number,
  input: {
    name?: string;
    category?: string | null;
    quantity?: number;
    unitPrice?: number;
    minQty?: number | null;
  },
) {
  await db
    .update(inventoryItems)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined
        ? { category: input.category?.trim() || null }
        : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unitPrice !== undefined ? { unitPrice: input.unitPrice } : {}),
      ...(input.minQty !== undefined ? { minQty: input.minQty } : {}),
    })
    .where(eq(inventoryItems.id, id));
  revalidatePath("/inventory");
  revalidatePath("/calc");
}

export async function deleteInventoryItem(id: number) {
  await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  revalidatePath("/inventory");
  revalidatePath("/calc");
}

export async function addDishInventory(
  dishId: number,
  itemId: number,
  qtyPerPortion: number,
) {
  if (!qtyPerPortion || qtyPerPortion <= 0) return;
  await db.insert(dishInventory).values({ dishId, itemId, qtyPerPortion });
  revalidatePath("/calc");
  revalidatePath("/inventory");
}

export async function updateDishInventory(lineId: number, qtyPerPortion: number) {
  if (!qtyPerPortion || qtyPerPortion <= 0) return;
  await db
    .update(dishInventory)
    .set({ qtyPerPortion })
    .where(eq(dishInventory.id, lineId));
  revalidatePath("/calc");
  revalidatePath("/inventory");
}

export async function deleteDishInventory(lineId: number) {
  await db.delete(dishInventory).where(eq(dishInventory.id, lineId));
  revalidatePath("/calc");
  revalidatePath("/inventory");
}

// ---------- bookings ----------

export type BookingInput = {
  title: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  pricePerGuest: number;
  clientName?: string;
  clientPhone?: string;
  notes?: string;
};

export async function createBooking(input: BookingInput) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.title.trim() || !input.eventDate) {
    return { error: "სახელი და თარიღი სავალდებულოა" };
  }

  let clientId: number | null = null;
  if (input.clientName?.trim()) {
    const [client] = await db
      .insert(clients)
      .values({
        venueId,
        name: input.clientName.trim(),
        phone: input.clientPhone?.trim() || null,
      })
      .returning({ id: clients.id });
    clientId = client.id;
  }

  await db.insert(bookings).values({
    venueId,
    clientId,
    title: input.title.trim(),
    eventType: (input.eventType || "other") as typeof bookings.$inferInsert.eventType,
    eventDate: input.eventDate,
    guestCount: input.guestCount || 0,
    pricePerGuest: input.pricePerGuest || 0,
    notes: input.notes?.trim() || null,
  });

  revalidatePath("/bookings");
  revalidatePath("/");
  return { ok: true };
}

export async function updateBookingStatus(bookingId: number, status: string) {
  await db
    .update(bookings)
    .set({ status: status as typeof bookings.$inferInsert.status })
    .where(eq(bookings.id, bookingId));
  revalidatePath("/bookings");
  revalidatePath("/");
}

export async function deleteBooking(bookingId: number) {
  await db.delete(bookings).where(eq(bookings.id, bookingId));
  revalidatePath("/bookings");
  revalidatePath("/");
}

// ---------- menu / calculations ----------

export async function createIngredient(input: {
  name: string;
  unit: string;
  pricePerUnit: number;
  wastePct?: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(ingredients).values({
    venueId,
    name: input.name.trim(),
    unit: input.unit as typeof ingredients.$inferInsert.unit,
    pricePerUnit: input.pricePerUnit || 0,
    wastePct: input.wastePct || 0,
  });
  revalidatePath("/calc");
}

export async function updateIngredient(
  id: number,
  input: { name?: string; pricePerUnit?: number; wastePct?: number },
) {
  await db
    .update(ingredients)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.pricePerUnit !== undefined
        ? { pricePerUnit: input.pricePerUnit }
        : {}),
      ...(input.wastePct !== undefined ? { wastePct: input.wastePct } : {}),
    })
    .where(eq(ingredients.id, id));
  revalidatePath("/calc");
}

export async function deleteIngredient(id: number) {
  await db.delete(ingredients).where(eq(ingredients.id, id));
  revalidatePath("/calc");
}

export async function createDishCategory(name: string) {
  const venueId = await getActiveVenueId();
  if (!venueId || !name.trim()) return;
  await db.insert(dishCategories).values({ venueId, name: name.trim() });
  revalidatePath("/calc");
}

export async function deleteDishCategory(id: number) {
  await db.delete(dishCategories).where(eq(dishCategories.id, id));
  revalidatePath("/calc");
}

export async function createDish(input: {
  name: string;
  categoryId: number | null;
  sellPrice: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(dishes).values({
    venueId,
    name: input.name.trim(),
    categoryId: input.categoryId,
    sellPrice: input.sellPrice || 0,
  });
  revalidatePath("/calc");
}

export async function updateDish(
  id: number,
  input: { name?: string; sellPrice?: number; categoryId?: number | null },
) {
  await db
    .update(dishes)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sellPrice !== undefined ? { sellPrice: input.sellPrice } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    })
    .where(eq(dishes.id, id));
  revalidatePath("/calc");
}

export async function deleteDish(id: number) {
  await db.delete(dishes).where(eq(dishes.id, id));
  revalidatePath("/calc");
}

export async function addRecipeLine(
  dishId: number,
  ingredientId: number,
  qty: number,
) {
  if (!qty || qty <= 0) return;
  await db.insert(dishIngredients).values({ dishId, ingredientId, qty });
  revalidatePath("/calc");
}

export async function updateRecipeLine(lineId: number, qty: number) {
  if (!qty || qty <= 0) return;
  await db.update(dishIngredients).set({ qty }).where(eq(dishIngredients.id, lineId));
  revalidatePath("/calc");
}

export async function deleteRecipeLine(lineId: number) {
  await db.delete(dishIngredients).where(eq(dishIngredients.id, lineId));
  revalidatePath("/calc");
}

export async function addPayment(
  bookingId: number,
  amount: number,
  paidOn: string,
  method: string,
) {
  if (!amount || amount <= 0) return { error: "თანხა აუცილებელია" };
  await db.insert(payments).values({
    bookingId,
    amount,
    paidOn,
    method: method as typeof payments.$inferInsert.method,
  });
  revalidatePath("/bookings");
  revalidatePath("/");
  return { ok: true };
}

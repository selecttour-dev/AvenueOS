"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { VENUE_COOKIE, getActiveVenueId } from "./venue";
import {
  bookingDishes,
  bookings,
  clients,
  dayCloses,
  dishCategories,
  dishes,
  dishIngredients,
  dishInventory,
  fixedCosts,
  ingredients,
  inventoryItems,
  ledger,
  menuTypes,
  operationalExpenses,
  packageDishes,
  advanceRepayments,
  debtRepayments,
  debts,
  partnerDraws,
  partners,
  packages,
  payments,
  purchases,
  services,
  settings,
  staff,
  suppliers,
  telegramRecipients,
  venues,
} from "@/db/schema";
import {
  extractSheetId,
  syncBookingsFromSheet,
  type SyncResult,
} from "./sheet-sync";
import { getRecipients, resolveTelegramChats, sendTelegram } from "./reminders";

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

// ---------- daily register ----------

export async function addLedgerEntry(input: {
  entryDate: string;
  type: string;
  category?: string;
  amount: number;
  qty?: number;
  staffId?: number | null;
  bookingId?: number | null;
  note?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.amount || input.amount <= 0) return { error: "თანხა აუცილებელია" };
  if (!input.entryDate) return { error: "თარიღი აუცილებელია" };

  // Income linked to a booking = a payment: create it through the payment
  // flow so the booking's paid total and the register stay one record.
  if (input.type === "income" && input.bookingId) {
    return addPayment(input.bookingId, input.amount, input.entryDate, "cash");
  }

  await db.insert(ledger).values({
    venueId,
    entryDate: input.entryDate,
    type: input.type as typeof ledger.$inferInsert.type,
    category: input.category?.trim() || null,
    amount: input.amount,
    qty: input.qty && input.qty > 0 ? input.qty : 1,
    staffId: input.staffId ?? null,
    bookingId: input.bookingId ?? null,
    note: input.note?.trim() || null,
  });

  revalidatePath("/register");
  if (input.bookingId) revalidatePath(`/bookings/${input.bookingId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteLedgerEntry(id: number) {
  // Payment mirrors are deleted through the payment (cascade removes the row).
  const [row] = await db
    .select({ paymentId: ledger.paymentId, bookingId: ledger.bookingId })
    .from(ledger)
    .where(eq(ledger.id, id));
  if (row?.paymentId) {
    await db.delete(payments).where(eq(payments.id, row.paymentId));
    if (row.bookingId) revalidatePath(`/bookings/${row.bookingId}`);
    revalidatePath("/bookings");
  } else {
    await db.delete(ledger).where(eq(ledger.id, id));
  }
  revalidatePath("/register");
  revalidatePath("/");
}

/** Log a shift wage for every active staff member on the given date,
 *  skipping anyone who already has a wage entry that day. */
export async function logAllStaffShift(entryDate: string) {
  const venueId = await getActiveVenueId();
  if (!venueId || !entryDate) return { error: "ობიექტი/თარიღი აუცილებელია" };

  const activeStaff = await db
    .select()
    .from(staff)
    .where(and(eq(staff.venueId, venueId), eq(staff.active, true)));

  const existing = await db
    .select({ staffId: ledger.staffId })
    .from(ledger)
    .where(
      and(
        eq(ledger.venueId, venueId),
        eq(ledger.entryDate, entryDate),
        eq(ledger.type, "wage"),
      ),
    );
  const already = new Set(existing.map((e) => e.staffId));

  let added = 0;
  for (const s of activeStaff) {
    if (already.has(s.id) || s.dailyRate <= 0) continue;
    await db.insert(ledger).values({
      venueId,
      entryDate,
      type: "wage",
      category: "ხელფასი",
      staffId: s.id,
      amount: s.dailyRate,
      qty: 1,
    });
    added++;
  }

  revalidatePath("/register");
  revalidatePath("/");
  return { ok: true, added };
}

export async function createStaff(input: {
  name: string;
  role?: string;
  phone?: string;
  dailyRate: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(staff).values({
    venueId,
    name: input.name.trim(),
    role: input.role?.trim() || null,
    phone: input.phone?.trim() || null,
    dailyRate: input.dailyRate || 0,
  });
  revalidatePath("/register");
}

export async function updateStaff(
  id: number,
  input: {
    name?: string;
    role?: string | null;
    phone?: string | null;
    dailyRate?: number;
    active?: boolean;
  },
) {
  await db
    .update(staff)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.role !== undefined ? { role: input.role?.trim() || null } : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.dailyRate !== undefined ? { dailyRate: input.dailyRate } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
    .where(eq(staff.id, id));
  revalidatePath("/register");
}

export async function deleteStaff(id: number) {
  await db.delete(staff).where(eq(staff.id, id));
  revalidatePath("/register");
}

/** Close (or recompute) a day: authoritative totals from the ledger,
 *  opening carried from the prior close. Upserts on (venue, date). */
export async function closeDay(entryDate: string, countedCash?: number | null) {
  const venueId = await getActiveVenueId();
  if (!venueId || !entryDate) return { error: "ობიექტი/თარიღი აუცილებელია" };

  const rows = await db
    .select({ type: ledger.type, amount: ledger.amount, qty: ledger.qty })
    .from(ledger)
    .where(and(eq(ledger.venueId, venueId), eq(ledger.entryDate, entryDate)));

  let income = 0;
  let wages = 0;
  let expenses = 0;
  for (const r of rows) {
    const t = r.amount * r.qty;
    if (r.type === "income") income += t;
    else if (r.type === "wage") wages += t;
    else expenses += t;
  }
  const net = income - wages - expenses;

  const [prior] = await db
    .select()
    .from(dayCloses)
    .where(
      and(eq(dayCloses.venueId, venueId), lt(dayCloses.closeDate, entryDate)),
    )
    .orderBy(desc(dayCloses.closeDate))
    .limit(1);
  const openingBalance = prior ? (prior.countedCash ?? prior.expectedCash) : 0;
  const expectedCash = openingBalance + net;
  const counted = countedCash ?? null;
  const difference = counted != null ? counted - expectedCash : null;

  await db
    .insert(dayCloses)
    .values({
      venueId,
      closeDate: entryDate,
      openingBalance,
      income,
      wages,
      expenses,
      net,
      expectedCash,
      countedCash: counted,
      difference,
    })
    .onConflictDoUpdate({
      target: [dayCloses.venueId, dayCloses.closeDate],
      set: {
        openingBalance,
        income,
        wages,
        expenses,
        net,
        expectedCash,
        countedCash: counted,
        difference,
      },
    });

  revalidatePath("/register");
  revalidatePath("/");
  return { ok: true };
}

export async function reopenDay(entryDate: string) {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  await db
    .delete(dayCloses)
    .where(
      and(eq(dayCloses.venueId, venueId), eq(dayCloses.closeDate, entryDate)),
    );
  revalidatePath("/register");
  revalidatePath("/");
}

// ---------- packages ----------

export async function createPackage(input: {
  name: string;
  pricePerGuest?: number;
  description?: string;
  menuTypeId?: number | null;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return null;
  const [row] = await db
    .insert(packages)
    .values({
      venueId,
      name: input.name.trim(),
      pricePerGuest: input.pricePerGuest || 0,
      description: input.description?.trim() || null,
      menuTypeId: input.menuTypeId ?? null,
    })
    .returning({ id: packages.id });
  revalidatePath("/calc");
  return row?.id ?? null;
}

export async function updatePackage(
  id: number,
  input: {
    name?: string;
    pricePerGuest?: number;
    description?: string | null;
    menuTypeId?: number | null;
  },
) {
  await db
    .update(packages)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.pricePerGuest !== undefined
        ? { pricePerGuest: input.pricePerGuest }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.menuTypeId !== undefined ? { menuTypeId: input.menuTypeId } : {}),
    })
    .where(eq(packages.id, id));
  revalidatePath("/calc");
  revalidatePath("/bookings");
}

export async function deletePackage(id: number) {
  await db.delete(packages).where(eq(packages.id, id));
  revalidatePath("/calc");
  revalidatePath("/bookings");
}

export async function addPackageDish(
  packageId: number,
  dishId: number,
  qtyPerGuest: number,
) {
  if (!qtyPerGuest || qtyPerGuest <= 0) return;
  await db.insert(packageDishes).values({ packageId, dishId, qtyPerGuest });
  revalidatePath("/calc");
}

export async function updatePackageDish(lineId: number, qtyPerGuest: number) {
  if (!qtyPerGuest || qtyPerGuest <= 0) return;
  await db
    .update(packageDishes)
    .set({ qtyPerGuest })
    .where(eq(packageDishes.id, lineId));
  revalidatePath("/calc");
}

export async function deletePackageDish(lineId: number) {
  await db.delete(packageDishes).where(eq(packageDishes.id, lineId));
  revalidatePath("/calc");
}

export async function setBookingPackage(
  bookingId: number,
  packageId: number | null,
) {
  await db
    .update(bookings)
    .set({ packageId })
    .where(eq(bookings.id, bookingId));
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
}

// ---------- per-event custom menu ----------

export async function addBookingDish(
  bookingId: number,
  dishId: number,
  qty: number,
  perGuest = false, // dishes are shared by default — 1 dish → 1 plate, not ×guests
) {
  await db.insert(bookingDishes).values({
    bookingId,
    dishId,
    qty: qty && qty > 0 ? qty : 1,
    perGuest,
  });
  revalidatePath(`/bookings/${bookingId}`);
}

export async function updateBookingDish(
  lineId: number,
  input: { qty?: number; perGuest?: boolean },
) {
  await db
    .update(bookingDishes)
    .set({
      ...(input.qty !== undefined && input.qty > 0 ? { qty: input.qty } : {}),
      ...(input.perGuest !== undefined ? { perGuest: input.perGuest } : {}),
    })
    .where(eq(bookingDishes.id, lineId));
  revalidatePath("/bookings", "layout");
}

export async function deleteBookingDish(lineId: number, bookingId: number) {
  await db.delete(bookingDishes).where(eq(bookingDishes.id, lineId));
  revalidatePath(`/bookings/${bookingId}`);
}

/** Copy a package's dishes into a booking's editable custom menu, then detach
 *  the package — so the client can start from a package and swap dishes. */
export async function applyPackageToBookingMenu(
  bookingId: number,
  packageId: number,
) {
  const pkgDishes = await db
    .select()
    .from(packageDishes)
    .where(eq(packageDishes.packageId, packageId));

  await db.delete(bookingDishes).where(eq(bookingDishes.bookingId, bookingId));
  for (const pd of pkgDishes) {
    await db.insert(bookingDishes).values({
      bookingId,
      dishId: pd.dishId,
      qty: pd.qtyPerGuest,
      perGuest: true,
    });
  }
  await db
    .update(bookings)
    .set({ packageId: null })
    .where(eq(bookings.id, bookingId));

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
}

// ---------- suppliers / purchases ----------

export async function createSupplier(input: {
  name: string;
  category?: string;
  contactPerson?: string;
  phone?: string;
  notes?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(suppliers).values({
    venueId,
    name: input.name.trim(),
    category: input.category?.trim() || null,
    contactPerson: input.contactPerson?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  revalidatePath("/suppliers");
}

export async function updateSupplier(
  id: number,
  input: {
    name?: string;
    category?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
    notes?: string | null;
    active?: boolean;
  },
) {
  await db
    .update(suppliers)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.category !== undefined
        ? { category: input.category?.trim() || null }
        : {}),
      ...(input.contactPerson !== undefined
        ? { contactPerson: input.contactPerson?.trim() || null }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
    .where(eq(suppliers.id, id));
  revalidatePath("/suppliers");
}

export async function deleteSupplier(id: number) {
  await db.delete(suppliers).where(eq(suppliers.id, id));
  revalidatePath("/suppliers");
}

function purchaseStatus(total: number, paid: number) {
  if (paid >= total && total > 0) return "paid" as const;
  if (paid > 0) return "partial" as const;
  return "unpaid" as const;
}

export async function createPurchase(input: {
  supplierId: number | null;
  purchaseDate: string;
  total: number;
  paid: number;
  note?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.purchaseDate) return { error: "თარიღი აუცილებელია" };
  const total = input.total || 0;
  const paid = input.paid || 0;
  await db.insert(purchases).values({
    venueId,
    supplierId: input.supplierId ?? null,
    purchaseDate: input.purchaseDate,
    total,
    paid,
    status: purchaseStatus(total, paid),
    note: input.note?.trim() || null,
  });
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function updatePurchase(
  id: number,
  input: { total?: number; paid?: number; note?: string | null },
) {
  const [cur] = await db
    .select({ total: purchases.total, paid: purchases.paid })
    .from(purchases)
    .where(eq(purchases.id, id));
  if (!cur) return;
  const total = input.total ?? cur.total;
  const paid = input.paid ?? cur.paid;
  await db
    .update(purchases)
    .set({
      total,
      paid,
      status: purchaseStatus(total, paid),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
    })
    .where(eq(purchases.id, id));
  revalidatePath("/suppliers");
}

/** Mark a purchase fully paid (paid = total). */
export async function settlePurchase(id: number) {
  const [cur] = await db
    .select({ total: purchases.total })
    .from(purchases)
    .where(eq(purchases.id, id));
  if (!cur) return;
  await db
    .update(purchases)
    .set({ paid: cur.total, status: purchaseStatus(cur.total, cur.total) })
    .where(eq(purchases.id, id));
  revalidatePath("/suppliers");
}

export async function deletePurchase(id: number) {
  await db.delete(purchases).where(eq(purchases.id, id));
  revalidatePath("/suppliers");
}

// ---------- forecast / business-model params ----------

export async function saveModelParams(params: Record<string, number>) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };

  for (const [key, value] of Object.entries(params)) {
    await db
      .insert(settings)
      .values({ venueId, key, value: String(value) })
      .onConflictDoUpdate({
        target: [settings.venueId, settings.key],
        set: { value: String(value) },
      });
  }

  revalidatePath("/forecast");
  revalidatePath("/");
  return { ok: true };
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

// ---------- operational / common (one-off) expenses ----------

export async function createOperationalExpense(input: {
  name: string;
  amount: number;
  kind?: string;
  category?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(operationalExpenses).values({
    venueId,
    name: input.name.trim(),
    amount: input.amount || 0,
    kind: input.kind === "partner_advance" ? "partner_advance" : "operational",
    category: input.category?.trim() || null,
  });
  revalidatePath("/finance");
}

export async function updateOperationalExpense(
  id: number,
  input: { name?: string; amount?: number; kind?: string; category?: string | null },
) {
  await db
    .update(operationalExpenses)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.category !== undefined
        ? { category: input.category?.trim() || null }
        : {}),
    })
    .where(eq(operationalExpenses.id, id));
  revalidatePath("/finance");
}

export async function deleteOperationalExpense(id: number) {
  await db.delete(operationalExpenses).where(eq(operationalExpenses.id, id));
  revalidatePath("/finance");
}

// ---------- partners (profit split) ----------

export async function createPartner(input: { name: string; sharePct: number }) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return;
  await db.insert(partners).values({
    venueId,
    name: input.name.trim(),
    sharePct: Math.min(Math.max(input.sharePct || 0, 0), 100),
  });
  revalidatePath("/finance");
  revalidatePath("/register");
}

export async function updatePartner(
  id: number,
  input: { name?: string; sharePct?: number; active?: boolean },
) {
  await db
    .update(partners)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sharePct !== undefined
        ? { sharePct: Math.min(Math.max(input.sharePct, 0), 100) }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
    .where(eq(partners.id, id));
  revalidatePath("/finance");
  revalidatePath("/register");
}

export async function deletePartner(id: number) {
  await db.delete(partners).where(eq(partners.id, id));
  revalidatePath("/finance");
  revalidatePath("/register");
}

export async function addPartnerDraw(input: {
  partnerId: number;
  drawDate: string;
  amount: number;
  note?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.amount || input.amount <= 0) return { error: "თანხა აუცილებელია" };
  if (!input.drawDate) return { error: "თარიღი აუცილებელია" };
  await db.insert(partnerDraws).values({
    venueId,
    partnerId: input.partnerId,
    drawDate: input.drawDate,
    amount: input.amount,
    note: input.note?.trim() || null,
  });
  revalidatePath("/finance");
  return { ok: true };
}

export async function deletePartnerDraw(id: number) {
  await db.delete(partnerDraws).where(eq(partnerDraws.id, id));
  revalidatePath("/finance");
}

// ---------- partner advances ----------

/** Set a partner's initial advance (the debt they took). */
export async function setPartnerAdvance(partnerId: number, amount: number) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  await db
    .update(partners)
    .set({ advanceAmount: Math.max(amount || 0, 0) })
    .where(and(eq(partners.id, partnerId), eq(partners.venueId, venueId)));
  revalidatePath("/finance");
  revalidatePath("/register");
  return { ok: true };
}

/** Record a repayment that reduces a partner's advance debt. */
export async function addAdvanceRepayment(input: {
  partnerId: number;
  amount: number;
  repayDate: string;
  note?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.amount || input.amount <= 0) return { error: "თანხა აუცილებელია" };
  if (!input.repayDate) return { error: "თარიღი აუცილებელია" };
  await db.insert(advanceRepayments).values({
    venueId,
    partnerId: input.partnerId,
    repayDate: input.repayDate,
    amount: input.amount,
    note: input.note?.trim() || null,
  });
  revalidatePath("/finance");
  revalidatePath("/register");
  return { ok: true };
}

export async function deleteAdvanceRepayment(id: number) {
  await db.delete(advanceRepayments).where(eq(advanceRepayments.id, id));
  revalidatePath("/finance");
  revalidatePath("/register");
}

// ---------- general debts ----------

export async function createDebt(input: { name: string; amount: number; note?: string }) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.name.trim()) return { error: "დასახელება აუცილებელია" };
  await db.insert(debts).values({
    venueId,
    name: input.name.trim(),
    amount: Math.max(input.amount || 0, 0),
    note: input.note?.trim() || null,
  });
  revalidatePath("/finance");
  revalidatePath("/register");
  return { ok: true };
}

export async function updateDebt(id: number, input: { name?: string; amount?: number }) {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  await db
    .update(debts)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.amount !== undefined ? { amount: Math.max(input.amount, 0) } : {}),
    })
    .where(and(eq(debts.id, id), eq(debts.venueId, venueId)));
  revalidatePath("/finance");
  revalidatePath("/register");
}

export async function deleteDebt(id: number) {
  await db.delete(debts).where(eq(debts.id, id));
  revalidatePath("/finance");
  revalidatePath("/register");
}

export async function addDebtRepayment(input: {
  debtId: number;
  amount: number;
  repayDate: string;
  note?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.amount || input.amount <= 0) return { error: "თანხა აუცილებელია" };
  if (!input.repayDate) return { error: "თარიღი აუცილებელია" };
  await db.insert(debtRepayments).values({
    venueId,
    debtId: input.debtId,
    repayDate: input.repayDate,
    amount: input.amount,
    note: input.note?.trim() || null,
  });
  revalidatePath("/finance");
  revalidatePath("/register");
  return { ok: true };
}

export async function deleteDebtRepayment(id: number) {
  await db.delete(debtRepayments).where(eq(debtRepayments.id, id));
  revalidatePath("/finance");
  revalidatePath("/register");
}

// ---------- inventory ----------

export async function createInventoryItem(input: {
  name: string;
  category?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  minQty?: number | null;
  perGuest?: number | null;
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
    perGuest: input.perGuest ?? null,
  });
  revalidatePath("/inventory");
  revalidatePath("/calc");
  revalidatePath("/bookings", "layout");
}

export async function updateInventoryItem(
  id: number,
  input: {
    name?: string;
    category?: string | null;
    quantity?: number;
    unitPrice?: number;
    minQty?: number | null;
    perGuest?: number | null;
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
      ...(input.perGuest !== undefined ? { perGuest: input.perGuest } : {}),
    })
    .where(eq(inventoryItems.id, id));
  revalidatePath("/inventory");
  revalidatePath("/calc");
  revalidatePath("/bookings", "layout");
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

  // Hard-block exact duplicates (same date + same title, not cancelled) —
  // prevents the same event being entered twice by accident.
  const [dup] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.venueId, venueId),
        eq(bookings.eventDate, input.eventDate),
        sql`lower(trim(${bookings.title})) = ${input.title.trim().toLowerCase()}`,
        sql`${bookings.status} <> 'cancelled'`,
      ),
    )
    .limit(1);
  if (dup) {
    return {
      error: "ზუსტად იგივე ჯავშანი ამ თარიღზე უკვე არსებობს — გახსენი და დაარედაქტირე.",
    };
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
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/receivables");
  revalidatePath("/");
}

/** Set the lump-sum total a client pays (menu + rent) as a single number.
 *  Stored as extraCharges with ppg=0 so bookingTotal() == this value. */
export async function setBookingLumpSum(bookingId: number, total: number) {
  const t = Math.max(total || 0, 0);
  await db
    .update(bookings)
    .set({ pricePerGuest: 0, extraCharges: t, discount: 0 })
    .where(eq(bookings.id, bookingId));
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/receivables");
  revalidatePath("/");
  return { ok: true };
}

export async function updateBooking(
  bookingId: number,
  input: {
    title?: string;
    eventType?: string;
    eventDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    guestCount?: number;
    pricePerGuest?: number;
    extraCharges?: number;
    discount?: number;
    notes?: string | null;
    requirements?: string | null;
    clientName?: string | null;
    clientPhone?: string | null;
  },
) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };

  // Resolve / create / update the client if a name was provided.
  let clientIdPatch: { clientId?: number | null } = {};
  if (input.clientName !== undefined) {
    const name = input.clientName?.trim();
    if (!name) {
      clientIdPatch = { clientId: null };
    } else {
      const [current] = await db
        .select({ clientId: bookings.clientId })
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      if (current?.clientId) {
        await db
          .update(clients)
          .set({ name, phone: input.clientPhone?.trim() || null })
          .where(eq(clients.id, current.clientId));
      } else {
        const [c] = await db
          .insert(clients)
          .values({ venueId, name, phone: input.clientPhone?.trim() || null })
          .returning({ id: clients.id });
        clientIdPatch = { clientId: c.id };
      }
    }
  }

  await db
    .update(bookings)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.eventType !== undefined
        ? { eventType: input.eventType as typeof bookings.$inferInsert.eventType }
        : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(input.endTime !== undefined ? { endTime: input.endTime } : {}),
      ...(input.guestCount !== undefined ? { guestCount: input.guestCount } : {}),
      ...(input.pricePerGuest !== undefined
        ? { pricePerGuest: input.pricePerGuest }
        : {}),
      ...(input.extraCharges !== undefined
        ? { extraCharges: input.extraCharges }
        : {}),
      ...(input.discount !== undefined ? { discount: input.discount } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.requirements !== undefined
        ? { requirements: input.requirements?.trim() || null }
        : {}),
      ...clientIdPatch,
    })
    .where(and(eq(bookings.id, bookingId), eq(bookings.venueId, venueId)));

  // Payment mirrors live on the event's date — move them if the date changed.
  if (input.eventDate !== undefined) {
    await db
      .update(ledger)
      .set({ entryDate: input.eventDate })
      .where(and(eq(ledger.bookingId, bookingId), isNotNull(ledger.paymentId)));
    revalidatePath("/register");
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/");
  return { ok: true };
}

/** Quick-save just the requirements text (from the detail view's own box). */
export async function saveBookingRequirements(bookingId: number, text: string) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  await db
    .update(bookings)
    .set({ requirements: text.trim() || null })
    .where(and(eq(bookings.id, bookingId), eq(bookings.venueId, venueId)));
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true };
}

export async function deleteBooking(bookingId: number) {
  await db.delete(bookings).where(eq(bookings.id, bookingId));
  revalidatePath("/bookings");
  revalidatePath("/");
}

// ---------- booking finances (payments + event ledger) ----------

export async function deletePayment(paymentId: number, bookingId: number) {
  // The register mirror row cascades away with the payment.
  await db.delete(payments).where(eq(payments.id, paymentId));
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/register");
  revalidatePath("/");
}

/** Log an expense/income against a specific booking. Also lands in the day
 *  register (same ledger table, filtered by date) once that module exists. */
export async function addBookingLedgerEntry(input: {
  bookingId: number;
  type: string;
  category?: string;
  amount: number;
  qty?: number;
  entryDate: string;
  note?: string;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  if (!input.amount || input.amount <= 0) return { error: "თანხა აუცილებელია" };
  if (!input.entryDate) return { error: "თარიღი აუცილებელია" };

  await db.insert(ledger).values({
    venueId,
    bookingId: input.bookingId,
    entryDate: input.entryDate,
    type: input.type as typeof ledger.$inferInsert.type,
    category: input.category?.trim() || null,
    amount: input.amount,
    qty: input.qty && input.qty > 0 ? input.qty : 1,
    note: input.note?.trim() || null,
  });

  revalidatePath(`/bookings/${input.bookingId}`);
  revalidatePath("/register");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteBookingLedgerEntry(
  entryId: number,
  bookingId: number,
) {
  await db.delete(ledger).where(eq(ledger.id, entryId));
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/register");
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
  menuTypeId?: number | null;
  sellPrice: number;
}) {
  const venueId = await getActiveVenueId();
  if (!venueId || !input.name.trim()) return null;
  const [row] = await db
    .insert(dishes)
    .values({
      venueId,
      name: input.name.trim(),
      categoryId: input.categoryId,
      menuTypeId: input.menuTypeId ?? null,
      sellPrice: input.sellPrice || 0,
    })
    .returning({ id: dishes.id });
  revalidatePath("/calc");
  return row?.id ?? null;
}

export async function updateDish(
  id: number,
  input: {
    name?: string;
    sellPrice?: number;
    categoryId?: number | null;
    menuTypeId?: number | null;
  },
) {
  await db
    .update(dishes)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sellPrice !== undefined ? { sellPrice: input.sellPrice } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.menuTypeId !== undefined ? { menuTypeId: input.menuTypeId } : {}),
    })
    .where(eq(dishes.id, id));
  revalidatePath("/calc");
}

// ---------- menu types ----------

export async function createMenuType(name: string) {
  const venueId = await getActiveVenueId();
  if (!venueId || !name.trim()) return;
  await db.insert(menuTypes).values({ venueId, name: name.trim() });
  revalidatePath("/calc");
}

export async function renameMenuType(id: number, name: string) {
  if (!name.trim()) return;
  await db.update(menuTypes).set({ name: name.trim() }).where(eq(menuTypes.id, id));
  revalidatePath("/calc");
}

export async function deleteMenuType(id: number) {
  await db.delete(menuTypes).where(eq(menuTypes.id, id));
  revalidatePath("/calc");
}

export async function deleteDish(id: number) {
  await db.delete(dishes).where(eq(dishes.id, id));
  revalidatePath("/calc");
}

/** Clone a dish with its full recipe + inventory links (fast menu variants). */
export async function duplicateDish(dishId: number) {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  const [d] = await db
    .select()
    .from(dishes)
    .where(and(eq(dishes.id, dishId), eq(dishes.venueId, venueId)));
  if (!d) return;

  const [copy] = await db
    .insert(dishes)
    .values({
      venueId,
      name: `${d.name} (ასლი)`,
      categoryId: d.categoryId,
      menuTypeId: d.menuTypeId,
      sellPrice: d.sellPrice,
      active: d.active,
    })
    .returning({ id: dishes.id });

  const [recipe, invLinks] = await Promise.all([
    db.select().from(dishIngredients).where(eq(dishIngredients.dishId, dishId)),
    db.select().from(dishInventory).where(eq(dishInventory.dishId, dishId)),
  ]);
  for (const r of recipe)
    await db
      .insert(dishIngredients)
      .values({ dishId: copy.id, ingredientId: r.ingredientId, qty: r.qty });
  for (const l of invLinks)
    await db.insert(dishInventory).values({
      dishId: copy.id,
      itemId: l.itemId,
      qtyPerPortion: l.qtyPerPortion,
    });

  revalidatePath("/calc");
}

export async function saveTargetFoodCostPct(pct: number) {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  const clamped = Math.min(Math.max(pct || 0, 1), 100);
  await db
    .insert(settings)
    .values({ venueId, key: "targetFoodCostPct", value: String(clamped) })
    .onConflictDoUpdate({
      target: [settings.venueId, settings.key],
      set: { value: String(clamped) },
    });
  revalidatePath("/calc");
}

// ---------- Telegram reminders ----------

export type TelegramRecipient = { id: number; name: string | null; chatId: string };

export async function getTelegramStatus(): Promise<{
  hasToken: boolean;
  recipients: TelegramRecipient[];
  joinCode: string;
}> {
  const venueId = await getActiveVenueId();
  if (!venueId) return { hasToken: false, recipients: [], joinCode: "" };
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      and(
        eq(settings.venueId, venueId),
        inArray(settings.key, ["telegramBotToken", "telegramJoinCode"]),
      ),
    );
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  const hasToken = !!(process.env.TELEGRAM_BOT_TOKEN || get("telegramBotToken"));
  const recipients = await getRecipients(venueId);
  return { hasToken, recipients, joinCode: get("telegramJoinCode") };
}

/** Generate (or rotate) the 4-digit code required for /start self-registration. */
export async function regenerateJoinCode() {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  const code = String(Math.floor(1000 + Math.random() * 9000));
  await upsertSetting(venueId, "telegramJoinCode", code);
  revalidatePath("/settings");
  return { ok: true, code };
}

export async function disableJoinCode() {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  await db
    .delete(settings)
    .where(and(eq(settings.venueId, venueId), eq(settings.key, "telegramJoinCode")));
  revalidatePath("/settings");
}

async function upsertSetting(venueId: number, key: string, value: string) {
  await db
    .insert(settings)
    .values({ venueId, key, value })
    .onConflictDoUpdate({ target: [settings.venueId, settings.key], set: { value } });
}

async function getBotToken(venueId: number): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.venueId, venueId), eq(settings.key, "telegramBotToken")));
  return row?.value ?? null;
}

/** Save the bot token and add the first recipient (whoever /start-ed the bot). */
export async function connectTelegram(token: string) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { ok: false as const, error: "ობიექტი არ არის არჩეული" };
  const t = token.trim();
  if (!t.includes(":"))
    return { ok: false as const, error: "ბოტის token არასწორია (BotFather-იდან დააკოპირე)" };
  await upsertSetting(venueId, "telegramBotToken", t);
  const res = await addTelegramRecipients();
  revalidatePath("/settings");
  return res;
}

/** Add every new chat that has messaged the bot as a reminder recipient. */
export async function addTelegramRecipients() {
  const venueId = await getActiveVenueId();
  if (!venueId) return { ok: false as const, error: "ობიექტი არ არის არჩეული" };
  const token = await getBotToken(venueId);
  if (!token) return { ok: false as const, error: "ჯერ ჩაწერე ბოტის token" };

  const chats = await resolveTelegramChats(token);
  if (chats.length === 0) {
    return {
      ok: false as const,
      error: "ვერავინ ვიპოვე — თანამშრომელმა ჯერ Telegram-ში ბოტს უნდა მისწეროს /start, მერე დააჭირე.",
    };
  }
  const existing = await getRecipients(venueId);
  const have = new Set(existing.map((r) => r.chatId));
  const added: string[] = [];
  const [v] = await db.select({ name: venues.name }).from(venues).where(eq(venues.id, venueId));
  for (const c of chats) {
    if (have.has(c.chatId)) continue;
    await db.insert(telegramRecipients).values({ venueId, chatId: c.chatId, name: c.name || null });
    await sendTelegram(token, c.chatId, `✅ <b>${v?.name ?? "AvenueOS"}</b> — შეხსენებები ჩართულია${c.name ? `, ${c.name}` : ""}.`);
    added.push(c.name || c.chatId);
  }
  revalidatePath("/settings");
  return added.length > 0
    ? { ok: true as const, added }
    : { ok: false as const, error: "ახალი თანამშრომელი არ დამატებულა (უკვე დამატებული არიან)." };
}

/** Register the webhook + command menu so /ჯავშნები and self-/start work.
 *  Must be run from the deployed (public) URL — Telegram can't reach localhost. */
export async function setupTelegramBot() {
  const venueId = await getActiveVenueId();
  if (!venueId) return { ok: false as const, error: "ობიექტი არ არის არჩეული" };
  const token = await getBotToken(venueId);
  if (!token) return { ok: false as const, error: "ჯერ ჩაწერე ბოტის token" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host || host.startsWith("localhost") || host.startsWith("127.")) {
    return {
      ok: false as const,
      error: "ბოტის ბრძანებები მხოლოდ გამოქვეყნებულ საიტზე ირთვება (avenueos.onrender.com), ლოკალურად არა.",
    };
  }
  const url = `${proto}://${host}/api/telegram`;

  // a random secret Telegram will echo back on every webhook call
  const secret = randomUUID().replace(/-/g, "");
  await upsertSetting(venueId, "telegramWebhookSecret", secret);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return { ok: false as const, error: `Telegram: ${data?.description ?? "setWebhook ვერ მოხერხდა"}` };
  }

  await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Telegram only accepts [a-z0-9_] as command names, so the menu is in
      // English; the webhook still answers the Georgian aliases if typed.
      commands: [
        { command: "bookings", description: "მომავალი ჯავშნების სია" },
        { command: "today", description: "დღევანდელი ივენთები" },
        { command: "expense", description: "ხარჯი — მაგ: /expense 450 ბაზარი" },
        { command: "income", description: "შემოსავალი — მაგ: /income 300 ფოტოსესია" },
        { command: "payment", description: "გადახდა — მაგ: /payment ნათია 2000" },
        { command: "close", description: "დღის დახურვა — მაგ: /close 500" },
        { command: "client", description: "კლიენტის ისტორია — მაგ: /client ნათია" },
        { command: "help", description: "დახმარება" },
      ],
    }),
  });

  revalidatePath("/settings");
  return { ok: true as const, url };
}

export async function removeTelegramRecipient(id: number) {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  await db
    .delete(telegramRecipients)
    .where(and(eq(telegramRecipients.id, id), eq(telegramRecipients.venueId, venueId)));
  revalidatePath("/settings");
}

export async function sendTestReminder() {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  const token = await getBotToken(venueId);
  const recipients = await getRecipients(venueId);
  if (!token || recipients.length === 0) return { error: "ჯერ დააკავშირე Telegram" };
  let ok = false;
  for (const r of recipients) {
    if (await sendTelegram(token, r.chatId, "🔔 <b>სატესტო შეხსენება</b>\nასე მოგივა ივენთის შეხსენება 2 და 1 დღით ადრე.")) ok = true;
  }
  return ok ? { ok: true } : { error: "გაგზავნა ვერ მოხერხდა — შეამოწმე token" };
}

/** Full disconnect: drops the token and all recipients for this venue. */
export async function disconnectTelegram() {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  await db.delete(telegramRecipients).where(eq(telegramRecipients.venueId, venueId));
  await db
    .delete(settings)
    .where(and(eq(settings.venueId, venueId), inArray(settings.key, ["telegramBotToken", "telegramChatId"])));
  revalidatePath("/settings");
}

// ---------- Google Sheets sync ----------

export async function getSheetId(): Promise<string> {
  const venueId = await getActiveVenueId();
  if (!venueId) return "";
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(and(eq(settings.venueId, venueId), eq(settings.key, "sheetId")));
  return row?.value ?? "";
}

export async function saveSheetId(input: string) {
  const venueId = await getActiveVenueId();
  if (!venueId) return { error: "ობიექტი არ არის არჩეული" };
  const id = extractSheetId(input.trim());
  await db
    .insert(settings)
    .values({ venueId, key: "sheetId", value: id })
    .onConflictDoUpdate({ target: [settings.venueId, settings.key], set: { value: id } });
  revalidatePath("/settings");
  return { ok: true, id };
}

export async function runSheetSync(overrideInput?: string): Promise<SyncResult & { error?: string }> {
  const venueId = await getActiveVenueId();
  if (!venueId)
    return { ok: false, error: "ობიექტი არ არის არჩეული", added: 0, updated: 0, skipped: 0, tabsRead: [], rows: 0 };
  const id = overrideInput?.trim() || (await getSheetId());
  if (!id)
    return { ok: false, error: "ჯერ ჩაწერე Google Sheet-ის ბმული", added: 0, updated: 0, skipped: 0, tabsRead: [], rows: 0 };
  const res = await syncBookingsFromSheet(venueId, id);
  if (res.ok) {
    revalidatePath("/bookings");
    revalidatePath("/receivables");
    revalidatePath("/analytics");
    revalidatePath("/");
  }
  return res;
}

export async function saveIncomeTaxPct(pct: number) {
  const venueId = await getActiveVenueId();
  if (!venueId) return;
  const clamped = Math.min(Math.max(pct || 0, 0), 100);
  await db
    .insert(settings)
    .values({ venueId, key: "incomeTaxPct", value: String(clamped) })
    .onConflictDoUpdate({
      target: [settings.venueId, settings.key],
      set: { value: String(clamped) },
    });
  revalidatePath("/finance");
  revalidatePath("/register");
  revalidatePath("/bookings", "layout");
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
  const [booking] = await db
    .select({ venueId: bookings.venueId, eventDate: bookings.eventDate })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  if (!booking) return { error: "ჯავშანი ვერ მოიძებნა" };

  const [payment] = await db
    .insert(payments)
    .values({
      bookingId,
      amount,
      paidOn,
      method: method as typeof payments.$inferInsert.method,
    })
    .returning({ id: payments.id });

  // Mirror into the day register on the EVENT's date, not the day the money was
  // taken: an advance for a future event belongs to that event's day, so each
  // day's register (and its profit split) reflects that day's event only.
  await db.insert(ledger).values({
    venueId: booking.venueId,
    entryDate: booking.eventDate,
    type: "income",
    category: "ჯავშნის გადახდა",
    bookingId,
    paymentId: payment.id,
    amount,
    qty: 1,
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/register");
  revalidatePath("/");
  return { ok: true };
}

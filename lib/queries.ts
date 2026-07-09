import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./db";
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
  ledger,
  payments,
  staff,
} from "@/db/schema";
import { todayISO } from "./format";
import { bookingTotal, type BookingRow } from "./booking-shared";
import type {
  InventoryItem,
  MenuCategory,
  MenuDish,
  MenuIngredient,
} from "./menu-shared";

export { bookingTotal, type BookingRow };

export async function getMenuData(venueId: number): Promise<{
  ingredients: MenuIngredient[];
  categories: MenuCategory[];
  dishes: MenuDish[];
}> {
  const [ings, cats, dishRows] = await Promise.all([
    db
      .select()
      .from(ingredients)
      .where(eq(ingredients.venueId, venueId))
      .orderBy(asc(ingredients.name)),
    db
      .select()
      .from(dishCategories)
      .where(eq(dishCategories.venueId, venueId))
      .orderBy(asc(dishCategories.sort), asc(dishCategories.id)),
    db
      .select()
      .from(dishes)
      .where(eq(dishes.venueId, venueId))
      .orderBy(asc(dishes.name)),
  ]);

  const dishIds = dishRows.map((d) => d.id);
  const [lines, invLines] = dishIds.length
    ? await Promise.all([
        db
          .select()
          .from(dishIngredients)
          .where(inArray(dishIngredients.dishId, dishIds)),
        db
          .select()
          .from(dishInventory)
          .where(inArray(dishInventory.dishId, dishIds)),
      ])
    : [[], []];

  return {
    ingredients: ings.map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      pricePerUnit: i.pricePerUnit,
      wastePct: i.wastePct,
    })),
    categories: cats.map((c) => ({ id: c.id, name: c.name })),
    dishes: dishRows.map((d) => ({
      id: d.id,
      name: d.name,
      categoryId: d.categoryId,
      sellPrice: d.sellPrice,
      lines: lines
        .filter((l) => l.dishId === d.id)
        .map((l) => ({ id: l.id, ingredientId: l.ingredientId, qty: l.qty })),
      invLines: invLines
        .filter((l) => l.dishId === d.id)
        .map((l) => ({ id: l.id, itemId: l.itemId, qtyPerPortion: l.qtyPerPortion })),
    })),
  };
}

export type FixedCostRow = {
  id: number;
  name: string;
  monthlyAmount: number;
  active: boolean;
};

export async function getFixedCosts(venueId: number): Promise<FixedCostRow[]> {
  const rows = await db
    .select()
    .from(fixedCosts)
    .where(eq(fixedCosts.venueId, venueId))
    .orderBy(desc(fixedCosts.monthlyAmount));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    monthlyAmount: r.monthlyAmount,
    active: r.active,
  }));
}

export async function getInventoryItems(venueId: number): Promise<InventoryItem[]> {
  const rows = await db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.venueId, venueId))
    .orderBy(asc(inventoryItems.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    minQty: r.minQty,
  }));
}

export async function getBookings(venueId: number): Promise<BookingRow[]> {
  const rows = await db
    .select({
      id: bookings.id,
      title: bookings.title,
      eventType: bookings.eventType,
      eventDate: bookings.eventDate,
      guestCount: bookings.guestCount,
      pricePerGuest: bookings.pricePerGuest,
      extraCharges: bookings.extraCharges,
      discount: bookings.discount,
      status: bookings.status,
      notes: bookings.notes,
      clientName: clients.name,
      clientPhone: clients.phone,
      paidTotal: sql<number>`coalesce((select sum(${payments.amount}) from ${payments} where ${payments.bookingId} = ${bookings.id}), 0)::float`,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(eq(bookings.venueId, venueId))
    .orderBy(desc(bookings.eventDate));
  return rows;
}

export type BookingPayment = {
  id: number;
  paidOn: string;
  amount: number;
  method: string;
  note: string | null;
};

export type BookingExpense = {
  id: number;
  entryDate: string;
  type: string;
  category: string | null;
  amount: number;
  qty: number;
  note: string | null;
  staffName: string | null;
};

export type BookingDetail = BookingRow & {
  venueId: number;
  startTime: string | null;
  endTime: string | null;
  clientId: number | null;
  payments: BookingPayment[];
  expenses: BookingExpense[];
};

export async function getBookingDetail(
  venueId: number,
  id: number,
): Promise<BookingDetail | null> {
  const [b] = await db
    .select({
      id: bookings.id,
      venueId: bookings.venueId,
      title: bookings.title,
      eventType: bookings.eventType,
      eventDate: bookings.eventDate,
      startTime: bookings.startTime,
      endTime: bookings.endTime,
      guestCount: bookings.guestCount,
      pricePerGuest: bookings.pricePerGuest,
      extraCharges: bookings.extraCharges,
      discount: bookings.discount,
      status: bookings.status,
      notes: bookings.notes,
      clientId: bookings.clientId,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(bookings)
    .leftJoin(clients, eq(bookings.clientId, clients.id))
    .where(and(eq(bookings.id, id), eq(bookings.venueId, venueId)));
  if (!b) return null;

  const [pays, exps] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, id))
      .orderBy(desc(payments.paidOn), desc(payments.id)),
    db
      .select({
        id: ledger.id,
        entryDate: ledger.entryDate,
        type: ledger.type,
        category: ledger.category,
        amount: ledger.amount,
        qty: ledger.qty,
        note: ledger.note,
        staffName: staff.name,
      })
      .from(ledger)
      .leftJoin(staff, eq(ledger.staffId, staff.id))
      .where(eq(ledger.bookingId, id))
      .orderBy(desc(ledger.entryDate), desc(ledger.id)),
  ]);

  const paidTotal = pays.reduce((s, p) => s + p.amount, 0);

  return {
    ...b,
    paidTotal,
    payments: pays.map((p) => ({
      id: p.id,
      paidOn: p.paidOn,
      amount: p.amount,
      method: p.method,
      note: p.note,
    })),
    expenses: exps.map((e) => ({
      id: e.id,
      entryDate: e.entryDate,
      type: e.type,
      category: e.category,
      amount: e.amount,
      qty: e.qty,
      note: e.note,
      staffName: e.staffName,
    })),
  };
}

export async function getDashboardStats(venueId: number) {
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";

  const all = await getBookings(venueId);
  const active = all.filter((b) => b.status !== "cancelled");
  const upcoming = active
    .filter((b) => b.eventDate >= today && b.status !== "completed")
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const pipeline = upcoming.reduce((s, b) => s + bookingTotal(b), 0);
  const outstanding = active.reduce(
    (s, b) => s + Math.max(bookingTotal(b) - b.paidTotal, 0),
    0,
  );

  const [monthLedger] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${ledger.type} = 'income' then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
      spent: sql<number>`coalesce(sum(case when ${ledger.type} in ('expense','wage') then ${ledger.amount} * ${ledger.qty} end), 0)::float`,
    })
    .from(ledger)
    .where(
      and(
        eq(ledger.venueId, venueId),
        gte(ledger.entryDate, monthStart),
        lte(ledger.entryDate, today),
      ),
    );

  return {
    upcoming: upcoming.slice(0, 6),
    upcomingCount: upcoming.length,
    pipeline,
    outstanding,
    monthIncome: monthLedger?.income ?? 0,
    monthSpent: monthLedger?.spent ?? 0,
    totalBookings: active.length,
  };
}

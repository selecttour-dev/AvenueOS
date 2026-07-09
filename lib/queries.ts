import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  bookings,
  clients,
  dishCategories,
  dishes,
  dishIngredients,
  ingredients,
  ledger,
  payments,
} from "@/db/schema";
import { todayISO } from "./format";
import { bookingTotal, type BookingRow } from "./booking-shared";
import type {
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

  const lines = dishRows.length
    ? await db
        .select()
        .from(dishIngredients)
        .where(
          inArray(
            dishIngredients.dishId,
            dishRows.map((d) => d.id),
          ),
        )
    : [];

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
    })),
  };
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

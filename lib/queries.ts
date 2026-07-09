import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
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
  payments,
  settings,
  staff,
} from "@/db/schema";
import { PARAM_KEYS, type ModelParams } from "./forecast-shared";
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

// ---------- daily register ----------

export type LedgerEntry = {
  id: number;
  entryDate: string;
  type: string;
  category: string | null;
  amount: number;
  qty: number;
  note: string | null;
  staffId: number | null;
  staffName: string | null;
  bookingId: number | null;
  bookingTitle: string | null;
};

export type StaffMember = {
  id: number;
  name: string;
  role: string | null;
  phone: string | null;
  dailyRate: number;
  active: boolean;
};

export type DayCloseRow = {
  closeDate: string;
  openingBalance: number;
  income: number;
  wages: number;
  expenses: number;
  net: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  notes: string | null;
};

export type RegisterDay = {
  date: string;
  entries: LedgerEntry[];
  income: number;
  wages: number;
  expenses: number;
  net: number;
  openingBalance: number;
  expectedCash: number;
  close: DayCloseRow | null;
  staff: StaffMember[];
  bookings: { id: number; title: string; eventDate: string }[];
};

export const entryTotal = (e: { amount: number; qty: number }) =>
  e.amount * e.qty;

export async function getStaff(venueId: number): Promise<StaffMember[]> {
  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.venueId, venueId))
    .orderBy(desc(staff.active), asc(staff.name));
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    phone: s.phone,
    dailyRate: s.dailyRate,
    active: s.active,
  }));
}

async function openingBalanceFor(
  venueId: number,
  date: string,
): Promise<number> {
  const [prior] = await db
    .select()
    .from(dayCloses)
    .where(and(eq(dayCloses.venueId, venueId), lt(dayCloses.closeDate, date)))
    .orderBy(desc(dayCloses.closeDate))
    .limit(1);
  if (!prior) return 0;
  return prior.countedCash ?? prior.expectedCash;
}

export async function getRegisterDay(
  venueId: number,
  date: string,
): Promise<RegisterDay> {
  const [entryRows, staffList, closeRows, bookingRows, opening] =
    await Promise.all([
      db
        .select({
          id: ledger.id,
          entryDate: ledger.entryDate,
          type: ledger.type,
          category: ledger.category,
          amount: ledger.amount,
          qty: ledger.qty,
          note: ledger.note,
          staffId: ledger.staffId,
          staffName: staff.name,
          bookingId: ledger.bookingId,
          bookingTitle: bookings.title,
        })
        .from(ledger)
        .leftJoin(staff, eq(ledger.staffId, staff.id))
        .leftJoin(bookings, eq(ledger.bookingId, bookings.id))
        .where(and(eq(ledger.venueId, venueId), eq(ledger.entryDate, date)))
        .orderBy(desc(ledger.id)),
      getStaff(venueId),
      db
        .select()
        .from(dayCloses)
        .where(
          and(eq(dayCloses.venueId, venueId), eq(dayCloses.closeDate, date)),
        )
        .limit(1),
      db
        .select({
          id: bookings.id,
          title: bookings.title,
          eventDate: bookings.eventDate,
        })
        .from(bookings)
        .where(eq(bookings.venueId, venueId))
        .orderBy(desc(bookings.eventDate))
        .limit(200),
      openingBalanceFor(venueId, date),
    ]);

  let income = 0;
  let wages = 0;
  let expenses = 0;
  for (const e of entryRows) {
    const t = entryTotal(e);
    if (e.type === "income") income += t;
    else if (e.type === "wage") wages += t;
    else expenses += t;
  }
  const net = income - wages - expenses;
  const expectedCash = opening + net;
  const existing = closeRows[0];

  return {
    date,
    entries: entryRows,
    income,
    wages,
    expenses,
    net,
    openingBalance: opening,
    expectedCash,
    staff: staffList,
    bookings: bookingRows,
    close: existing
      ? {
          closeDate: existing.closeDate,
          openingBalance: existing.openingBalance,
          income: existing.income,
          wages: existing.wages,
          expenses: existing.expenses,
          net: existing.net,
          expectedCash: existing.expectedCash,
          countedCash: existing.countedCash,
          difference: existing.difference,
          notes: existing.notes,
        }
      : null,
  };
}

export type MonthSummary = {
  income: number;
  wages: number;
  expenses: number;
  net: number;
  dailyNet: { day: number; net: number }[];
  wagesByStaff: { name: string; total: number }[];
  expensesByCategory: { category: string; total: number }[];
  closedDays: number;
  daysInMonth: number;
};

export async function getMonthSummary(
  venueId: number,
  year: number,
  month: number,
): Promise<MonthSummary> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(year, month, 0).getDate();
  const start = `${year}-${pad(month)}-01`;
  const end = `${year}-${pad(month)}-${pad(daysInMonth)}`;

  const [rows, closes] = await Promise.all([
    db
      .select({
        entryDate: ledger.entryDate,
        type: ledger.type,
        category: ledger.category,
        amount: ledger.amount,
        qty: ledger.qty,
        staffName: staff.name,
      })
      .from(ledger)
      .leftJoin(staff, eq(ledger.staffId, staff.id))
      .where(
        and(
          eq(ledger.venueId, venueId),
          gte(ledger.entryDate, start),
          lte(ledger.entryDate, end),
        ),
      ),
    db
      .select({ closeDate: dayCloses.closeDate })
      .from(dayCloses)
      .where(
        and(
          eq(dayCloses.venueId, venueId),
          gte(dayCloses.closeDate, start),
          lte(dayCloses.closeDate, end),
        ),
      ),
  ]);

  let income = 0;
  let wages = 0;
  let expenses = 0;
  const dailyNet = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    net: 0,
  }));
  const wagesByStaff = new Map<string, number>();
  const expensesByCategory = new Map<string, number>();

  for (const r of rows) {
    const t = r.amount * r.qty;
    const day = Number(r.entryDate.slice(8, 10));
    const cell = dailyNet[day - 1];
    if (r.type === "income") {
      income += t;
      if (cell) cell.net += t;
    } else if (r.type === "wage") {
      wages += t;
      if (cell) cell.net -= t;
      const name = r.staffName ?? "სხვა";
      wagesByStaff.set(name, (wagesByStaff.get(name) ?? 0) + t);
    } else {
      expenses += t;
      if (cell) cell.net -= t;
      const cat = r.category ?? "სხვა";
      expensesByCategory.set(cat, (expensesByCategory.get(cat) ?? 0) + t);
    }
  }

  return {
    income,
    wages,
    expenses,
    net: income - wages - expenses,
    dailyNet,
    wagesByStaff: [...wagesByStaff.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total),
    expensesByCategory: [...expensesByCategory.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    closedDays: closes.length,
    daysInMonth,
  };
}

// ---------- forecast / business model ----------

export type ForecastData = {
  params: ModelParams;
  monthlyFixed: number;
  hasSavedParams: boolean;
  suggestions: {
    avgGuests: number | null;
    avgPrice: number | null;
    bookingsCount: number;
    avgFoodCostPerGuest: number | null;
  };
};

export async function getForecastData(venueId: number): Promise<ForecastData> {
  const [settingRows, fixedRows, bookingAgg, dishCosts] = await Promise.all([
    db.select().from(settings).where(eq(settings.venueId, venueId)),
    db
      .select({
        total: sql<number>`coalesce(sum(${fixedCosts.monthlyAmount}), 0)::float`,
      })
      .from(fixedCosts)
      .where(and(eq(fixedCosts.venueId, venueId), eq(fixedCosts.active, true))),
    db
      .select({
        avgGuests: sql<number>`avg(${bookings.guestCount})::float`,
        avgPrice: sql<number>`avg(nullif(${bookings.pricePerGuest}, 0))::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.venueId, venueId),
          sql`${bookings.status} <> 'cancelled'`,
        ),
      ),
    // per-dish recipe cost, averaged in JS as a rough food-cost proxy
    db
      .select({
        cost: sql<number>`coalesce(sum(${dishIngredients.qty} / 1000.0 * ${ingredients.pricePerUnit} * (1 + ${ingredients.wastePct} / 100.0)), 0)::float`,
      })
      .from(dishIngredients)
      .innerJoin(dishes, eq(dishes.id, dishIngredients.dishId))
      .innerJoin(ingredients, eq(ingredients.id, dishIngredients.ingredientId))
      .where(eq(dishes.venueId, venueId))
      .groupBy(dishIngredients.dishId),
  ]);

  const map = new Map(settingRows.map((s) => [s.key, s.value]));
  const hasSavedParams = PARAM_KEYS.some((k) => map.has(k));

  const avgDishCost = dishCosts.length
    ? dishCosts.reduce((s, d) => s + d.cost, 0) / dishCosts.length
    : null;

  const agg = bookingAgg[0];
  const suggestions = {
    avgGuests: agg?.avgGuests ? Math.round(agg.avgGuests) : null,
    avgPrice: agg?.avgPrice ? Math.round(agg.avgPrice) : null,
    bookingsCount: agg?.count ?? 0,
    avgFoodCostPerGuest: avgDishCost != null ? Math.round(avgDishCost) : null,
  };

  const num = (k: keyof ModelParams, def: number) =>
    map.has(k) ? Number(map.get(k)) : def;

  const params: ModelParams = {
    eventsPerMonth: num("eventsPerMonth", 4),
    avgGuests: num("avgGuests", suggestions.avgGuests ?? 150),
    pricePerGuest: num("pricePerGuest", suggestions.avgPrice ?? 80),
    foodCostPerGuest: num("foodCostPerGuest", suggestions.avgFoodCostPerGuest ?? 25),
    serviceCostPerEvent: num("serviceCostPerEvent", 0),
  };

  return {
    params,
    monthlyFixed: fixedRows[0]?.total ?? 0,
    hasSavedParams,
    suggestions,
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
